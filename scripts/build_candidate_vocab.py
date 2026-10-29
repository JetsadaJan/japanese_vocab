#!/usr/bin/env python3
from __future__ import annotations
"""
Backend Data Preparation: Candidate Japanese Vocabulary Pipeline
Sources:
1. Jiten (Local Yomichan Frequency Dictionaries across 12 media categories)
2. CEJC (Corpus of Everyday Japanese Conversation - Yomichan Frequency Dictionaries)
3. Wiktionary (Japanese Frequency Lists from Wikipedia Dumps & Appendices)

Processing:
- Extracts all terms completely.
- Cleans and deduplicates across all sources.
- Excludes 100% of existing vocabulary from JLPT N5-N1 (public/data/n{1..5}.csv).
- Generates clean backend candidate lists sorted by source agreement and frequency rank.
"""

import csv
import glob
import json
import os
import re
import unicodedata
import zipfile
from collections import defaultdict
from typing import Optional, Set, Dict, List

# Root directories
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JITEN_DIR = os.path.join(PROJECT_ROOT, "jiten")
CEJC_DIR = os.path.join(PROJECT_ROOT, "scratch", "cejc_repo")
WIKT_DIR = os.path.join(PROJECT_ROOT, "scratch", "wiktionary_raw")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "backend_data", "candidate_vocab")

# Regex & Cleaning helpers
JP_CHAR_RE = re.compile(r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]")
# Exclude Latin letters, digits, symbols, HTML/markup characters
BAD_CHAR_RE = re.compile(r"[a-zA-Z0-9_<>{}\[\]|@#$%^&*+=/\\\"'`~;:,]")
PUNCT_SET = set("「」（）【】〜…・、。ーっッ・!?！？:：;；,，.．\t\r\n ")


def load_existing_vocab(project_root: str) -> set:
    """Load all existing expressions and readings from public/data/n{1..5}.csv."""
    existing = set()
    files = glob.glob(os.path.join(project_root, "public", "data", "n*.csv"))
    for fpath in files:
        with open(fpath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                exp = row.get("expression")
                reading = row.get("reading")
                if exp:
                    existing.add(unicodedata.normalize("NFKC", exp.strip()))
                if reading:
                    existing.add(unicodedata.normalize("NFKC", reading.strip()))
    return existing


def clean_term(w: str, existing_set: set):
    """Validate and clean Japanese term."""
    if not w:
        return None
    w = unicodedata.normalize("NFKC", str(w).strip())
    if not w or len(w) > 15:
        return None
    # Filter standalone punctuation or repetitive particles
    if w in PUNCT_SET or (len(w) == 1 and w in "っッー〜…・"):
        return None
    # Must contain at least one Japanese character (Kanji, Hiragana, Katakana)
    if not JP_CHAR_RE.search(w):
        return None
    # Must not contain foreign characters, digits, or markup
    if BAD_CHAR_RE.search(w):
        return None
    # Must NOT exist in our current vocabulary database
    if w in existing_set:
        return None
    return w


def main():
    print("=" * 60)
    print("Japanese Candidate Vocabulary Extraction & Cleaning Pipeline")
    print("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Load Existing Vocabulary
    existing_set = load_existing_vocab(PROJECT_ROOT)
    print(f"[*] Loaded {len(existing_set):,} existing terms (expressions + readings) to exclude.")

    # Data structures: term -> { reading, best_rank, sources (set), domains (set) }
    candidates: dict[str, dict] = defaultdict(lambda: {
        "reading": "",
        "best_rank": 9999999,
        "source_families": set(),
        "detailed_sources": set()
    })

    stats = {
        "jiten_raw": 0,
        "cejc_raw": 0,
        "wiktionary_raw": 0,
    }

    # 2. Extract from Jiten (All media categories)
    print("\n[*] Processing Jiten Yomichan frequency dictionaries...")
    jiten_files = glob.glob(os.path.join(JITEN_DIR, "**", "term_meta_bank_1.json"), recursive=True)
    for fpath in sorted(jiten_files):
        cat_name = os.path.basename(os.path.dirname(fpath))
        with open(fpath, "r", encoding="utf-8") as f:
            entries = json.load(f)
            stats["jiten_raw"] += len(entries)
            for entry in entries:
                if not entry or len(entry) < 2:
                    continue
                raw_term = entry[0]
                term = clean_term(raw_term, existing_set)
                if not term:
                    continue

                rec = candidates[term]
                rec["source_families"].add("jiten")
                rec["detailed_sources"].add(cat_name)

                # Extract reading and frequency rank if present
                meta = entry[2] if len(entry) > 2 else None
                if isinstance(meta, dict):
                    if not rec["reading"] and meta.get("reading"):
                        r = unicodedata.normalize("NFKC", str(meta["reading"]).strip())
                        if JP_CHAR_RE.search(r):
                            rec["reading"] = r
                    val = meta.get("value")
                    if val is None and isinstance(meta.get("frequency"), dict):
                        val = meta["frequency"].get("value")
                    if isinstance(val, (int, float)) and val > 0:
                        rec["best_rank"] = min(rec["best_rank"], int(val))
                elif isinstance(meta, (int, float)) and meta > 0:
                    rec["best_rank"] = min(rec["best_rank"], int(meta))

    print(f"    - Processed {stats['jiten_raw']:,} raw entries across {len(jiten_files)} Jiten dictionaries.")

    # 3. Extract from CEJC (Corpus of Everyday Japanese Conversation)
    print("\n[*] Processing CEJC (Corpus of Everyday Japanese Conversation)...")
    cejc_zips = glob.glob(os.path.join(CEJC_DIR, "*.zip"))
    for zpath in sorted(cejc_zips):
        domain_name = os.path.splitext(os.path.basename(zpath))[0]
        try:
            with zipfile.ZipFile(zpath, "r") as zf:
                if "term_meta_bank_1.json" in zf.namelist():
                    with zf.open("term_meta_bank_1.json") as f:
                        entries = json.load(f)
                        stats["cejc_raw"] += len(entries)
                        for entry in entries:
                            if not entry or len(entry) < 2:
                                continue
                            raw_term = entry[0]
                            term = clean_term(raw_term, existing_set)
                            if not term:
                                continue

                            rec = candidates[term]
                            rec["source_families"].add("cejc")
                            rec["detailed_sources"].add(domain_name)

                            meta = entry[2] if len(entry) > 2 else None
                            if isinstance(meta, (int, float)) and meta > 0:
                                rec["best_rank"] = min(rec["best_rank"], int(meta))
        except Exception as e:
            print(f"    ! Error reading {zpath}: {e}")

    print(f"    - Processed {stats['cejc_raw']:,} raw entries across {len(cejc_zips)} CEJC corpora.")

    # 4. Extract from Wiktionary Frequency Lists
    print("\n[*] Processing Wiktionary Frequency Lists...")
    wikt_files = glob.glob(os.path.join(WIKT_DIR, "*.json"))
    for fpath in sorted(wikt_files):
        source_name = os.path.splitext(os.path.basename(fpath))[0]
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
            pages = data.get("query", {}).get("pages", {})
            for page in pages.values():
                content = page.get("revisions", [{}])[0].get("slots", {}).get("main", {}).get("*", "")
                if not content:
                    continue

                # 1) Template {{l/ja|word}} or {{l|ja|word}}
                terms_l = re.findall(r"\{\{l(?:/ja)?\|([^|}]+)", content)
                # 2) Wikilinks [[word]] or [[word|label]]
                terms_wiki = re.findall(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]", content)

                all_extracted = terms_l + terms_wiki
                stats["wiktionary_raw"] += len(all_extracted)

                for raw_term in all_extracted:
                    term = clean_term(raw_term, existing_set)
                    if not term:
                        continue
                    rec = candidates[term]
                    rec["source_families"].add("wiktionary")
                    rec["detailed_sources"].add(source_name)

    print(f"    - Processed {stats['wiktionary_raw']:,} raw terms across {len(wikt_files)} Wiktionary datasets.")

    print(f"\n[*] Total unique clean candidate words extracted: {len(candidates):,}")

    # 5. Deduplication, Ranking & Sorting
    print("[*] Sorting candidates by source confidence and frequency rank...")

    sorted_candidates = []
    for term, data in candidates.items():
        sorted_candidates.append({
            "expression": term,
            "reading": data["reading"],
            "sources_count": len(data["source_families"]),
            "best_rank": data["best_rank"] if data["best_rank"] < 9999999 else "",
            "rank_val": data["best_rank"],
            "sources": ";".join(sorted(data["source_families"])),
            "detailed_sources": ";".join(sorted(data["detailed_sources"])),
        })

    # Sort:
    # 1. More source families first (e.g. jiten + cejc + wiktionary = 3)
    # 2. Lower best_rank first (most frequent)
    # 3. Alphabetical expression tie-breaker
    sorted_candidates.sort(key=lambda x: (-x["sources_count"], x["rank_val"], x["expression"]))

    # Assign sequential global priority rank
    for idx, c in enumerate(sorted_candidates, start=1):
        c["priority_rank"] = idx

    # 6. Breakdown stats
    sources_breakdown = defaultdict(int)
    for c in sorted_candidates:
        sources_breakdown[c["sources"]] += 1

    print("\n--- Candidate Source Family Breakdown ---")
    for src_combo, count in sorted(sources_breakdown.items(), key=lambda x: -x[1]):
        print(f"  • {src_combo}: {count:,} words")

    # 7. Write Output Files
    print(f"\n[*] Writing candidate files to: {OUTPUT_DIR}")

    # 7.1 Full CSV
    full_csv_path = os.path.join(OUTPUT_DIR, "candidate_vocab_all.csv")
    with open(full_csv_path, "w", encoding="utf-8", newline="") as f:
        fieldnames = ["priority_rank", "expression", "reading", "sources_count", "best_rank", "sources", "detailed_sources"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for c in sorted_candidates:
            writer.writerow({k: c[k] for k in fieldnames})
    print(f"  ✓ {full_csv_path} ({len(sorted_candidates):,} rows)")

    # 7.2 Full Plain List TXT
    full_txt_path = os.path.join(OUTPUT_DIR, "candidate_vocab_all.txt")
    with open(full_txt_path, "w", encoding="utf-8") as f:
        for c in sorted_candidates:
            f.write(c["expression"] + "\n")
    print(f"  ✓ {full_txt_path} ({len(sorted_candidates):,} lines)")

    # 7.3 High-Priority Top 10,000 Words (multi-source verified & top frequency)
    top_10k = sorted_candidates[:10000]
    top_csv_path = os.path.join(OUTPUT_DIR, "candidate_vocab_top10k.csv")
    with open(top_csv_path, "w", encoding="utf-8", newline="") as f:
        fieldnames = ["priority_rank", "expression", "reading", "sources_count", "best_rank", "sources", "detailed_sources"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for c in top_10k:
            writer.writerow({k: c[k] for k in fieldnames})
    print(f"  ✓ {top_csv_path} ({len(top_10k):,} rows)")

    top_txt_path = os.path.join(OUTPUT_DIR, "candidate_vocab_top10k.txt")
    with open(top_txt_path, "w", encoding="utf-8") as f:
        for c in top_10k:
            f.write(c["expression"] + "\n")
    print(f"  ✓ {top_txt_path} ({len(top_10k):,} lines)")

    # 7.4 Summary JSON
    summary_path = os.path.join(OUTPUT_DIR, "candidate_vocab_summary.json")
    summary_data = {
        "existing_vocabulary_excluded": len(existing_set),
        "total_unique_candidates": len(sorted_candidates),
        "raw_counts": stats,
        "source_breakdown": dict(sources_breakdown),
        "top_10k_sample": [c["expression"] for c in top_10k[:50]],
    }
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {summary_path}")

    # 7.5 Documentation README
    readme_path = os.path.join(OUTPUT_DIR, "README.md")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(f"""# Candidate Japanese Vocabulary Repository (คลังคำศัพท์ภาษาญี่ปุ่นสำหรับอนาคต)

ไฟล์ข้อมูลคำศัพท์ภาษาญี่ปุ่นที่เตรียมไว้สำหรับการขยายคลังคำศัพท์ในอนาคต โดยผ่านกระบวนการคัดกรอง ทำความสะอาด และตัดคำที่มีอยู่เดิมออกแล้ว 100%

## ข้อมูลสรุป (Summary)
- **คำศัพท์เดิมที่มีอยู่ (JLPT N5–N1) ที่ถูกตัดออก**: {len(existing_set):,} คำ
- **คำศัพท์ใหม่ที่คัดกรองได้ (Unique Candidates)**: {len(sorted_candidates):,} คำ
- **ชุดคำศัพท์ความสำคัญสูงสุด (Top 10,000 High-Priority)**: 10,000 คำ

## แหล่งที่มา (Sources)
1. **Jiten (Media Frequency Dictionaries)**: ข้อมูลความถี่คำศัพท์จากสื่อ 12 หมวดหมู่ (Anime, Manga, Drama, Movie, Novel, NonFiction, VideoGame, VisualNovel, WebNovel, YouTube, Audio, Global)
2. **Corpus of Everyday Japanese Conversation (CEJC)**: ข้อมูลความถี่คำศัพท์จากการสนทนาภาษาญี่ปุ่นในชีวิตจริง (Yomichan Frequency Dictionary โดย n-manas)
3. **Wiktionary Frequency Lists**: รายการความถี่คำศัพท์ภาษาญี่ปุ่นจาก Wikipedia Dump (Kagome, MeCab, JUMAN) และดัชนีคำศัพท์พื้นฐาน

## การจัดลำดับความสำคัญ (Priority Sorting)
1. **Source Agreement (จำนวนแหล่งที่พบ)**: คำที่พบตรงกันในหลายคลังข้อมูล (เช่น พบทั้งใน CEJC การสนทนาจริง, Jiten สื่อ และ Wiktionary) จะถูกจัดให้อยู่บนสุด
2. **Frequency Rank**: จัดเรียงตามลำดับความถี่ที่ใช้บ่อยที่สุด (Best Frequency Rank)

## โครงสร้างไฟล์ในโฟลเดอร์นี้
- `candidate_vocab_all.csv`: ข้อมูลคำศัพท์ทั้งหมดแบบเต็มพร้อม Reading, แหล่งที่มา, และ Frequency Rank
- `candidate_vocab_all.txt`: รายชื่อคำภาษาญี่ปุ่นทั้งหมด บรรทัดละ 1 คำ
- `candidate_vocab_top10k.csv`: คำศัพท์ความสำคัญสูงสุด 10,000 คำแรกที่เหมาะสำหรับนำมาแปลและเพิ่มในระบบเป็นชุดแรก
- `candidate_vocab_top10k.txt`: รายชื่อคำศัพท์ 10,000 คำแรก บรรทัดละ 1 คำ
- `candidate_vocab_summary.json`: ข้อมูลสรุปทางสถิติและตัวเลขภาพรวม
""")
    print(f"  ✓ {readme_path}")

    print("\n" + "=" * 60)
    print("Pipeline completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
