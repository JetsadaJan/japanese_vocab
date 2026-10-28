# JLPT Kotoba Master

A web application for practicing Japanese vocabulary across JLPT levels N5 to N1 with bilingual (Thai and English) support, kanji cross-references, and confusable word distinctions.

Live application: [japanesevocab.vercel.app](https://japanesevocab.vercel.app/)

## Data Sources

The vocabulary and kanji datasets in this project are derived from the following sources:

- **JLPT Word List**: Base N5-N1 vocabulary from [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) (MIT), originally based on the JLPT lists by Jonathan Waller at [tanos.co.uk](http://www.tanos.co.uk/jlpt/).
- **JMdict**: Additional vocabulary from the [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) dictionary files via [scriptin/jmdict-simplified](https://github.com/scriptin/jmdict-simplified) (CC BY-SA 4.0).
- **KANJIDIC**: Kanji readings and meanings from the [KANJIDIC](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) files via [davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data) (CC BY-SA 4.0).
- **Jiten**: Word and kanji frequency rankings from [Jiten](https://jiten.moe/frequency-dictionaries) (CC BY-SA 4.0).

This project uses the JMdict and KANJIDIC dictionary files. These files are the property of the [Electronic Dictionary Research and Development Group](https://www.edrdg.org/), and are used in conformance with the Group's [licence](https://www.edrdg.org/edrdg/licence.html).

Thai translations, kanji notes, and usage distinctions were added by this project.

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

- **Source code** (`src/`, `scripts/`, configuration files): [MIT License](LICENSE).
- **Data** (`public/data/`): [Creative Commons Attribution-ShareAlike 4.0 International](public/data/LICENSE). This data adapts material from JMdict, KANJIDIC, and Jiten, which are licensed under CC BY-SA 4.0, so any redistribution or modification of these files must keep the same license and attribution.

Full attribution and the license texts of all upstream sources are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
