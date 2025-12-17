import * as fs from "fs"
import * as path from "path"
import Mustache from "mustache"
import { toPascalCase } from "../utils/formater"
import { _parsePathParamType, _parseQueryParamType } from "../utils/params"
import { loadTemplate } from "../utils/template-loader"

interface IPaths {
  [key: string]: {
    [key: string]: MethodObjectType
  }
}

interface GroupedParams {
  [groupName: string]: {
    [routePath: string]: MethodObjectType
  }
}

const paramsTemplate = loadTemplate("paramsTemplate.mustache")

export class ParamsGenerator {
  private readonly outputDir: string
  private readonly paths: IPaths

  constructor(paths: IPaths, outputDir: string) {
    this.paths = paths
    this.outputDir = outputDir
  }

  public generate(): void {
    const groupedParams = this.groupParamsByMainRoute()
    this.generateGroupedParams(groupedParams)
  }

  private groupParamsByMainRoute(): GroupedParams {
    const grouped: GroupedParams = {}

    for (const [route, methods] of Object.entries(this.paths)) {
      const mainRoute = route.split("/")[1]
      if (!grouped[mainRoute]) {
        grouped[mainRoute] = {}
      }

      for (const [httpMethod, details] of Object.entries(methods)) {
        if (this.isValidHttpMethod(httpMethod) && details.parameters) {
          grouped[mainRoute][route] = details
        }
      }
    }

    return grouped
  }

  private generateGroupedParams(groupedParams: GroupedParams): void {
    for (const [group, routes] of Object.entries(groupedParams)) {
      const paramsDir = path.join(this.outputDir, "params")
      if (!fs.existsSync(paramsDir)) {
        fs.mkdirSync(paramsDir, { recursive: true })
      }

      const allInterfaces = []
      const imports = new Set<{ name: string; fileName: string }>()

      for (const [route, details] of Object.entries(routes)) {
        if (details.parameters) {
          const { interfaceData, requiredImports } = this.generateParamsContent(
            route,
            details
          )
          if (interfaceData && interfaceData.properties.length > 0) {
            allInterfaces.push(interfaceData)
            requiredImports.forEach((imp) => {
              if (
                !Array.from(imports).some(
                  (existingImp) => existingImp.name === imp.name
                )
              ) {
                imports.add(imp)
              }
            })
          }
        }
      }

      if (allInterfaces.length > 0) {
        const content = Mustache.render(paramsTemplate, {
          imports: Array.from(imports),
          interfaces: allInterfaces,
        })
        const fileName = `${group}.params.ts`
        fs.writeFileSync(path.join(paramsDir, fileName), content)
      }
    }
  }

  private isValidHttpMethod(method: string): boolean {
    return ["get", "post", "put", "delete", "patch"].includes(method)
  }
  private generateParamsContent(
    route: string,
    details: MethodObjectType
  ): { interfaceData: any; requiredImports: Set<any> } {
    if (!details.parameters && !details.requestBody)
      return { interfaceData: null, requiredImports: new Set() }

    const routeIdentifier = route
      .split("/")
      .slice(1)
      .map((part) => part.replace(/{|}/g, ""))
      .join("_")
    const interfaceName = `I${toPascalCase(routeIdentifier)}Params`
    const requiredImports = new Set<{ name: string; fileName: string }>()
    const properties = []

    // Handle OpenAPI 2.0 parameters
    if (details.parameters) {
      details.parameters.forEach((param: IQueryParameter | IBodyParameter) => {
        const paramName = param.name
        let paramType: string
        if (param.in === "query") {
          paramType = _parseQueryParamType(param as IQueryParameter)
          // Check if this is a Serializer type that needs an import
          if (paramType.endsWith('Serializer')) {
            const modelName = paramType.replace(/^I/, '').replace(/Serializer$/, '')
            requiredImports.add({
              name: paramType,
              fileName: modelName,
            })
          }
        } else if (param.in === "path") {
          // Convert to IEndpointParameter for path param parsing
          const pathParam: IEndpointParameter = {
            name: param.name,
            in: param.in,
            type: param.type || "string",
            required: param.required,
          }
          paramType = _parsePathParamType(pathParam)
        } else if (param.in === "formData") {
          // Handle form data parameters
          paramType = this.parseFormDataParamType(param as IQueryParameter)
        } else if (param.in === "body" && param.schema) {
          if (param.schema.$ref) {
            const refType = param.schema.$ref.split("/").pop() || ""
            const serializerName = `I${toPascalCase(refType)}Serializer`
            requiredImports.add({
              name: serializerName,
              fileName: toPascalCase(refType),
            })
            paramType = serializerName
          } else {
            paramType = "any"
          }
        } else {
          paramType = "any"
        }

        properties.push({
          name: paramName,
          type: paramType,
          optional: !param.required,
        })
      })
    }

    // Handle OpenAPI 3.x requestBody
    if (details.requestBody?.content) {
      const contentTypes = Object.keys(details.requestBody.content)
      const firstContentType = contentTypes[0]
      const schema = details.requestBody.content[firstContentType]?.schema

      if (schema?.$ref) {
        const refType = schema.$ref.split("/").pop() || ""
        const serializerName = `I${toPascalCase(refType)}Serializer`
        requiredImports.add({
          name: serializerName,
          fileName: toPascalCase(refType),
        })

        // Add the request body as a parameter
        properties.push({
          name: "body",
          type: serializerName,
          optional: !details.requestBody.required,
        })
      }
    }

    return {
      interfaceData: {
        name: interfaceName,
        properties,
      },
      requiredImports,
    }
  }

  private parseFormDataParamType(param: IQueryParameter): string {
    // Handle form data parameter types
    if (param.type === "file") {
      return "File"
    }
    return _parseQueryParamType(param)
  }
}
