# JLPT Kotoba Master

[![Release](https://img.shields.io/badge/Release-v1.0.0-blue.svg)](https://github.com/JetsadaJan/japanese_vocab/releases/tag/v1.0.0)
[![Offline](https://img.shields.io/badge/Offline-100%25-brightgreen.svg)]()
[![PWA](https://img.shields.io/badge/PWA-Ready-orange.svg)]()
[![Tauri](https://img.shields.io/badge/Desktop-Tauri%20v2-blueviolet.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

JLPT Kotoba Master is a comprehensive, offline-first Japanese language learning application covering JLPT levels N5 through N1. It features Thai translations, furigana readings, romaji, related kanji cross-references, confusable word distinctions, 100 semantic category groups, and an interactive quiz system.

The application operates 100% offline on all supported platforms with no external API dependencies required after initial installation or page load.

---

## Downloads (GitHub Releases)

Compiled desktop binaries and application bundles are available on the [GitHub Releases v1.0.0](https://github.com/JetsadaJan/japanese_vocab/releases/tag/v1.0.0) page:

| Platform | Format | Direct Download Link | Notes |
| :--- | :--- | :--- | :--- |
| macOS | `.dmg` Installer | [JLPT_Kotoba_Master_1.0.0_aarch64.dmg](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT_Kotoba_Master_1.0.0_aarch64.dmg) (~5.8 MB) | Apple Silicon (M1/M2/M3/M4). Drag-and-drop installer to Applications. |
| macOS | `.zip` (Standalone .app) | [JLPT_Kotoba_Master_1.0.0_macOS.zip](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT_Kotoba_Master_1.0.0_macOS.zip) (~4.8 MB) | Extract and run `JLPT Kotoba Master.app` directly. |
| iOS | Progressive Web App | Installed via Safari (see instructions below) | Runs as a fullscreen standalone offline application on iPhone and iPad. |
| Android | Progressive Web App | Installed via Chrome (see instructions below) | Installs as a standalone WebAPK with full offline persistence. |
| Windows | PWA / Native Binary | Installed via Edge/Chrome or built via Tauri | Runs as a dedicated desktop window. Native `.exe` build instructions below. |

---

## Platform Installation Guides

### macOS (Apple Silicon / Intel)

#### Method 1: Using the `.dmg` Installer
1. Download [JLPT_Kotoba_Master_1.0.0_aarch64.dmg](https://github.com/JetsadaJan/japanese_vocab/releases/download/v1.0.0/JLPT_Kotoba_Master_1.0.0_aarch64.dmg).
2. Double-click the downloaded `.dmg` file to mount it.
3. Drag the **JLPT Kotoba Master** icon into the **Applications** folder.
4. Launch the application from Launchpad or `/Applications`.

> **macOS Gatekeeper Note:**
> If macOS displays a security prompt stating the developer cannot be verified upon first launch:
> - Right-click (or Control-click) `JLPT Kotoba Master.app` in `/Applications` and select **Open**, then confirm by clicking **Open**.
> - Alternatively, run the following command in Terminal:
>   ```bash
>   xattr -cr "/Applications/JLPT Kotoba Master.app"
>   ```

---

### iOS (iPhone and iPad)

The application implements a Progressive Web App (PWA) architecture. All vocabulary, kanji, and sound assets are cached locally via a Service Worker:

1. Open the web application URL in **Safari** on your iOS device.
2. Tap the **Share** button (the square icon with an upward arrow at the bottom toolbar).
3. Scroll down the share sheet and select **Add to Home Screen**.
4. Confirm the application title and tap **Add** in the top right corner.
5. The **JLPT Kotoba Master** icon will appear on your home screen.
6. When opened from the home screen, the application launches in standalone fullscreen mode without browser navigation bars and functions 100% offline, including in Airplane Mode.

---

### Android (Smartphones and Tablets)

1. Open the web application URL in **Google Chrome** on your Android device.
2. Tap the menu button (three vertical dots) in the top-right corner.
3. Select **Install app** or **Add to Home screen** (or tap the installation banner at the bottom of the screen).
4. Tap **Install** to confirm.
5. Android will generate a WebAPK and place the app icon in your app drawer and home screen. The application runs offline with local storage persistence.

---

### Windows and Linux

#### Option 1: Desktop Web App (PWA) - Recommended
1. Open the application URL in **Google Chrome** or **Microsoft Edge**.
2. Click the install icon located on the right side of the URL address bar (or go to **Menu > Apps > Install JLPT Kotoba Master**).
3. Confirm installation. The application will launch in its own standalone desktop window and register a shortcut in the Start Menu and Desktop.

#### Option 2: Native Windows Installer (`.exe` / `.msi`) via Tauri
To compile a native Windows installer:
1. Install [Node.js](https://nodejs.org/) and the [Rust toolchain](https://www.rust-lang.org/) on your Windows environment.
2. Clone the repository and run:
   ```powershell
   git clone https://github.com/JetsadaJan/japanese_vocab.git
   cd japanese_vocab
   npm install
   npm run tauri build
   ```
3. Compiled installers (`.msi` and `.exe` via NSIS) will be generated in `src-tauri/target/release/bundle/`.

---

## Dataset Overview

| Category | Count | Description |
| :--- | :--- | :--- |
| JLPT N5 Vocabulary | 664 terms | Beginner-level core vocabulary with Thai definitions and furigana. |
| JLPT N4 Vocabulary | 634 terms | Elementary vocabulary and common daily verbs. |
| JLPT N3 Vocabulary | 1,818 terms | Intermediate expressions, compound verbs, and contextual nuance. |
| JLPT N2 Vocabulary | 1,833 terms | Upper-intermediate business, academic, and daily communication words. |
| JLPT N1 Vocabulary | 5,804 terms | Advanced vocabulary, formal prose, news media, and specialized terms. |
| Jōyō Kanji | 2,136 characters | Regular-use kanji with Thai meanings, stroke counts, on/kun readings, and JLPT levels. |
| Semantic Groups | 100 categories | 2,900+ curated terms grouped into situational and thematic contexts. |

---

## Offline Architecture

The application is engineered to operate without an active internet connection:
- **Relative Asset Resolution**: All data bundles (`n5.json` through `n1.json`, `kanji.json`, and `semantic_groups.json`) are resolved relative to the application bundle root using Vite base configurations.
- **Service Worker Precaching**: Using `vite-plugin-pwa` and Workbox, all application logic, styling, fonts, and large datasets (up to 6 MB single files) are cached on first load.
- **Zero External API Calls**: The application contains no runtime calls to external CDNs, tracking services, or remote APIs.

---

## Local Development

### Prerequisites
- Node.js 18 or higher ([nodejs.org](https://nodejs.org/))
- npm 9 or higher
- Rust toolchain (required only for building desktop binaries via Tauri)

### Commands

```bash
# Clone the repository
git clone https://github.com/JetsadaJan/japanese_vocab.git
cd japanese_vocab

# Install dependencies
npm install

# Start Vite development server (http://localhost:5173/)
npm run dev

# Run TypeScript check and production web build
npm run build

# Preview production build locally
npm run preview
```

### Desktop Development (Tauri v2)

```bash
# Run Tauri in development mode with hot reload
npm run tauri dev

# Build production desktop bundle for the host platform
npm run tauri build
```

---

## Human Recheck Studio

The repository includes a dedicated local web interface for reviewing, correcting, and curating Thai translations, kanji readings, and semantic groupings:

```bash
npm run recheck
```

- Launches the review server at `http://localhost:5174/`.
- Review state, audit logs, and backups are isolated in the local `backend_data/` directory (ignored by git) to prevent test data from contaminating production releases.

---

## Attribution and Licenses

- **Source Code**: [MIT License](LICENSE) (`src/`, `scripts/`, and build configuration files).
- **Data Sets**: [Creative Commons Attribution-ShareAlike 4.0 International](public/data/LICENSE) (`public/data/`).
  - **JLPT Word List**: Derived from [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) (MIT), based on lists compiled by Jonathan Waller ([tanos.co.uk](http://www.tanos.co.uk/jlpt/)).
  - **JMdict & KANJIDIC**: Electronic Dictionary Research and Development Group ([EDRDG](https://www.edrdg.org/)) in conformance with the [EDRDG Licence](https://www.edrdg.org/edrdg/licence.html).
  - **Jiten**: Word and kanji frequency rankings from [Jiten](https://jiten.moe/frequency-dictionaries) (CC BY-SA 4.0).
- Thai translations, cross-references, confusable word pairs, and semantic categorizations were developed and curated within this project.

For third-party legal notices, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
