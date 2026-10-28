import fs from 'node:fs/promises';
import path from 'node:path';

const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];
const BASE_URLS = [
  'https://raw.githubusercontent.com/elzup/jlpt-word-list/master/src',
  'https://raw.githubusercontent.com/elzup/jlpt-word-list/master/out',
];

const outDir = path.resolve('public/data');

async function fetchLevel(level) {
  for (const base of BASE_URLS) {
    const url = `${base}/${level}.csv`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('expression')) {
          const dest = path.join(outDir, `${level}.csv`);
          await fs.writeFile(dest, text, 'utf8');
          const lines = text.trim().split('\n').length - 1;
          console.log(`Downloaded ${level}.csv (${lines} words) from ${url}`);
          return;
        }
      }
    } catch (err) {
      // try next url
    }
  }
  throw new Error(`Failed to download ${level}.csv`);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  for (const level of LEVELS) {
    await fetchLevel(level);
  }
  console.log('All JLPT word lists downloaded successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
