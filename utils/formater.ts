const toCamelCase = (str: string): string => {
  return str
    .replace(/_([a-z])/g, (g) => g[1].toUpperCase())
    .replace(/-([a-z])/g, (g) => g[1].toUpperCase())
}

const toPascalCase = (str: string): string => {
  return str.replace(/(^\w|_\w|-\w)/g, (g) =>
    g.replace(/[_-]/, "").toUpperCase()
  )
}

module.exports = { toCamelCase, toPascalCase }
