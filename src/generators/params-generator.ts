import * as fs from "fs"
import * as path from "path"
import Mustache from "mustache"
import { toPascalCase } from "../utils/formater"
import { _parsePathParamType, _parseQueryParamType } from "../utils/params"
import { loadTemplate } from "../utils/template-loader"
import { stripApiBasePath } from "../utils/name-cleaner"
import { getModelDomain } from "../utils/domain-classifier"
import { isEnumSchema } from "../utils/is-enum-schema"

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
  private readonly apiBasePath?: string
  private readonly useAtAlias?: boolean
  private readonly enumNames: Set<string>

  constructor(paths: IPaths, outputDir: string, definitions: any, apiBasePath?: string, useAtAlias?: boolean) {
    this.paths = paths
    this.outputDir = outputDir
    this.apiBasePath = apiBasePath
    this.useAtAlias = useAtAlias
    
    // Detect all enums from definitions
    this.enumNames = new Set<string>()
    if (definitions && typeof definitions === 'object') {
      for (const [name, schema] of Object.entries(definitions)) {
        if (!schema) continue
        const cleanedName = stripApiBasePath(name, apiBasePath)
        const cleanName = toPascalCase(cleanedName)
        if (isEnumSchema(schema)) {
          this.enumNames.add(cleanName)
        }
      }
    }
  }

  private isEnumType(typeName: string): boolean {
    return this.enumNames.has(typeName)
  }

  public generate(): void {
    const groupedParams = this.groupParamsByMainRoute()
    this.generateGroupedParams(groupedParams)
  }

  private groupParamsByMainRoute(): GroupedParams {
    const grouped: GroupedParams = {}

    // Calculate resource name position based on apiBasePath depth
    const apiBaseDepth = this.apiBasePath ? (this.apiBasePath.match(/\//g) || []).length + 1 : 0;

    for (const [route, methods] of Object.entries(this.paths)) {
      const pathParts = route.split("/");
      const resourceIndex = 1 + apiBaseDepth;
      const mainRoute = pathParts[resourceIndex] || "api";
      if (!grouped[mainRoute]) {
        grouped[mainRoute] = {}
      }

      for (const [httpMethod, details] of Object.entries(methods)) {
        if (this.isValidHttpMethod(httpMethod) && (details.parameters || details.requestBody)) {
          // Create a unique key per route+method to distinguish between GET and PATCH operations
          const routeKey = `${route}::${httpMethod}`;
          grouped[mainRoute][routeKey] = details
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
      const imports = new Set<{ name: string; fileName: string; isEnum?: boolean }>()

      for (const [routeKey, details] of Object.entries(routes)) {
        // Extract route and method from the combined key
        const [route, httpMethod] = routeKey.split('::');
        
        if (details.parameters || details.requestBody) {
          const { interfaceData, requiredImports } = this.generateParamsContent(
            route,
            details,
            httpMethod
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
        const constantsImportPrefix = this.useAtAlias ? '@/api/constants' : '../constants';
        const modelsImportPrefix = this.useAtAlias ? '@/api/models' : '../models';
        
        const content = Mustache.render(paramsTemplate, {
          imports: Array.from(imports),
          interfaces: allInterfaces,
          constantsImportPrefix: constantsImportPrefix,
          modelsImportPrefix: modelsImportPrefix,
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
    details: MethodObjectType,
    httpMethod?: string
  ): { interfaceData: any; requiredImports: Set<any> } {
    if (!details.parameters && !details.requestBody)
      return { interfaceData: null, requiredImports: new Set() }

    // Strip apiBasePath from route for interface naming
    const stripApiBasePathFromRoute = (routePath: string): string => {
      if (!this.apiBasePath) return routePath;
      const basePathPrefix = `/${this.apiBasePath}/`;
      return routePath.startsWith(basePathPrefix) ? routePath.substring(basePathPrefix.length - 1) : routePath;
    };

    const routeForNaming = stripApiBasePathFromRoute(route);
    const routeIdentifier = routeForNaming
      .split("/")
      .slice(1)
      .map((part) => part.replace(/{|}/g, ""))
      .join("_")
    
    // Add HTTP method suffix to distinguish between GET and PATCH/POST/PUT operations
    const methodSuffix = httpMethod ? toPascalCase(httpMethod) : '';
    const interfaceName = `I${toPascalCase(routeIdentifier)}${methodSuffix}Params`
    
    const requiredImports = new Set<{ name: string; fileName: string; isEnum?: boolean }>()
    const properties = []

    // Handle OpenAPI 2.0 parameters
    if (details.parameters) {
      details.parameters.forEach((param: IQueryParameter | IBodyParameter) => {
        const paramName = param.name
        let paramType: string
        if (param.in === "query") {
          paramType = _parseQueryParamType(param as IQueryParameter)
          
          // Check if this is a schema reference (enum or model)
          const schema = (param as IQueryParameter).schema as any;
          let refName: string | undefined;
          
          // Direct $ref
          if (schema?.$ref) {
            refName = schema.$ref.split('/').pop();
          }
          // anyOf with $ref (common for nullable enums)
          else if (schema?.anyOf && Array.isArray(schema.anyOf)) {
            const refType = schema.anyOf.find((t: any) => t.$ref);
            if (refType) {
              refName = refType.$ref.split('/').pop();
            }
          }
          
          if (refName) {
            // For enums, import from constants, for models use models with Schema
            const isEnumType = this.isEnumType(refName);
            // Enums always use just the enum name, models use domain path when useAtAlias is true
            const fileName = isEnumType ? refName : (this.useAtAlias ? `${getModelDomain(refName)}/${refName}` : refName);
            requiredImports.add({
              name: refName,
              fileName: fileName,
              isEnum: isEnumType,
            });
            paramType = refName;
          } else if (paramType.endsWith('Schema')) {
            // For schema types
            const modelName = paramType.replace(/^I/, '').replace(/Schema$/, '')
            const fileName = this.useAtAlias ? `${getModelDomain(modelName)}/${modelName}` : modelName;
            requiredImports.add({
              name: paramType,
              fileName: fileName,
              isEnum: false,
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
            const cleanedRefType = stripApiBasePath(refType, this.apiBasePath)
            const modelName = toPascalCase(cleanedRefType);
            const schemaName = `I${modelName}Schema`
            const fileName = this.useAtAlias ? `${getModelDomain(refType)}/${modelName}` : modelName;
            requiredImports.add({
              name: schemaName,
              fileName: fileName,
            })
            paramType = schemaName
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
      let refString: string | undefined

      // Direct $ref
      if (schema?.$ref) {
        refString = schema.$ref
      }
      // Handle Optional types (anyOf with $ref and null)
      else if (schema?.anyOf && Array.isArray(schema.anyOf)) {
        const refItem = schema.anyOf.find((item: any) => item.$ref)
        if (refItem) {
          refString = refItem.$ref
        }
      }
      // Handle oneOf patterns
      else if (schema?.oneOf && Array.isArray(schema.oneOf)) {
        const refItem = schema.oneOf.find((item: any) => item.$ref)
        if (refItem) {
          refString = refItem.$ref
        }
      }

      if (refString) {
        const refType = refString.split("/").pop() || ""
        const cleanedRefType = stripApiBasePath(refType, this.apiBasePath)
        const modelName = toPascalCase(cleanedRefType);
        const schemaName = `I${modelName}Schema`
        const fileName = this.useAtAlias ? `${getModelDomain(refType)}/${modelName}` : modelName;
        requiredImports.add({
          name: schemaName,
          fileName: fileName,
        })

        // Add the request body as a parameter
        properties.push({
          name: "body",
          type: schemaName,
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
