export const toCamelCase = (str: string): string => {
  if (!str) return '';
  // Handle spaces, underscores, and hyphens
  return str
    .replace(/[_\s-]([a-z])/gi, (g) => g[1].toUpperCase())
    .replace(/^[A-Z]/, (g) => g.toLowerCase())
    .replace(/[_\s-]/g, ''); // Remove any remaining separators
};

export const toPascalCase = (str: string): string => {
  if (!str) return '';
  // Remove all underscores and hyphens, converting to PascalCase
  // First remove trailing underscores/hyphens, then convert
  return str
    .replace(/[_-]+$/g, '') // Remove trailing underscores/hyphens
    .replace(/(^\w|_\w|-\w)/g, (g) => g.replace(/[_-]/, '').toUpperCase());
};
