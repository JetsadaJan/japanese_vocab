# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-10-30

### Added

- **Kanji Practice Mode (2,028 Characters)**: Dedicated quiz mode testing Kanji meanings across JLPT N5 through N1 tiers based on first-encounter level distribution (N5: 450, N4: 331, N3: 664, N2: 255, N1: 328).
- **Dual-Reading Card Component**: Pedagogical question presentation featuring a prominent centered Kanji character glyph with a bottom dual-column layout:
  - Left column: On'yomi (Katakana) and Kun'yomi (Hiragana) readings with independent hide/peek toggles.
  - Right column: Latinized Romaji transcriptions for both reading types with independent hide/peek toggles.
  - Native Japanese Text-to-Speech (TTS) audio playback.
- **Dedicated Kanji Mistake Store**: Independent persistence layer (`jlpt-kotoba-kanji-mistakes-v1`) implementing a strict two-consecutive-correct reset policy and spaced review weighting.
- **Re-architected Setup Screen Navigation**:
  - Expanded top navigation header into a 2x2 grid for Vocabulary Library (8,870 words), Kanji Library (2,028 characters), Vocabulary Mistakes, and Kanji Mistakes.
  - 2x2 Game Mode selection matrix (Normal Vocabulary, Normal Kanji, Vocabulary Mistakes Only, Kanji Mistakes Only).
  - Dynamic gold action button reflecting the active mode and question pool count.
  - Automatic locking of quiz direction to Japanese-to-Meaning (`JA_TO_EN`) during Kanji mode.
- **Question Skip Functionality**: Added a "Skip (K)" action during active quiz sessions. Skipped questions are logged as errors in the respective mistake store and immediate answer feedback is provided.
- **GitHub Repository Link**: Added an official repository navigation link in the footer supporting Web, PWA, and desktop environments.

### Fixed

- **Answer Flash Artifact**: Eliminated an asynchronous state synchronization race condition where the correct answer of the subsequent question could briefly flash green during question transitions. Implemented synchronous state reset and component key isolation.
- **Dynamic Level Badge Metrics**: Corrected level selection cards to dynamically display Kanji character counts and units (`characters` vs `words`) when Kanji practice mode is active.
- **Part of Speech Filter Guard**: Cleanly suppressed vocabulary-specific grammatical category filters during Kanji mode.

---

## [1.0.0] - 2026-10-29

### Added

- Initial production release of JLPT Kotoba Master.
- Bundled offline database containing 8,870 vocabulary words across JLPT N5 through N1 with 100% Thai and English definitions.
- Comprehensive Kanji dictionary covering 13,108 characters with stroke counts, on/kun readings, and cross-references.
- 48 curated semantic nuance groups covering 512 keywords and 333 pedagogical member notes.
- Interactive quiz engine supporting three quiz directions (`JA_TO_EN`, `EN_TO_JA`, `MIXED`) with customizable session lengths.
- Multi-tier Spaced Mistake Tracking (`jlpt-kotoba-mistakes-v2`) with priority review queue.
- Multi-platform packaging for Windows (x64 setup installer), macOS (Apple Silicon disk image), and Progressive Web App (PWA).
