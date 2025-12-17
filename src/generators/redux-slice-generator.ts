import * as fs from "fs"
import * as path from "path"
import Mustache from "mustache"

import { loadTemplate } from "../utils/template-loader"
import { toPascalCase } from "../utils/formater"

const sliceTemplate = loadTemplate("sliceTemplate.mustache")

const toKebabCase = (str: string): string => {
  return str.replace(/[_\s]+/g, '-').replace(/([A-Z])/g, (g) => '-' + g.toLowerCase()).replace(/^-/, '')
}

const generateSliceFileContent = (
  sliceName: string,
  schemaName: string,
  uniqueImports: any[],
  interfaceName: string
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
  outputDir: string
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
    const sliceName = name.replace(/Upsert$/, "").replace(/GetToAlter$/, "")
    const modelName = toPascalCase(name)
    const sliceFileName = toPascalCase(sliceName)
    const uniqueImports = [{ interface: `I${modelName}Serializer`, modelName: modelName }]
    const interfaceName = `I${modelName}Serializer`
    const sliceContent = generateSliceFileContent(
      sliceName,
      name,
      uniqueImports,
      interfaceName
    )
    
    // Determine subdirectory based on slice type to match thunks structure
    let subDir = ''
    if (sliceName.match(/^(Client)/i)) {
      subDir = 'clients'
    } else if (sliceName.match(/^(Partner)/i)) {
      subDir = 'partners'
    } else if (sliceName.match(/^(Consultant)/i)) {
      subDir = 'consultants'
    } else if (sliceName.match(/^(Professional)/i)) {
      subDir = 'professionals'
    } else if (sliceName.match(/^(Subcontractor)/i)) {
      subDir = 'subcontractors'
    } else if (sliceName.match(/^(ManpowerEmployee)/i)) {
      subDir = 'manpower'
    } else if (sliceName.match(/^(SkilledWorker)/i)) {
      subDir = 'skilled-workers'
    } else if (sliceName.match(/^(Project)/i)) {
      subDir = 'projects'
    } else if (sliceName.match(/^(Portfolio)/i)) {
      subDir = 'portfolio'
    } else if (sliceName.match(/^(Service)/i)) {
      subDir = 'services'
    } else if (sliceName.match(/^(Document|Body.*Document)/i)) {
      subDir = 'documents'
    } else if (sliceName.match(/^(Login|Token|RefreshToken|User)/i)) {
      subDir = 'auth'
    } else {
      subDir = 'common'
    }
    
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
