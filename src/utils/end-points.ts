import { ResponseStatus } from "./constants"
import { toCamelCase, toPascalCase } from "./formater"
import {
  getQueryParams,
  getBodyParams,
  getPathParams,
  getPathParamsTyped,
  getParamsTyped,
} from "./params"
import { getNames } from "./interface"
import { stripApiBasePath } from "./name-cleaner"

type EndpointType = "service" | "slice" | "thunk"

export class EndpointFactory {
  static getEndpoints(
    endpointType: EndpointType,
    path: string,
    methods: Record<string, ReduxApiEndpointType>,
    definitions?: any,
    apiBasePath?: string
  ): any[] {
    const pathParams = methods?.parameters || []

    return Object.entries(methods)
      .filter(([url, details]: [string, any]) => details && details.method)
      .map(([url, details]: [string, any]) => {
        const endpointDetails = { ...details, pathParams }
        switch (endpointType) {
          case "service":
            return getServiceEndpoint(path, details.method, endpointDetails, apiBasePath)
          case "slice":
            return getSliceEndpoint(path, details.method, endpointDetails, apiBasePath)
          case "thunk":
            return getThunkEndpoint(path, details.method, endpointDetails, apiBasePath)
          default:
            throw new Error(`Unknown endpoint type: ${endpointType}`)
        }
      })
  }
}

const getServiceEndpoint = (
  path: string,
  httpMethod: MethodType,
  details: ReduxApiEndpointType,
  apiBasePath?: string
): any => {
  const endpoint = new Endpoint("service", path, httpMethod, details, apiBasePath)
  return {
    name: endpoint.name,
    method: endpoint.method,
    path: endpoint.path,
    httpMethod: endpoint.httpMethod,
    params: endpoint.params,
    queryParams: endpoint.queryParams,
    queryParamsArray: endpoint.queryParamsArray,
    bodyParam: endpoint.body,
    tag: endpoint.tag,
    isMutation: endpoint.isMutation,
    isQuery: endpoint.isQuery,
    interface: endpoint.interface,
    hasInterface: endpoint.hasInterface,
    isListEndpoint: endpoint.isListEndpoint,
    modelName: endpoint.modelName,
    exportName: endpoint.exportName,
    types: endpoint.types,
    requestBodyModelName: endpoint.requestBodyModelName,
    requestBodyInterfaceName: endpoint.requestBodyInterfaceName,
    isRequestBodyArray: endpoint.isRequestBodyArray,
    isResponseArray: endpoint.isResponseArray,
  }
}

const getSliceEndpoint = (
  path: string,
  httpMethod: MethodType,
  details: any,
  apiBasePath?: string
): any => {
  const endpoint = new Endpoint("slice", path, httpMethod, details, apiBasePath)
  return {
    name: endpoint.name,
    method: endpoint.method,
    path: endpoint.path,
    httpMethod: endpoint.httpMethod,
    params: endpoint.params,
    body: endpoint.body,
    tag: endpoint.tag,
    isMutation: endpoint.isMutation,
    isQuery: endpoint.isQuery,
    interface: endpoint.interface,
    iNameParam: endpoint.iNameParam,
    hasInterface: endpoint.hasInterface,
    isListEndpoint: endpoint.isListEndpoint,
    modelName: endpoint.modelName,
    exportName: endpoint.exportName,
    types: endpoint.types,
  }
}

const getThunkEndpoint = (
  path: string,
  httpMethod: MethodType,
  details: any,
  apiBasePath?: string
): any => {
  const endpoint = new Endpoint("thunk", path, httpMethod, details, apiBasePath)
  const hasMultipleParams = endpoint.joinedParamsLength > 1
  
  // Generate param interface name if there are parameters
  // Must match the logic in params-generator.ts to ensure consistency
  let paramInterface = null;
  let hasRequestBody = false;
  if (endpoint.params && endpoint.joinedParamsLength > 0) {
    // Strip apiBasePath from route for interface naming
    const stripApiBasePathFromRoute = (routePath: string): string => {
      if (!apiBasePath) return routePath;
      const basePathPrefix = `/${apiBasePath}/`;
      return routePath.startsWith(basePathPrefix) ? routePath.substring(basePathPrefix.length - 1) : routePath;
    };
    
    const routeForNaming = stripApiBasePathFromRoute(details.url);
    const routeIdentifier = routeForNaming
      .split("/")
      .slice(1)
      .map((part: string) => part.replace(/{|}/g, ""))
      .join("_");
    
    // Add HTTP method suffix to match params generator naming
    const methodSuffix = httpMethod.charAt(0).toUpperCase() + httpMethod.slice(1).toLowerCase();
    paramInterface = `I${toPascalCase(routeIdentifier)}${methodSuffix}Params`;
    
    // Check if there's a request body for POST/PUT/PATCH
    if (['post', 'put', 'patch'].includes(httpMethod.toLowerCase())) {
      hasRequestBody = !!(details.methodObj?.requestBody || endpoint.requestBodyModelName);
    }
  }
  
  return {
    operationId: endpoint.name,
    url: endpoint.path,
    method: endpoint.httpMethod,
    parameters: details.methodObj?.parameters || [],
    isListEndpoint: endpoint.isListEndpoint,
    sliceName: path.replace(/[^a-zA-Z0-9]/g, ""),
    slicePath: path,
    interface: endpoint.interface,
    modelName: endpoint.modelName,
    queryParams: endpoint.queryParams,
    queryParamsForObject: endpoint.queryParamsArray.length > 0 ? `{ ${endpoint.queryParamsArray.join(', ')} }` : null,
    bodyParam: endpoint.body,
    hasRequestBody: hasRequestBody,
    pathParamsTyped: endpoint.pathParamsTyped,
    paramsTyped: endpoint.paramsTyped,
    params: endpoint.params,
    paramsForDestructuring: endpoint.joinedParams.join(', '), // For destructuring in thunks
    types: endpoint.types,
    paramInterface: paramInterface,
    // Add flags for template conditional logic
    hasMultipleParams: hasMultipleParams,
    hasSingleParam: !hasMultipleParams && endpoint.params !== null,
  }
}

class Endpoint {
  private _endpointType: EndpointType
  private _path: string
  private _httpMethod: MethodType
  private _details: ReduxApiEndpointType
  private _name: string
  private _exportName: string
  private _isListEndpoint: boolean
  private _isDeleteEndpoint: boolean
  private _modelName: string
  private _interfaceName: string
  private _INameParam: string
  private _isQuery: boolean
  private _bodyParams: string[]
  private _queryParams: string[]
  private _pathParams: string[]
  private _pathParamsTyped: string[]
  private _paramsTyped: string[]
  private _joinedParams: string[]
  private _joinedParamsTyped: string[]
  private _requestBodyModelName: string = ""
  private _requestBodyInterfaceName: string = ""
  private _isRequestBodyArray: boolean = false
  private _isResponseArray: boolean = false

  constructor(
    endpointType: EndpointType,
    path: string,
    httpMethod: MethodType,
    details: ReduxApiEndpointType,
    apiBasePath?: string
  ) {
    this._endpointType = endpointType
    this._path = path
    this._httpMethod = httpMethod
    this._details = details
    // Clean the operation ID to remove API base path patterns
    const cleanedId = stripApiBasePath(details.id, apiBasePath)
    this._name = toCamelCase(cleanedId)
    this._exportName = toPascalCase(this._name)
    
    // Check if this is a list endpoint by multiple criteria:
    // 1. URL or ID contains "list"
    // 2. Has pagination parameters (skip, limit, page, page_size)
    // 3. Returns a PaginatedResponse type
    const hasPaginationParams = details.methodObj?.parameters?.some((p: any) => 
      p.in === 'query' && (p.name === 'skip' || p.name === 'limit' || p.name === 'page' || p.name === 'page_size')
    )
    const response200 = details.methodObj?.responses?.['200']
    const responseSchema = response200?.content?.['application/json']?.schema
    const isPaginatedResponse = responseSchema?.$ref?.includes('PaginatedResponse') ||
                               responseSchema?.$ref?.includes('Paginated') ||
                               responseSchema?.properties?.results ||
                               responseSchema?.properties?.items ||
                               responseSchema?.properties?.data
    const hasNoPathParams = !details.url.includes('{')
    
    this._isListEndpoint =
      details.url.toLowerCase().includes("/list") ||
      details.id.toLowerCase().includes("list") ||
      (httpMethod === "get" && hasPaginationParams && isPaginatedResponse && hasNoPathParams)
    this._isDeleteEndpoint = httpMethod === "delete"
    this._isQuery = httpMethod === "get"

    const {
      interfaceName: paramInterfaceName,
      modelName: paramModelName,
      paramName: iNameParam,
      requestBodyModelName,
      requestBodyInterfaceName,
      isRequestBodyArray,
      isResponseArray,
    } = getNames(details, apiBasePath)
    this._modelName = paramModelName
    this._interfaceName = paramInterfaceName
    this._INameParam = iNameParam
    this._requestBodyModelName = requestBodyModelName
    this._requestBodyInterfaceName = requestBodyInterfaceName
    this._isRequestBodyArray = isRequestBodyArray
    this._isResponseArray = isResponseArray
    this._requestBodyInterfaceName = requestBodyInterfaceName

    this._queryParams = getQueryParams(details.methodObj.parameters)
    this._bodyParams = getBodyParams(details.methodObj.parameters)
    // Path params should come from methodObj.parameters for OpenAPI 3.0
    const methodPathParams = getPathParams(details.methodObj.parameters as any[])
    const pathLevelParams = getPathParams(details.parameters)
    this._pathParams = methodPathParams.length > 0 ? methodPathParams : pathLevelParams
    
    const methodPathParamsTyped = getPathParamsTyped(details.methodObj.parameters as any[], httpMethod)
    const pathLevelParamsTyped = getPathParamsTyped(details.parameters, httpMethod)
    this._pathParamsTyped = methodPathParamsTyped.length > 0 ? methodPathParamsTyped : pathLevelParamsTyped
    
    this._paramsTyped = getParamsTyped(details.methodObj.parameters)

    this._joinedParams = this._pathParams
      .concat(this._queryParams)
      .concat(this._bodyParams)
    this._joinedParamsTyped = this._pathParamsTyped.concat(this._paramsTyped)
  }

  get name(): string {
    return this._name
  }

  get method(): string {
    return this._httpMethod === "get" ? "query" : "mutation"
  }

  get path(): string {
    return `${this._details.url}`.replace(/{/g, "${")
  }

  get httpMethod(): string {
    return this._httpMethod.toUpperCase()
  }

  get tag(): string {
    return this._path.toUpperCase().replace(/-/g, "_") + "_LIST"
  }

  get isMutation(): boolean {
    return ["post", "put", "delete", "patch"].includes(this._httpMethod)
  }

  get isQuery(): boolean {
    return this._isQuery
  }

  get interface(): string {
    return this._interfaceName
  }

  get iNameParam(): string {
    return this._INameParam
  }

  get hasInterface(): boolean {
    return !!this._interfaceName
  }

  get isListEndpoint(): boolean {
    return this._isListEndpoint
  }

  get modelName(): string {
    return this._modelName
  }

  get exportName(): string {
    return this._exportName
  }

  get requestBodyModelName(): string {
    return this._requestBodyModelName
  }

  get requestBodyInterfaceName(): string {
    return this._requestBodyInterfaceName
  }

  get isRequestBodyArray(): boolean {
    return this._isRequestBodyArray
  }

  get isResponseArray(): boolean {
    return this._isResponseArray
  }

  get joinedParamsLength(): number {
    return this._joinedParams.length
  }

  get params(): string | null {
    // For single parameters, return just the name to match with types
    // For multiple parameters, return destructured object
    let param: string | null =
      this._joinedParams.length > 1
        ? `{ ${this._joinedParams.join(", ")} }`
        : this._joinedParams.length === 1
        ? this._joinedParams[0]
        : null
    
    if (param && ["{  }", ""].includes(param))
      param = this._isDeleteEndpoint ? "data" : null

    return param
  }

  get joinedParams(): string[] {
    return this._joinedParams
  }

  get queryParams(): string | null {
    return this._queryParams.length > 1
      ? `{ ${this._queryParams.join(", ")} }`
      : this._queryParams.length == 1
      ? `${this._queryParams.join(", ")}`
      : null
  }

  get queryParamsArray(): string[] {
    return this._queryParams
  }

  get body(): string | null {
    return this._bodyParams.length > 1
      ? `{ ${this._bodyParams.join(", ")} }`
      : this._bodyParams.length == 1
      ? `${this._bodyParams.join(", ")}`
      : null
  }

  get paramsTyped(): string | null {
    return this._paramsTyped.length > 1
      ? `{ ${this._paramsTyped.join(", ")} }`
      : this._paramsTyped.length == 1
      ? `${this._paramsTyped.join(", ")}`
      : null
  }

  get pathParamsTyped(): string | null {
    return this._pathParamsTyped.length > 1
      ? `{ ${this._pathParamsTyped.join(", ")}}`
      : this._pathParamsTyped.length == 1
      ? `${this._pathParamsTyped.join(", ")}`
      : null
  }

  get types(): string {
    // For thunks, if we have only one param type, return it directly without wrapping
    // This allows for cleaner function signatures like (id: string) instead of ({id}: {id: string})
    if (this._joinedParamsTyped.length === 1) {
      return this._joinedParamsTyped[0];
    }
    return !this._isListEndpoint || this._joinedParamsTyped.length > 1
      ? `{ ${this._joinedParamsTyped.join(", ")} }`
      : "IFilters"
  }
}
