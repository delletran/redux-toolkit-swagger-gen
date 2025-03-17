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

const generateReduxSlices = async (
  definitions: any,
  outputDir: string
): Promise<void> => {
  const slicesDir = path.resolve(outputDir, "slices")
  if (!fs.existsSync(slicesDir)) {
    fs.mkdirSync(slicesDir, { recursive: true })
  }

  const constantsFilePath = path.resolve(__dirname, "../redux/constants.ts")
  const tempConstantsFilePath = path.resolve(
    outputDir,
    "redux/constants.temp.ts"
  )

  // Copy constants.ts to a temporary file in the output directory
  fs.copyFileSync(constantsFilePath, tempConstantsFilePath)

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
  updateConstantsFile(tempConstantsFilePath, sliceNames)

  // Replace the original constants.ts with the modified temporary file in the output directory
  fs.copyFileSync(
    tempConstantsFilePath,
    path.resolve(outputDir, "redux/constants.ts")
  )
  fs.unlinkSync(tempConstantsFilePath)
}

module.exports = { generateReduxSlices }
