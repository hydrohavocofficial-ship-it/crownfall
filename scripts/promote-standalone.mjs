import { copyFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = path.join(root, 'dist', 'index.dev.html');
const launch = path.join(root, 'index.html');
const previewEntry = path.join(root, 'dist', 'index.html');
await stat(built);
await copyFile(built, launch);
await copyFile(built, previewEntry);
const { size } = await stat(launch);
console.log(`Standalone launcher updated: index.html (${(size / 1024 / 1024).toFixed(2)} MiB)`);
