#!/usr/bin/env python3
"""
Japanese Vocabulary Pipeline & Translation Manager (vocab_tool.py)
Designed specifically for AI Agent & automated workflows to fetch, translate,
validate, and manage candidate Japanese vocabulary in slices of 100 to 1,000 words.

Backend Data Architecture:
- SQLite Database: backend_data/vocab_master.db (Sub-millisecond queries, indexed by rank, batch, chunk, level, category, status)
- Master CSV File: backend_data/candidate_vocab_master.csv (Synchronized readable master file)

Quick Agent Usage Examples:
  # 1. Fetch next 100 pending words as JSON for translation:
  python3 scripts/vocab_tool.py fetch 100

  # 2. Fetch next 500 words and save to a JSON workfile:
  python3 scripts/vocab_tool.py fetch 500 --file todo_500.json

  # 3. Fetch a specific 100-word chunk (e.g. Chunk 1: ranks 1-100):
  python3 scripts/vocab_tool.py fetch --chunk 1

  # 4. Fetch words filtered by predicted JLPT level (e.g. N3):
  python3 scripts/vocab_tool.py fetch 100 --level N3

  # 5. Submit translated words with automatic Thai validation:
  python3 scripts/vocab_tool.py submit translations.json

  # 6. Check overall translation progress & level distribution:
  python3 scripts/vocab_tool.py stats

  # 7. Search candidate words:
  python3 scripts/vocab_tool.py search "合宿"

  # 8. Export translated words directly into public/data/n{1..5}.csv:
  python3 scripts/vocab_tool.py export-to-app --to-jlpt
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
from typing import Any, Dict, List, Optional

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend_data")
DB_PATH = os.path.join(BACKEND_DIR, "vocab_master.db")
CSV_PATH = os.path.join(BACKEND_DIR, "candidate_vocab_master.csv")

THAI_CHAR_RE = re.compile(r"[\u0E00-\u0E7F]")


def get_db_connection() -> sqlite3.Connection:
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}.")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def sync_db_to_csv():
    """Exports SQLite DB contents to candidate_vocab_master.csv."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT batch_id, priority_rank, expression, reading, meaning_th, meaning_en,
               category, predicted_level, translation_status, sources_count,
               best_frequency_rank, sources
        FROM words ORDER BY priority_rank ASC
    """)
    rows = cur.fetchall()
    conn.close()

    temp_csv = CSV_PATH + ".tmp"
    fieldnames = [
        "batch_id", "priority_rank", "expression", "reading",
        "meaning_th", "meaning_en", "category", "predicted_level",
        "translation_status", "sources_count", "best_frequency_rank", "sources"
    ]

    with open(temp_csv, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(fieldnames)
        for r in rows:
            writer.writerow([
                r["batch_id"],
                r["priority_rank"],
                r["expression"],
                r["reading"],
                r["meaning_th"],
                r["meaning_en"],
                r["category"],
                r["predicted_level"],
                r["translation_status"],
                r["sources_count"],
                r["best_frequency_rank"] if r["best_frequency_rank"] is not None else "",
                r["sources"]
            ])

    os.replace(temp_csv, CSV_PATH)


def cmd_stats(args):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM words")
    total = cur.fetchone()[0]

    cur.execute("SELECT translation_status, COUNT(*) FROM words GROUP BY translation_status")
    status_counts = dict(cur.fetchall())

    cur.execute("SELECT predicted_level, COUNT(*) FROM words GROUP BY predicted_level ORDER BY predicted_level ASC")
    level_counts = dict(cur.fetchall())

    cur.execute("SELECT category, COUNT(*) FROM words GROUP BY category ORDER BY COUNT(*) DESC")
    category_counts = dict(cur.fetchall())

    cur.execute("SELECT sources_count, COUNT(*) FROM words GROUP BY sources_count ORDER BY sources_count DESC")
    source_counts = dict(cur.fetchall())

    cur.execute("SELECT MAX(priority_rank) FROM words")
    max_rank = cur.fetchone()[0]

    cur.execute("""
        SELECT batch_id, COUNT(*) as total_in_batch,
               SUM(CASE WHEN translation_status = 'translated' THEN 1 ELSE 0 END) as translated_in_batch
        FROM words
        GROUP BY batch_id
        HAVING translated_in_batch > 0
        ORDER BY batch_id ASC
        LIMIT 10
    """)
    active_batches = cur.fetchall()

    conn.close()

    translated = status_counts.get("translated", 0)
    pending = status_counts.get("pending", 0)

    print("\n" + "=" * 65)
    print("      Japanese Candidate Vocabulary Master - Summary Stats      ")
    print("=" * 65)
    print(f"Total Words in Database : {total:,}")
    print(f"Total 1,000-Word Batches: {(max_rank - 1) // 1000 + 1} (BATCH_001 to BATCH_{(max_rank - 1) // 1000 + 1:03d})")
    print(f"Total 100-Word Chunks   : {(max_rank - 1) // 100 + 1} (CHUNK_0001 to CHUNK_{(max_rank - 1) // 100 + 1:04d})")

    print("\n--- Translation Progress ---")
    print(f"  Pending    : {pending:,} ({pending/total*100:.2f}%)")
    print(f"  Translated : {translated:,} ({translated/total*100:.2f}%)")

    print("\n--- Predicted JLPT Level Distribution ---")
    for lvl in ["N5", "N4", "N3", "N2", "N1"]:
        c = level_counts.get(lvl, 0)
        print(f"  {lvl} : {c:,} ({c/total*100:.1f}%)")

    print("\n--- Word Categories (POS) ---")
    for cat, c in category_counts.items():
        print(f"  {cat:<16}: {c:,} ({c/total*100:.1f}%)")

    if active_batches:
        print("\n--- Active Batches with Translations ---")
        for b in active_batches:
            pct = b["translated_in_batch"] / b["total_in_batch"] * 100
            print(f"  {b['batch_id']}: {b['translated_in_batch']}/{b['total_in_batch']} translated ({pct:.1f}%)")

    print("\n--- Source Agreement Breakdown ---")
    print(f"  3 sources (CEJC + Jiten + Wiktionary) : {source_counts.get(3, 0):,} words (Highest confidence)")
    print(f"  2 sources (Corpus consensus)           : {source_counts.get(2, 0):,} words")
    print(f"  1 source  (Frequency list)             : {source_counts.get(1, 0):,} words")
    print("=" * 65 + "\n")


def cmd_fetch(args):
    """Fetches candidate words for translation."""
    conn = get_db_connection()
    cur = conn.cursor()

    limit = args.limit or 100
    status = args.status or "pending"

    conditions = []
    params: List[Any] = []

    if status != "all":
        conditions.append("translation_status = ?")
        params.append(status)

    if args.level:
        conditions.append("predicted_level = ?")
        params.append(args.level.upper())

    if args.category:
        conditions.append("category = ?")
        params.append(args.category.upper())

    if args.batch:
        batch_id = f"BATCH_{int(args.batch):03d}" if str(args.batch).isdigit() else args.batch.upper()
        conditions.append("batch_id = ?")
        params.append(batch_id)

    if args.chunk:
        chunk_id = f"CHUNK_{int(args.chunk):04d}" if str(args.chunk).isdigit() else args.chunk.upper()
        conditions.append("chunk_100_id = ?")
        params.append(chunk_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"""
        SELECT priority_rank, batch_id, chunk_100_id, expression, reading,
               meaning_th, meaning_en, category, predicted_level,
               translation_status, sources_count, sources
        FROM words
        {where_clause}
        ORDER BY priority_rank ASC
        LIMIT ?
    """
    params.append(limit)

    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    if not rows:
        print(f"No words found matching criteria.")
        return

    out_format = args.format or ("json" if args.file else "table")
    output_str = ""

    if out_format == "json":
        output_str = json.dumps(rows, ensure_ascii=False, indent=2)
    elif out_format == "table":
        header = f"{'Rank':<6} {'Word':<12} {'Reading':<12} {'Category':<14} {'Lvl':<5} {'Status':<10} {'English Gloss'}"
        sep = "-" * 80
        lines = [header, sep]
        for r in rows:
            gloss = r["meaning_en"][:30] if r["meaning_en"] else "-"
            lines.append(f"{r['priority_rank']:<6} {r['expression']:<12} {r['reading']:<12} {r['category']:<14} {r['predicted_level']:<5} {r['translation_status']:<10} {gloss}")
        output_str = "\n".join(lines)
    elif out_format in ("tsv", "csv"):
        import io
        buf = io.StringIO()
        delim = "\t" if out_format == "tsv" else ","
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), delimiter=delim)
        writer.writeheader()
        writer.writerows(rows)
        output_str = buf.getvalue()

    if args.file:
        with open(args.file, "w", encoding="utf-8") as f:
            f.write(output_str)
        print(f"Fetched {len(rows)} words and saved to: {args.file}")
    else:
        print(output_str)


def cmd_submit(args):
    """Submits translations and validates them."""
    items = []
    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: File not found: {args.file}")
            sys.exit(1)
        with open(args.file, "r", encoding="utf-8") as f:
            if args.file.endswith(".json"):
                items = json.load(f)
            else:
                reader = csv.DictReader(f)
                items = list(reader)
    elif args.json:
        items = json.loads(args.json)
    else:
        print("Error: Must provide translation data via --file <path> or --json '<json_string>'")
        sys.exit(1)

    if not isinstance(items, list) or len(items) == 0:
        print("Error: Input must be a non-empty list of translation items.")
        sys.exit(1)

    valid_items = []
    errors = []
    for idx, item in enumerate(items):
        expr = item.get("expression", "").strip()
        meaning_th = item.get("meaning_th", "").strip()
        meaning_en = item.get("meaning_en", "").strip()
        category = item.get("category", "").strip()
        rank = item.get("priority_rank") or item.get("rank")

        if not expr and not rank:
            errors.append(f"Row {idx}: Missing both 'expression' and 'priority_rank'")
            continue

        if not meaning_th:
            errors.append(f"Row {idx} ({expr or rank}): Empty 'meaning_th'")
            continue

        if not THAI_CHAR_RE.search(meaning_th):
            errors.append(f"Row {idx} ({expr or rank}): 'meaning_th' must contain Thai characters: '{meaning_th}'")
            continue

        # Format verb English gloss with 'to '
        if category == "VERB" and meaning_en and not meaning_en.lower().startswith("to "):
            meaning_en = "to " + meaning_en

        valid_items.append({
            "expression": expr,
            "rank": int(rank) if rank else None,
            "meaning_th": meaning_th,
            "meaning_en": meaning_en
        })

    if errors:
        print(f"Validation Warning: Found {len(errors)} invalid items:")
        for e in errors[:10]:
            print(f"  - {e}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more.")
        if not args.force and len(valid_items) == 0:
            print("Aborting. No valid items to import.")
            sys.exit(1)

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

    sync_db_to_csv()
    print(f"\nSuccessfully submitted & validated {updated} translations!")
    print(f"Database and {os.path.relpath(CSV_PATH, PROJECT_ROOT)} are in sync.")


def cmd_search(args):
    query = args.query.strip()
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT priority_rank, batch_id, chunk_100_id, expression, reading,
               category, predicted_level, meaning_th, meaning_en, translation_status
        FROM words
        WHERE expression = ? OR reading = ? OR expression LIKE ?
        ORDER BY priority_rank ASC
        LIMIT 25
    """, (query, query, f"%{query}%"))
    rows = cur.fetchall()
    conn.close()

    if not rows:
        print(f"No candidate words found matching: '{query}'")
        return

    print(f"\nFound {len(rows)} matching candidate words:")
    print(f"{'Rank':<6} {'Word':<12} {'Reading':<12} {'Category':<14} {'Lvl':<5} {'Status':<10} {'Thai Meaning'}")
    print("-" * 80)
    for r in rows:
        th = r["meaning_th"] if r["meaning_th"] else "-"
        print(f"{r['priority_rank']:<6} {r['expression']:<12} {r['reading']:<12} {r['category']:<14} {r['predicted_level']:<5} {r['translation_status']:<10} {th}")
    print()


def cmd_export_to_app(args):
    """Exports approved words directly into public/data/n{1..5}.csv with auto-backup and sanity gate."""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT expression, reading, meaning_en, category, predicted_level, meaning_th, priority_rank
        FROM words
        WHERE translation_status = 'approved'
        ORDER BY priority_rank ASC
    """)
    rows = cur.fetchall()

    if not rows:
        print("No approved words found to export. (Review words in Human Recheck at http://localhost:5174/ first)")
        conn.close()
        return

    # Load existing expressions to prevent duplicates across all levels
    existing_all = set()
    public_data_dir = os.path.join(PROJECT_ROOT, "public", "data")
    for lvl_file in glob.glob(os.path.join(public_data_dir, "n*.csv")):
        with open(lvl_file, "r", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                existing_all.add(r["expression"].strip())

    # Pre-Export Sanity Gate
    valid_words = []
    skipped = []
    thai_char_re = re.compile(r"[\u0E00-\u0E7F]")

    for w in rows:
        expr = w["expression"].strip()
        meaning_th = (w["meaning_th"] or "").strip()
        meaning_en = (w["meaning_en"] or "").strip()
        category = w["category"]

        if not meaning_th or not thai_char_re.search(meaning_th):
            skipped.append((expr, "No valid Thai meaning"))
            continue
        if expr in existing_all:
            skipped.append((expr, "Already exists in main vocabulary"))
            continue
        if category == "VERB" or expr.endswith("する"):
            if not meaning_en.lower().startswith("to "):
                meaning_en = "to " + meaning_en

        valid_words.append({
            "priority_rank": w["priority_rank"],
            "expression": expr,
            "reading": w["reading"].strip(),
            "meaning_en": meaning_en,
            "meaning_th": meaning_th,
            "category": category,
            "predicted_level": w["predicted_level"]
        })
        existing_all.add(expr)

    if not valid_words:
        print("No words passed the sanity gate check.")
        for expr, reason in skipped:
            print(f"  Skipped {expr}: {reason}")
        conn.close()
        return

    # Auto-Backup snapshot
    import shutil
    now_str = time.strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(public_data_dir, "backups", f"backup_{now_str}")
    os.makedirs(backup_dir, exist_ok=True)
    for lvl_num in range(1, 6):
        src_csv = os.path.join(public_data_dir, f"n{lvl_num}.csv")
        if os.path.exists(src_csv):
            shutil.copy2(src_csv, os.path.join(backup_dir, f"n{lvl_num}.csv"))
    print(f"Created automated backup at: {os.path.relpath(backup_dir, PROJECT_ROOT)}")

    # Append to CSVs by level
    by_level: Dict[str, List[Dict[str, Any]]] = {"N1": [], "N2": [], "N3": [], "N4": [], "N5": []}
    exported_ranks = []
    for w in valid_words:
        lvl = w["predicted_level"]
        if lvl in by_level:
            by_level[lvl].append(w)
            exported_ranks.append(w["priority_rank"])

    total_exported = 0
    for lvl, word_list in by_level.items():
        if not word_list:
            continue
        csv_file = os.path.join(public_data_dir, f"{lvl.lower()}.csv")
        added = 0
        with open(csv_file, "a", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            for w in word_list:
                writer.writerow([
                    w["expression"],
                    w["reading"],
                    w["meaning_en"],
                    f"JLPT_{lvl} Candidate_Approved",
                    w["meaning_th"]
                ])
                added += 1
        total_exported += added
        print(f"Appended {added} words to {os.path.relpath(csv_file, PROJECT_ROOT)} (Level {lvl})")

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    cur.executemany("""
        UPDATE words
        SET translation_status = 'exported',
            exported_at = ?
        WHERE priority_rank = ?
    """, [(now_iso, rank) for rank in exported_ranks])

    cur.execute("""
        CREATE TABLE IF NOT EXISTS export_history (
            export_id INTEGER PRIMARY KEY AUTOINCREMENT,
            backup_dir TEXT NOT NULL,
            exported_words_count INTEGER NOT NULL,
            exported_at TEXT NOT NULL,
            ranks_json TEXT NOT NULL
        )
    """)
    cur.execute("""
        INSERT INTO export_history (backup_dir, exported_words_count, exported_at, ranks_json)
        VALUES (?, ?, ?, ?)
    """, (backup_dir, total_exported, now_iso, json.dumps(exported_ranks)))

    conn.commit()
    conn.close()

    sync_db_to_csv()
    print(f"\nSuccessfully graduated {total_exported} words into public/data/n*.csv!")
    if skipped:
        print(f"Note: {len(skipped)} words were skipped during sanity gate check:")
        for expr, reason in skipped:
            print(f"  - {expr}: {reason}")


def cmd_rollback(args):
    """Rolls back the latest export to public/data/n*.csv using the backup snapshot."""
    import shutil
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM export_history ORDER BY export_id DESC LIMIT 1")
    last_export = cur.fetchone()

    if not last_export:
        print("No export history found to rollback.")
        conn.close()
        return

    backup_dir = last_export["backup_dir"]
    ranks = json.loads(last_export["ranks_json"])
    public_data_dir = os.path.join(PROJECT_ROOT, "public", "data")

    if not os.path.exists(backup_dir):
        print(f"Error: Backup directory not found at: {backup_dir}")
        conn.close()
        return

    # Restore CSV files from backup snapshot
    for lvl_num in range(1, 6):
        bak_csv = os.path.join(backup_dir, f"n{lvl_num}.csv")
        dest_csv = os.path.join(public_data_dir, f"n{lvl_num}.csv")
        if os.path.exists(bak_csv):
            shutil.copy2(bak_csv, dest_csv)

    # Revert SQLite status for those words back to 'approved'
    cur.executemany("""
        UPDATE words
        SET translation_status = 'approved',
            exported_at = NULL
        WHERE priority_rank = ?
    """, [(r,) for r in ranks])

    cur.execute("DELETE FROM export_history WHERE export_id = ?", (last_export["export_id"],))
    conn.commit()
    conn.close()

    sync_db_to_csv()
    print(f"\nSuccessfully rolled back export #{last_export['export_id']}!")
    print(f"Restored files from: {os.path.relpath(backup_dir, PROJECT_ROOT)}")
    print(f"{len(ranks)} words reverted to 'approved' status in vocab_master.db.")


def main():
    parser = argparse.ArgumentParser(description="Japanese Vocabulary Pipeline & Translation Manager")
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # stats
    subparsers.add_parser("stats", help="Display summary stats, level distribution, and translation progress")

    # fetch
    fetch_parser = subparsers.add_parser("fetch", help="Fetch candidate words for translation")
    fetch_parser.add_argument("limit", type=int, nargs="?", default=100, help="Number of words to fetch (e.g. 100, 500)")
    fetch_parser.add_argument("--level", type=str, choices=["N5", "N4", "N3", "N2", "N1"], help="Filter by predicted JLPT level")
    fetch_parser.add_argument("--category", type=str, help="Filter by category (NOUN, VERB, ADJECTIVE, LOANWORD)")
    fetch_parser.add_argument("--batch", type=str, help="Filter by 1,000-word batch (e.g. 1 or BATCH_001)")
    fetch_parser.add_argument("--chunk", type=str, help="Filter by 100-word chunk (e.g. 1 or CHUNK_0001)")
    fetch_parser.add_argument("--status", type=str, default="pending", help="Filter by status: pending, translated, approved, exported, all")
    fetch_parser.add_argument("--format", choices=["json", "table", "tsv", "csv"], default=None, help="Output format")
    fetch_parser.add_argument("--file", type=str, help="Save fetched output to file")

    # submit
    submit_parser = subparsers.add_parser("submit", help="Submit translated words")
    submit_parser.add_argument("file", nargs="?", type=str, help="Path to JSON or CSV file containing translations")
    submit_parser.add_argument("--json", type=str, help="Inline JSON string of translations")
    submit_parser.add_argument("--force", action="store_true", help="Force import even if some rows fail validation")

    # search
    search_parser = subparsers.add_parser("search", help="Search for a Japanese word")
    search_parser.add_argument("query", type=str, help="Word or reading to search")

    # export-to-app
    export_parser = subparsers.add_parser("export-to-app", help="Export approved words to app format")
    export_parser.add_argument("--to-jlpt", action="store_true", help="Export directly into public/data/n{1..5}.csv based on predicted_level")

    # rollback
    subparsers.add_parser("rollback", help="Rollback the latest export using backup snapshot")

    args = parser.parse_args()

    if args.command == "stats":
        cmd_stats(args)
    elif args.command == "fetch":
        cmd_fetch(args)
    elif args.command == "submit":
        cmd_submit(args)
    elif args.command == "search":
        cmd_search(args)
    elif args.command == "export-to-app":
        cmd_export_to_app(args)
    elif args.command == "rollback":
        cmd_rollback(args)
    else:
        cmd_stats(args)


if __name__ == "__main__":
    main()
