#!/usr/bin/env python3
"""
Lexical Quality Filter, POS Classifier, and JLPT Level Predictor
1. Filters out:
   - Single-mora grammar particles (だ, を, も, へ, etc.)
   - Interjections & conversational sound fillers (あっ, えっ, えー, わあ, etc.)
   - Colloquial contractions & inflected auxiliaries (ちゃう, じゃん, れる, られる)
   - Obscure ateji spellings of grammar particles (出州, 多利, 南乃, 乍ら, etc.)
   - Japanese prefectures and strict proper names (from JMnedict gazetteer)
2. Assigns Part of Speech / Category:
   - NOUN, VERB, ADJECTIVE, LOANWORD, ADVERB_PHRASE, AFFIX
3. Predicts JLPT Level (N5, N4, N3, N2, N1) based on constituent Kanji difficulty & corpus frequency.
4. Populates default English glosses from JMdict.
5. Rebuilds backend_data/candidate_vocab_master.csv and backend_data/vocab_master.db.
"""

from __future__ import annotations
import csv
import json
import os
import re
import sqlite3
import unicodedata
from typing import Dict, List, Set, Tuple

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend_data")
REF_DIR = os.path.join(BACKEND_DIR, "reference")
CSV_PATH = os.path.join(BACKEND_DIR, "candidate_vocab_master.csv")
DB_PATH = os.path.join(BACKEND_DIR, "vocab_master.db")
THAI_REF_PATH = os.path.join(REF_DIR, "thai_reference_index.json")

JMDICT_PATH = os.path.join(REF_DIR, "jmdict-common", "jmdict-eng-common-3.6.2.json")
JMNEDICT_PATH = os.path.join(REF_DIR, "jmnedict-data", "jmnedict-all-3.6.2.json")

KANA_RE = re.compile(r"^[\u3040-\u309F\u30A0-\u30FFー]+$")
KATAKANA_ONLY_RE = re.compile(r"^[\u30A0-\u30FF・ー\s]+$")
KANJI_CHAR_RE = re.compile(r"[\u4E00-\u9FAF]")

# 1. 1-mora kana particles & fragments
KANA_1MORA = set("だをもへぞぜつんてにでとはかよねわさ")

# 2. Interjections & sounds
INTERJECTIONS = {
    "あっ", "えっ", "えー", "わあ", "あー", "はっ", "なあ", "ねえ", "うーん", "おー",
    "へえ", "ふーん", "いやあ", "ほら", "おい", "やあ", "まあ", "よし", "さあ", "はい",
    "いいえ", "うん", "ううん", "うふふ", "きゃー", "ギャー", "わー", "キャー", "ほー",
    "へー", "ふー", "ひえー", "はあ", "ふん", "へん", "ほっ", "ふっ", "ちぇっ", "ええい"
}

# 3. Grammar inflections & contractions
GRAMMAR = {
    "って", "ちゃう", "じゃん", "れる", "られる", "させる", "たり", "多利", "出州",
    "南乃", "乍ら", "小曽", "美日", "奈弥", "ちゃう", "ちゃった", "なきゃ", "てく",
    "てしまう", "ておく", "てみる", "ちゃ", "きゃ"
}

# 4. Obscure ateji of grammar particles
ATEJI_READINGS = {
    "です", "たり", "なの", "ながら", "こそ", "のに", "ので", "から", "けど",
    "たら", "ば", "なら", "まで", "より", "ほど", "ばかり", "だけ", "くらい",
    "など", "かしら", "ぜ", "ぞ", "ね", "よ", "わ", "さ"
}

# 5. Prefectures of Japan
PREFECTURES = {
    "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬",
    "埼玉", "千葉", "東京", "神奈川", "新潟", "富山", "石川", "福井", "山梨", "長野",
    "岐阜", "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
    "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡",
    "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"
}


def load_jmdict_common() -> Dict[str, Dict[str, Any]]:
    print("Loading JMdict Common vocabulary...")
    if not os.path.exists(JMDICT_PATH):
        print(f"JMdict common file not found at {JMDICT_PATH}")
        return {}

    with open(JMDICT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    vocab = {}
    for w in data.get("words", []):
        pos = []
        glosses = []
        for s in w.get("sense", []):
            pos.extend(s.get("partOfSpeech", []))
            for g in s.get("gloss", []):
                if g.get("text"):
                    glosses.append(g["text"])

        entry = {"pos": pos, "gloss": glosses}
        for k in w.get("kanji", []):
            vocab[k["text"]] = entry
        for k in w.get("kana", []):
            if k["text"] not in vocab:
                vocab[k["text"]] = entry
    return vocab


def load_jmnedict_proper_names() -> Set[str]:
    print("Loading JMnedict proper names gazetteer...")
    if not os.path.exists(JMNEDICT_PATH):
        print(f"JMnedict file not found at {JMNEDICT_PATH}")
        return set()

    with open(JMNEDICT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    proper_names = set()
    for w in data.get("words", []):
        for k in w.get("kanji", []):
            proper_names.add(k["text"])
        for k in w.get("kana", []):
            proper_names.add(k["text"])
    return proper_names


def classify_category(expr: str, reading: str, jmdict_info: Dict[str, Any] | None) -> str:
    """Classifies a word into NOUN, VERB, ADJECTIVE, LOANWORD, ADVERB_PHRASE, AFFIX."""
    if KATAKANA_ONLY_RE.match(expr):
        return "LOANWORD"

    if jmdict_info and jmdict_info.get("pos"):
        pos_list = jmdict_info["pos"]
        if any(p.startswith("v") for p in pos_list):
            return "VERB"
        if any(p.startswith("adj") for p in pos_list):
            return "ADJECTIVE"
        if any(p in ("adv", "adv-to") for p in pos_list):
            return "ADVERB_PHRASE"
        if any(p in ("suf", "pref", "ctr") for p in pos_list):
            return "AFFIX"
        if any(p in ("n", "pn") for p in pos_list):
            return "NOUN"

    # Morphological heuristics
    if expr.endswith("する"):
        return "VERB"
    if expr.endswith("的") or (expr.endswith("い") and reading.endswith("い") and len(expr) >= 2):
        return "ADJECTIVE"
    if KANA_RE.match(expr) and not KATAKANA_ONLY_RE.match(expr):
        return "ADVERB_PHRASE"
    return "NOUN"


def predict_jlpt_level(expr: str, reading: str, best_rank: int | None, category: str, kanji_dict: Dict[str, Any]) -> str:
    """Predicts JLPT level: N5, N4, N3, N2, N1."""
    kanji_levels = []
    for ch in expr:
        if ch in kanji_dict:
            lvl = kanji_dict[ch].get("jlpt")
            if lvl:
                kanji_levels.append(lvl)

    if kanji_levels:
        min_lvl = min(kanji_levels) # 1 is hardest, 5 is easiest in JLPT
        if min_lvl == 1:
            return "N1"
        if min_lvl == 2:
            return "N2" if (not best_rank or best_rank > 2500) else "N3"
        if min_lvl == 3:
            return "N3" if (not best_rank or best_rank > 1200) else "N4"
        if min_lvl >= 4:
            return "N4" if (not best_rank or best_rank > 600) else "N5"

    if category == "LOANWORD":
        if best_rank and best_rank <= 1500:
            return "N4"
        elif best_rank and best_rank <= 8000:
            return "N3"
        else:
            return "N2"

    if best_rank and best_rank <= 1000:
        return "N3"
    elif best_rank and best_rank <= 5000:
        return "N2"
    return "N1"


def run():
    common_vocab = load_jmdict_common()
    proper_names = load_jmnedict_proper_names()

    with open(THAI_REF_PATH, "r", encoding="utf-8") as f:
        ref_bundle = json.load(f)
    kanji_dict = ref_bundle.get("kanji_dict", {})

    print(f"Reading current candidate database from {CSV_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT priority_rank, expression, reading, sources_count, best_frequency_rank, sources FROM words ORDER BY priority_rank ASC")
    raw_words = cur.fetchall()
    conn.close()

    total_input = len(raw_words)
    print(f"Total input candidates: {total_input:,}")

    clean_words = []
    filtered_reasons = {}

    for rank, expr, reading, sc, bfr, src in raw_words:
        reason = None
        if expr in KANA_1MORA:
            reason = "1-mora particle"
        elif expr in INTERJECTIONS or expr.endswith("ーっ") or expr.endswith("っー"):
            reason = "interjection/sound"
        elif expr in GRAMMAR:
            reason = "grammar/contraction"
        elif expr in PREFECTURES:
            reason = "prefecture/place"
        elif expr != reading and reading in ATEJI_READINGS and len(expr) <= 3:
            reason = "ateji of particle"
        elif expr in proper_names and expr not in common_vocab:
            reason = "strict proper name"

        if reason:
            filtered_reasons[reason] = filtered_reasons.get(reason, 0) + 1
            continue

        # Classify and predict level
        info = common_vocab.get(expr) or common_vocab.get(reading)
        cat = classify_category(expr, reading, info)
        pred_lvl = predict_jlpt_level(expr, reading, bfr, cat, kanji_dict)

        # Default English gloss from JMdict if available
        gloss_en = ""
        if info and info.get("gloss"):
            gloss_en = ", ".join(info["gloss"][:3])
            # If verb, format with 'to '
            if cat == "VERB" and not gloss_en.lower().startswith("to "):
                gloss_en = "to " + gloss_en

        clean_words.append({
            "expression": expr,
            "reading": reading,
            "meaning_th": "",
            "meaning_en": gloss_en,
            "category": cat,
            "predicted_level": pred_lvl,
            "sources_count": sc,
            "best_frequency_rank": bfr,
            "sources": src
        })

    print("\n--- Filtering Summary ---")
    for r, count in sorted(filtered_reasons.items(), key=lambda x: -x[1]):
        print(f"  {r:<25}: {count:,}")
    print(f"Total Filtered Out : {total_input - len(clean_words):,}")
    print(f"Total Clean Candidates : {len(clean_words):,}")

    # Re-sort clean candidates
    print("Re-sorting clean candidates by multi-source consensus...")
    clean_words.sort(key=lambda x: (
        -x["sources_count"],
        x["best_frequency_rank"] if x["best_frequency_rank"] else 9999999,
        x["expression"]
    ))

    # Write updated master CSV
    print(f"Writing updated master CSV to {CSV_PATH}...")
    temp_csv = CSV_PATH + ".tmp"
    fieldnames = [
        "batch_id",
        "priority_rank",
        "expression",
        "reading",
        "meaning_th",
        "meaning_en",
        "category",
        "predicted_level",
        "translation_status",
        "sources_count",
        "best_frequency_rank",
        "sources"
    ]

    with open(temp_csv, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for idx, item in enumerate(clean_words, 1):
            batch_num = (idx - 1) // 1000 + 1
            batch_id = f"BATCH_{batch_num:03d}"
            writer.writerow({
                "batch_id": batch_id,
                "priority_rank": idx,
                "expression": item["expression"],
                "reading": item["reading"],
                "meaning_th": item["meaning_th"],
                "meaning_en": item["meaning_en"],
                "category": item["category"],
                "predicted_level": item["predicted_level"],
                "translation_status": "pending",
                "sources_count": item["sources_count"],
                "best_frequency_rank": item["best_frequency_rank"] if item["best_frequency_rank"] else "",
                "sources": item["sources"]
            })

    os.replace(temp_csv, CSV_PATH)

    # Rebuild SQLite Database
    print(f"Rebuilding SQLite database at {DB_PATH}...")
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE words (
            priority_rank INTEGER PRIMARY KEY,
            batch_id TEXT NOT NULL,
            chunk_100_id TEXT NOT NULL,
            expression TEXT NOT NULL,
            reading TEXT NOT NULL,
            meaning_th TEXT DEFAULT '',
            meaning_en TEXT DEFAULT '',
            category TEXT NOT NULL,
            predicted_level TEXT NOT NULL,
            translation_status TEXT DEFAULT 'pending',
            sources_count INTEGER NOT NULL,
            best_frequency_rank INTEGER,
            sources TEXT NOT NULL,
            translated_at TEXT
        );
    """)
    cur.execute("CREATE INDEX idx_status_rank ON words(translation_status, priority_rank);")
    cur.execute("CREATE INDEX idx_batch ON words(batch_id, priority_rank);")
    cur.execute("CREATE INDEX idx_chunk ON words(chunk_100_id);")
    cur.execute("CREATE INDEX idx_level ON words(predicted_level);")
    cur.execute("CREATE INDEX idx_category ON words(category);")
    cur.execute("CREATE INDEX idx_expression ON words(expression);")

    to_insert = []
    for idx, item in enumerate(clean_words, 1):
        batch_num = (idx - 1) // 1000 + 1
        batch_id = f"BATCH_{batch_num:03d}"
        chunk_num = (idx - 1) // 100 + 1
        chunk_id = f"CHUNK_{chunk_num:04d}"

        to_insert.append((
            idx,
            batch_id,
            chunk_id,
            item["expression"],
            item["reading"],
            item["meaning_th"],
            item["meaning_en"],
            item["category"],
            item["predicted_level"],
            "pending",
            item["sources_count"],
            item["best_frequency_rank"],
            item["sources"],
            None
        ))

        if len(to_insert) >= 25000:
            cur.executemany("INSERT INTO words VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", to_insert)
            to_insert = []

    if to_insert:
        cur.executemany("INSERT INTO words VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", to_insert)

    conn.commit()
    conn.close()

    # Clean up huge 159 MB temporary raw gazetteer file
    print("Cleaning up temporary raw gazetteer...")
    if os.path.exists(JMNEDICT_PATH):
        os.remove(JMNEDICT_PATH)
    jmnedict_dir = os.path.join(REF_DIR, "jmnedict-data")
    if os.path.exists(jmnedict_dir) and not os.listdir(jmnedict_dir):
        os.rmdir(jmnedict_dir)

    print("\n" + "=" * 60)
    print("  Lexical Filtering & Level Prediction Complete!  ")
    print("=" * 60)
    print(f"Final Clean Vocabulary Words : {len(clean_words):,}")
    print(f"Total 1,000-Word Batches     : {(len(clean_words) - 1) // 1000 + 1}")
    print(f"Total 100-Word Chunks        : {(len(clean_words) - 1) // 100 + 1}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    run()
