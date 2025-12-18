export const generateTags = (paths: any, apiBasePath?: string): string => {
  const tags: Set<string> = new Set()

  // Calculate resource name position based on apiBasePath depth
  const apiBaseDepth = apiBasePath ? (apiBasePath.match(/\//g) || []).length + 1 : 0;

  for (const route of Object.keys(paths)) {
    const pathParts = route.split("/");
    const resourceIndex = 1 + apiBaseDepth;
    const tag = pathParts[resourceIndex] || "api";
    if (tag) {
      tags.add(tag.toUpperCase().replace(/-/g, "_") + "_LIST")
    }
  }

  const tagEntries = Array.from(tags)
    .map((tag) => `${tag}: '${tag}'`)
    .join(",\n  ")

  return `export const TAGS = {\n  ${tagEntries}\n} as const;\n`
}
