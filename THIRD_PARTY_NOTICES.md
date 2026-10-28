# Third-Party Notices

This project uses data from the sources listed below. The vocabulary, kanji,
and semantic-group files in `public/data/` combine and adapt material from
these sources and are distributed under the
[Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/)
(full text in [`public/data/LICENSE`](public/data/LICENSE)), as required by the
ShareAlike terms of the JMdict, KANJIDIC, and Jiten licenses.

Changes made to the source data: entries were filtered and merged, JLPT levels
were assigned or adjusted, English glosses were shortened, and Thai
translations, kanji notes, and usage explanations were added by this project.
None of the original authors endorse this project.

---

## JMdict (via jmdict-simplified)

This project uses the [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project)
dictionary files. These files are the property of the
[Electronic Dictionary Research and Development Group](https://www.edrdg.org/),
and are used in conformance with the Group's [licence](https://www.edrdg.org/edrdg/licence.html).

- Copyright: James William Breen and The Electronic Dictionary Research and Development Group
- License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- JSON conversion: [scriptin/jmdict-simplified](https://github.com/scriptin/jmdict-simplified)
  (derived files distributed under CC BY-SA 4.0); release used: `jmdict-eng-common-3.6.2+20261026175559`

## KANJIDIC (via kanji-data)

Kanji readings, meanings, and stroke counts are derived from the
[KANJIDIC](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) files, which are
the property of the Electronic Dictionary Research and Development Group and are
used in conformance with the Group's [licence](https://www.edrdg.org/edrdg/licence.html).

- License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- JSON conversion: [davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data)

kanji-data is distributed under the following license:

```
MIT License

Copyright (c) 2019 David Gouveia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Jiten frequency lists

Word and kanji frequency rankings from [Jiten](https://jiten.moe/frequency-dictionaries)
were used to select vocabulary and assign difficulty levels.

- Author: Jiten ([jiten.moe](https://jiten.moe))
- License: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Versions used: `Jiten 26-10-23` (global), `Jiten (Kanji) 26-08-09`

## JLPT Word List

Base JLPT N5-N1 vocabulary lists from [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list),
which is distributed under the following license:

```
MIT License

Copyright (c) 2020 Jamie Sinclair
Copyright (c) 2020 elzup

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The jlpt-word-list data originates from
[chyyran/jlpt-anki-decks](https://github.com/chyyran/jlpt-anki-decks) and
[jamsinclair/open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks),
which are based on the JLPT lists by Jonathan Waller at
[tanos.co.uk](http://www.tanos.co.uk/jlpt/) (CC BY).
