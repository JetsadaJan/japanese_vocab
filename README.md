# JLPT Kotoba Master

A web application for practicing Japanese vocabulary across JLPT levels N5 to N1 with bilingual (Thai and English) support, kanji cross-references, and confusable word distinctions.

Live application: [japanesevocab.vercel.app](https://japanesevocab.vercel.app/)

## Data Sources

The vocabulary and kanji datasets in this project are derived from the following sources:

- **JLPT Word List**: Vocabulary data from [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list).
- **Jiten**: Kanji dictionary and character reference data from [Jiten](https://jiten.net/).

Thai translations and contextual usage distinctions were supplemented and curated for learners.

## Local Setup

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

```bash
git clone https://github.com/JetsadaJan/japanese_vocab.git
cd japanese_vocab
npm install
```

### Development

```bash
npm run dev
```

The local development server runs at `http://localhost:5173/`.

### Production Build

```bash
npm run build
```

## License

This project is released under the MIT License. Underlying datasets from [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) and Jiten belong to their respective creators and are used under their applicable terms.
