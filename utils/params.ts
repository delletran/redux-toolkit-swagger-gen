// #region getQueryParams
const getQueryParams = (
  parameters: (IBodyParameter | IQueryParameter)[]
): string[] => {
  const params = parameters
    .filter((param) => param.in === "query")
    .map((param) => param.name)
  return params
}
// #endregion

// #region getBodyParams
const getBodyParams = (
  parameters: (IBodyParameter | IQueryParameter)[]
): string[] => {
  const params = parameters
    .filter((param) => param.in === "body")
    .map((param) => param.name)
  return params
}
// #endregion

// #region getPathParams
const getPathParams = (parameters: IEndpointParameter[]): string[] => {
  const params = parameters
    .filter((param) => param.in === "path")
    .map((param) => param.name)
  return params
}
// #endregion

// #region getPathParamsTyped
const getPathParamsTyped = (
  parameters: IEndpointParameter[],
  method?: MethodType
): string[] => {
  const params = parameters
    .filter((param) => param.in === "path")
    .map((param) => {
      const paramType = _parsePathParamType(param)
      return `${param.name}${param.required ? "" : "?"}: ${paramType}`
    })
  return params
}
// #endregion

// #region getPathParamsTyped
const getParamsTyped = (
  parameters: (IBodyParameter | IQueryParameter)[]
): string[] => {
  const params = parameters.map((param) => {
    const paramType = _parseQueryParamType(param as IQueryParameter)
    return `${param.name}${param.required ? "" : "?"}: ${paramType}`
  })
  return params
}
// #endregion

const _parsePathParamType = (param: IEndpointParameter): string => {
  let paramType = param.type
  if (paramType === "integer") {
    paramType = "number"
  } else if (paramType === "string") {
    paramType = "string"
  } else if (paramType === "array" && param.items) {
    paramType = `${param.items.type}[]`
  } else if (paramType === "object") {
    paramType = "Record<string, any>"
  }
  return paramType
}

const _parseQueryParamType = (param: IQueryParameter): string => {
  if (param.schema?.$ref) {
    return `I${param.schema.$ref.split("/").pop()}Serializer`
  }
  let paramType = param.type
  if (paramType === "integer") {
    paramType = "number"
  } else if (paramType === "string") {
    paramType = "string"
  } else if (paramType === "object") {
    paramType = "Record<string, any>"
  }
  return paramType || "unknown"
}

module.exports = {
  getQueryParams,
  getBodyParams,
  getPathParams,
  getPathParamsTyped,
  getParamsTyped,
  _parsePathParamType,
  _parseQueryParamType,
}
