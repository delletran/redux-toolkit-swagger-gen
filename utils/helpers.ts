import * as fs from 'fs';
import * as path from 'path';


export const fsRead = (filePath: string, unicode: BufferEncoding = 'utf-8'): string => {
  return fs.readFileSync(path.resolve(__dirname, filePath), unicode);
};

const sliceTemplate = fsRead('../templates/sliceTemplate.mustache');