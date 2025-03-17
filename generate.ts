const axios = require("axios")

const swaggerPath = process.argv[2] || "http://localhost:8000/swagger.json"
const baseOutPath = path.resolve(__dirname, "src/api")

const outputDir = baseOutPath
const sliceDir = baseOutPath
const reduxDir = path.join(baseOutPath, "redux")
const thunkDir = path.join(baseOutPath, "thunks")
const schemaDir = path.join(baseOutPath, "schema")
const constantsDir = path.join(baseOutPath, "constants")

module.exports = {
  swaggerPath,
  baseOutPath,
  outputDir,
  sliceDir,
  reduxDir,
  thunkDir,
  schemaDir,
  constantsDir,
}

// Ensure all directories exist
;[
  reduxDir,
  sliceDir,
  schemaDir,
  thunkDir,
  path.join(reduxDir, "helper"),
  constantsDir,
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

const fetchSwagger = async (url: string): Promise<any> => {
  const response = await axios.get(url)
  return response.data
}

const generateServices = (
  paths: ExtendedPathType[],
  definitions: DefinitionType,
  generateIndex = false
): void => {
  const subFolders = new Set<string>()
  const mainRoutes: Record<string, Record<string, ReduxApiEndpointType>> = {}

  // Group routes by main endpoint
  for (const [route, methods] of Object.entries(paths)) {
    const subDir = route.split("/")[1]
    const method = (["get", "put", "patch", "delete"] as MethodType[]).find(
      (m) => methods[m]
    )
    const methodObject = method ? methods[method] : undefined

    if (methodObject && method) {
      mainRoutes[subDir] = {
        ...mainRoutes[subDir],
        [route]: {
          id: methodObject.operationId,
          url: route,
          method,
          parentPath: subDir,
          tags: methodObject.tags,
          parameters: (methods as ExtendedPathType).parameters ?? [],
          methodObj: methodObject,
        },
      }
    }
  }
  // Generate service and thunk files
  for (const [route, methods] of Object.entries(mainRoutes)) {
    const servicesDir = path.join(outputDir, "services", route)
    const thunksDir = path.join(thunkDir, route)

    fs.mkdirSync(servicesDir, { recursive: true })
    fs.mkdirSync(thunksDir, { recursive: true })

    const service = generateApiService(route, methods)
    const thunk = thunkGenerator(route, methods)

    const fileName = route.replace(/\W/g, "_") // Simplified filename formatting
    fs.writeFileSync(path.join(servicesDir, `${fileName}.ts`), service)
    fs.writeFileSync(path.join(thunksDir, `${fileName}.thunk.ts`), thunk)

    subFolders.add(servicesDir)
    subFolders.add(thunksDir)
  }

  // Generate index.ts files if required
  // if (generateIndex) {
  //   ;["services", "thunks"].forEach((type) => {
  //     const folders = Array.from(subFolders).filter((f) => f.includes(type))
  //     let indexContent = ""
  //     folders.forEach((folder) => {
  //       const files = fs
  //         .readdirSync(folder)
  //         .filter((file) => file.endsWith(".ts"))
  //       // indexContent = indexContent.concat(files.map(file => `export * from './${file.replace('.thunk.ts', '')}/${file.replace('', '')}';`).join('\n'), '\n');
  //     })
  //     fs.writeFileSync(
  //       path.join(type === "services" ? outputDir : thunkDir, "index.ts"),
  //       indexContent
  //     )
  //   })
  // }
}

const generateMain = async () => {
  let swagger
  if (swaggerPath.startsWith("http")) {
    swagger = await fetchSwagger(swaggerPath)
  } else {
    swagger = JSON.parse(fs.readFileSync(swaggerPath, "utf-8"))
  }
  const { definitions, paths } = parseSwagger(swagger)

  await generateModels(definitions, outputDir)

  // Generate tags
  const tagsContent = generateTags(paths)
  const tagsDir = path.resolve(__dirname, constantsDir)
  if (!fs.existsSync(tagsDir)) {
    fs.mkdirSync(tagsDir, { recursive: true })
  }
  fs.writeFileSync(path.join(tagsDir, "tags.ts"), tagsContent)

  // Generate services for paths that do not have 'object' type attributes
  generateServices(paths, definitions, true) // Pass true to generate index files

  // Update params generation to use the new class
  const paramsGenerator = new ParamsGenerator(paths, outputDir)
  paramsGenerator.generate()

  // Generate Redux slices
  await generateReduxSlices(definitions, outputDir)

  // Copy dependency files to the output directory
  const reduxGlobalFiles = ["redux.d.ts", "index.d.ts"]
  const reduxFiles = [
    "response.ts",
    "types.ts",
    "query.ts",
    "actions.ts",
    "helper/array.ts",
  ]

  reduxGlobalFiles.forEach((file) => {
    fs.copyFileSync(
      path.resolve(__dirname, `./redux/${file}`),
      path.join(sliceDir, file)
    )
  })
  reduxFiles.forEach((file) => {
    fs.copyFileSync(
      path.resolve(__dirname, `./redux/${file}`),
      path.join(reduxDir, file)
    )
  })

  fs.copyFileSync(
    path.resolve(__dirname, "./schema/api.ts"),
    path.join(schemaDir, "api.ts")
  )
  console.log(`APIs generated to ${baseOutPath}`)
}

generateMain().catch(console.error)
