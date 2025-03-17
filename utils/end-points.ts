type EndpointType = "service" | "slice" | "thunk"

class EndpointFactory {
  static getEndpoints(
    endpointType: EndpointType,
    path: string,
    methods: Record<string, ReduxApiEndpointType>,
    definitions?: any
  ): any[] {
    const pathParams = methods?.parameters || []

    return Object.entries(methods).map(([url, details]: [string, any]) => {
      const endpointDetails = { ...details, pathParams }
      switch (endpointType) {
        case "service":
          return getServiceEndpoint(path, details.method, endpointDetails)
        case "slice":
          return getSliceEndpoint(path, details.method, endpointDetails)
        case "thunk":
          return getThunkEndpoint(path, details.method, endpointDetails)
        default:
          throw new Error(`Unknown endpoint type: ${endpointType}`)
      }
    })
  }
}

const getServiceEndpoint = (
  path: string,
  httpMethod: MethodType,
  details: ReduxApiEndpointType
): any => {
  const endpoint = new Endpoint("service", path, httpMethod, details)
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
    hasInterface: endpoint.hasInterface,
    isListEndpoint: endpoint.isListEndpoint,
    modelName: endpoint.modelName,
    exportName: endpoint.exportName,
    types: endpoint.types,
  }
}

const getSliceEndpoint = (
  path: string,
  httpMethod: MethodType,
  details: any
): any => {
  const endpoint = new Endpoint("slice", path, httpMethod, details)
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
  details: any
): any => {
  const endpoint = new Endpoint("thunk", path, httpMethod, details)

  return {
    operationId: endpoint.name,
    url: endpoint.path,
    method: endpoint.httpMethod,
    parameters: details.methodObj.parameters || [],
    isListEndpoint: endpoint.isListEndpoint,
    sliceName: path.replace(/[^a-zA-Z0-9]/g, ""),
    slicePath: path,
    interface: endpoint.interface,
    modelName: endpoint.modelName,
    queryParams: endpoint.queryParams,
    bodyParam: endpoint.body,
    pathParamsTyped: endpoint.pathParamsTyped,
    paramsTyped: endpoint.paramsTyped,
    params: endpoint.params,
    types: endpoint.types,
  }
}

class Endpoint {
  private _endpointType: string
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

  constructor(
    endpointType: EndpointType,
    path: string,
    httpMethod: MethodType,
    details: ReduxApiEndpointType
  ) {
    this._endpointType = endpointType
    this._path = path
    this._httpMethod = httpMethod
    this._details = details
    this._name = toCamelCase(details.id)
    this._exportName = toPascalCase(this._name)
    this._isListEndpoint =
      details.url.toLowerCase().includes("/list") ||
      details.id.toLowerCase().includes("list")
    this._isDeleteEndpoint = httpMethod === "delete"
    this._isQuery = httpMethod === "get"

    const {
      interfaceName: paramInterfaceName,
      modelName: paramModelName,
      paramName: iNameParam,
    } = getNames(details)
    this._modelName = paramModelName
    this._interfaceName = paramInterfaceName
    this._INameParam = iNameParam

    this._queryParams = getQueryParams(details.methodObj.parameters)
    this._bodyParams = getBodyParams(details.methodObj.parameters)
    this._pathParams = getPathParams(details.parameters)
    this._pathParamsTyped = getPathParamsTyped(details.parameters, httpMethod)
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

  get params(): string | null {
    let param: string | null =
      this._joinedParams.length > 1
        ? `{ ${this._joinedParams.join(", ")}}`
        : this._joinedParams[0]
    if (param in ["{  }", "", null])
      param = this._isDeleteEndpoint ? "data" : null

    return param
  }

  get queryParams(): string | null {
    return this._queryParams.length > 1
      ? `{ ${this._queryParams.join(", ")} }`
      : this._queryParams.length == 1
      ? `${this._queryParams.join(", ")}`
      : null
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
    return !this._isListEndpoint || this._joinedParamsTyped.length > 1
      ? `{ ${this._joinedParamsTyped.join(", ")} }`
      : "IFilters"
    // : this._INameParam
    //   ? `Record<string, unknown> & ${this._INameParam}`
    //   : 'Record<string, unknown>';
  }
}

module.exports = { EndpointFactory }
