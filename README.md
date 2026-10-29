# JLPT Kotoba Master

[![Release](https://img.shields.io/badge/Release-v1.0.0-blue.svg)](https://github.com/JetsadaJan/japanese_vocab/releases/tag/v1.0.0)
[![Offline](https://img.shields.io/badge/Offline-100%25-brightgreen.svg)]()
[![PWA](https://img.shields.io/badge/PWA-Ready-orange.svg)]()
[![Tauri](https://img.shields.io/badge/Desktop-Tauri%20v2-blueviolet.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

JLPT Kotoba Master is an offline-first Japanese language learning and quiz application covering all Japanese Language Proficiency Test (JLPT) levels from N5 through N1. It features 100% bilingual Thai and English translations, furigana readings, romaji, bidirectional kanji cross-references, confusable word nuance distinctions, 48 curated semantic category groups, an interactive quiz engine, and offline speech synthesis.

> **Project Notice:** This repository is an independent open-source side project created as a lightweight, zero-latency study companion for Japanese learners. It requires no user registration, sends zero telemetry, makes no external network requests after installation, and runs 100% offline across desktop and mobile devices.

---

## Recommended Downloads (Release v1.0.0)

Compiled desktop installers are published on the [GitHub Releases v1.0.0](https://github.com/JetsadaJan/japanese_vocab/releases/tag/v1.0.0) page:

| Operating System | Recommended Package | Size | Description |
| :--- | :--- | :--- | :--- |
| Windows (10/11, 64-bit) | [JLPT.Kotoba.Master_1.0.0_x64-setup.exe](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT.Kotoba.Master_1.0.0_x64-setup.exe) | 3.06 MB | Standalone NSIS installer. Automatically sets up desktop and Start Menu shortcuts. |
| macOS (Apple Silicon M1-M4) | [JLPT_Kotoba_Master_1.0.0_aarch64.dmg](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT_Kotoba_Master_1.0.0_aarch64.dmg) | 5.80 MB | Standard Apple disk image (`.dmg`). Drag-and-drop installation into `/Applications`. |
| iOS (iPhone / iPad) | Progressive Web App (PWA) | No download | Install directly to home screen via Safari (fullscreen offline application). |
| Android (Phone / Tablet) | Progressive Web App (PWA) | No download | Install directly as a native WebAPK via Google Chrome. |

---

## Verified Dataset Metrics

All figures below reflect the verified records bundled in `public/data/`:

| Dataset Category | Exact Record Count | Description and Structure |
| :--- | :--- | :--- |
| JLPT N5 Vocabulary | 753 terms | Essential beginner vocabulary with 100% Thai and English definitions (`public/data/n5.csv`). |
| JLPT N4 Vocabulary | 773 terms | Elementary compound words, daily verbs, and adjectives (`public/data/n4.csv`). |
| JLPT N3 Vocabulary | 2,367 terms | Intermediate expressions, compound verbs, and contextual nuance (`public/data/n3.csv`). |
| JLPT N2 Vocabulary | 2,150 terms | Upper-intermediate business, academic, and daily communication words (`public/data/n2.csv`). |
| JLPT N1 Vocabulary | 2,827 terms | Advanced vocabulary, formal prose, news media, and specialized terms (`public/data/n1.csv`). |
| **Total Vocabulary** | **8,870 terms** | **100% complete Thai translations (`meaningTh`), English meanings (`meaning`), and furigana readings.** |
| Kanji Database | 13,108 characters | Comprehensive dictionary (`public/data/kanji.json`) covering 100% of the 2,028 unique kanji appearing in the vocabulary, with Thai meanings, stroke counts, on/kun readings, and JLPT tiers. |
| Semantic Nuance Groups | 48 curated groups | In-depth distinction modules (`public/data/semantic-groups.json`) covering 512 keywords and 333 pedagogical member notes with nuance differences, common pitfalls, and Japanese/Thai example sentences. |

---

## Core Application Features

### 1. Interactive Quiz Engine
- **Three Quiz Directions:** Japanese to Thai/English (`JA_TO_EN`), Thai/English to Japanese (`EN_TO_JA`), and Randomized Mixed (`MIXED`).
- **Bilingual Meaning Display:** Toggle between Thai (`TH`), English (`EN`), or simultaneous bilingual display (`BOTH`).
- **Smart Mix Level Distribution:** Test specific target levels or apply custom distribution weights (e.g., 70% N3, 20% N4, 10% N5).
- **Distractor Optimization:** Distractors are intelligently selected from similar grammatical categories and JLPT tiers to prevent obvious elimination.
- **Session Lengths:** 10, 20, 30, 50 questions, or Endless mode.

### 2. Spaced Mistake Tracking & Review Mode
- **Persistent Mistake Store:** Incorrect answers are stored in `localStorage` across sessions.
- **Review Quiz Mode:** Target only previously missed vocabulary (`MISTAKES_ONLY`) with cooldown intervals to reinforce weak points.

### 3. Word Explorer and Kanji Inspector
- **Vocabulary Search:** Instant client-side search across Japanese expressions, readings, English meanings, and Thai keywords.
- **Kanji Breakdown Modal:** Clicking any kanji character reveals its stroke count, on/kun readings, Thai definition, and a list of all vocabulary words in the database containing that kanji.
- **Confusable Words and Semantic Groups:** Identifies words with overlapping meanings (e.g., giving/receiving verbs, seeing/watching verbs, wearing clothes/shoes) and presents detailed usage notes with contextual example sentences.

### 4. Native Audio Pronunciation
- Utilizes the Web Speech API (`SpeechSynthesis`) with `ja-JP` locale voice matching for offline Japanese speech synthesis.

### 5. Display Customization
- Toggle Furigana (Hiragana annotations above expressions) on or off.
- Toggle Romaji transliteration on or off.

---

## Platform Installation Guides

### 1. Windows Installation (Recommended: `.exe`)

1. Download [JLPT.Kotoba.Master_1.0.0_x64-setup.exe](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT.Kotoba.Master_1.0.0_x64-setup.exe).
2. Double-click the downloaded executable to start the setup wizard.
3. *Windows SmartScreen Note:* If prompted by Windows SmartScreen ("Windows protected your PC"):
   - Click **More info**.
   - Click **Run anyway**.
4. Follow the setup prompts to choose your install directory (defaults to `%LOCALAPPDATA%\Programs\JLPT Kotoba Master`).
5. Launch **JLPT Kotoba Master** via the newly created Desktop or Start Menu shortcut.

---

### 2. macOS Installation (Recommended: `.dmg`)

1. Download [JLPT_Kotoba_Master_1.0.0_aarch64.dmg](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT_Kotoba_Master_1.0.0_aarch64.dmg).
2. Double-click the `.dmg` file to mount it.
3. Drag the **JLPT Kotoba Master** icon into the **Applications** folder.
4. Launch from Launchpad or `/Applications`.

*macOS Gatekeeper First-Launch Note:* Because this is an independent open-source side project without a paid Apple Developer certificate, Gatekeeper may display an unidentified developer notice on first launch:
- Right-click `JLPT Kotoba Master.app` in Finder, choose **Open**, and click **Open** on the confirmation dialog.
- Alternatively, run this command in Terminal:
  ```bash
  xattr -cr "/Applications/JLPT Kotoba Master.app"
  ```

---

### 3. iOS Installation (iPhone & iPad)

1. Open the application URL in **Safari**.
2. Tap the **Share** button (box with an upward arrow at the bottom toolbar).
3. Select **Add to Home Screen**.
4. Tap **Add** in the top right.
5. Launch the application from your home screen. It will open in standalone fullscreen mode and function 100% offline via Service Worker caching.

---

### 4. Android Installation

1. Open the application URL in **Google Chrome**.
2. Tap the three-dot menu icon in the upper right.
3. Select **Install app** or **Add to Home screen**.
4. Confirm installation. The application will be installed into your app drawer as an offline-ready WebAPK.

---

## Offline Architecture

The application is engineered to operate without external network dependencies:
- **Local Data Files:** All vocabulary tables (`n5.csv` through `n1.csv`), the kanji dictionary (`kanji.json`), and the semantic groups (`semantic-groups.json`) reside in `public/data/` and are resolved relatively via `import.meta.env.BASE_URL`.
- **Workbox Service Worker:** Pre-caches the entire application bundle, including stylesheets, fonts, and the 2.8 MB kanji database (configured with a 6 MB maximum cache threshold in `vite.config.ts`).
- **Zero Third-Party Runtime Dependencies:** No external CDNs, tracking scripts, or remote APIs are invoked during operation.

---

## Local Development and Building

### Prerequisites
- Node.js 18 or higher ([nodejs.org](https://nodejs.org/))
- npm 9 or higher
- Rust toolchain (required only for building native desktop binaries via Tauri)

### Commands

```bash
# Clone the repository
git clone https://github.com/JetsadaJan/japanese_vocab.git
cd japanese_vocab

# Install dependencies
npm install

# Start Vite development server (http://localhost:5173/)
npm run dev

# TypeScript type check and production web build
npm run build

# Preview production build locally
npm run preview
```

### Desktop Development (Tauri v2)

```bash
# Run desktop application in development mode
npm run tauri dev

# Compile production installers for host OS
npm run tauri build
```

---

## Internal Review Tool (Human Recheck Studio)

A dedicated local inspection interface is included for verifying and editing vocabulary records and kanji definitions:

```bash
npm run recheck
```

- Accessible locally at `http://localhost:5174/`.
- All working backups, audit logs, and edit histories are stored in `backend_data/` (git-ignored) to ensure production distributions remain unbloated.

---

## Attribution and Licenses

- **Source Code:** [MIT License](LICENSE) (`src/`, `scripts/`, and build configuration files).
- **Data Sets:** [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](public/data/LICENSE) (`public/data/`).
  - **JLPT Word List:** Based on [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) (MIT) and Jonathan Waller's JLPT lists ([tanos.co.uk](http://www.tanos.co.uk/jlpt/)).
  - **JMdict & KANJIDIC:** Electronic Dictionary Research and Development Group ([EDRDG](https://www.edrdg.org/)) under the [EDRDG Licence](https://www.edrdg.org/edrdg/licence.html).
  - **Jiten:** Frequency rankings from [Jiten](https://jiten.moe/frequency-dictionaries) (CC BY-SA 4.0).
- Thai translations, contextual clarifications, kanji notes, and semantic categorizations were developed and curated within this project.

For third-party legal notices, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
