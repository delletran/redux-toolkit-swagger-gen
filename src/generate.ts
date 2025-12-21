// File with modified generate.ts
import * as fs from "fs"
import * as path from "path"
import axios from "axios"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as Mustache from "mustache"
import { parseSwagger } from "./utils/swagger-parser"
import { generateModels } from "./generators/model-generator"
import { apiServiceGenerator } from "./generators/api-service-generator"
import { thunkGenerator } from "./generators/thunk-generator"
import { generateTags } from "./generators/tag-generator"
import { generateReduxSlices } from "./generators/redux-slice-generator"
import { ParamsGenerator } from "./generators/params-generator"
import { generateReduxHooks, generateReduxStore } from "./generators/redux-hooks-generator"

interface Arguments {
  url: string
  output: string
  verbose?: boolean
  clean: boolean
  skipValidation: boolean
  prettier: boolean
  exclude: string[]
  apiBasePath?: string
  "use@"?: boolean
  reduxPath?: string
  [x: string]: unknown
}

const parseArgs = () => {
  return yargs(hideBin(process.argv))
    .usage("Usage: $0 [options]")
    .option("url", {
      alias: "u",
      describe: "Swagger JSON URL or file path",
      type: "string",
      default: "http://localhost:8000/swagger.json",
    })
    .option("output", {
      alias: "o",
      describe: "Output directory",
      type: "string",
      default: "src/api",
      normalize: true,
    })
    .option("verbose", {
      alias: "v",
      type: "boolean",
      description: "Run with verbose logging",
    })
    .option("clean", {
      alias: "c",
      type: "boolean",
      description: "Clean output directory before generating",
      default: false,
    })
    .option("skipValidation", {
      alias: "s",
      type: "boolean",
      description: "Skip swagger schema validation",
      default: false,
    })    .option("prettier", {
      alias: "p",
      type: "boolean",
      description: "Format generated code with prettier",
      default: true,
    })    .option("exclude", {
      alias: "e",
      type: "array",
      description: "Exclude generation types: thunks, slices",
      default: [],
      choices: ["thunks", "slices"],
    })
    .option("apiBasePath", {
      alias: "b",
      type: "string",
      description: "API base URL path (e.g., api/v1/)",
      default: "api",
    })
    .option("use@", {
      type: "boolean",
      description: "Use @ alias for imports (e.g., @/api/models/...)",
      default: false,
    })
    .option("reduxPath", {
      type: "string",
      description: "Path to redux directory for authSlice and store imports (e.g., src/store/redux)",
      default: "src/store/redux",
    })
    .check((argv) => {
      if (argv.clean && !argv.output) {
        throw new Error("Output directory is required when using --clean")
      }
      return true
    })
    .example(
      "$0 --url http://api.example.com/swagger.json",
      "Generate from remote swagger"
    )
    .example(
      "$0 --url ./swagger.json --output ./src/api",
      "Generate from local file"
    )
    .example("$0 --clean --verbose", "Clean output and show detailed logs")
    .example("$0 --exclude thunks", "Generate without thunks")
    .example("$0 --exclude slices", "Generate without slices")
    .example("$0 --exclude thunks slices", "Generate without thunks and slices")
    .help()
    .alias("help", "h").argv as Arguments
}

const argv = parseArgs()
const baseOutPath = path.resolve(process.cwd(), argv.output)

export const swaggerPath = argv.url
export const outputDir = baseOutPath
export const sliceDir = baseOutPath
export const reduxDir = path.join(baseOutPath, "redux")
export const thunkDir = path.join(baseOutPath, "thunks")
export const schemaDir = path.join(baseOutPath, "schema")
export const constantsDir = path.join(baseOutPath, "constants")

const main = async () => {
  try {    const log = (message: string) => {
      if (argv.verbose) {
        console.log(`[swagger-gen] ${message}`)
      }
    }
    
    const ensureDirectories = () => {
      const dirs = [
        reduxDir,
        sliceDir,
        schemaDir,
        path.join(reduxDir, "helper"),
        constantsDir,
      ]
        // Only create thunk directory if thunks are not excluded
      if (!argv.exclude.includes("thunks")) {
        dirs.push(thunkDir)
      }
      
      dirs.forEach((dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
          log(`Created directory: ${dir}`)
        }
      })
    }

    const fetchSwagger = async (url: string): Promise<any> => {
      log(`Fetching swagger from: ${url}`)
      try {
        if (url.startsWith("http")) {
          const response = await axios.get(url)
          return response.data
        }
        return JSON.parse(fs.readFileSync(url, "utf-8"))      } catch (error) {
        console.error(`Failed to fetch swagger from ${url}:`, error)
        process.exit(1)
      }
    }
    
    const generateServices = (
      paths: ExtendedPathType[],
      definitions: DefinitionType,
      generateIndex = false,
      apiBasePath?: string
    ) => {
      const subFolders = new Set<string>()
      const mainRoutes: Record<
        string,
        Record<string, ReduxApiEndpointType>
      > = {}

      // Group routes by main endpoint
      for (const [route, methods] of Object.entries(paths)) {
        // Calculate which path segment contains the resource name
        // based on apiBasePath depth (number of slashes + 1)
        const apiBaseDepth = apiBasePath ? (apiBasePath.match(/\//g) || []).length + 1 : 0;
        const pathParts = route.split("/");
        // Skip empty string from leading slash + apiBasePath segments
        const resourceIndex = 1 + apiBaseDepth;
        const subDir = pathParts[resourceIndex] || "api";
        
        // Process all available HTTP methods for this route
        const availableMethods = (["get", "post", "put", "patch", "delete"] as MethodType[]).filter(
          (m) => methods[m]
        )
        
        for (const method of availableMethods) {
          const methodObject = methods[method]
          console.log(`Processing route: ${route} with method: ${method}`)

          if (methodObject) {
            // Initialize subDir object if it doesn't exist
            if (!mainRoutes[subDir]) {
              mainRoutes[subDir] = {}
            }
            
            // Create a unique route key that includes the method
            const routeKey = `${route}_${method}`
            mainRoutes[subDir] = {
              ...mainRoutes[subDir],
              [routeKey]: {
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
      }
        // Routes are now properly grouped by main endpoint and HTTP method
        // Generate service and thunk files
      for (const [route, methods] of Object.entries(mainRoutes)) {
        const servicesDir = path.join(outputDir, "services", route)
        
        fs.mkdirSync(servicesDir, { recursive: true })
          const service = apiServiceGenerator(route, methods, apiBasePath, argv["use@"])
        const fileName = route.replace(/\W/g, "_") // Simplified filename formatting
        fs.writeFileSync(path.join(servicesDir, `${fileName}.ts`), service)
        subFolders.add(servicesDir)
        
        // Only generate thunks if not excluded
        if (!argv.exclude.includes("thunks")) {
          const thunksDir = path.join(thunkDir, route)
          fs.mkdirSync(thunksDir, { recursive: true })
          
          const thunk = thunkGenerator(route, methods, apiBasePath, argv["use@"])
          fs.writeFileSync(path.join(thunksDir, `${fileName}.thunk.ts`), thunk)
          subFolders.add(thunksDir)
        }
      }

      // Generate index.ts files if required
      // if (generateIndex) {
      //   ;["services", "thunks"].forEach((type) => {
      //     const folders = Array.from(subFolders).filter((f) => f.includes(type));
      //     let indexContent = "";
      //     folders.forEach((folder) => {
      //       const files = fs
      //         .readdirSync(folder)
      //         .filter((file) => file.endsWith(".ts"));
      //       // indexContent = indexContent.concat(files.map(file => `export * from './${file.replace('.thunk.ts', '')}/${file.replace('', '')}';`).join('\n'), '\n');
      //     });
      //     fs.writeFileSync(
      //       path.join(type === "services" ? outputDir : thunkDir, "index.ts"),
      //       indexContent
      //     );
      //   });
      // }
        return mainRoutes;
    }

    const cleanOutputDirectory = () => {
      if (argv.clean && fs.existsSync(outputDir)) {
        log(`Cleaning output directory: ${outputDir}`)
        try {
          // Remove the entire output directory and recreate it
          fs.rmSync(outputDir, { recursive: true, force: true })
          log(`Successfully cleaned output directory`)
        } catch (error) {
          console.error(`Failed to clean output directory: ${error}`)
          process.exit(1)
        }
      }
    }
    
    log("Starting API generation...")
    cleanOutputDirectory()
    ensureDirectories()

    const swagger = await fetchSwagger(swaggerPath)
    const { definitions, paths } = parseSwagger(swagger)

    const apiBasePath = argv.apiBasePath ? argv.apiBasePath.replace(/\/$/, '') : ''

    log("Generating models...")
    await generateModels(definitions, outputDir, apiBasePath)

    log("Generating tags...")
    const tagsContent = generateTags(paths, apiBasePath)
    fs.writeFileSync(path.join(constantsDir, "tags.ts"), tagsContent)

    log("Generating services and thunks...")
    const mainRoutes = generateServices(paths, definitions, true, apiBasePath)

    log("Generating parameters...")
    const paramsGenerator = new ParamsGenerator(paths, outputDir, apiBasePath)
    paramsGenerator.generate()

    log("Generating Redux slices...")
    if (!argv.exclude.includes("slices")) {
      await generateReduxSlices(definitions, outputDir, apiBasePath, argv["use@"])
    } else {
      log("Skipping Redux slices generation (excluded)")
    }    log("Generating Redux hooks and store...")
    generateReduxHooks(outputDir)
    generateReduxStore(outputDir, mainRoutes, argv.exclude, argv.apiBasePath, argv.reduxPath)

    log("Copying dependency files...")
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
        path.resolve(__dirname, `../src/redux/${file}`),
        path.join(sliceDir, file)
      )
    })
    reduxFiles.forEach((file) => {
      fs.copyFileSync(
        path.resolve(__dirname, `../src/redux/${file}`),
        path.join(reduxDir, file)
      )
    })

    // Copy config directory with template rendering
    const configDir = path.join(reduxDir, "config")
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    const apiConfigTemplate = fs.readFileSync(
      path.resolve(__dirname, "../src/redux/config/api.ts"),
      "utf-8"
    )
    // Reuse apiBasePath from above
    const apiConfigContent = Mustache.render(apiConfigTemplate, {
      apiBasePath: apiBasePath
    })
    fs.writeFileSync(
      path.join(configDir, "api.ts"),
      apiConfigContent
    )

    // Copy authSlice and generate store to the specified reduxPath location
    if (argv.reduxPath) {
      log(`Generating store and authSlice to ${argv.reduxPath}...`)
      const targetReduxPath = path.resolve(process.cwd(), argv.reduxPath)
      
      // Create the target directory if it doesn't exist
      if (!fs.existsSync(targetReduxPath)) {
        fs.mkdirSync(targetReduxPath, { recursive: true })
      }
      
      // Copy authSlice to the target location
      fs.copyFileSync(
        path.resolve(__dirname, "../src/redux/slices/authSlice.ts"),
        path.join(targetReduxPath, "authSlice.ts")
      )
      
      // Generate a separate store.ts for the redux directory with updated import paths
      // Calculate relative path from reduxPath to API directory
      const apiRelativePath = path.relative(targetReduxPath, path.resolve(outputDir))
        .replace(/\\/g, '/') // Normalize to forward slashes
      
      generateReduxStore(targetReduxPath, mainRoutes, argv.exclude, argv.apiBasePath, argv.reduxPath, apiRelativePath)
    }

    // Also copy slices to API directory for backward compatibility
    const slicesDir = path.join(sliceDir, "slices")
    if (!fs.existsSync(slicesDir)) {
      fs.mkdirSync(slicesDir, { recursive: true })
    }
    fs.copyFileSync(
      path.resolve(__dirname, "../src/redux/slices/authSlice.ts"),
      path.join(slicesDir, "authSlice.ts")
    )

    fs.copyFileSync(
      path.resolve(__dirname, "../src/schema/api.ts"),
      path.join(schemaDir, "api.ts")
    )

    console.log(`✨ APIs successfully generated to ${baseOutPath}`)
  } catch (error) {
    console.error("Failed to generate API client:", error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

export { main }
