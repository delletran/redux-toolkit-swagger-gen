const generateTags = (paths: any): string => {
  const tags: Set<string> = new Set()

  for (const route of Object.keys(paths)) {
    const tag = route.split("/")[1]
    if (tag) {
      tags.add(tag.toUpperCase().replace(/-/g, "_") + "_LIST")
    }
  }

  const tagEntries = Array.from(tags)
    .map((tag) => `${tag}: '${tag}'`)
    .join(",\n  ")

  return `export const TAGS = {\n  ${tagEntries}\n} as const;\n`
}

const main = async () => {
  const swaggerPath = process.argv[2] || "http://localhost:8000/swagger.json"
  let swagger
  if (swaggerPath.startsWith("http")) {
    const response = await axios.get(swaggerPath)
    swagger = response.data
  } else {
    swagger = JSON.parse(fs.readFileSync(swaggerPath, "utf-8"))
  }

  const { paths } = swagger
  const tagsContent = generateTags(paths)

  const outputDir = path.resolve(__dirname, constantsDir)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(path.join(outputDir, "tags.ts"), tagsContent)
}

main().catch(console.error)

module.exports = { generateTags }
