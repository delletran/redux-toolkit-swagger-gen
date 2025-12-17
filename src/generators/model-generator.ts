import * as fs from "fs"
import * as path from "path"
import Mustache from "mustache"
import { loadTemplate } from "../utils/template-loader"
import { toPascalCase } from "../utils/formater"

const modelTemplate = loadTemplate("modelTemplate.mustache")

// Common regex patterns mapped to constant names
const REGEX_PATTERN_MAP: Record<string, string> = {
  '^\\d{4}-\\d{2}-\\d{2}$': 'REGEX_DATE',
  '^(?!^[-+.]*$)[+-]?0*(?:\\d{0,11}|(?=[\\d.]{1,16}0*$)\\d{0,11}\\.\\d{0,4}0*$)': 'REGEX_DECIMAL_11_4',
  '^(?!^[-+.]*$)[+-]?0*(?:\\d{0,6}|(?=[\\d.]{1,11}0*$)\\d{0,6}\\.\\d{0,4}0*$)': 'REGEX_DECIMAL_6_4',
  '^(?!^[-+.]*$)[+-]?0*\\d*\\.?\\d*$': 'REGEX_DECIMAL_FLEXIBLE'
}

const getZodType = (property: any, nestedModels: Set<string>, usedPatterns: Set<string>): string => {
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
      getZodType(subSchema, nestedModels, usedPatterns)
    );
    return `z.union([${unionTypes.join(', ')}])`
  }

  const baseType = property.type
  let zodType = "z.any()"

  switch (baseType) {
    case "string":
      zodType = "z.string()"
      if (property.format === "date") {
        const constName = REGEX_PATTERN_MAP['^\\d{4}-\\d{2}-\\d{2}$']
        if (constName) {
          usedPatterns.add(constName)
          zodType += `.regex(${constName})`
        } else {
          zodType += ".regex(/^\\d{4}-\\d{2}-\\d{2}$/)"
        }
      }
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
      if (property.pattern) {
        const constName = REGEX_PATTERN_MAP[property.pattern]
        if (constName) {
          usedPatterns.add(constName)
          zodType += `.regex(${constName})`
        } else {
          zodType += `.regex(/${property.pattern}/)`
        }
      }
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
      const itemType = getZodType(property.items, nestedModels, usedPatterns)
      zodType = `z.array(${itemType})`
      break
    case "object":
      if (property.properties) {
        // Handle nested objects
        const nestedProps = Object.entries(property.properties).map(
          ([propName, propSchema]: [string, any]) => {
            const propType = getZodType(propSchema, nestedModels, usedPatterns);
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
  nestedModels: Set<string>,
  usedPatterns: Set<string>
): any[] => {
  if (!properties) return []

  return Object.entries(properties).map(([name, prop]: [string, any]) => ({
    name,
    zodType: getZodType(prop, nestedModels, usedPatterns),
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
      hasRegexImport: false,
    })
  }

  const nestedModels = new Set<string>()
  const usedPatterns = new Set<string>()
  const properties = generateProperties(
    schema.properties,
    Array.isArray(schema.required) ? schema.required : [],
    nestedModels,
    usedPatterns
  )

  return Mustache.render(modelTemplate, {
    modelName,
    properties,
    nestedModels: Array.from(nestedModels),
    hasRegexImport: usedPatterns.size > 0,
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

  // Track all used patterns across all models with their actual regex patterns
  const allUsedPatterns = new Map<string, string>()

  // Generate models
  for (const [name, schema] of Object.entries(definitions)) {
    if (!schema) {
      console.warn(`Warning: Empty schema for ${name}`)
      continue
    }
    const cleanName = toPascalCase(name)
    const modelContent = generateModelFileContent(cleanName, schema)
    fs.writeFileSync(path.join(modelsDir, `${cleanName}.ts`), modelContent)
    
    // Extract patterns used in this model and find their regex
    const matches = modelContent.matchAll(/REGEX_[A-Z_0-9]+/g)
    for (const match of matches) {
      const constName = match[0]
      const pattern = Object.entries(REGEX_PATTERN_MAP).find(([_, name]) => name === constName)?.[0]
      if (pattern) {
        allUsedPatterns.set(constName, pattern)
      }
    }
  }

  // Generate regex constants file if any patterns were used
  if (allUsedPatterns.size > 0) {
    const constantsDir = path.resolve(outputDir, "constants")
    if (!fs.existsSync(constantsDir)) {
      fs.mkdirSync(constantsDir, { recursive: true })
    }
    
    const regexConstantsContent = `// Auto-generated regex constants
${Array.from(allUsedPatterns.entries()).map(([constName, pattern]) => {
  return `export const ${constName} = /${pattern}/;`
}).join('\n')}
`
    fs.writeFileSync(path.join(constantsDir, 'regex-constants.ts'), regexConstantsContent)
  }
}
