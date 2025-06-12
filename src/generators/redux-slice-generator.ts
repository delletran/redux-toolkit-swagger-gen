import * as fs from "fs"
import * as path from "path"
import Mustache from "mustache"

import { fsRead } from "../utils/helpers"

const sliceTemplate = fsRead("../templates/sliceTemplate.mustache")

const toPascalCase = (str: string): string => {
  return str.replace(/(^\w|_\w|-\w)/g, (g) =>
    g.replace(/[_-]/, "").toUpperCase()
  )
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
    const uniqueImports = [{ interface: `I${name}Serializer`, modelName: name }]
    const interfaceName = `I${name}Serializer`
    const sliceContent = generateSliceFileContent(
      sliceName,
      name,
      uniqueImports,
      interfaceName
    )
    fs.writeFileSync(path.join(slicesDir, `${sliceName}Slice.ts`), sliceContent)
    sliceNames.push(sliceName)
  }
  sliceNames = Array.from(new Set(sliceNames))
  updateConstantsFile(path.join(reduxDir, "constants.ts"), sliceNames)

  // Clean up temp file if it exists
  if (fs.existsSync(tempConstantsFilePath)) {
    fs.unlinkSync(tempConstantsFilePath)
  }
}
