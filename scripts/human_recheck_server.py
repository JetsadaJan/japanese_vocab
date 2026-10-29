#!/usr/bin/env python3
"""
Human Recheck Server (scripts/human_recheck_server.py)
Modular, fast, bulletproof local staging server for vocabulary review.

Architecture:
- Static assets served cleanly from scripts/recheck_web/ (index.html, app.js, style.css)
- Zero string escaping / quote collision issues between Python and JavaScript
- Server-Side Hydration (SSR): Injects initial stats, options, and pre-renders Card #1 directly into HTML
- Real-time Kanji Inspector linking to public/data/n{1..5}.csv
- Search & Jump API (/api/search)
- Pre-Export Sanity Gate + 1-Click Rollback
"""

from __future__ import annotations
import argparse
import csv
import glob
import html
import json
import os
import re
import shutil
import sqlite3
import sys
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse, unquote
from typing import List, Dict, Any, Optional

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend_data")
DB_PATH = os.path.join(BACKEND_DIR, "vocab_master.db")
CSV_PATH = os.path.join(BACKEND_DIR, "candidate_vocab_master.csv")
REF_DIR = os.path.join(BACKEND_DIR, "reference")
REF_INDEX_PATH = os.path.join(REF_DIR, "thai_reference_index.json")
PUBLIC_DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data")
BACKUP_BASE_DIR = os.path.join(BACKEND_DIR, "backups")
WEB_DIR = os.path.join(PROJECT_ROOT, "scripts", "recheck_web")

THAI_CHAR_RE = re.compile(r"[\u0E00-\u0E7F]")
KANJI_CHAR_RE = re.compile(r"[\u4E00-\u9FAF]")

# --- Romaji Converter ---
KATA_TO_HIRA = {chr(i): chr(i - 0x60) for i in range(0x30A1, 0x30F7)}

DIGRAPH_MAP = {
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
    'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho', 'しぇ': 'she',
    'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho', 'ちぇ': 'che',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
    'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'じゃ': 'ja',  'じゅ': 'ju',  'じょ': 'jo',  'じぇ': 'je',
    'ぢゃ': 'ja',  'ぢゅ': 'ju',  'ぢょ': 'jo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
    'てぃ': 'ti',  'でぃ': 'di',  'てゅ': 'tyu', 'でゅ': 'dyu',
    'とぅ': 'tu',  'どぅ': 'du',  'ふぁ': 'fa',  'ふぃ': 'fi',
    'ふぇ': 'fe',  'ふぉ': 'fo',  'ふゅ': 'fyu', 'うぃ': 'wi',
    'うぇ': 'we',  'うぉ': 'wo',  'ゔぁ': 'va',  'ゔぃ': 'vi',
    'ゔぇ': 've',  'ゔぉ': 'vo',  'ゔゅ': 'vyu', 'つぁ': 'tsa',
    'つぃ': 'tsi', 'つぇ': 'tse', 'つぉ': 'tso', 'くぁ': 'kwa',
    'くぃ': 'kwi', 'くぇ': 'kwe', 'くぉ': 'kwo', 'ぐぁ': 'gwa',
}

MONOGRAPH_MAP = {
    'あ': 'a',  'い': 'i',   'う': 'u',   'え': 'e',  'お': 'o',
    'か': 'ka', 'き': 'ki',  'く': 'ku',  'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su',  'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni',  'ぬ': 'nu',  'ね': 'ne', 'ของ': 'no', 'の': 'no',
    'は': 'ha', 'ひ': 'hi',  'ふ': 'fu',  'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi',  'む': 'mu',  'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu',  'よ': 'yo',
    'ら': 'ra', 'り': 'ri',  'る': 'ru',  'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'ゐ': 'wi',  'ゑ': 'we',  'を': 'o',  'ん': 'n',
    'が': 'ga', 'ぎ': 'gi',  'ぐ': 'gu',  'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji',  'ず': 'zu',  'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'ji',  'づ': 'zu',  'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi',  'ぶ': 'bu',  'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi',  'ぷ': 'pu',  'ぺ': 'pe', 'ぽ': 'po',
    'ゔ': 'vu', 'ぁ': 'a',   'ぃ': 'i',   'ぅ': 'u',   'ぇ': 'e',  'ぉ': 'o',
    'っ': '',   'ー': '-',
}

def kana_to_romaji(text: str) -> str:
    if not text:
        return ""
    hira = ''.join(KATA_TO_HIRA.get(c, c) for c in text)
    res = []
    i = 0
    n = len(hira)
    while i < n:
        if hira[i] == 'っ' and i + 1 < n:
            next_ch = hira[i+1]
            next_digraph = hira[i+1:i+3]
            sub = DIGRAPH_MAP.get(next_digraph) or MONOGRAPH_MAP.get(next_ch, '')
            if sub:
                first = 't' if sub.startswith(('ch', 'ts')) else sub[0]
                res.append(first)
            i += 1
            continue
        if i + 1 < n and hira[i:i+2] in DIGRAPH_MAP:
            res.append(DIGRAPH_MAP[hira[i:i+2]])
            i += 2
            continue
        if hira[i] in MONOGRAPH_MAP:
            res.append(MONOGRAPH_MAP[hira[i]])
            i += 1
            continue
        res.append(hira[i])
        i += 1
    return ''.join(res)

# Caches
_MAIN_VOCAB_CACHE = None
_REF_DATA_CACHE = None
_KANJI_CACHE = None

def load_kanji_db():
    global _KANJI_CACHE
    if _KANJI_CACHE is not None:
        return _KANJI_CACHE
    kanji_path = os.path.join(PUBLIC_DATA_DIR, "kanji.json")
    if os.path.exists(kanji_path):
        with open(kanji_path, "r", encoding="utf-8") as f:
            _KANJI_CACHE = json.load(f)
    else:
        _KANJI_CACHE = {}
    return _KANJI_CACHE

def load_ref_data():
    global _REF_DATA_CACHE
    if _REF_DATA_CACHE is not None:
        return _REF_DATA_CACHE
    if os.path.exists(REF_INDEX_PATH):
        with open(REF_INDEX_PATH, "r", encoding="utf-8") as f:
            _REF_DATA_CACHE = json.load(f)
    else:
        _REF_DATA_CACHE = {"kanji_dict": {}, "vocab_memory": {}}
    return _REF_DATA_CACHE

def load_main_vocab_cache():
    global _MAIN_VOCAB_CACHE
    if _MAIN_VOCAB_CACHE is not None:
        return _MAIN_VOCAB_CACHE
    vocab = []
    for p in sorted(glob.glob(os.path.join(PUBLIC_DATA_DIR, "n*.csv"))):
        level = os.path.basename(p).replace(".csv", "").upper()
        with open(p, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                vocab.append({
                    "expression": r.get("expression", "").strip(),
                    "reading": r.get("reading", "").strip(),
                    "meaning_en": r.get("meaning", "").strip(),
                    "meaning_th": r.get("meaning_th", "").strip(),
                    "level": level
                })
    _MAIN_VOCAB_CACHE = vocab
    return _MAIN_VOCAB_CACHE

def clean_reading_for_romaji(r: str) -> str:
    return re.sub(r"[.\-・\s]", "", r)

def get_kanji_full_info(char: str) -> Dict[str, Any]:
    k_pub = load_kanji_db()
    ref = load_ref_data()
    k_dict = ref.get("kanji_dict", {})

    info_pub = k_pub.get(char, {})
    info_ref = k_dict.get(char, {})

    th = info_pub.get("th") or info_ref.get("meaning_th") or ""
    en = info_pub.get("en") or ", ".join(info_ref.get("meanings_en", []))
    lvl = info_pub.get("lvl")
    if not lvl and info_ref.get("jlpt"):
        lvl = f"N{info_ref.get('jlpt')}"
    if not lvl:
        lvl = "ทั่วไป"
    strokes = info_pub.get("strokes") or info_ref.get("strokes", 0)
    on = info_pub.get("on") or info_ref.get("readings_on", [])
    kun = info_pub.get("kun") or info_ref.get("readings_kun", [])
    note = info_pub.get("note", "")

    readings_on = []
    for r in on:
        clean = clean_reading_for_romaji(r)
        readings_on.append({
            "reading": r,
            "romaji": kana_to_romaji(clean)
        })

    readings_kun = []
    for r in kun:
        clean = clean_reading_for_romaji(r)
        readings_kun.append({
            "reading": r,
            "romaji": kana_to_romaji(clean)
        })

    main_vocab = load_main_vocab_cache()
    related = []
    for item in main_vocab:
        if char in item["expression"]:
            related.append({
                "expression": item["expression"],
                "reading": item["reading"],
                "romaji": kana_to_romaji(item["reading"]),
                "level": item["level"],
                "meaning_th": item["meaning_th"],
                "meaning_en": item["meaning_en"]
            })

    return {
        "character": char,
        "strokes": strokes,
        "level": lvl,
        "meaning_th": th,
        "meaning_en": en,
        "note": note,
        "readings_on": readings_on,
        "readings_kun": readings_kun,
        "related_words": related,
        "related_words_count": len(related)
    }

def get_kanji_breakdown(expr: str) -> List[Dict[str, Any]]:
    k_pub = load_kanji_db()
    ref = load_ref_data()
    k_dict = ref.get("kanji_dict", {})
    breakdown = []
    seen = set()
    for ch in expr:
        if KANJI_CHAR_RE.match(ch) and ch not in seen:
            seen.add(ch)
            info_pub = k_pub.get(ch, {})
            info_ref = k_dict.get(ch, {})
            th = info_pub.get("th") or info_ref.get("meaning_th") or ""
            en = [info_pub["en"]] if info_pub.get("en") else info_ref.get("meanings_en", [])
            lvl = info_pub.get("lvl") or (f"N{info_ref.get('jlpt')}" if info_ref.get('jlpt') else "")
            strokes = info_pub.get("strokes") or info_ref.get("strokes", 0)
            on = info_pub.get("on") or info_ref.get("readings_on", [])
            kun = info_pub.get("kun") or info_ref.get("readings_kun", [])
            breakdown.append({
                "kanji": ch,
                "meaning_th": th,
                "meanings_en": en,
                "jlpt": lvl,
                "strokes": strokes,
                "readings_on": on,
                "readings_kun": kun
            })
    return breakdown

def find_similar_main_words(expr: str, reading: str) -> List[Dict[str, Any]]:
    main_vocab = load_main_vocab_cache()
    expr_kanji = set(re.findall(KANJI_CHAR_RE, expr))
    matches = []

    for item in main_vocab:
        score = 0
        match_type = []
        if item["reading"] == reading:
            score += 10
            match_type.append("เสียงอ่านตรงกัน")
        if item["expression"] == expr:
            score += 20
            match_type.append("รูปเขียนตรงกัน")
        elif expr in item["expression"] or item["expression"] in expr:
            score += 5
            match_type.append("คำประสม/ส่วนประกอบร่วม")

        item_kanji = set(re.findall(KANJI_CHAR_RE, item["expression"]))
        common_k = expr_kanji.intersection(item_kanji)
        if common_k:
            score += len(common_k) * 3
            match_type.append(f"คันจิร่วม ({''.join(common_k)})")

        if score > 0:
            matches.append({
                "expression": item["expression"],
                "reading": item["reading"],
                "level": item["level"],
                "meaning_th": item["meaning_th"],
                "meaning_en": item["meaning_en"],
                "match_reason": ", ".join(match_type),
                "score": score
            })

    matches.sort(key=lambda x: -x["score"])
    return matches[:8]

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_db_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(words)")
    cols = [r[1] for r in cur.fetchall()]
    if "exported_at" not in cols:
        cur.execute("ALTER TABLE words ADD COLUMN exported_at TEXT")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS export_history (
            export_id INTEGER PRIMARY KEY AUTOINCREMENT,
            backup_dir TEXT NOT NULL,
            exported_words_count INTEGER NOT NULL,
            exported_at TEXT NOT NULL,
            ranks_json TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def sync_csv_from_db():
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

# --- Server-Side Pre-rendered Card Generator ---
def render_ssr_card(word: Dict[str, Any], total_in_queue: int) -> str:
    if not word:
        return ""
    
    kanji_bd = get_kanji_breakdown(word["expression"])
    similar_words = find_similar_main_words(word["expression"], word["reading"])
    
    lvl_colors = {
        "N5": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        "N4": "bg-sky-500/10 text-sky-400 border-sky-500/30",
        "N3": "bg-amber-500/10 text-amber-400 border-amber-500/30",
        "N2": "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
        "N1": "bg-rose-500/10 text-rose-400 border-rose-500/30",
    }
    lvl_badge = lvl_colors.get(word.get("predicted_level", ""), "bg-slate-800 text-slate-300 border-slate-700")

    # Interactive Expression (click to open Kanji Modal)
    expr_chips = []
    for ch in word["expression"]:
        if KANJI_CHAR_RE.match(ch):
            expr_chips.append(
                f'<span onclick="openKanjiModal(\'{ch}\')" class="kanji-interactive hover:text-amber-400 hover:underline decoration-amber-400/60 px-0.5" title="คลิกดูคันจิ {ch} ในคลังหลัก">{ch}</span>'
            )
        else:
            expr_chips.append(html.escape(ch))
    expr_html = "".join(expr_chips)

    # Kanji Breakdown
    kanji_html = ""
    if kanji_bd:
        items = []
        for k in kanji_bd:
            m_th = k.get("meaning_th") or (", ".join(k.get("meanings_en", [])) if isinstance(k.get("meanings_en"), list) else str(k.get("meanings_en", "")))
            readings = "・".join(k.get("readings_on", [])) or "・".join(k.get("readings_kun", [])) or "-"
            jlpt = f'<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">{k.get("jlpt")}</span>' if k.get("jlpt") else ""
            k_char = k["kanji"]
            items.append(f"""
              <div onclick="openKanjiModal('{k_char}')" class="bg-[#151B27] hover:bg-[#1C2434] border border-slate-800 hover:border-amber-500/50 p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all group shadow-sm">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 border border-amber-500/20 flex items-center justify-center font-japanese text-xl font-bold shrink-0 transition-transform">{k_char}</span>
                  <div class="truncate">
                    <div class="text-slate-200 group-hover:text-amber-300 font-semibold text-xs truncate transition-colors">{html.escape(m_th)}</div>
                    <div class="text-[11px] text-slate-400 font-japanese truncate">{html.escape(readings)}</div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  {jlpt}
                  <span class="text-xs text-amber-400/60 group-hover:text-amber-400 transition-colors">🔍 ➔</span>
                </div>
              </div>
            """)
        kanji_html = f"""
          <div class="space-y-2 pt-1">
            <div class="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <span>🧩 คันจิประกอบคำ ({len(kanji_bd)} ตัว)</span>
                <span class="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">คลิกที่คันจิเพื่อเปิดดูคลังหลัก</span>
              </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {''.join(items)}
            </div>
          </div>
        """

    # Similar Words
    similar_html = ""
    if similar_words:
        sim_items = []
        for s in similar_words[:4]:
            s_expr = html.escape(s["expression"])
            s_rd = html.escape(s["reading"])
            s_lvl = s["level"]
            s_mean = html.escape(s.get("meaning_th") or s.get("meaning_en") or "")
            s_reason = html.escape(s["match_reason"])
            sim_items.append(f"""
              <div class="bg-[#121622] border border-slate-800/80 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2">
                <div class="min-w-0 truncate">
                  <div class="flex items-center gap-1.5">
                    <span class="font-japanese font-bold text-slate-200">{s_expr}</span>
                    <span class="text-slate-400 text-[11px] font-japanese">({s_rd})</span>
                    <span class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">{s_lvl}</span>
                  </div>
                  <div class="text-slate-400 text-[11px] truncate mt-0.5">{s_mean}</div>
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">{s_reason}</span>
              </div>
            """)
        similar_html = f"""
          <div class="space-y-2 pt-2 border-t border-slate-800/60">
            <div class="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span>📚 คำในคลังหลักเดิมที่ใกล้เคียง / คล้ายกัน (n1-n5.csv)</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {''.join(sim_items)}
            </div>
          </div>
        """

    safe_th = html.escape(word.get("meaning_th") or "")
    safe_en = html.escape(word.get("meaning_en") or "")
    safe_reading = html.escape(word.get("reading") or "")
    safe_romaji = html.escape(word.get("romaji") or "")
    safe_cat = html.escape(word.get("category") or "GENERAL")
    safe_lvl = html.escape(word.get("predicted_level") or "N/A")
    rank = word.get("priority_rank", 1)

    # Level Pills & Selector
    pill_btns = []
    for lvl in ["N5", "N4", "N3", "N2", "N1"]:
        is_active = (safe_lvl == lvl)
        if is_active:
            if lvl == "N5": active_class = "bg-emerald-500 text-white font-bold"
            elif lvl == "N4": active_class = "bg-sky-500 text-white font-bold"
            elif lvl == "N3": active_class = "bg-amber-500 text-white font-bold"
            elif lvl == "N2": active_class = "bg-indigo-500 text-white font-bold"
            else: active_class = "bg-rose-500 text-white font-bold"
        else:
            active_class = "bg-slate-800/80 text-slate-400 hover:text-white"
        num_key = "1" if lvl == "N1" else ("2" if lvl == "N2" else ("3" if lvl == "N3" else ("4" if lvl == "N4" else "5")))
        pill_btns.append(
            f'<button type="button" onclick="changeWordLevel(\'{lvl}\')" class="px-2 py-0.5 text-[11px] rounded font-mono transition-colors {active_class}" title="ปรับเป็น {lvl} (กด {num_key})">{lvl}</button>'
        )
    pills_html = "".join(pill_btns)

    level_control_html = f"""
      <div class="flex items-center gap-1.5 bg-[#161B27] px-2.5 py-1 rounded-xl border border-slate-700/80 shadow-sm">
        <label for="selectWordLevel" class="text-[11px] font-semibold text-slate-400">ระดับ:</label>
        <select 
          id="selectWordLevel" 
          onchange="changeWordLevel(this.value)"
          class="bg-[#1C2434] text-amber-300 font-mono font-bold text-xs px-2 py-0.5 rounded-lg border border-slate-600 focus:outline-none focus:border-indigo-500 cursor-pointer"
          title="ปรับระดับ JLPT ของคำนี้ (คีย์ลัด: 1-5)"
        >
          <option value="N5" {'selected' if safe_lvl == 'N5' else ''}>N5</option>
          <option value="N4" {'selected' if safe_lvl == 'N4' else ''}>N4</option>
          <option value="N3" {'selected' if safe_lvl == 'N3' else ''}>N3</option>
          <option value="N2" {'selected' if safe_lvl == 'N2' else ''}>N2</option>
          <option value="N1" {'selected' if safe_lvl == 'N1' else ''}>N1</option>
        </select>
        <div class="flex items-center gap-1 pl-1 border-l border-slate-700">
          {pills_html}
        </div>
      </div>
    """

    return f"""
      <div class="bg-[#121622] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 card-transition relative overflow-hidden">
        
        <!-- Header Info Bar -->
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs pb-4 border-b border-slate-800/80">
          <div class="flex items-center gap-2">
            {level_control_html}
            <span class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium border border-slate-700 text-xs">
              {safe_cat}
            </span>
            <span class="text-indigo-400 font-mono font-semibold">#Rank {rank}</span>
            <span class="text-slate-500 text-[11px]">(1 จาก {total_in_queue})</span>
          </div>
          
          <div class="flex items-center gap-1.5">
            <button 
              onclick="prevWord()" 
              class="px-3 py-1 bg-[#181E2B] hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
              title="ย้อนกลับไปดูคำก่อนหน้าในคิว"
            >
              <span>◀ ก่อนหน้า</span>
            </button>
            <button 
              onclick="skipWord()" 
              class="px-3 py-1 bg-[#181E2B] hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
              title="ข้ามไปคำถัดไป (คีย์ลัด: S หรือ ลูกศรลง)"
            >
              <span>ข้าม ⏭</span>
            </button>
          </div>
        </div>

        <!-- Expression & Pronunciation Hero -->
        <div class="text-center py-4 space-y-2">
          <!-- Furigana Reading -->
          <div class="text-slate-400 font-japanese text-base md:text-lg tracking-wider flex items-center justify-center gap-2">
            <span>{safe_reading}</span>
            <button 
              onclick="speakJapanese('{safe_reading}')" 
              class="p-1 rounded-full bg-slate-800/80 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
              title="ฟังเสียงอ่านภาษาญี่ปุ่น"
            >
              🔊
            </button>
          </div>

          <!-- Main Japanese Expression -->
          <div class="text-4xl md:text-6xl font-extrabold text-white font-japanese tracking-wide py-1 drop-shadow-md">
            {expr_html}
          </div>

          <!-- ROMAJI: Prominent Yellow enclosed in [xxxx] -->
          <div class="text-amber-400 font-mono text-base md:text-lg font-bold tracking-wider pt-1">
            [{safe_romaji}]
          </div>
        </div>

        <!-- 1. Editable Meanings Form (Placed right below Japanese Characters) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          
          <!-- Meaning Thai -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>🇹🇭 ความหมายภาษาไทย (แก้ไขได้)</span>
              <span class="text-[10px] text-slate-500 font-normal">บังคับมีตัวอักษรไทย</span>
            </label>
            <input 
              type="text" 
              id="inputMeaningTh" 
              value="{safe_th}" 
              placeholder="กรอกคำแปลภาษาไทย..."
              class="w-full bg-[#181E2B] border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium"
            >
          </div>

          <!-- Meaning English -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>🇬🇧 ความหมายภาษาอังกฤษ (แก้ไขได้)</span>
              <span class="text-[10px] text-slate-500 font-normal">คำกริยาขึ้นต้นด้วย "to "</span>
            </label>
            <input 
              type="text" 
              id="inputMeaningEn" 
              value="{safe_en}" 
              placeholder="English meaning..."
              class="w-full bg-[#181E2B] border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
            >
          </div>

        </div>

        <!-- 2. Primary Action Buttons (Reject, Skip, Approve) placed directly below Meanings -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          
          <!-- Reject Button -->
          <button 
            id="rejectCurrentWord" 
            onclick="reviewWord('rejected')" 
            class="py-3 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 text-rose-300 hover:text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 group shadow-sm hover:shadow-rose-600/20"
            title="ปฏิเสธคำนี้ (คีย์ลัด: ลูกศรซ้าย ⬅)"
          >
            <span class="text-base group-hover:-translate-x-1 transition-transform">⬅</span>
            <span>ปฏิเสธ (Reject)</span>
          </button>

          <!-- Skip Button -->
          <button 
            id="skipCurrentWord" 
            onclick="skipWord()" 
            class="py-3 px-4 rounded-2xl bg-[#181E2B] hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 group shadow-sm"
            title="ข้ามไปก่อน (คีย์ลัด: ลูกศรลง ⬇ หรือ S)"
          >
            <span class="text-base">⏭</span>
            <span>ข้ามไปก่อน (Skip)</span>
          </button>

          <!-- Approve Button -->
          <button 
            id="approveCurrentWord" 
            onclick="reviewWord('approved')" 
            class="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 group shadow-lg shadow-emerald-600/30"
            title="อนุมัติคำนี้ (คีย์ลัด: ลูกศรขวา ➔ หรือ Enter)"
          >
            <span>อนุมัติ (Approve)</span>
            <span class="text-base group-hover:translate-x-1 transition-transform">➔</span>
          </button>

        </div>

        <!-- 3. Review Comment & Quick-Click Template Chips -->
        <div class="space-y-2 pt-3 border-t border-slate-800/80">
          <div class="flex items-center justify-between text-xs">
            <label class="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>📝 หมายเหตุการตรวจ / เหตุผลที่ปฏิเสธ (ถ้ามี)</span>
            </label>
            <button type="button" onclick="clearCommentInput()" class="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
              ล้างข้อความ
            </button>
          </div>
          <input 
            type="text" 
            id="inputComment" 
            placeholder="คลิกแท็กแม่แบบด้านล่าง หรือพิมพ์ระบุเหตุผล เช่น คำสแลง, ซ้ำซ้อน, แปลไม่ตรง..."
            class="w-full bg-[#161B27] border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none transition-all"
          >
          <!-- Common Template Chips -->
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span class="text-[10px] text-slate-500">แม่แบบพบบ่อย:</span>
            <button type="button" onclick="setCommentTemplate('คำสแลง / ภาษาพูด')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 transition-colors">💬 คำสแลง/ภาษาพูด</button>
            <button type="button" onclick="setCommentTemplate('ซ้ำซ้อนกับคลังหลัก')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-rose-300 border border-slate-700/60 transition-colors">⚠️ ซ้ำกับคลังหลัก</button>
            <button type="button" onclick="setCommentTemplate('แปลไทยไม่เป็นธรรมชาติ')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700/60 transition-colors">✍️ แปลไม่ธรรมชาติ</button>
            <button type="button" onclick="setCommentTemplate('คำเฉพาะทาง / วิชาการ')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 border border-slate-700/60 transition-colors">🔬 เฉพาะทาง/วิชาการ</button>
            <button type="button" onclick="setCommentTemplate('คำโบราณ / พบน้อยมาก')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition-colors">📜 โบราณ/พบน้อย</button>
            <button type="button" onclick="setCommentTemplate('ควรปรับระดับ JLPT')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-sky-300 border border-slate-700/60 transition-colors">🎯 ปรับระดับ JLPT</button>
            <button type="button" onclick="setCommentTemplate('คำนามเฉพาะ / ชื่อเฉพาะ')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition-colors">🏷️ นามเฉพาะ</button>
            <button type="button" onclick="setCommentTemplate('รูปคันจิไม่นิยมใช้')" class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700/60 transition-colors">🈶 คันจิไม่นิยม</button>
          </div>
        </div>

        <!-- 4. Other Details: Kanji Breakdown -->
        {kanji_html}

        <!-- 5. Other Details: Similar Words in Existing App -->
        {similar_html}

      </div>
    """

# --- HTTP Request Handler ---
class RecheckRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_json(self, data: Any, status: HTTPStatus = HTTPStatus.OK):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_html(self, content: str, status: HTTPStatus = HTTPStatus.OK):
        body = content.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, file_path: str, content_type: str):
        if not os.path.exists(file_path):
            self.send_error(HTTPStatus.NOT_FOUND, "File Not Found")
            return
        with open(file_path, "rb") as f:
            data = f.read()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        query = parse_qs(url.query)

        # Serve static assets
        if path == "/app.js":
            self.send_file(os.path.join(WEB_DIR, "app.js"), "application/javascript; charset=utf-8")
            return

        if path == "/style.css":
            self.send_file(os.path.join(WEB_DIR, "style.css"), "text/css; charset=utf-8")
            return

        # Main Page with Bulletproof SSR
        if path in ("/", "/index.html"):
            index_path = os.path.join(WEB_DIR, "index.html")
            with open(index_path, "r", encoding="utf-8") as f:
                template = f.read()

            conn = get_db_connection()
            cur = conn.cursor()

            # 1. Stats
            cur.execute("SELECT translation_status, COUNT(*) FROM words GROUP BY translation_status")
            status_map = dict(cur.fetchall())
            cur.execute("SELECT COUNT(*) FROM review_history")
            history_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM export_history")
            export_count = cur.fetchone()[0]

            cur.execute("""
                SELECT predicted_level, COUNT(*) 
                FROM words 
                WHERE translation_status = 'translated' 
                GROUP BY predicted_level
            """)
            level_counts = dict(cur.fetchall())

            stats = {
                "pending": status_map.get("pending", 0),
                "translated": status_map.get("translated", 0),
                "approved": status_map.get("approved", 0),
                "rejected": status_map.get("rejected", 0),
                "exported": status_map.get("exported", 0),
                "history_count": history_count,
                "can_rollback": export_count > 0,
                "level_counts": level_counts
            }

            # 2. First 100 words in queue
            cur.execute("""
                SELECT priority_rank, batch_id, chunk_100_id, expression, reading,
                       meaning_th, meaning_en, category, predicted_level,
                       translation_status, review_comment, sources_count,
                       best_frequency_rank, sources, exported_at
                FROM words
                WHERE translation_status = 'translated'
                ORDER BY priority_rank ASC
                LIMIT 100
            """)
            words = []
            for r in cur.fetchall():
                d = dict(r)
                d["romaji"] = kana_to_romaji(d["reading"])
                words.append(d)
            conn.close()

            # Pre-render card #1
            card_html = ""
            if words:
                card_html = render_ssr_card(words[0], len(words))

            # Options
            total_queue = stats["translated"]
            lvl_opts = f"""
              <option value="">ทั้งหมด ({total_queue} คำ)</option>
              <option value="N5">N5 ({level_counts.get('N5', 0)} คำ)</option>
              <option value="N4">N4 ({level_counts.get('N4', 0)} คำ)</option>
              <option value="N3">N3 ({level_counts.get('N3', 0)} คำ)</option>
              <option value="N1">N1 ({level_counts.get('N1', 0)} คำ)</option>
            """

            initial_data_json = json.dumps({"stats": stats, "words": words}, ensure_ascii=False)

            rendered = template.replace("<!-- SSR_CARD_PLACEHOLDER -->", card_html)
            rendered = rendered.replace("<!-- SSR_LEVEL_OPTIONS -->", lvl_opts)
            rendered = rendered.replace("/* SSR_INJECTED_DATA */ null", initial_data_json)

            self.send_html(rendered)
            return

        if path == "/api/stats":
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT translation_status, COUNT(*) FROM words GROUP BY translation_status")
            status_map = dict(cur.fetchall())
            cur.execute("SELECT COUNT(*) FROM review_history")
            history_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM export_history")
            export_count = cur.fetchone()[0]

            cur.execute("""
                SELECT predicted_level, COUNT(*) 
                FROM words 
                WHERE translation_status = 'translated' 
                GROUP BY predicted_level
            """)
            level_counts = dict(cur.fetchall())
            conn.close()

            self.send_json({
                "pending": status_map.get("pending", 0),
                "translated": status_map.get("translated", 0),
                "approved": status_map.get("approved", 0),
                "rejected": status_map.get("rejected", 0),
                "exported": status_map.get("exported", 0),
                "history_count": history_count,
                "can_rollback": export_count > 0,
                "level_counts": level_counts
            })
            return

        if path == "/api/words":
            status = query.get("status", ["translated"])[0]
            level = query.get("level", [""])[0]
            limit = int(query.get("limit", [50])[0])
            offset = int(query.get("offset", [0])[0])

            conn = get_db_connection()
            cur = conn.cursor()
            conditions = []
            params = []

            if status != "all":
                conditions.append("translation_status = ?")
                params.append(status)

            if level:
                conditions.append("predicted_level = ?")
                params.append(level.upper())

            where_sql = ("WHERE " + " AND ".join(conditions)) if conditions else ""
            query_sql = f"""
                SELECT priority_rank, batch_id, chunk_100_id, expression, reading,
                       meaning_th, meaning_en, category, predicted_level,
                       translation_status, review_comment, sources_count,
                       best_frequency_rank, sources, exported_at
                FROM words
                {where_sql}
                ORDER BY priority_rank ASC
                LIMIT ? OFFSET ?
            """
            params.extend([limit, offset])
            cur.execute(query_sql, params)
            words = []
            for r in cur.fetchall():
                d = dict(r)
                d["romaji"] = kana_to_romaji(d["reading"])
                words.append(d)
            conn.close()

            self.send_json({"words": words, "count": len(words)})
            return

        if path.startswith("/api/word/"):
            rank_str = path.replace("/api/word/", "").strip()
            if not rank_str.isdigit():
                self.send_json({"error": "Invalid rank"}, HTTPStatus.BAD_REQUEST)
                return

            rank = int(rank_str)
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM words WHERE priority_rank = ?", (rank,))
            r = cur.fetchone()
            conn.close()

            if not r:
                self.send_json({"error": "Word not found"}, HTTPStatus.NOT_FOUND)
                return

            word_dict = dict(r)
            word_dict["romaji"] = kana_to_romaji(word_dict["reading"])
            kanji_breakdown = get_kanji_breakdown(word_dict["expression"])
            similar_words = find_similar_main_words(word_dict["expression"], word_dict["reading"])

            self.send_json({
                "word": word_dict,
                "kanji_breakdown": kanji_breakdown,
                "similar_words": similar_words
            })
            return

        if path == "/api/search":
            q = query.get("q", [""])[0].strip()
            if not q:
                self.send_json({"results": []})
                return

            conn = get_db_connection()
            cur = conn.cursor()

            rank_match = re.match(r"^#?(\d+)$", q)
            if rank_match:
                target_rank = int(rank_match.group(1))
                cur.execute("""
                    SELECT priority_rank, batch_id, expression, reading, meaning_th, meaning_en,
                           category, predicted_level, translation_status, best_frequency_rank
                    FROM words
                    WHERE priority_rank = ?
                    LIMIT 10
                """, (target_rank,))
            else:
                param = f"%{q}%"
                cur.execute("""
                    SELECT priority_rank, batch_id, expression, reading, meaning_th, meaning_en,
                           category, predicted_level, translation_status, best_frequency_rank
                    FROM words
                    WHERE expression LIKE ? OR reading LIKE ? OR meaning_th LIKE ? OR meaning_en LIKE ?
                    ORDER BY 
                        CASE 
                            WHEN expression = ? THEN 1
                            WHEN reading = ? THEN 2
                            WHEN expression LIKE ? THEN 3
                            ELSE 4
                        END,
                        priority_rank ASC
                    LIMIT 15
                """, (param, param, param, param, q, q, f"{q}%"))

            results = []
            for r in cur.fetchall():
                d = dict(r)
                d["romaji"] = kana_to_romaji(d["reading"])
                results.append(d)
            conn.close()

            self.send_json({"results": results})
            return

        if path.startswith("/api/kanji/"):
            raw_char = path.replace("/api/kanji/", "").strip()
            char = unquote(raw_char)
            if not char:
                self.send_json({"error": "Empty character"}, HTTPStatus.BAD_REQUEST)
                return

            info = get_kanji_full_info(char)
            self.send_json(info)
            return

        self.send_json({"error": "Not Found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self):
        global _MAIN_VOCAB_CACHE
        url = urlparse(self.path)
        path = url.path
        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length)

        try:
            payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
        except Exception:
            payload = {}

        if path == "/api/update_level":
            rank = payload.get("priority_rank")
            new_level = (payload.get("level") or payload.get("predicted_level") or "").upper().strip()
            if not rank or new_level not in ("N5", "N4", "N3", "N2", "N1"):
                self.send_json({"error": "Invalid rank or level (must be N1-N5)"}, HTTPStatus.BAD_REQUEST)
                return

            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("UPDATE words SET predicted_level = ? WHERE priority_rank = ?", (new_level, rank))
            conn.commit()
            conn.close()

            sync_csv_from_db()
            self.send_json({"success": True, "priority_rank": rank, "level": new_level})
            return

        if path == "/api/review":
            rank = payload.get("priority_rank")
            decision = payload.get("decision")  # 'approved', 'rejected', 'translated'
            meaning_th = payload.get("meaning_th")
            meaning_en = payload.get("meaning_en")
            new_level = (payload.get("predicted_level") or payload.get("level") or "").upper().strip()
            comment = payload.get("comment", "").strip()

            if not rank or not decision:
                self.send_json({"error": "Missing rank or decision"}, HTTPStatus.BAD_REQUEST)
                return

            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM words WHERE priority_rank = ?", (rank,))
            old_row = cur.fetchone()

            if not old_row:
                conn.close()
                self.send_json({"error": "Word not found"}, HTTPStatus.NOT_FOUND)
                return

            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            # Log to review_history for infinite undo
            cur.execute("""
                INSERT INTO review_history (
                    priority_rank, old_status, new_status,
                    old_meaning_th, new_meaning_th,
                    old_meaning_en, new_meaning_en,
                    old_comment, new_comment, action_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rank,
                old_row["translation_status"],
                decision,
                old_row["meaning_th"],
                meaning_th or old_row["meaning_th"],
                old_row["meaning_en"],
                meaning_en or old_row["meaning_en"],
                old_row["review_comment"],
                comment,
                now_iso
            ))

            # Update words row (incorporating predicted_level if valid)
            if new_level in ("N5", "N4", "N3", "N2", "N1"):
                cur.execute("""
                    UPDATE words
                    SET translation_status = ?,
                        meaning_th = COALESCE(NULLIF(?, ''), meaning_th),
                        meaning_en = COALESCE(NULLIF(?, ''), meaning_en),
                        predicted_level = ?,
                        review_comment = ?,
                        reviewed_at = ?
                    WHERE priority_rank = ?
                """, (decision, meaning_th, meaning_en, new_level, comment, now_iso, rank))
            else:
                cur.execute("""
                    UPDATE words
                    SET translation_status = ?,
                        meaning_th = COALESCE(NULLIF(?, ''), meaning_th),
                        meaning_en = COALESCE(NULLIF(?, ''), meaning_en),
                        review_comment = ?,
                        reviewed_at = ?
                    WHERE priority_rank = ?
                """, (decision, meaning_th, meaning_en, comment, now_iso, rank))

            conn.commit()
            conn.close()

            sync_csv_from_db()
            self.send_json({"success": True, "priority_rank": rank, "decision": decision})
            return

        if path == "/api/undo":
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM review_history ORDER BY history_id DESC LIMIT 1")
            last_action = cur.fetchone()

            if not last_action:
                conn.close()
                self.send_json({"success": False, "message": "ไม่มีประวัติการกระทำย้อนหลัง"}, HTTPStatus.OK)
                return

            rank = last_action["priority_rank"]
            old_status = last_action["old_status"]
            old_th = last_action["old_meaning_th"]
            old_en = last_action["old_meaning_en"]
            old_comment = last_action["old_comment"]

            cur.execute("""
                UPDATE words
                SET translation_status = ?,
                    meaning_th = ?,
                    meaning_en = ?,
                    review_comment = ?
                WHERE priority_rank = ?
            """, (old_status, old_th, old_en, old_comment, rank))

            cur.execute("DELETE FROM review_history WHERE history_id = ?", (last_action["history_id"],))
            conn.commit()
            conn.close()

            sync_csv_from_db()
            self.send_json({"success": True, "restored_rank": rank, "restored_status": old_status})
            return

        if path == "/api/export":
            # Pre-Export Sanity Gate + Auto-Backup + Export to public/data/n*.csv
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                SELECT expression, reading, meaning_en, category, predicted_level, meaning_th, priority_rank
                FROM words
                WHERE translation_status = 'approved'
                ORDER BY priority_rank ASC
            """)
            approved_words = cur.fetchall()

            if not approved_words:
                conn.close()
                self.send_json({"success": False, "error": "ไม่มีคำศัพท์ในสถานะ Approved ให้ส่งออก"})
                return

            # Check duplicates against existing CSVs
            existing_all = set()
            for lvl_file in glob.glob(os.path.join(PUBLIC_DATA_DIR, "n*.csv")):
                with open(lvl_file, "r", encoding="utf-8") as f:
                    for r in csv.DictReader(f):
                        existing_all.add(r["expression"].strip())

            valid_words = []
            skipped = []

            for w in approved_words:
                expr = w["expression"].strip()
                meaning_th = (w["meaning_th"] or "").strip()
                meaning_en = (w["meaning_en"] or "").strip()
                category = w["category"]

                # Gate 1: Thai Script presence
                if not meaning_th or not THAI_CHAR_RE.search(meaning_th):
                    skipped.append({"rank": w["priority_rank"], "expr": expr, "reason": "ไม่มีคำแปลภาษาไทยที่ถูกต้อง"})
                    continue

                # Gate 2: Duplicate check
                if expr in existing_all:
                    skipped.append({"rank": w["priority_rank"], "expr": expr, "reason": "มีคำนี้อยู่ในคลังหลักแล้ว"})
                    continue

                # Gate 3: Verb formatting
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
                conn.close()
                self.send_json({
                    "success": False,
                    "error": "ไม่มีคำศัพท์ที่ผ่านเกณฑ์ตรวจสอบความถูกต้อง (Sanity Gate)",
                    "skipped": skipped
                })
                return

            # Auto-backup
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            backup_dir = os.path.join(BACKUP_BASE_DIR, f"backup_{timestamp}")
            os.makedirs(backup_dir, exist_ok=True)
            for lvl_num in range(1, 6):
                src_csv = os.path.join(PUBLIC_DATA_DIR, f"n{lvl_num}.csv")
                if os.path.exists(src_csv):
                    shutil.copy2(src_csv, os.path.join(backup_dir, f"n{lvl_num}.csv"))

            # Group valid words by target CSV
            by_level: Dict[str, List[Dict[str, Any]]] = {"N1": [], "N2": [], "N3": [], "N4": [], "N5": []}
            for vw in valid_words:
                lvl = vw["predicted_level"].upper()
                if lvl in by_level:
                    by_level[lvl].append(vw)
                else:
                    by_level["N4"].append(vw)

            total_added = 0
            exported_ranks = [vw["priority_rank"] for vw in valid_words]

            for lvl_str, words_to_add in by_level.items():
                if not words_to_add:
                    continue
                csv_file = os.path.join(PUBLIC_DATA_DIR, f"{lvl_str.lower()}.csv")
                with open(csv_file, "a", encoding="utf-8", newline="") as f:
                    writer = csv.writer(f)
                    for item in words_to_add:
                        writer.writerow([
                            item["expression"],
                            item["reading"],
                            item["meaning_en"],
                            item["category"],
                            item["meaning_th"]
                        ])
                        total_added += 1

            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            cur.executemany("""
                UPDATE words
                SET translation_status = 'exported',
                    exported_at = ?
                WHERE priority_rank = ?
            """, [(now_iso, rank) for rank in exported_ranks])

            cur.execute("""
                INSERT INTO export_history (backup_dir, exported_words_count, exported_at, ranks_json)
                VALUES (?, ?, ?, ?)
            """, (backup_dir, total_added, now_iso, json.dumps(exported_ranks)))

            conn.commit()
            conn.close()

            _MAIN_VOCAB_CACHE = None
            sync_csv_from_db()

            self.send_json({
                "success": True,
                "exported_count": total_added,
                "backup_dir": os.path.relpath(backup_dir, PROJECT_ROOT),
                "skipped": skipped
            })
            return

        if path == "/api/rollback":
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM export_history ORDER BY export_id DESC LIMIT 1")
            last_export = cur.fetchone()

            if not last_export:
                conn.close()
                self.send_json({"success": False, "error": "ไม่พบประวัติการส่งออกที่สามารถ Rollback ได้"})
                return

            backup_dir = last_export["backup_dir"]
            if not os.path.exists(backup_dir) and "public/data/backups" in backup_dir:
                backup_dir = backup_dir.replace("public/data/backups", "backend_data/backups")
            ranks = json.loads(last_export["ranks_json"])

            if not os.path.exists(backup_dir):
                conn.close()
                self.send_json({"success": False, "error": f"ไม่พบโฟลเดอร์สำรองข้อมูล: {backup_dir}"})
                return

            for lvl_num in range(1, 6):
                bak_csv = os.path.join(backup_dir, f"n{lvl_num}.csv")
                dest_csv = os.path.join(PUBLIC_DATA_DIR, f"n{lvl_num}.csv")
                if os.path.exists(bak_csv):
                    shutil.copy2(bak_csv, dest_csv)

            cur.executemany("""
                UPDATE words
                SET translation_status = 'approved',
                    exported_at = NULL
                WHERE priority_rank = ?
            """, [(r,) for r in ranks])

            cur.execute("DELETE FROM export_history WHERE export_id = ?", (last_export["export_id"],))
            conn.commit()
            conn.close()

            _MAIN_VOCAB_CACHE = None
            sync_csv_from_db()

            self.send_json({
                "success": True,
                "restored_count": len(ranks),
                "restored_from": os.path.relpath(backup_dir, PROJECT_ROOT)
            })
            return

        self.send_json({"error": "Endpoint Not Found"}, HTTPStatus.NOT_FOUND)

def run_server(port: int = 5174):
    ensure_db_schema()
    server_address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(server_address, RecheckRequestHandler)
    print("=" * 65)
    print(f"  Human Recheck Server running at: http://localhost:{port}/")
    print("=" * 65)
    print("  Pre-rendered SSR : Initial words & real-time counts baked in HTML")
    print("  [➔ Right Arrow] : Approve word")
    print("  [⬅ Left Arrow]  : Reject word")
    print("  [⬇ / S]         : Skip word (ข้ามไปก่อน)")
    print("  [/]             : Live Search & Jump")
    print("  Press Ctrl+C to stop server.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Human Recheck Server.")
        httpd.server_close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Human Recheck Web Server")
    parser.add_argument("--port", type=int, default=5174, help="Port to listen on (default: 5174)")
    args = parser.parse_args()
    run_server(port=args.port)
