import * as fs from "fs"
import * as path from "path"
import Mustache from "mustache"
import { loadTemplate } from "../utils/template-loader"
import { toPascalCase } from "../utils/formater"
import { stripApiBasePath } from "../utils/name-cleaner"

// Model domain mapping based on naming patterns
const getModelDomain = (modelName: string): string => {
  const name = modelName.toLowerCase();
  
  // Authentication & Users
  if (/^(user|login|token|refresh|account|password)/.test(name)) return 'auth';
  
  // Members
  if (/^(member|membership)/.test(name)) return 'members';
  
  // Attendance
  if (/^(attendance|checkin|checkout)/.test(name)) return 'attendance';
  
  // Transactions & Payments
  if (/^(transaction|payment)/.test(name)) return 'transactions';
  
  // Branches
  if (/^branch/.test(name)) return 'branches';
  
  // Leads
  if (/^lead/.test(name)) return 'leads';
  
  // Goals
  if (/^(goal|unit)/.test(name)) return 'goals';
  
  // Discounts & Referrals
  if (/^(discount|referral)/.test(name)) return 'discounts';
  
  // Expenses
  if (/^expense/.test(name)) return 'expenses';
  
  // Products & Inventory
  if (/^(product|inventory|stock|sale)/.test(name)) return 'products';
  
  // Roles & Permissions
  if (/^(role|permission|module|submodule|department)/.test(name)) return 'permissions';
  
  // Notifications
  if (/^notification/.test(name)) return 'notifications';
  
  // Reports
  if (/^(report|profit|revenue|export)/.test(name)) return 'reports';
  
  // Analytics
  if (/^(analytics|churn|retention|cohort|segment|ltv|engagement|atrisk|renewal|prediction)/.test(name)) return 'analytics';
  
  // Settings
  if (/^(setting|systemconfiguration|category)/.test(name)) return 'settings';
  
  // Files
  if (/^(file|upload)/.test(name)) return 'files';
  
  // Billing & Automation
  if (/^(billing|schedule|upcoming)/.test(name)) return 'billing';
  
  // Payment Gateway
  if (/^(paymentintent|paymentstatus|cardtokenize|refund)/.test(name)) return 'payment-gateway';
  
  // Training
  if (/^training/.test(name)) return 'training';
  
  // Common/Shared (validation errors, body schemas, etc.)
  if (/^(validation|http|body_|app_schemas_|app__)/.test(name)) return 'common';
  
  // Dashboard
  if (/^dashboard/.test(name)) return 'dashboard';
  
  // Default to common for everything else
  return 'common';
}

const modelTemplate = loadTemplate("modelTemplate.mustache")
const enumTemplate = loadTemplate("enumTemplate.mustache")

// Common regex patterns mapped to constant names
const REGEX_PATTERN_MAP: Record<string, string> = {
  '^\\d{4}-\\d{2}-\\d{2}$': 'REGEX_DATE',
  '^(?!^[-+.]*$)[+-]?0*(?:\\d{0,11}|(?=[\\d.]{1,16}0*$)\\d{0,11}\\.\\d{0,4}0*$)': 'REGEX_DECIMAL_11_4',
  '^(?!^[-+.]*$)[+-]?0*(?:\\d{0,6}|(?=[\\d.]{1,11}0*$)\\d{0,6}\\.\\d{0,4}0*$)': 'REGEX_DECIMAL_6_4',
  '^(?!^[-+.]*$)[+-]?0*\\d*\\.?\\d*$': 'REGEX_DECIMAL_FLEXIBLE'
}

// List of known enum types
const KNOWN_ENUM_TYPES = [
  'EmploymentType',
  'PayrollMethod',
  'PersonStatus',
  'ProjectStatus',
  'ProjectType',
  'RateType',
  'ServiceCategory',
  'SkillCategory',
  'TESDALevel',
  'UserRole',
]

const isEnumSchema = (schema: any): boolean => {
  return schema && schema.type === 'string' && Array.isArray(schema.enum) && schema.enum.length > 0
}

const getZodType = (property: any, nestedModels: Set<string>, usedPatterns: Set<string>): string => {
  if (!property) return "z.any()"

  // Handle $ref references
  if (property.$ref) {
    const refName = property.$ref.split("/").pop()
    nestedModels.add(refName)
    // Wrap enums with z.enum() using Object.values
    if (KNOWN_ENUM_TYPES.includes(refName)) {
      return `z.enum(Object.values(${refName}) as [string, ...string[]])`
    }
    return refName
  }

  // Handle OpenAPI 3.x anyOf and oneOf
  if (property.anyOf || property.oneOf) {
    const schemas = property.anyOf || property.oneOf;
    
    // Check if this is a nullable pattern (ref/type + null)
    const refSchema = schemas.find((s: any) => s.$ref);
    const typeSchema = schemas.find((s: any) => s.type && s.type !== 'null');
    const hasNull = schemas.some((s: any) => s.type === 'null');
    
    // Handle nullable reference (ref + null)
    if (refSchema && hasNull && schemas.length === 2) {
      const refName = refSchema.$ref.split("/").pop();
      nestedModels.add(refName);
      
      if (KNOWN_ENUM_TYPES.includes(refName)) {
        return `z.enum(Object.values(${refName}) as [string, ...string[]]).nullable()`;
      }
      return `${refName}.nullable()`;
    }
    
    // Handle nullable type with format (e.g., datetime + null, uuid + null)
    if (typeSchema && hasNull && schemas.length === 2) {
      // Recursively get the zod type for the non-null schema
      const baseZodType = getZodType(typeSchema, nestedModels, usedPatterns);
      return `${baseZodType}.nullable()`;
    }
    
    // Otherwise, handle as a union
    const unionTypes = schemas.map((subSchema: any) => 
      getZodType(subSchema, nestedModels, usedPatterns)
    );
    return `z.union([${unionTypes.join(', ')}])`;
  }

  const baseType = property.type
  let zodType = "z.any()"

  switch (baseType) {
    case "string":
      // Handle special formats that have their own z.* methods
      if (property.format === "date-time") {
        zodType = "z.iso.datetime()"
      } else if (property.format === "email") {
        zodType = "z.email()"
      } else if (property.format === "uri") {
        zodType = "z.string().url()"
      } else if (property.format === "date") {
        zodType = "z.string()"
        const constName = REGEX_PATTERN_MAP['^\\d{4}-\\d{2}-\\d{2}$']
        if (constName) {
          usedPatterns.add(constName)
          zodType += `.regex(${constName})`
        } else {
          zodType += ".regex(/^\\d{4}-\\d{2}-\\d{2}$/)"
        }
      } else if (property.enum) {
        zodType = `z.enum([${property.enum
          .map((e: string) => `'${e}'`)
          .join(", ")}])`
      } else {
        zodType = "z.string()"
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

const generateEnumFileContent = (enumName: string, schema: any): string => {
  if (!schema || !Array.isArray(schema.enum)) {
    console.warn(`Warning: Invalid enum schema for ${enumName}`)
    return ''
  }

  return Mustache.render(enumTemplate, {
    enumName,
    values: schema.enum,
    description: schema.title || schema.description,
  })
}

const generateModelFileContent = (modelName: string, schema: any, currentDomain: string, knownEnumTypes: string[]): string => {
  if (!schema) {
    console.warn(`Warning: Empty schema for model ${modelName}`)
    return Mustache.render(modelTemplate, {
      modelName,
      properties: [],
      nestedModels: [],
      hasRegexImport: false,
    })
  }

  // Check if this is an enum schema
  if (isEnumSchema(schema)) {
    return generateEnumFileContent(modelName, schema)
  }

  const nestedModels = new Set<string>()
  const usedPatterns = new Set<string>()
  const properties = generateProperties(
    schema.properties,
    Array.isArray(schema.required) ? schema.required : [],
    nestedModels,
    usedPatterns
  )

  // Separate enum imports from model imports
  const allNestedModels = Array.from(nestedModels)
  const enumImports = allNestedModels.filter(name => knownEnumTypes.includes(name))
  const modelImports = allNestedModels.filter(name => !knownEnumTypes.includes(name))
  
  // Generate import paths for nested models based on their domain
  const nestedModelImports = modelImports.map(nestedModelName => {
    const targetDomain = getModelDomain(nestedModelName)
    let importPath: string
    
    if (targetDomain === currentDomain) {
      // Same domain - use relative import in same directory
      importPath = `./${nestedModelName}`
    } else {
      // Different domain - navigate up and into target domain
      importPath = `../${targetDomain}/${nestedModelName}`
    }
    
    return {
      name: nestedModelName,
      importPath: importPath
    }
  })

  return Mustache.render(modelTemplate, {
    modelName,
    properties,
    nestedModels: nestedModelImports,
    enumImports: enumImports,
    hasRegexImport: usedPatterns.size > 0,
  })
}

export const generateModels = async (
  definitions: any,
  outputDir: string,
  apiBasePath?: string
): Promise<void> => {
  if (!definitions || typeof definitions !== "object") {
    console.warn("Warning: No definitions found in swagger file")
    return
  }

  const modelsDir = path.resolve(outputDir, "models")
  const constantsDir = path.resolve(outputDir, "constants")
  
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true })
  }
  if (!fs.existsSync(constantsDir)) {
    fs.mkdirSync(constantsDir, { recursive: true })
  }

  // Track all used patterns across all models with their actual regex patterns
  const allUsedPatterns = new Map<string, string>()
  const enumDefinitions: Array<{ name: string; content: string }> = []
  // Track domain directories created
  const createdDomains = new Set<string>()
  
  // First pass: Identify all enums
  const enumNames = new Set<string>()
  for (const [name, schema] of Object.entries(definitions)) {
    if (!schema) continue
    const cleanedName = stripApiBasePath(name, apiBasePath);
    const cleanName = toPascalCase(cleanedName)
    if (isEnumSchema(schema)) {
      enumNames.add(cleanName)
    }
  }
  
  // Update KNOWN_ENUM_TYPES to include all detected enums
  const KNOWN_ENUM_TYPES_RUNTIME = Array.from(enumNames)

  // Generate models and collect enums
  for (const [name, schema] of Object.entries(definitions)) {
    if (!schema) {
      console.warn(`Warning: Empty schema for ${name}`)
      continue
    }
    const cleanedName = stripApiBasePath(name, apiBasePath);
    const cleanName = toPascalCase(cleanedName)
    
    // Determine domain for this model first (needed for generateModelFileContent)
    const domain = getModelDomain(cleanName)
    const modelContent = generateModelFileContent(cleanName, schema, domain, KNOWN_ENUM_TYPES_RUNTIME)
    
    // Check if this is an enum and save to constants dir
    if (isEnumSchema(schema)) {
      enumDefinitions.push({ name: cleanName, content: modelContent })
    } else {
      const domainDir = path.join(modelsDir, domain)
      
      // Create domain directory if it doesn't exist
      if (!createdDomains.has(domain)) {
        if (!fs.existsSync(domainDir)) {
          fs.mkdirSync(domainDir, { recursive: true })
        }
        createdDomains.add(domain)
      }
      
      // Write model to domain subdirectory
      fs.writeFileSync(path.join(domainDir, `${cleanName}.ts`), modelContent)
    }
    
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

  // Write all enums to constants directory
  for (const enumDef of enumDefinitions) {
    fs.writeFileSync(path.join(constantsDir, `${enumDef.name}.ts`), enumDef.content)
  }

  // Generate regex constants file if any patterns were used
  if (allUsedPatterns.size > 0) {
    const regexConstantsContent = `// Auto-generated regex constants
${Array.from(allUsedPatterns.entries()).map(([constName, pattern]) => {
  return `export const ${constName} = /${pattern}/;`
}).join('\n')}
`
    fs.writeFileSync(path.join(constantsDir, 'regex-constants.ts'), regexConstantsContent)
  }
}
