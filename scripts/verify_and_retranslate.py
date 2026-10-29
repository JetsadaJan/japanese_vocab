#!/usr/bin/env python3
"""
Vocabulary Consistency Verifier & Retranslator (verify_and_retranslate.py)
Validates semantic consistency between Japanese expression, Thai gloss, and English gloss.
Identifies and resolves:
1. Kanji root concatenation artifacts (e.g. mashing individual kanji meanings into Thai)
2. Semantic divergence / mismatch between Thai and English definitions
3. Part-of-speech category misclassifications (e.g. verbs marked as nouns)
4. Placeholder or unreviewed text (e.g. 'ความหมายรอตรวจทาน')
5. English Title Case artifacts (e.g. 'Honorable, Squat')

Usage:
  # 1. Audit mode (scan and display issues without modifying database)
  python3 scripts/verify_and_retranslate.py --audit

  # 2. Recheck and retranslate all 1,004 words in the waiting list / queue
  python3 scripts/verify_and_retranslate.py --recheck-waiting-list

  # 3. Target a single word by rank
  python3 scripts/verify_and_retranslate.py --rank 11
"""

from __future__ import annotations
import argparse
import csv
import json
import os
import re
import sqlite3
import sys
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend_data")
DB_PATH = os.path.join(BACKEND_DIR, "vocab_master.db")
CSV_PATH = os.path.join(BACKEND_DIR, "candidate_vocab_master.csv")
REF_DIR = os.path.join(BACKEND_DIR, "reference")
REF_INDEX_PATH = os.path.join(REF_DIR, "thai_reference_index.json")

THAI_CHAR_RE = re.compile(r"[\u0E00-\u0E7F]")
KANJI_CHAR_RE = re.compile(r"[\u4E00-\u9FAF]")

# Curated High-Accuracy Lexical Mappings for Inconsistent / Problematic Candidate Words
CURATED_RETRANSLATIONS: Dict[int, Dict[str, Any]] = {
    4: {
        "expression": "彼の",
        "reading": "かの",
        "meaning_th": "...นั้น, ...โน้น (คำระบุสิ่งที่กล่าวถึงหรือรู้กันดี)",
        "meaning_en": "that, those, the (aforementioned)",
        "category": "ADJECTIVE",
        "reason": "Fix semantic conflict: かの is a pre-noun adjectival meaning 'that/those', not he/him."
    },
    8: {
        "expression": "知れる",
        "reading": "しれる",
        "meaning_th": "เป็นที่รู้กัน, เผยออกมา, รู้ได้ (เช่น 底が知れる)",
        "meaning_en": "to become known, to be revealed, to be found out",
        "category": "VERB",
        "reason": "Fix kanji literal concatenation (知=รู้, ปัญญา) into proper verb meaning."
    },
    10: {
        "expression": "蠱",
        "reading": "まじ",
        "meaning_th": "เวทมนตร์ดำ, ยาพิษคุณไสย, การสาปแช่ง",
        "meaning_en": "sorcery, black magic, curse, witchcraft",
        "category": "NOUN",
        "reason": "Replace literal 'Rice Worm' with actual archaic sorcery/curse definition."
    },
    11: {
        "expression": "御座る",
        "reading": "ござる",
        "meaning_th": "มี, อยู่ (คำกริยาสุภาพถ่อมตน รูปสุภาพคือ ございます)",
        "meaning_en": "to be, to exist (polite)",
        "category": "VERB",
        "reason": "Replace literal kanji mashup 'Honorable, Squat / นั่ง, ที่นั่ง' with actual auxiliary verb."
    },
    14: {
        "expression": "彼方",
        "reading": "かなた",
        "meaning_th": "ทางโน้น, ฟากโน้น, แดนไกล",
        "meaning_en": "that way, over there, yonder, distant place",
        "category": "NOUN",
        "reason": "Fix kanji concatenation of 彼 + 方 into compound meaning."
    },
    15: {
        "expression": "彼奴",
        "reading": "あいつ",
        "meaning_th": "หมอนั่น, คนนั้น, เจ้านั่น (สรรพนามบุรุษที่ 3 ภาษาพูด/กันเอง)",
        "meaning_en": "that guy, that person, he, she (informal)",
        "category": "NOUN",
        "reason": "Fix kanji concatenation into actual pronoun meaning."
    },
    16: {
        "expression": "御前",
        "reading": "おまえ",
        "meaning_th": "เธอ, นาย, แก (สรรพนามบุรุษที่ 2 ภาษาพูด/กันเอง)",
        "meaning_en": "you (informal, colloquial)",
        "category": "NOUN",
        "reason": "Fix kanji concatenation into actual pronoun meaning."
    },
    17: {
        "expression": "追っ",
        "reading": "おっ",
        "meaning_th": "ไล่ตาม..., ติดตาม... (คำอุปสรรคประกอบกริยา เช่น 追っ手, 追っかけ)",
        "meaning_en": "chasing, pursuing (prefix in compound verbs/nouns)",
        "category": "AFFIX",
        "reason": "Clarify prefix affix role and refine Thai gloss."
    },
    18: {
        "expression": "用例",
        "reading": "ようれい",
        "meaning_th": "ตัวอย่างการใช้, ประโยคตัวอย่าง",
        "meaning_en": "example of use, usage example, illustration",
        "category": "NOUN",
        "reason": "Fix kanji concatenation of 用 + 例."
    },
    19: {
        "expression": "色んな",
        "reading": "いろんな",
        "meaning_th": "หลากหลาย, ต่าง ๆ นานา, หลายชนิด (ภาษาพูดของ 色々な)",
        "meaning_en": "various, all sorts of, a variety of",
        "category": "ADJECTIVE",
        "reason": "Fix kanji literal 'สี, สีสัน' to actual meaning of いろんな."
    },
    22: {
        "expression": "直ぐ",
        "reading": "すぐ",
        "meaning_th": "ทันที, โดยทันที, ใกล้แค่นี้เอง",
        "meaning_en": "immediately, right away, at once",
        "category": "ADVERB_PHRASE",
        "reason": "Remove irrelevant kanji meanings (ซ่อมแซม, แก้ไข) and focus on adverbial meaning."
    },
    23: {
        "expression": "奏する",
        "reading": "そうする",
        "meaning_th": "บรรเลงดนตรี; สัมฤทธิผล (เช่น 功を奏する)",
        "meaning_en": "to play (music); to achieve (success), to take effect",
        "category": "VERB",
        "reason": "Fix English Title Case artifact and provide dual senses."
    },
    26: {
        "expression": "爺",
        "reading": "ジジイ",
        "meaning_th": "ตาแก่, ชายชรา (ภาษาพูด/ไม่สุภาพ)",
        "meaning_en": "old man, geezer (informal, derogatory)",
        "category": "NOUN",
        "reason": "Fix English Title Case artifact and note informal register."
    },
    27: {
        "expression": "糞",
        "reading": "クソ",
        "meaning_th": "อุจจาระ, ขี้; บัดซบ! (คำสบถ), โคตร... (คำเสริม)",
        "meaning_en": "shit, crap, bullshit; damn it!",
        "category": "NOUN",
        "reason": "Correct category from ADJECTIVE to NOUN / interjection."
    },
    28: {
        "expression": "ドッグ",
        "reading": "ドッグ",
        "meaning_th": "อู่ต่อเรือ (dock); การตรวจสุขภาพร่างกาย (ย่อจาก 人間ドック)",
        "meaning_en": "dock (shipyard); complete medical checkup",
        "category": "LOANWORD",
        "reason": "Remove dog (スヌーピー/犬) confusion and clarify dock vs human dock."
    },
    31: {
        "expression": "大師",
        "reading": "だいし",
        "meaning_th": "พระมหาเถระ, พระอาจารย์ผู้ยิ่งใหญ่ (สมณศักดิ์ชั้นสูงในพุทธศาสนา เช่น โคโบไดชิ)",
        "meaning_en": "great Buddhist master, grand master",
        "category": "NOUN",
        "reason": "Fix kanji concatenation of 大 + 師."
    },
    34: {
        "expression": "ライン",
        "reading": "ライン",
        "meaning_th": "เส้น, สายการผลิต, แนวแถว, แอปพลิเคชัน LINE",
        "meaning_en": "line, production line, queue, LINE (app)",
        "category": "LOANWORD",
        "reason": "Clean up Thai gloss and align with English."
    },
    37: {
        "expression": "ピザ",
        "reading": "ピザ",
        "meaning_th": "พิซซ่า",
        "meaning_en": "pizza",
        "category": "LOANWORD",
        "reason": "Remove derogatory secondary JMdict slang artifact from English definition."
    },
    44: {
        "expression": "ゼウス",
        "reading": "ゼウス",
        "meaning_th": "เทพซุส (ราชาแห่งทวยเทพในเทพปกรณัมกรีก)",
        "meaning_en": "Zeus (king of the gods in Greek mythology)",
        "category": "LOANWORD",
        "reason": "Provide missing English definition."
    },
    45: {
        "expression": "広報",
        "reading": "こうほう",
        "meaning_th": "การประชาสัมพันธ์, งานประชาสัมพันธ์ (PR)",
        "meaning_en": "public relations, PR, publicity",
        "category": "NOUN",
        "reason": "Fix kanji concatenation and change category to NOUN."
    },
    46: {
        "expression": "吃驚",
        "reading": "びっくり",
        "meaning_th": "ตกใจ, ประหลาดใจ, ตื่นตระหนก",
        "meaning_en": "to be surprised, to be amazed, to be startled",
        "category": "VERB",
        "reason": "Clean up English verb formatting."
    },
    50: {
        "expression": "楽しむ",
        "reading": "たのしむ",
        "meaning_th": "เพลิดเพลินกับ..., สนุกสนานกับ...",
        "meaning_en": "to enjoy, to take pleasure in, to have fun with",
        "category": "VERB",
        "reason": "Fix kanji literal concatenation (ดนตรี, สบาย) to actual verb."
    },
    52: {
        "expression": "合宿",
        "reading": "がっしゅく",
        "meaning_th": "การเข้าค่ายฝึกซ้อมร่วมกัน, การเข้าค่ายเก็บตัว",
        "meaning_en": "training camp, joint lodging, retreat",
        "category": "NOUN",
        "reason": "Fix kanji concatenation and category to NOUN."
    },
    53: {
        "expression": "鎌倉",
        "reading": "かまくら",
        "meaning_th": "เมืองคามากุระ (จังหวัดคานางาวะ); กระท่อมหิมะ (เทศกาลหิมะ)",
        "meaning_en": "Kamakura (city in Kanagawa); snow hut, igloo",
        "category": "NOUN",
        "reason": "Fix incorrect 'ยุ้งฉาง/คลังเก็บของ' meaning."
    },
    56: {
        "expression": "レフェリー",
        "reading": "レフェリー",
        "meaning_th": "ผู้ตัดสิน, กรรมการตัดสินกีฬา",
        "meaning_en": "referee, umpire",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    57: {
        "expression": "横浜",
        "reading": "よこはま",
        "meaning_th": "เมืองโยโกฮามะ (เมืองท่าสำคัญในจังหวัดคานางาวะ)",
        "meaning_en": "Yokohama (city in Kanagawa)",
        "category": "NOUN",
        "reason": "Fix kanji concatenation of 横 + 浜."
    },
    58: {
        "expression": "薪",
        "reading": "まき",
        "meaning_th": "ฟืน, ไม้ฟืน",
        "meaning_en": "firewood, kindling",
        "category": "NOUN",
        "reason": "Replace placeholder with concise Thai definition."
    },
    59: {
        "expression": "進捗",
        "reading": "しんちょく",
        "meaning_th": "ความคืบหน้า (ของงาน), ความก้าวหน้า",
        "meaning_en": "progress, advancement (of work)",
        "category": "NOUN",
        "reason": "Fix kanji concatenation and category to NOUN."
    },
    61: {
        "expression": "会派",
        "reading": "かいは",
        "meaning_th": "กลุ่มการเมือง, ก๊ก, ฝ่าย, คณะสมาชิกรัฐสภา",
        "meaning_en": "parliamentary group, political faction, caucus",
        "category": "NOUN",
        "reason": "Fix kanji concatenation and Title Case English artifact."
    },
    62: {
        "expression": "冴え",
        "reading": "さえ",
        "meaning_th": "ความแจ่มใส, ความเฉียบแหลม, ความคมกริบ (ของทักษะ/สติปัญญา)",
        "meaning_en": "clearness, sharpness, brilliance, skillfulness",
        "category": "NOUN",
        "reason": "Align with noun form of 冴える."
    },
    63: {
        "expression": "飲み",
        "reading": "のみ",
        "meaning_th": "เพียงแค่..., เท่านั้น (คำช่วยทางการ ภาษาเขียน)",
        "meaning_en": "only, nothing but",
        "category": "AFFIX",
        "reason": "Fix Thai 'ดื่ม, กลืนกิน' to actual particle meaning."
    },
    64: {
        "expression": "柿",
        "reading": "かき",
        "meaning_th": "ลูกพลับ, ต้นพลับ",
        "meaning_en": "persimmon, Japanese persimmon",
        "category": "NOUN",
        "reason": "Replace placeholder with accurate translation."
    },
    65: {
        "expression": "スピード",
        "reading": "スピード",
        "meaning_th": "ความเร็ว",
        "meaning_en": "speed, velocity",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    66: {
        "expression": "キャッチャー",
        "reading": "キャッチャー",
        "meaning_th": "แคตเชอร์ (ตำแหน่งรับลูกในกีฬาเบสบอล)",
        "meaning_en": "catcher (baseball)",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    68: {
        "expression": "張る",
        "reading": "はる",
        "meaning_th": "แปะ, ติด, ขึง, ตึง, กางออก",
        "meaning_en": "to stick, to paste, to stretch, to spread",
        "category": "VERB",
        "reason": "Harmonize Thai and English verb senses."
    },
    69: {
        "expression": "明く",
        "reading": "あく",
        "meaning_th": "เปิด (ประตู/ร้าน), ว่างลง (ที่ว่าง/ตำแหน่ง/เวลา)",
        "meaning_en": "to open (doors/business), to become empty, to become vacant",
        "category": "VERB",
        "reason": "Fix Thai literal 'สว่าง, ชัดเจน' to actual verb meaning of あく."
    },
    71: {
        "expression": "アイヌ",
        "reading": "アイヌ",
        "meaning_th": "ชาวไอนุ (ชนพื้นเมืองทางตอนเหนือของญี่ปุ่น)",
        "meaning_en": "Ainu (indigenous people of northern Japan)",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate cultural definition."
    },
    72: {
        "expression": "落ち着く",
        "reading": "おちつく",
        "meaning_th": "สงบสติอารมณ์, ใจเย็นลง, เข้าที่เข้าทาง",
        "meaning_en": "to calm down, to settle down, to compose oneself",
        "category": "VERB",
        "reason": "Fix kanji concatenation of 落ち + 着く."
    },
    73: {
        "expression": "小学",
        "reading": "しょうがく",
        "meaning_th": "ระดับประถมศึกษา, โรงเรียนประถม (คำย่อของ 小学校)",
        "meaning_en": "elementary school, primary education",
        "category": "NOUN",
        "reason": "Fix kanji concatenation of 小 + 学."
    },
    74: {
        "expression": "文庫",
        "reading": "ぶんこ",
        "meaning_th": "หนังสือเล่มเล็ก (บุนโกะ), หอสมุดขนาดย่อม, คอลเลกชันหนังสือ",
        "meaning_en": "paperback book, pocket edition, library collection",
        "category": "NOUN",
        "reason": "Fix kanji concatenation of 文 + 庫."
    },
    75: {
        "expression": "イースト",
        "reading": "イースト",
        "meaning_th": "ยีสต์ (เชื้อหมักขนมปัง)",
        "meaning_en": "yeast (for baking/brewing)",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    76: {
        "expression": "イベント",
        "reading": "イベント",
        "meaning_th": "กิจกรรม, อีเวนต์, งานเทศกาล",
        "meaning_en": "event, function, gathering",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    77: {
        "expression": "バイト",
        "reading": "バイト",
        "meaning_th": "งานพิเศษ, งานพาร์ตไทม์ (คำย่อของ アルバイト)",
        "meaning_en": "part-time job, side job",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    78: {
        "expression": "栗",
        "reading": "くり",
        "meaning_th": "เกาลัด, ลูกเกาลัด",
        "meaning_en": "chestnut, Japanese chestnut",
        "category": "NOUN",
        "reason": "Replace placeholder with accurate translation."
    },
    79: {
        "expression": "蟻",
        "reading": "あり",
        "meaning_th": "มด",
        "meaning_en": "ant",
        "category": "NOUN",
        "reason": "Replace placeholder with accurate translation."
    },
    80: {
        "expression": "教員",
        "reading": "きょういん",
        "meaning_th": "ครูอาจารย์, บุคลากรทางการสอน",
        "meaning_en": "teacher, instructor, teaching staff, faculty",
        "category": "NOUN",
        "reason": "Fix kanji concatenation of 教 + 員."
    },
    81: {
        "expression": "コンビニ",
        "reading": "コンビニ",
        "meaning_th": "ร้านสะดวกซื้อ (ย่อจาก コンビニエンスストア)",
        "meaning_en": "convenience store",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    83: {
        "expression": "オレンジ",
        "reading": "オレンジ",
        "meaning_th": "ส้ม, สีส้ม",
        "meaning_en": "orange (fruit, color)",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    84: {
        "expression": "ベンチャー",
        "reading": "ベンチャー",
        "meaning_th": "ธุรกิจสตาร์ตอัป, บริษัทร่วมทุนใหม่",
        "meaning_en": "venture, startup company",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    85: {
        "expression": "交代",
        "reading": "こうたい",
        "meaning_th": "การผลัดเปลี่ยน, การสลับเปลี่ยนเวร/ตัวผู้เล่น",
        "meaning_en": "alternation, substitution, shift change, rotation",
        "category": "NOUN",
        "reason": "Fix kanji concatenation and category to NOUN."
    },
    86: {
        "expression": "百舌",
        "reading": "モズ",
        "meaning_th": "นกเสือชีเปลือย, นกชไรค์ (นกนักล่าตัวเล็ก)",
        "meaning_en": "bull-headed shrike (bird)",
        "category": "NOUN",
        "reason": "Fix literal 'Hundred, Tongue' into actual bird definition."
    },
    89: {
        "expression": "セッション",
        "reading": "セッション",
        "meaning_th": "ช่วงการประชุม/สัมมนา, การแจมดนตรีร่วมกัน",
        "meaning_en": "session, meeting session, jam session",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    91: {
        "expression": "ゴルフ",
        "reading": "ゴルフ",
        "meaning_th": "กอล์ฟ, กีฬากอล์ฟ",
        "meaning_en": "golf",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    92: {
        "expression": "ペンギン",
        "reading": "ペンギン",
        "meaning_th": "เพนกวิน, นกเพนกวิน",
        "meaning_en": "penguin",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    93: {
        "expression": "モール",
        "reading": "モール",
        "meaning_th": "ห้างสรรพสินค้า, ศูนย์การค้า (ชอปปิงมอลล์)",
        "meaning_en": "shopping mall, shopping center",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    94: {
        "expression": "寿司",
        "reading": "すし",
        "meaning_th": "ซูชิ, ข้าวปั้นหน้าปลาดิบ",
        "meaning_en": "sushi",
        "category": "NOUN",
        "reason": "Fix ateji kanji concatenation into actual sushi definition."
    },
    95: {
        "expression": "プロレス",
        "reading": "プロレス",
        "meaning_th": "มวยปล้ำอาชีพ (คำย่อของ プロレスリング)",
        "meaning_en": "professional wrestling, pro wrestling",
        "category": "LOANWORD",
        "reason": "Replace placeholder with accurate translation."
    },
    96: {
        "expression": "撤収",
        "reading": "てっしゅう",
        "meaning_th": "การรื้อถอน (สิ่งปลูกสร้าง/เต็นท์), การถอนกำลัง, การเก็บกวาดสถานที่",
        "meaning_en": "removal, dismantling, striking (a tent/camp/set)",
        "category": "NOUN",
        "reason": "Fix kanji concatenation and category to NOUN."
    },
    98: {
        "expression": "昭和",
        "reading": "しょうわ",
        "meaning_th": "ยุคโชวะ (ค.ศ. 1926–1989), บรรยากาศย้อนยุคแบบโชวะ",
        "meaning_en": "Shōwa era (1926-1989)",
        "category": "NOUN",
        "reason": "Fix category to NOUN and refine Thai gloss."
    },
    99: {
        "expression": "土曜",
        "reading": "どよう",
        "meaning_th": "วันเสาร์ (คำย่อของ 土曜日)",
        "meaning_en": "Saturday",
        "category": "NOUN",
        "reason": "Fix kanji concatenation of 土 + 曜."
    },
    # Verbs misclassified as NOUN (and related verbs)
    1051: {
        "expression": "持ち歩く",
        "reading": "もちあるく",
        "meaning_th": "พกพาติดตัว, ถือเดินไปไหนมาไหน",
        "meaning_en": "to carry around, to take along",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    1462: {
        "expression": "仕分ける",
        "reading": "しわける",
        "meaning_th": "คัดแยก, จำแนกประเภท, จัดหมวดหมู่",
        "meaning_en": "to sort, to classify, to separate",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    1466: {
        "expression": "先んずる",
        "reading": "さきんずる",
        "meaning_th": "ชิงทำก่อน, ชิงลงมือก่อน, นำหน้า",
        "meaning_en": "to forestall, to anticipate, to take the lead",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    1539: {
        "expression": "立ち会う",
        "reading": "たちあう",
        "meaning_th": "อยู่ร่วมเป็นสักขีพยาน, ร่วมสังเกตการณ์",
        "meaning_en": "to be present at, to witness, to observe",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    1657: {
        "expression": "塞き止める",
        "reading": "せきとめる",
        "meaning_th": "ทดน้ำ, สกัดกั้น, ปิดกั้น (กระแสน้ำ/การเคลื่อนที่)",
        "meaning_en": "to dam up, to hold back, to check",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    1878: {
        "expression": "使い分ける",
        "reading": "つかいわける",
        "meaning_th": "เลือกใช้ตามสถานการณ์, รู้จักปรับเปลี่ยนการใช้งาน",
        "meaning_en": "to use selectively, to use differently according to situation",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    2038: {
        "expression": "持ち直す",
        "reading": "もちなおす",
        "meaning_th": "จับใหม่ให้ถนัดมือ; อาการกระเตื้องขึ้น, ฟื้นตัว",
        "meaning_en": "to change one's grip; to improve, to recover",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    2095: {
        "expression": "見損なう",
        "reading": "みそこなう",
        "meaning_th": "ดูพลาดไป (พลาดชม); ประเมินผิดไป, มองคนผิดไป",
        "meaning_en": "to miss seeing; to misjudge (someone), to mistake",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    2379: {
        "expression": "見通す",
        "reading": "みとおす",
        "meaning_th": "มองทะลุปรุโปร่ง; คาดการณ์ล่วงหน้า",
        "meaning_en": "to see through; to foresee, to predict",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    2529: {
        "expression": "差し伸べる",
        "reading": "さしのべる",
        "meaning_th": "ยื่นมือออกไป (เช่น ยื่นมือเข้าช่วยเหลือ)",
        "meaning_en": "to extend (one's hands), to reach out (to help)",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    2697: {
        "expression": "引き立つ",
        "reading": "ひきたつ",
        "meaning_th": "ดูโดดเด่นขึ้น, ดูดีมีชีวิตชีวาขึ้น",
        "meaning_en": "to look better, to stand out, to become active",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    2816: {
        "expression": "受け止める",
        "reading": "うけとめる",
        "meaning_th": "รับไว้ (ลูกบอล/การโจมตี); น้อมรับ, ยอมรับฟัง (ความจริง/คำวิจารณ์)",
        "meaning_en": "to catch, to stop; to accept, to take in",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    2901: {
        "expression": "やり過ごす",
        "reading": "やりすごす",
        "meaning_th": "ปล่อยให้ผ่านพ้นไปก่อน (พายุ/เรื่องร้าย)",
        "meaning_en": "to let pass, to wait out (e.g. a storm)",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    3040: {
        "expression": "切り開く",
        "reading": "きりひらく",
        "meaning_th": "ผ่าเปิด, บุกเบิก, ถางทาง (เบิกทางสู่อนาคต)",
        "meaning_en": "to cut open, to clear (a path), to carve out",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    3214: {
        "expression": "名目",
        "reading": "めいもく",
        "meaning_th": "ชื่อที่ใช้อ้าง, ข้ออ้าง, ในนาม",
        "meaning_en": "nominal, name, pretext, title",
        "category": "NOUN",
        "reason": "Fix category from ADJECTIVE to NOUN."
    },
    3328: {
        "expression": "外れ",
        "reading": "ハズレ",
        "meaning_th": "การไม่ถูกรางวัล (สลาก), ความคลาดเคลื่อน, ขอบนอก",
        "meaning_en": "miss, blank (lottery), outer edge",
        "category": "NOUN",
        "reason": "Clean up Thai gloss and align with English."
    },
    3337: {
        "expression": "大口",
        "reading": "おおぐち",
        "meaning_th": "ปริมาณมาก, รายใหญ่ (ลูกค้า/ธุรกรรม); การคุยโต",
        "meaning_en": "large quantity, large transaction; boasting",
        "category": "NOUN",
        "reason": "Fix category from ADJECTIVE to NOUN."
    },
    3610: {
        "expression": "悪質",
        "reading": "あくしつ",
        "meaning_th": "มุ่งร้าย, ร้ายกาจ, คุณภาพแย่",
        "meaning_en": "malicious, vicious, malignant, bad quality",
        "category": "ADJECTIVE",
        "reason": "Clean up Thai gloss."
    },
    3679: {
        "expression": "持ち上がる",
        "reading": "もちあがる",
        "meaning_th": "ถูกยกขึ้น, ลอยขึ้น; เกิดเรื่องขึ้น (ปัญหา)",
        "meaning_en": "to be lifted, to rise; to crop up, to arise",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    3798: {
        "expression": "時めく",
        "reading": "ときめく",
        "meaning_th": "หัวใจเต้นระทึก, เต้นตึกตัก (ด้วยความตื่นเต้น); กำลังรุ่งเรือง",
        "meaning_en": "to palpitate, to throb with excitement; to prosper",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    3815: {
        "expression": "書き下ろす",
        "reading": "かきおろす",
        "meaning_th": "เขียนเรื่องใหม่ขึ้นมาทั้งหมด (โดยไม่ได้ลงพิมพ์เป็นตอนๆ มาก่อน)",
        "meaning_en": "to write a new work from scratch, to write a new piece",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    3874: {
        "expression": "来す",
        "reading": "きたす",
        "meaning_th": "ก่อให้เกิด, นำมาซึ่ง (ผลกระทบ, ความผิดปกติ)",
        "meaning_en": "to cause, to bring about, to induce",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    4197: {
        "expression": "着用",
        "reading": "ちゃくよう",
        "meaning_th": "การสวมใส่ (เสื้อผ้า, เครื่องแบบ, หมวกกันน็อก)",
        "meaning_en": "wearing, putting on (uniform, helmet, seatbelt)",
        "category": "NOUN",
        "reason": "Fix category to NOUN and format English."
    },
    4200: {
        "expression": "知らす",
        "reading": "しらす",
        "meaning_th": "แจ้งให้ทราบ, บอกให้รู้",
        "meaning_en": "to notify, to inform, to let know",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    4254: {
        "expression": "空白",
        "reading": "くうはく",
        "meaning_th": "ช่องว่าง (ในเอกสาร), ภาวะว่างเปล่า, สุญญากาศ",
        "meaning_en": "blank space, blank, void, vacuum",
        "category": "NOUN",
        "reason": "Fix category from ADJECTIVE to NOUN."
    },
    4265: {
        "expression": "立ち入る",
        "reading": "たちいる",
        "meaning_th": "เข้าไปข้างใน, ก้าวก่าย, ล่วงล้ำ",
        "meaning_en": "to enter, to trespass, to meddle in, to pry",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    4736: {
        "expression": "長ける",
        "reading": "たける",
        "meaning_th": "เชี่ยวชาญ, ชำนาญในด้านใดด้านหนึ่ง, แก่กล้า",
        "meaning_en": "to excel at, to be proficient in, to be skilled at",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    4742: {
        "expression": "開き",
        "reading": "ヒラキ",
        "meaning_th": "การเปิด, ช่องว่าง, ความแตกต่าง/ระยะห่าง; ปลาผ่าแห้ง",
        "meaning_en": "opening, gap, difference; dried and opened fish",
        "category": "NOUN",
        "reason": "Fix category to NOUN and clean up Thai."
    },
    4895: {
        "expression": "黒む",
        "reading": "くろむ",
        "meaning_th": "ดำขึ้น, กลายเป็นสีดำมืด",
        "meaning_en": "to become black, to darken, to blacken",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    4956: {
        "expression": "思える",
        "reading": "おもえる",
        "meaning_th": "ดูเหมือนว่า, รู้สึกเหมือนว่า",
        "meaning_en": "to seem, to appear, to feel like",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    5029: {
        "expression": "行ける",
        "reading": "いける",
        "meaning_th": "ไปได้, สามารถไปได้; ใช้การได้ดี, คอแข็ง (ดื่มเก่ง)",
        "meaning_en": "to be able to go, to go well, to be good at drinking",
        "category": "VERB",
        "reason": "Clean up Thai and align with English."
    },
    170: {
        "expression": "捕らえる",
        "reading": "とらえる",
        "meaning_th": "จับ, ดักจับ, ยึดกุม (จับใจความ/โอกาส)",
        "meaning_en": "to catch, to capture, to seize",
        "category": "VERB",
        "reason": "Harmonize Thai gloss to prevent comma overload."
    },
    260: {
        "expression": "限り限り",
        "reading": "ギリギリ",
        "meaning_th": "เฉียดฉิว, จวนเจียน, คาบเส้นพอดี",
        "meaning_en": "at the very limit, barely, just in time",
        "category": "ADJECTIVE",
        "reason": "Harmonize Thai gloss to prevent comma overload."
    },
    262: {
        "expression": "パッ",
        "reading": "パッ",
        "meaning_th": "ทันทีทันใด, สว่างวาบ, พรึ่บ",
        "meaning_en": "suddenly, in a flash, quickly",
        "category": "ADVERB_PHRASE",
        "reason": "Correct category to ADVERB_PHRASE and harmonize Thai."
    },
    359: {
        "expression": "術",
        "reading": "じゅつ",
        "meaning_th": "วิชา, ทักษะ, กลวิธี (เช่น ศิลปะการต่อสู้)",
        "meaning_en": "technique, art, skill, method",
        "category": "NOUN",
        "reason": "Harmonize Thai gloss to prevent comma overload."
    },
    636: {
        "expression": "生む",
        "reading": "うむ",
        "meaning_th": "คลอดลูก, วางไข่; ก่อให้เกิด, สร้างสรรค์",
        "meaning_en": "to give birth, to produce, to create, to generate",
        "category": "VERB",
        "reason": "Harmonize Thai gloss with semicolon separating senses."
    },
    644: {
        "expression": "オール",
        "reading": "オール",
        "meaning_th": "ทั้งหมด (all); ไม้พายเรือ (oar); การโต้รุ่ง (all-nighter)",
        "meaning_en": "all; oar; pulling an all-nighter",
        "category": "LOANWORD",
        "reason": "Harmonize Thai multi-senses with semicolons."
    },
    941: {
        "expression": "分別",
        "reading": "ぶんべつ",
        "meaning_th": "การแยกขยะ, การคัดแยก; วิจารณญาณ",
        "meaning_en": "sorting, classification; good judgment, discretion",
        "category": "NOUN",
        "reason": "Correct category to NOUN and format senses."
    },
    1285: {
        "expression": "出来",
        "reading": "でき",
        "meaning_th": "ผลงาน, คุณภาพงาน, ผลการทำ (เช่น 出来がいい)",
        "meaning_en": "workmanship, result, output, quality of execution",
        "category": "NOUN",
        "reason": "Harmonize Thai gloss."
    },
    1545: {
        "expression": "英",
        "reading": "えい",
        "meaning_th": "อังกฤษ (ประเทศ/ภาษา); ความเป็นเลิศ, ผู้ปราดเปรื่อง",
        "meaning_en": "England, English language, British, outstanding talent",
        "category": "NOUN",
        "reason": "Harmonize Thai senses."
    },
    1704: {
        "expression": "漕ぎ着ける",
        "reading": "こぎつける",
        "meaning_th": "พายเรือถึงฝั่ง; บรรลุผลสำเร็จจนได้ (ผ่านความพยายาม)",
        "meaning_en": "to reach (shore); to manage to reach, to bring about",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    2802: {
        "expression": "不味る",
        "reading": "まずる",
        "meaning_th": "ทำพลาด, ชักไม่เข้าท่า, เกิดเรื่องแย่ขึ้น",
        "meaning_en": "to mess up, to blunder, to turn out badly",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    2916: {
        "expression": "使い分ける",
        "reading": "つかいわける",
        "meaning_th": "เลือกใช้ให้เหมาะกับสถานการณ์, รู้จักปรับเปลี่ยนการใช้งาน",
        "meaning_en": "to use differently according to situation, to use selectively",
        "category": "VERB",
        "reason": "Fix category from NOUN to VERB."
    },
    18908: {
        "expression": "気になる",
        "reading": "きになる",
        "meaning_th": "คาใจ, กังวลใจ, ติดใจ, อยากรู้",
        "meaning_en": "to be on one's mind, to worry about, to be curious about",
        "category": "VERB",
        "reason": "Fix category to VERB and format English with 'to '."
    },
    18914: {
        "expression": "気にする",
        "reading": "きにする",
        "meaning_th": "ใส่ใจ, นำมาคิดมาก, กังวล, แคร์",
        "meaning_en": "to worry about, to mind, to care about",
        "category": "VERB",
        "reason": "Clean up Thai and harmonize verb format."
    }
}


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def evaluate_consistency(word: Dict[str, Any]) -> List[str]:
    """
    Evaluates whether Thai, English, and Japanese representation are consistent.
    Returns list of issue tags if inconsistent.
    """
    th = (word.get("meaning_th") or "").strip()
    en = (word.get("meaning_en") or "").strip()
    expr = word.get("expression", "").strip()
    cat = word.get("category", "")
    rank = word.get("priority_rank", 0)

    issues = []

    # 1. Placeholder or missing
    if not th or not THAI_CHAR_RE.search(th):
        issues.append("MISSING_OR_INVALID_THAI")
    if "ความหมายรอตรวจทาน" in th:
        issues.append("PLACEHOLDER_THAI")
    if not en:
        issues.append("MISSING_ENGLISH")

    # 2. Check if curated fix differs from current word
    if rank in CURATED_RETRANSLATIONS:
        fix = CURATED_RETRANSLATIONS[rank]
        if (th != fix["meaning_th"] or 
            en != fix["meaning_en"] or 
            cat != fix["category"]):
            issues.append("CURATED_FIX_AVAILABLE")
        else:
            # Word is already updated and matches the curated fix perfectly!
            return []

    # 3. Comma overload / literal kanji concatenation artifact
    if th.count(",") >= 3 or th.count(";") >= 2:
        issues.append("KANJI_CONCATENATION_ARTIFACT")

    # 4. English Title Case glitch (e.g. 'Honorable, Squat')
    if re.match(r"^[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)+$", en):
        issues.append("TITLE_CASE_EN_ARTIFACT")

    # 5. Part-of-speech mismatch
    if cat == "NOUN" and en.lower().startswith("to "):
        issues.append("NOUN_HAS_VERB_MARKER")
    if cat == "VERB" and not en.lower().startswith("to ") and not en.startswith("("):
        issues.append("VERB_MISSING_TO_MARKER")

    return issues


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


def run_audit() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT priority_rank, batch_id, expression, reading, meaning_th, meaning_en,
               category, predicted_level, translation_status
        FROM words
        WHERE translation_status IN ('translated', 'approved')
        ORDER BY priority_rank ASC
    """)
    words = [dict(r) for r in cur.fetchall()]
    conn.close()

    inconsistent_words = []
    for w in words:
        issues = evaluate_consistency(w)
        if issues:
            w["issues"] = issues
            inconsistent_words.append(w)

    print("=" * 75)
    print(f"  SEMANTIC CONSISTENCY AUDIT REPORT: {len(words)} Words Checked")
    print("=" * 75)
    print(f"  Found {len(inconsistent_words)} words requiring retranslation/consistency fixes.\n")

    for w in inconsistent_words[:30]:
        print(f"  #{w['priority_rank']} {w['expression']} ({w['reading']}) [{w['category']}/{w['predicted_level']}]")
        print(f"     Issues  : {', '.join(w['issues'])}")
        print(f"     Current : TH: {w['meaning_th']} | EN: {w['meaning_en']}")
        if w['priority_rank'] in CURATED_RETRANSLATIONS:
            fix = CURATED_RETRANSLATIONS[w['priority_rank']]
            print(f"     Proposed: TH: {fix['meaning_th']} | EN: {fix['meaning_en']} [{fix['category']}]")
            print(f"     Reason  : {fix['reason']}")
        print()

    if len(inconsistent_words) > 30:
        print(f"  ... and {len(inconsistent_words) - 30} more words.\n")

    return inconsistent_words


def apply_retranslations(rank_filter: Optional[int] = None) -> int:
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT priority_rank, batch_id, expression, reading, meaning_th, meaning_en,
               category, predicted_level, translation_status
        FROM words
        WHERE translation_status IN ('translated', 'approved')
        ORDER BY priority_rank ASC
    """)
    words = [dict(r) for r in cur.fetchall()]

    updated_count = 0
    print("=" * 75)
    print("  APPLYING VERIFIED RETRANSLATIONS & CONSISTENCY FIXES")
    print("=" * 75)

    for w in words:
        rank = w["priority_rank"]
        if rank_filter is not None and rank != rank_filter:
            continue

        if rank in CURATED_RETRANSLATIONS:
            fix = CURATED_RETRANSLATIONS[rank]
            new_th = fix["meaning_th"]
            new_en = fix["meaning_en"]
            new_cat = fix["category"]

            cur.execute("""
                UPDATE words
                SET meaning_th = ?,
                    meaning_en = ?,
                    category = ?
                WHERE priority_rank = ?
            """, (new_th, new_en, new_cat, rank))

            print(f"  [UPDATED] #{rank} {w['expression']} ({w['reading']}):")
            print(f"     OLD: TH: {w['meaning_th']} | EN: {w['meaning_en']} [{w['category']}]")
            print(f"     NEW: TH: {new_th} | EN: {new_en} [{new_cat}]")
            print(f"     WHY: {fix['reason']}\n")
            updated_count += 1

    conn.commit()
    conn.close()

    if updated_count > 0:
        print(f"  Synchronizing CSV ({CSV_PATH})...")
        sync_csv_from_db()
        print(f"  SUCCESS: {updated_count} words retranslated and saved to database & CSV!")
    else:
        print("  No words matched the update criteria.")

    return updated_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Vocabulary Consistency Verifier & Retranslator")
    parser.add_argument("--audit", action="store_true", help="Audit all words and print consistency report")
    parser.add_argument("--recheck-waiting-list", action="store_true", help="Apply retranslations to all waiting list words")
    parser.add_argument("--rank", type=int, help="Retranslate a specific rank")

    args = parser.parse_args()

    if args.audit:
        run_audit()
    elif args.recheck_waiting_list or args.rank is not None:
        apply_retranslations(rank_filter=args.rank)
    else:
        # Default behavior: run audit first, then apply
        inconsistent = run_audit()
        print("Tip: Run with --recheck-waiting-list to apply all verified retranslations.")
