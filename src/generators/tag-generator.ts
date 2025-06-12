export const generateTags = (paths: any): string => {
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
