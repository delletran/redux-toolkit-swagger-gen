import * as fs from "fs"
import * as path from "path"
import axios from "axios"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { parseSwagger } from "./utils/swagger-parser"
import { generateModels } from "./generators/model-generator"
import { apiServiceGenerator } from "./generators/api-service-generator"
import { thunkGenerator } from "./generators/thunk-generator"
import { generateTags } from "./generators/tag-generator"
import { generateReduxSlices } from "./generators/redux-slice-generator"
import { ParamsGenerator } from "./generators/params-generator"

interface Arguments {
  url: string
  output: string
  verbose?: boolean
  clean: boolean
  skipValidation: boolean
  prettier: boolean
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
    })
    .option("prettier", {
      alias: "p",
      type: "boolean",
      description: "Format generated code with prettier",
      default: true,
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
  try {
    const log = (message: string) => {
      if (argv.verbose) {
        console.log(`[swagger-gen] ${message}`)
      }
    }

    const ensureDirectories = () => {
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
        return JSON.parse(fs.readFileSync(url, "utf-8"))
      } catch (error) {
        console.error(`Failed to fetch swagger from ${url}:`, error)
        process.exit(1)
      }
    }

    const generateServices = (
      paths: ExtendedPathType[],
      definitions: DefinitionType,
      generateIndex = false
    ): void => {
      const subFolders = new Set<string>()
      const mainRoutes: Record<
        string,
        Record<string, ReduxApiEndpointType>
      > = {}

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

        const service = apiServiceGenerator(route, methods)
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
    }

    log("Starting API generation...")
    ensureDirectories()

    const swagger = await fetchSwagger(swaggerPath)
    const { definitions, paths } = parseSwagger(swagger)

    log("Generating models...")
    await generateModels(definitions, outputDir)

    log("Generating tags...")
    const tagsContent = generateTags(paths)
    fs.writeFileSync(path.join(constantsDir, "tags.ts"), tagsContent)

    log("Generating services and thunks...")
    generateServices(paths, definitions, true)

    log("Generating parameters...")
    const paramsGenerator = new ParamsGenerator(paths, outputDir)
    paramsGenerator.generate()

    log("Generating Redux slices...")
    await generateReduxSlices(definitions, outputDir)

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
