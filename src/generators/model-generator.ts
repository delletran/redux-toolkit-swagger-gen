import * as fs from "fs"
import * as path from "path"
import Mustache from "mustache"
import { loadTemplate } from "../utils/template-loader"

const modelTemplate = loadTemplate("modelTemplate.mustache")

const getZodType = (property: any, nestedModels: Set<string>): string => {
  if (!property) return "z.any()"

  // Handle $ref references
  if (property.$ref) {
    const refName = property.$ref.split("/").pop()
    nestedModels.add(refName)
    return refName
  }

  // Handle OpenAPI 3.x anyOf and oneOf
  if (property.anyOf || property.oneOf) {
    const unionTypes = (property.anyOf || property.oneOf).map((subSchema: any) => 
      getZodType(subSchema, nestedModels)
    );
    return `z.union([${unionTypes.join(', ')}])`
  }

  const baseType = property.type
  let zodType = "z.any()"

  switch (baseType) {
    case "string":
      zodType = "z.string()"
      if (property.format === "date")
        zodType += ".regex(/^\\d{4}-\\d{2}-\\d{2}$/)"
      if (property.format === "date-time") 
        zodType += ".datetime()"
      if (property.format === "uri") zodType += ".url()"
      if (property.format === "email") zodType += ".email()"
      if (property.enum)
        zodType = `z.enum([${property.enum
          .map((e: string) => `'${e}'`)
          .join(", ")}])`
      if (property.maxLength) zodType += `.max(${property.maxLength})`
      if (property.minLength) zodType += `.min(${property.minLength})`
      if (property.pattern) zodType += `.regex(/${property.pattern}/)`
      break
    case "integer":
    case "number":
      zodType = baseType === "integer" ? "z.number().int()" : "z.number()"
      if (property.maximum) zodType += `.max(${property.maximum})`
      if (property.minimum) zodType += `.min(${property.minimum})`
      break
    case "boolean":
      zodType = "z.boolean()"
      break
    case "array":
      const itemType = getZodType(property.items, nestedModels)
      zodType = `z.array(${itemType})`
      break
    case "object":
      if (property.properties) {
        // Handle nested objects
        const nestedProps = Object.entries(property.properties).map(
          ([propName, propSchema]: [string, any]) => {
            const propType = getZodType(propSchema, nestedModels);
            const isRequired = Array.isArray(property.required) && property.required.includes(propName);
            return `${propName}: ${propType}${isRequired ? '' : '.optional()'}`;
          }
        );
        zodType = `z.object({ ${nestedProps.join(', ')} })`;
      } else {
        zodType = 'z.record(z.string(), z.any())';
      }
      break;
  }

  if (property["x-nullable"] === true || !property.required) {
    zodType += ".optional()"
  }

  return zodType
}

const generateProperties = (
  properties: any = {},
  required: string[] = [],
  nestedModels: Set<string>
): any[] => {
  if (!properties) return []

  return Object.entries(properties).map(([name, prop]: [string, any]) => ({
    name,
    zodType: getZodType(prop, nestedModels),
    isRef: prop && prop.$ref ? true : false,
    isOptional:
      !prop || prop["x-nullable"] === true || !required.includes(name),
    refName: prop && prop.$ref ? prop.$ref.split("/").pop() : null,
  }))
}

const generateModelFileContent = (modelName: string, schema: any): string => {
  if (!schema) {
    console.warn(`Warning: Empty schema for model ${modelName}`)
    return Mustache.render(modelTemplate, {
      modelName,
      properties: [],
      nestedModels: [],
    })
  }

  const nestedModels = new Set<string>()
  const properties = generateProperties(
    schema.properties,
    Array.isArray(schema.required) ? schema.required : [],
    nestedModels
  )

  return Mustache.render(modelTemplate, {
    modelName,
    properties,
    nestedModels: Array.from(nestedModels),
  })
}

export const generateModels = async (
  definitions: any,
  outputDir: string
): Promise<void> => {
  if (!definitions || typeof definitions !== "object") {
    console.warn("Warning: No definitions found in swagger file")
    return
  }

  const modelsDir = path.resolve(outputDir, "models")
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true })
  }

  for (const [name, schema] of Object.entries(definitions)) {
    if (!schema) {
      console.warn(`Warning: Empty schema for ${name}`)
      continue
    }
    const modelContent = generateModelFileContent(name, schema)
    fs.writeFileSync(path.join(modelsDir, `${name}.ts`), modelContent)
  }
}
