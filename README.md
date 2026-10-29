# JLPT Kotoba Master

[![Release](https://img.shields.io/badge/Release-v1.0.0-blue.svg)](https://github.com/JetsadaJan/japanese_vocab/releases/tag/v1.0.0)
[![Offline](https://img.shields.io/badge/Offline-100%25-brightgreen.svg)]()
[![PWA](https://img.shields.io/badge/PWA-Ready-orange.svg)]()
[![Tauri](https://img.shields.io/badge/Desktop-Tauri%20v2-blueviolet.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

JLPT Kotoba Master is an offline-first Japanese language learning application covering Japanese Language Proficiency Test (JLPT) levels N5 through N1. It features complete Thai translations, furigana readings, romaji, related kanji cross-references, confusable word distinctions, 100 semantic category groups, and an interactive quiz system.

> **Project Notice:** This is an independent open-source side project created as a lightweight, zero-latency study companion for Japanese language learners. It is designed to run entirely offline across desktop and mobile devices without requiring user accounts, external APIs, or constant internet access.

---

## Recommended Downloads (Release v1.0.0)

All compiled standalone installers are available on the [GitHub Releases v1.0.0](https://github.com/JetsadaJan/japanese_vocab/releases/tag/v1.0.0) page:

| Operating System | Recommended File | File Size | Description |
| :--- | :--- | :--- | :--- |
| Windows (10/11, 64-bit) | [JLPT.Kotoba.Master_1.0.0_x64-setup.exe](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT.Kotoba.Master_1.0.0_x64-setup.exe) | 3.06 MB | Standard Windows NSIS setup wizard. Includes full desktop integration and shortcuts. |
| macOS (Apple Silicon M1-M4) | [JLPT_Kotoba_Master_1.0.0_aarch64.dmg](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT_Kotoba_Master_1.0.0_aarch64.dmg) | 5.80 MB | Apple disk image installer. Drag-and-drop installation to Applications. |
| iOS (iPhone / iPad) | Progressive Web App (PWA) | No download | Install directly to home screen via Safari (zero App Store download needed). |
| Android (Phone / Tablet) | Progressive Web App (PWA) | No download | Install directly as a native WebAPK via Google Chrome. |

---

## Installation and Setup Guides

### 1. Windows Installation Guide

**Recommended File:** `JLPT.Kotoba.Master_1.0.0_x64-setup.exe`

#### File Details
The `.exe` file is a self-contained NSIS installer compiled with Tauri v2. It includes the precompiled application binary, local database files, and system integration logic. It uses Microsoft Edge WebView2 (which is pre-installed on Windows 10 and Windows 11) for high-performance, low-memory rendering.

#### Step-by-Step Instructions
1. Download `JLPT.Kotoba.Master_1.0.0_x64-setup.exe` from the release link above.
2. Double-click the downloaded executable to start the setup wizard.
3. *Windows SmartScreen Notice:* If Windows SmartScreen displays a blue dialog saying "Windows protected your PC" (common for newly released open-source software without an expensive commercial code-signing certificate):
   - Click **More info**.
   - Click **Run anyway**.
4. Choose the installation directory (default: `%LOCALAPPDATA%\Programs\JLPT Kotoba Master`) and click **Install**.
5. Once installation completes, click **Finish**.
6. The setup automatically creates a shortcut on your Desktop and in the Start Menu. You can launch **JLPT Kotoba Master** at any time completely offline.

---

### 2. macOS Installation Guide

**Recommended File:** `JLPT_Kotoba_Master_1.0.0_aarch64.dmg`

#### File Details
The `.dmg` file is an Apple disk image tailored for Apple Silicon architectures (M1, M2, M3, M4). It packages `JLPT Kotoba Master.app` compiled with native ARM64 instructions, ensuring instant launch times and minimal power consumption.

#### Step-by-Step Instructions
1. Download `JLPT_Kotoba_Master_1.0.0_aarch64.dmg` from the release link above.
2. Double-click the `.dmg` file in your Downloads folder to mount the disk image.
3. In the mounted window, drag the **JLPT Kotoba Master** application icon and drop it into the **Applications** folder shortcut.
4. Eject the disk image and open **Applications** (or use Spotlight / Launchpad) to launch the app.

#### macOS Gatekeeper First-Launch Note
Because this is an independent open-source side project without an Apple Developer subscription certificate, macOS Gatekeeper may prompt: *"JLPT Kotoba Master cannot be opened because the developer cannot be verified."*
To open the application:
- **Option A (GUI):** In Finder, navigate to `/Applications`, right-click (or Control-click) `JLPT Kotoba Master.app`, select **Open**, and then click **Open** on the confirmation dialog. This only needs to be performed once.
- **Option B (Terminal):** Open Terminal and execute:
  ```bash
  xattr -cr "/Applications/JLPT Kotoba Master.app"
  ```

---

### 3. iOS Installation Guide (iPhone & iPad)

**Platform:** Progressive Web App (PWA) via Safari

#### How It Works
The web version of JLPT Kotoba Master features a Service Worker that precaches all 10,753 vocabulary entries, kanji definitions, audio synthesis routines, and semantic maps into your device storage.

#### Step-by-Step Instructions
1. Launch **Safari** on your iPhone or iPad and navigate to the application URL.
2. Tap the **Share** button located in the toolbar (the square icon with an arrow pointing upward).
3. Scroll down the action list and select **Add to Home Screen**.
4. Review the application title and tap **Add** in the top-right corner.
5. The **JLPT Kotoba Master** icon will be placed on your home screen alongside native apps.
6. When launched from the home screen, the application runs in standalone mode (without Safari address bars or tabs) and operates 100% offline, including under Airplane Mode.

---

### 4. Android Installation Guide

**Platform:** Progressive Web App (PWA / WebAPK) via Google Chrome

#### How It Works
Modern Android devices convert the Progressive Web App into an installed WebAPK that registers in the system app drawer, supports native multitasking, and caches all application data locally.

#### Step-by-Step Instructions
1. Open **Google Chrome** on your Android device and visit the application URL.
2. Tap the three-dot menu icon in the upper-right corner.
3. Select **Install app** or **Add to Home screen** (or tap the installation banner if prompted at the bottom).
4. Tap **Install** to confirm.
5. The application will be installed into your app drawer and home screen. All features function completely offline without internet connectivity.

---

## Dataset Overview

| Category | Record Count | Details |
| :--- | :--- | :--- |
| JLPT N5 Vocabulary | 664 terms | Basic foundational words, daily greetings, and essential expressions with Thai definitions. |
| JLPT N4 Vocabulary | 634 terms | Elementary daily vocabulary, basic compound verbs, and conversational essentials. |
| JLPT N3 Vocabulary | 1,818 terms | Intermediate vocabulary, everyday expressions, and nuanced contextual usages. |
| JLPT N2 Vocabulary | 1,833 terms | Upper-intermediate business, news, and specialized workplace communication terms. |
| JLPT N1 Vocabulary | 5,804 terms | Advanced academic vocabulary, formal literary terms, and complex idioms. |
| Jōyō Kanji | 2,136 characters | Complete regular-use kanji list with Thai meanings, stroke counts, on/kun readings, and JLPT levels. |
| Semantic Groups | 100 categories | 2,900+ curated terms structured into situational and thematic learning modules. |

---

## Offline Architecture

The application is structured to ensure resilience in offline environments:
- **Relative Asset Resolution:** All vocabulary and kanji JSON bundles are fetched via relative base resolution (`import.meta.env.BASE_URL`), allowing the application to run smoothly under local filesystem schemas (`tauri://localhost`, `file://`) and web subpaths.
- **Service Worker Precaching:** Configured via `vite-plugin-pwa` with custom Workbox thresholds (up to 6 MB single-asset caching), ensuring the 2.8 MB Joyo Kanji database and all JLPT tiers are preloaded upon initial access.
- **No Remote Telemetry or External CDNs:** Fonts, styles, and scripts are self-contained within the client bundle.

---

## Local Development and Building

### Prerequisites
- Node.js 18 or higher ([nodejs.org](https://nodejs.org/))
- npm 9 or higher
- Rust toolchain (required only for building native desktop binaries via Tauri)

### Development Commands

```bash
# Clone the repository
git clone https://github.com/JetsadaJan/japanese_vocab.git
cd japanese_vocab

# Install dependencies
npm install

# Start Vite development server (http://localhost:5173/)
npm run dev

# Compile TypeScript and build production web assets
npm run build

# Preview production build locally
npm run preview
```

### Building Desktop Installers (Tauri v2)

```bash
# Run desktop application in development mode
npm run tauri dev

# Build production installers for the current host OS
npm run tauri build
```

- On Windows, this creates `.exe` (NSIS) and `.msi` installers in `src-tauri/target/release/bundle/`.
- On macOS, this creates `.dmg` and `.app` bundles in `src-tauri/target/release/bundle/`.

---

## Internal Review Tool (Human Recheck Studio)

The repository provides a dedicated local review environment for verifying and refining Thai translations, kanji readings, and semantic groupings:

```bash
npm run recheck
```

- Accessible locally at `http://localhost:5174/`.
- All working backups, revision histories, and human recheck states are kept in `backend_data/` (excluded from git tracking) to ensure that production builds remain lightweight.

---

## Data Attribution and Licensing

- **Application Source Code:** [MIT License](LICENSE) (`src/`, `scripts/`, build configurations).
- **Data Sets:** [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](public/data/LICENSE) (`public/data/`).
  - **JLPT Word List:** Based on [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) (MIT) and Jonathan Waller's JLPT lists ([tanos.co.uk](http://www.tanos.co.uk/jlpt/)).
  - **JMdict & KANJIDIC:** Electronic Dictionary Research and Development Group ([EDRDG](https://www.edrdg.org/)) under the [EDRDG Licence](https://www.edrdg.org/edrdg/licence.html).
  - **Jiten:** Frequency rankings from [Jiten](https://jiten.moe/frequency-dictionaries) (CC BY-SA 4.0).
- Thai translations, contextual clarifications, kanji notes, and semantic categorizations were authored and curated within this project.

Detailed notices and full legal texts are provided in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
