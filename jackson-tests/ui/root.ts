import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UI_DIR = path.join(ROOT, 'ui');
export const PORT = Number(process.env.UI_PORT || 5173);
