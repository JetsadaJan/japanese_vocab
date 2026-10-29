#!/usr/bin/env python3
"""
Batch Vocabulary Translation Assistant (translate_batch.py)
Translates Japanese candidate vocabulary in batches of 100 words (or custom N),
utilizing:
1. Reference Kanji Data (davidluzgouveia/kanji-data + curated Thai meanings)
2. Curated JLPT N1-N5 Translation Memory (8,648 pairs)
3. Automated Translation Bridge with multi-tier validation
4. Pre-classified Part of Speech & Predicted JLPT Level
5. Direct ACID ingestion into backend_data/vocab_master.db & candidate_vocab_master.csv

Usage:
  # 1. Prepare next 100 words with full Kanji breakdown & reference hints:
  python3 scripts/translate_batch.py prepare 100 --out todo_100.json

  # 2. Filter by predicted level (e.g. 100 words of N3):
  python3 scripts/translate_batch.py prepare 100 --level N3 --out todo_n3.json

  # 3. Automatically draft translations for 100 words (dry-run review mode):
  python3 scripts/translate_batch.py auto 100 --out draft_100.json

  # 4. Automatically draft, validate, and commit 100 words into database:
  python3 scripts/translate_batch.py auto 100 --commit

  # 5. Commit a reviewed JSON file of translations into database:
  python3 scripts/translate_batch.py commit draft_100.json

  # 6. Deep inspect a single Japanese word:
  python3 scripts/translate_batch.py inspect "合宿"
"""

from __future__ import annotations
import argparse
import csv
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend_data")
REF_DIR = os.path.join(BACKEND_DIR, "reference")
DB_PATH = os.path.join(BACKEND_DIR, "vocab_master.db")
CSV_PATH = os.path.join(BACKEND_DIR, "candidate_vocab_master.csv")
REF_INDEX_PATH = os.path.join(REF_DIR, "thai_reference_index.json")

THAI_CHAR_RE = re.compile(r"[\u0E00-\u0E7F]")
KANJI_CHAR_RE = re.compile(r"[\u4E00-\u9FAF]")

_REF_DATA: Optional[Dict[str, Any]] = None


def get_reference_data() -> Dict[str, Any]:
    global _REF_DATA
    if _REF_DATA is not None:
        return _REF_DATA

    if not os.path.exists(REF_INDEX_PATH):
        print(f"Reference index not found at {REF_INDEX_PATH}.")
        return {"kanji_dict": {}, "vocab_memory": {}}

    with open(REF_INDEX_PATH, "r", encoding="utf-8") as f:
        _REF_DATA = json.load(f)
    return _REF_DATA


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def query_translation_bridge(text: str) -> str:
    """Queries free translation endpoint for draft Thai gloss with graceful fallback."""
    url = (
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=th&dt=t&q="
        + urllib.parse.quote(text)
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            data = json.loads(res.read().decode("utf-8"))
            result = "".join([part[0] for part in data[0] if part[0]]).strip()
            return result
    except Exception:
        return ""


def get_kanji_breakdown(expression: str) -> List[Dict[str, Any]]:
    ref = get_reference_data()
    k_dict = ref.get("kanji_dict", {})
    breakdown = []
    for ch in expression:
        if KANJI_CHAR_RE.match(ch):
            info = k_dict.get(ch, {})
            breakdown.append({
                "kanji": ch,
                "meaning_th": info.get("meaning_th", ""),
                "meanings_en": info.get("meanings_en", []),
                "jlpt": info.get("jlpt"),
                "readings_on": info.get("readings_on", []),
                "readings_kun": info.get("readings_kun", [])
            })
    return breakdown


def get_vocab_memory_hint(expression: str) -> Optional[Dict[str, Any]]:
    ref = get_reference_data()
    v_mem = ref.get("vocab_memory", {})
    if expression in v_mem:
        return v_mem[expression]
    for k, v in v_mem.items():
        if len(k) >= 2 and (expression.startswith(k) or expression.endswith(k)):
            return {"match_type": "partial", "root": k, "root_th": v["th"], "root_en": v.get("en", "")}
    return None


def fetch_pending_words(limit: int = 100, level: Optional[str] = None, category: Optional[str] = None, chunk_id: Optional[str] = None, batch_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cur = conn.cursor()

    conditions = ["translation_status = 'pending'"]
    params: List[Any] = []

    if level:
        conditions.append("predicted_level = ?")
        params.append(level.upper())

    if category:
        conditions.append("category = ?")
        params.append(category.upper())

    if chunk_id:
        c_str = f"CHUNK_{int(chunk_id):04d}" if str(chunk_id).isdigit() else chunk_id.upper()
        conditions.append("chunk_100_id = ?")
        params.append(c_str)

    if batch_id:
        b_str = f"BATCH_{int(batch_id):03d}" if str(batch_id).isdigit() else batch_id.upper()
        conditions.append("batch_id = ?")
        params.append(b_str)

    where_sql = "WHERE " + " AND ".join(conditions)
    query = f"""
        SELECT priority_rank, batch_id, chunk_100_id, expression, reading,
               category, predicted_level, meaning_en,
               sources_count, best_frequency_rank, sources
        FROM words
        {where_sql}
        ORDER BY priority_rank ASC
        LIMIT ?
    """
    params.append(limit)

    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def build_word_dossier(row: Dict[str, Any], include_auto_bridge: bool = True) -> Dict[str, Any]:
    expr = row["expression"]
    reading = row["reading"]
    cat = row.get("category", "NOUN")
    lvl = row.get("predicted_level", "N3")
    default_en = row.get("meaning_en", "")

    kanji_breakdown = get_kanji_breakdown(expr)
    vocab_memory = get_vocab_memory_hint(expr)

    suggested_th = ""
    suggested_en = default_en

    if not suggested_en and kanji_breakdown:
        en_parts = []
        for k in kanji_breakdown:
            if k["meanings_en"]:
                en_parts.append(k["meanings_en"][0])
        if en_parts:
            suggested_en = ", ".join(en_parts)

    if cat == "VERB" and suggested_en and not suggested_en.lower().startswith("to "):
        suggested_en = "to " + suggested_en

    # Fix common category misclassifications for compound verbs
    common_verb_endings = ("歩く", "分ける", "ずる", "会う", "止める", "開く", "入る", "ける", "む", "える", "つく", "直す", "出す", "込む", "立つ", "通す", "過す", "起こす", "落とす", "下ろす")
    if cat == "NOUN" and expr.endswith(common_verb_endings):
        cat = "VERB"

    # Automated translation bridge
    if include_auto_bridge:
        auto_th = query_translation_bridge(expr)
        if auto_th:
            suggested_th = auto_th

    # Only fallback to single-kanji meaning if it is a 1-character kanji word.
    # NEVER concatenate multiple kanji meanings for compound words!
    if not suggested_th and len(kanji_breakdown) == 1:
        suggested_th = kanji_breakdown[0].get("meaning_th", "")

    return {
        "priority_rank": row["priority_rank"],
        "batch_id": row["batch_id"],
        "chunk_100_id": row["chunk_100_id"],
        "expression": expr,
        "reading": reading,
        "category": cat,
        "predicted_level": lvl,
        "meaning_th": suggested_th,
        "meaning_en": suggested_en,
        "sources_count": row["sources_count"],
        "best_frequency_rank": row["best_frequency_rank"],
        "sources": row["sources"],
        "kanji_breakdown": kanji_breakdown,
        "memory_hint": vocab_memory
    }


def commit_translations(items: List[Dict[str, Any]]) -> Tuple[int, List[str]]:
    valid_items = []
    errors = []

    for idx, item in enumerate(items):
        rank = item.get("priority_rank") or item.get("rank")
        expr = item.get("expression", "")
        th = item.get("meaning_th", "").strip()
        en = item.get("meaning_en", "").strip()
        cat = item.get("category", "").strip()

        if not rank and not expr:
            errors.append(f"Row {idx}: missing both rank and expression")
            continue
        if not th:
            errors.append(f"Row {idx} ({expr or rank}): empty meaning_th")
            continue
        if not THAI_CHAR_RE.search(th):
            errors.append(f"Row {idx} ({expr or rank}): meaning_th must contain Thai script ('{th}')")
            continue

        if cat == "VERB" and en and not en.lower().startswith("to "):
            en = "to " + en

        valid_items.append({
            "rank": int(rank) if rank else None,
            "expression": expr,
            "meaning_th": th,
            "meaning_en": en
        })

    if not valid_items:
        return 0, errors

    conn = get_db_connection()
    cur = conn.cursor()
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    updated = 0

    for it in valid_items:
        if it["rank"]:
            cur.execute("""
                UPDATE words
                SET meaning_th = ?, meaning_en = COALESCE(NULLIF(?, ''), meaning_en),
                    translation_status = 'translated', translated_at = ?
                WHERE priority_rank = ?
            """, (it["meaning_th"], it["meaning_en"], now_iso, it["rank"]))
        else:
            cur.execute("""
                UPDATE words
                SET meaning_th = ?, meaning_en = COALESCE(NULLIF(?, ''), meaning_en),
                    translation_status = 'translated', translated_at = ?
                WHERE expression = ?
            """, (it["meaning_th"], it["meaning_en"], now_iso, it["expression"]))
        if cur.rowcount > 0:
            updated += cur.rowcount

    conn.commit()
    conn.close()

    # Sync to CSV
    from scripts.vocab_tool import sync_db_to_csv
    sync_db_to_csv()
    return updated, errors


# --- CLI Commands ---

def cmd_prepare(args):
    limit = args.limit or 100
    rows = fetch_pending_words(limit=limit, level=args.level, category=args.category, chunk_id=args.chunk, batch_id=args.batch)
    if not rows:
        print("No pending words found matching criteria.")
        return

    print(f"Preparing translation dossier for {len(rows)} words...")
    dossier = [build_word_dossier(r, include_auto_bridge=False) for r in rows]

    out_file = args.out or os.path.join(BACKEND_DIR, f"batch_prepare_{len(rows)}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(dossier, f, ensure_ascii=False, indent=2)

    print(f"Successfully prepared {len(dossier)} words with Kanji breakdown & reference hints!")
    print(f"Saved to: {os.path.relpath(out_file, PROJECT_ROOT)}")


def cmd_auto(args):
    limit = args.limit or 100
    rows = fetch_pending_words(limit=limit, level=args.level, category=args.category, chunk_id=args.chunk, batch_id=args.batch)
    if not rows:
        print("No pending words found matching criteria.")
        return

    print(f"Auto-drafting translations for {len(rows)} words using reference memory & translation bridge...")
    translated_items = []
    for i, r in enumerate(rows, 1):
        dossier = build_word_dossier(r, include_auto_bridge=True)
        translated_items.append(dossier)
        if i % 10 == 0 or i == len(rows):
            print(f"  [{i}/{len(rows)}] [{dossier['predicted_level']}] {r['expression']} ({r['reading']}) [{dossier['category']}] -> {dossier['meaning_th']}")

    out_file = args.out or os.path.join(BACKEND_DIR, f"batch_draft_{len(rows)}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(translated_items, f, ensure_ascii=False, indent=2)

    print(f"\nDraft complete for {len(translated_items)} words. Saved to {os.path.relpath(out_file, PROJECT_ROOT)}")

    if args.commit:
        print("Committing translations into database & master CSV...")
        updated, errors = commit_translations(translated_items)
        if errors:
            print(f"Warning: {len(errors)} errors encountered:")
            for e in errors[:5]:
                print(f"  - {e}")
        print(f"Successfully committed {updated} translated words into database!")
    else:
        print("To commit these translations, run:")
        print(f"  python3 scripts/translate_batch.py commit {os.path.relpath(out_file, PROJECT_ROOT)}")


def cmd_commit(args):
    file_path = args.file
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        sys.exit(1)

    with open(file_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    if not isinstance(items, list) or len(items) == 0:
        print("Error: JSON must be a list of translation items.")
        sys.exit(1)

    print(f"Validating and committing {len(items)} translations from {file_path}...")
    updated, errors = commit_translations(items)
    if errors:
        print(f"Validation warnings ({len(errors)}):")
        for e in errors[:10]:
            print(f"  - {e}")

    print(f"Successfully committed {updated} translations into database and master CSV!")


def cmd_inspect(args):
    query = args.query.strip()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT priority_rank, batch_id, chunk_100_id, expression, reading,
               category, predicted_level, meaning_en,
               sources_count, best_frequency_rank, sources
        FROM words
        WHERE expression = ? OR reading = ?
        LIMIT 1
    """, (query, query))
    r = cur.fetchone()
    conn.close()

    if not r:
        print(f"Word '{query}' not found in candidate database.")
        ref = get_reference_data()
        k_dict = ref.get("kanji_dict", {})
        if query in k_dict:
            k = k_dict[query]
            print(f"\nKanji Reference Lookup for '{query}':")
            print(f"  Strokes: {k['strokes']}, Grade: {k['grade']}, JLPT: N{k['jlpt']}")
            print(f"  Thai Meaning: {k['meaning_th'] or '(none)'}")
            print(f"  English Meanings: {', '.join(k['meanings_en'])}")
            print(f"  On Readings: {', '.join(k['readings_on'])}")
            print(f"  Kun Readings: {', '.join(k['readings_kun'])}\n")
        return

    row_dict = dict(r)
    dossier = build_word_dossier(row_dict, include_auto_bridge=True)

    print("\n" + "=" * 65)
    print(f"  Word Dossier: {dossier['expression']} ({dossier['reading']})")
    print("=" * 65)
    print(f"Priority Rank   : {dossier['priority_rank']} ({dossier['batch_id']} / {dossier['chunk_100_id']})")
    print(f"Category (POS)  : {dossier['category']}")
    print(f"Predicted Level : {dossier['predicted_level']}")
    print(f"Draft Thai      : {dossier['meaning_th']}")
    print(f"Draft English   : {dossier['meaning_en']}")

    if dossier["kanji_breakdown"]:
        print("\n--- Kanji Breakdown ---")
        for k in dossier["kanji_breakdown"]:
            th = k["meaning_th"] if k["meaning_th"] else "-"
            en = ", ".join(k["meanings_en"][:3]) if k["meanings_en"] else "-"
            print(f"  Kanji '{k['kanji']}': Thai=[{th}] | En=[{en}] | On={k['readings_on']} | Kun={k['readings_kun']}")

    if dossier["memory_hint"]:
        print(f"\n--- Translation Memory Match ---\n  {dossier['memory_hint']}")
    print("=" * 65 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Batch Vocabulary Translation Assistant")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # prepare
    prep_p = subparsers.add_parser("prepare", help="Prepare next N words with Kanji breakdown and reference hints")
    prep_p.add_argument("limit", type=int, nargs="?", default=100, help="Number of words (default 100)")
    prep_p.add_argument("--level", type=str, choices=["N5", "N4", "N3", "N2", "N1"], help="Filter by predicted JLPT level")
    prep_p.add_argument("--category", type=str, help="Filter by category (NOUN, VERB, ADJECTIVE, LOANWORD)")
    prep_p.add_argument("--chunk", type=str, help="Chunk ID (e.g. 1)")
    prep_p.add_argument("--batch", type=str, help="Batch ID (e.g. 1)")
    prep_p.add_argument("--out", type=str, help="Output JSON path")

    # auto
    auto_p = subparsers.add_parser("auto", help="Auto-draft translations for next N words")
    auto_p.add_argument("limit", type=int, nargs="?", default=100, help="Number of words (default 100)")
    auto_p.add_argument("--level", type=str, choices=["N5", "N4", "N3", "N2", "N1"], help="Filter by predicted JLPT level")
    auto_p.add_argument("--category", type=str, help="Filter by category (NOUN, VERB, ADJECTIVE, LOANWORD)")
    auto_p.add_argument("--chunk", type=str, help="Chunk ID (e.g. 1)")
    auto_p.add_argument("--batch", type=str, help="Batch ID (e.g. 1)")
    auto_p.add_argument("--out", type=str, help="Output JSON path")
    auto_p.add_argument("--commit", action="store_true", help="Directly commit into database & master CSV")

    # commit
    com_p = subparsers.add_parser("commit", help="Commit reviewed JSON translations into database")
    com_p.add_argument("file", type=str, help="Path to JSON file with translations")

    # inspect
    ins_p = subparsers.add_parser("inspect", help="Inspect a Japanese word with Kanji breakdown")
    ins_p.add_argument("query", type=str, help="Japanese word or kanji to inspect")

    args = parser.parse_args()

    if args.command == "prepare":
        cmd_prepare(args)
    elif args.command == "auto":
        cmd_auto(args)
    elif args.command == "commit":
        cmd_commit(args)
    elif args.command == "inspect":
        cmd_inspect(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
