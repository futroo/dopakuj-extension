import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const source = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const directory = new URL('../public/icon/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const size of [16, 24, 32, 48, 64, 96, 128, 256, 512]) {
  const renderer = new Resvg(source, { fitTo: { mode: 'width', value: size } });
  await writeFile(new URL(`${size}.png`, directory), renderer.render().asPng());
}
console.log('Generated extension icons (16–512 px).');
