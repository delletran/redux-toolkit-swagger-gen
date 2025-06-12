import * as fs from 'fs';
import * as path from 'path';
import { loadTemplate } from './template-loader';

// Deprecated: Use loadTemplate instead
export const fsRead = (filePath: string, unicode: BufferEncoding = 'utf-8'): string => {
  return fs.readFileSync(path.resolve(__dirname, filePath), unicode);
};

const sliceTemplate = loadTemplate('sliceTemplate.mustache');