import * as fs from "fs"
import * as path from "path"
import Mustache from "mustache"

const modelTemplate = fs.readFileSync(
  path.resolve(__dirname, "../templates/modelTemplate.mustache"),
  "utf-8"
)

const getZodType = (property: any, nestedModels: Set<string>): string => {
  if (property.$ref) {
    const refName = property.$ref.split("/").pop()
    nestedModels.add(refName)
    return refName
  }

  const baseType = property.type
  let zodType = "z.any()"

  switch (baseType) {
    case "string":
      zodType = "z.string()"
      if (property.format === "date")
        zodType += ".regex(/^\\d{4}-\\d{2}-\\d{2}$/)"
      if (property.format === "uri") zodType += ".url()"
      if (property.format === "email") zodType += ".email()"
      if (property.enum)
        zodType = `z.enum([${property.enum
          .map((e: string) => `'${e}'`)
          .join(", ")}])`
      if (property.maxLength) zodType += `.max(${property.maxLength})`
      if (property.minLength) zodType += `.min(${property.minLength})`
      break
    case "integer":
      zodType = "z.number().int()"
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
  }

  if (property["x-nullable"] === true || !property.required) {
    zodType += ".optional()"
  }

  return zodType
}

const generateProperties = (
  properties: any,
  required: string[] = [],
  nestedModels: Set<string>
): any[] => {
  return Object.entries(properties).map(([name, prop]: [string, any]) => ({
    name,
    zodType: getZodType(prop, nestedModels),
    isRef: !!prop.$ref,
    isOptional: prop["x-nullable"] === true || !required.includes(name),
    refName: prop.$ref ? prop.$ref.split("/").pop() : null,
  }))
}

const generateModelFileContent = (modelName: string, schema: any): string => {
  const nestedModels = new Set<string>()
  const properties = generateProperties(
    schema.properties,
    schema.required,
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
  const modelsDir = path.resolve(outputDir, "models")
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true })
  }

  for (const [name, schema] of Object.entries(definitions)) {
    const modelContent = generateModelFileContent(name, schema)
    fs.writeFileSync(path.join(modelsDir, `${name}.ts`), modelContent)
  }
}
