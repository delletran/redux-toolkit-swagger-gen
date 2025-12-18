export const toCamelCase = (str: string): string => {
  if (!str) return '';
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase()).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
};

export const toPascalCase = (str: string): string => {
  if (!str) return '';
  // Remove all underscores and hyphens, converting to PascalCase
  // First remove trailing underscores/hyphens, then convert
  return str
    .replace(/[_-]+$/g, '') // Remove trailing underscores/hyphens
    .replace(/(^\w|_\w|-\w)/g, (g) => g.replace(/[_-]/, '').toUpperCase());
};
