const fs = require("fs")
const path = require("path")

interface FsRead {
  (filePath: string, unicode?: string): string
}

const fsRead: FsRead = (filePath, unicode = "utf-8") => {
  return fs.readFileSync(path.resolve(__dirname, filePath), unicode)
}

const sliceTemplate = fsRead("../templates/sliceTemplate.mustache")

module.exports = {
  fsRead,
  sliceTemplate,
}
