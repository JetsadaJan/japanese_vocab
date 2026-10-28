# JLPT Kotoba Master

A web application for practicing Japanese vocabulary across JLPT levels N5 to N1 with bilingual (Thai and English) support, kanji cross-references, and confusable word distinctions.

Live application: [japanesevocab.vercel.app](https://japanesevocab.vercel.app/)

## Data Sources

The vocabulary and kanji datasets in this project are derived from the following sources:

- **JLPT Word List**: Vocabulary data from [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list).
- **Jiten**: Dictionary reference data from [Jiten](https://jiten.moe/frequency-dictionaries).

Thai translations and contextual usage distinctions were supplemented and curated for learners.

## Local Setup

### Prerequisites

- Node.js 18 or higher ([nodejs.org](https://nodejs.org/))
- Git ([git-scm.com](https://git-scm.com/))

### macOS

Open Terminal and execute the following:

```bash
# Clone the repository
git clone https://github.com/JetsadaJan/japanese_vocab.git
cd japanese_vocab

# Install dependencies
npm install

# Start development server (http://localhost:5173/)
npm run dev

# Build for production
npm run build
```

Production build artifacts will be created in the `dist` folder. To preview the production build locally:

```bash
npm run preview
```

### Windows

Open PowerShell or Command Prompt (cmd.exe) and execute the following:

```powershell
# Clone the repository
git clone https://github.com/JetsadaJan/japanese_vocab.git
cd japanese_vocab

# Install dependencies
npm install

# Start development server (http://localhost:5173/)
npm run dev

# Build for production
npm run build
```

Production build artifacts will be created in the `dist` folder. To preview the production build locally:

```powershell
npm run preview
```

## License

This project is released under the MIT License. Underlying datasets from [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) and [Jiten](https://jiten.moe/frequency-dictionaries) belong to their respective creators and are used under their applicable terms.
