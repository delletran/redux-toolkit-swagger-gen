/**
 * Checks if a schema definition represents an enum type
 */
export const isEnumSchema = (schema: any): boolean => {
  return schema && schema.type === 'string' && Array.isArray(schema.enum) && schema.enum.length > 0
}
