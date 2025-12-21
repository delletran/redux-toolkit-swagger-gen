import * as fs from "fs"
import * as path from "path"
import Mustache from "mustache"

import { loadTemplate } from "../utils/template-loader"
import { toPascalCase } from "../utils/formater"
import { stripApiBasePath } from "../utils/name-cleaner"

const sliceTemplate = loadTemplate("sliceTemplate.mustache")

const getModelDomain = (modelName: string): string => {
  const name = modelName.toLowerCase();
  
  if (/^(user|login|token|refresh|account|password)/.test(name)) return 'auth';
  if (/^(member|membership)/.test(name)) return 'members';
  if (/^(attendance|checkin|checkout)/.test(name)) return 'attendance';
  if (/^(transaction|payment)/.test(name)) return 'transactions';
  if (/^branch/.test(name)) return 'branches';
  if (/^lead/.test(name)) return 'leads';
  if (/^(goal|unit)/.test(name)) return 'goals';
  if (/^(discount|referral)/.test(name)) return 'discounts';
  if (/^expense/.test(name)) return 'expenses';
  if (/^(product|inventory|stock|sale)/.test(name)) return 'products';
  if (/^(role|permission|module|submodule|department)/.test(name)) return 'permissions';
  if (/^notification/.test(name)) return 'notifications';
  if (/^(report|profit|revenue|export)/.test(name)) return 'reports';
  if (/^(analytics|churn|retention|cohort|segment|ltv|engagement|atrisk|renewal|prediction)/.test(name)) return 'analytics';
  if (/^(setting|systemconfiguration|category)/.test(name)) return 'settings';
  if (/^(file|upload)/.test(name)) return 'files';
  if (/^(billing|schedule|upcoming)/.test(name)) return 'billing';
  if (/^(paymentintent|paymentstatus|cardtokenize|refund)/.test(name)) return 'payment-gateway';
  if (/^training/.test(name)) return 'training';
  if (/^dashboard/.test(name)) return 'dashboard';
  if (/^(validation|http|body_|app_schemas_|app__)/.test(name)) return 'common';
  
  return 'common';
}

const toKebabCase = (str: string): string => {
  return str.replace(/[_\s]+/g, '-').replace(/([A-Z])/g, (g) => '-' + g.toLowerCase()).replace(/^-/, '')
}

const generateSliceFileContent = (
  sliceName: string,
  schemaName: string,
  uniqueImports: any[],
  interfaceName: string,
  useAtAlias?: boolean,
  modelDomain?: string
): string => {
  return Mustache.render(sliceTemplate, {
    sliceName,
    schemaName,
    interfaceName,
    formSliceName: sliceName.toUpperCase(),
    sliceNameCamelCase: sliceName.charAt(0).toLowerCase() + sliceName.slice(1),
    sliceNamePascalCase: toPascalCase(sliceName),
    sliceNameKebabCase: toKebabCase(sliceName),
    uniqueImports,
    useAtAlias,
    modelDomain,
  })
}

const updateConstantsFile = (
  tempConstantsFilePath: string,
  sliceNames: string[]
): void => {
  const constantsFileContent = fs.readFileSync(tempConstantsFilePath, "utf-8")

  // Extract the FORM_SLICE content
  const formSliceMatch = constantsFileContent.match(
    /FORM_SLICE = {([^}]+)} as const/
  )
  if (!formSliceMatch) {
    throw new Error("FORM_SLICE not found in constants file")
  }

  let formSliceContent = formSliceMatch[1]

  // Remove existing slice constants
  sliceNames.forEach((sliceName) => {
    const formSliceRegex = new RegExp(
      `\\s*${sliceName.toUpperCase()}: '${sliceName}-form-slice',`,
      "g"
    )
    formSliceContent = formSliceContent.replace(formSliceRegex, "")
  })

  // Add new slice constants
  const newEntries = sliceNames
    .map(
      (sliceName) => `  ${sliceName.toUpperCase()}: '${sliceName}-form-slice',`
    )
    .join("\n")
  formSliceContent = `${newEntries}\n${formSliceContent}`

  // Sort the entries
  const formSliceEntries = formSliceContent.match(/  [A-Z_]+: '[^']+',/g) || []
  const sortedFormSliceEntries = formSliceEntries.sort().join("\n")

  // Replace the FORM_SLICE content in the original file content
  const finalContent = constantsFileContent.replace(
    /FORM_SLICE = {[^}]+} as const/,
    `FORM_SLICE = {\n${sortedFormSliceEntries}\n} as const`
  )

  fs.writeFileSync(tempConstantsFilePath, finalContent)
}

export const generateReduxSlices = async (
  definitions: any,
  outputDir: string,
  apiBasePath?: string,
  useAtAlias?: boolean
): Promise<void> => {
  const slicesDir = path.resolve(outputDir, "slices")
  if (!fs.existsSync(slicesDir)) {
    fs.mkdirSync(slicesDir, { recursive: true })
  }

  // Update constants file path to use src directory
  const constantsFilePath = path.resolve(
    __dirname,
    "../../src/redux/constants.ts"
  )
  const reduxDir = path.join(outputDir, "redux")

  // Ensure redux directory exists
  if (!fs.existsSync(reduxDir)) {
    fs.mkdirSync(reduxDir, { recursive: true })
  }

  const tempConstantsFilePath = path.join(reduxDir, "constants.temp.ts")

  // Create default constants if file doesn't exist
  if (!fs.existsSync(constantsFilePath)) {
    const defaultConstants = `export const FORM_SLICE = {} as const;\n`
    fs.writeFileSync(path.join(reduxDir, "constants.ts"), defaultConstants)
  } else {
    // Copy constants.ts to output directory if it exists
    fs.copyFileSync(constantsFilePath, path.join(reduxDir, "constants.ts"))
  }

  // Continue with slice generation
  let sliceNames = []
  for (const [name, schema] of Object.entries(definitions)) {
    const cleanedName = stripApiBasePath(name, apiBasePath);
    const sliceName = cleanedName.replace(/Upsert$/, "").replace(/GetToAlter$/, "")
    const modelName = toPascalCase(cleanedName)
    const sliceFileName = toPascalCase(sliceName)
    
    // Get domain for the model to construct correct import path
    const modelDomain = getModelDomain(cleanedName)
    const modelPath = `${modelDomain}/${modelName}`
    
    const uniqueImports = [{ interface: `I${modelName}Schema`, modelName: modelPath }]
    const interfaceName = `I${modelName}Schema`
    
    // Use domain-based classification for slice directory
    const subDir = modelDomain
    
    const sliceContent = generateSliceFileContent(
      sliceName,
      cleanedName,
      uniqueImports,
      interfaceName,
      useAtAlias,
      subDir
    )
    
    const targetDir = path.join(slicesDir, subDir)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
    
    fs.writeFileSync(path.join(targetDir, `${sliceFileName}Slice.ts`), sliceContent)
    sliceNames.push(sliceName)
  }
  sliceNames = Array.from(new Set(sliceNames))
  updateConstantsFile(path.join(reduxDir, "constants.ts"), sliceNames)

  // Clean up temp file if it exists
  if (fs.existsSync(tempConstantsFilePath)) {
    fs.unlinkSync(tempConstantsFilePath)
  }
}
