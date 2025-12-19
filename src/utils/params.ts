// #region getQueryParams
export const getQueryParams = (
  parameters: (IBodyParameter | IQueryParameter)[] | undefined
): string[] => {
  if (!parameters || !Array.isArray(parameters)) return [];
  const params = parameters
    .filter((param) => param.in === 'query' && param.name)
    .map((param) => param.name);
  return params
};
// #endregion

// #region getBodyParams
export const getBodyParams = (
  parameters: (IBodyParameter | IQueryParameter)[] | undefined
): string[] => {
  if (!parameters || !Array.isArray(parameters)) return [];
  const params = parameters
    .filter((param) => param.in === 'body' && param.name)
    .map((param) => param.name);
  return params
};
// #endregion

// #region getPathParams
export const getPathParams = (
  parameters: IEndpointParameter[] | undefined
): string[] => {
  if (!parameters || !Array.isArray(parameters)) return [];
  const params = parameters
    .filter((param) => param.in === 'path' && param.name)
    .map((param) => param.name);
  return params
};
// #endregion

// #region getPathParamsTyped
export const getPathParamsTyped = (
  parameters: IEndpointParameter[] | undefined,
  method?: MethodType
): string[] => {
  if (!parameters || !Array.isArray(parameters)) return [];
  const params = parameters
    .filter((param) => param.in === 'path' && param.name)
    .map((param) => {
      const paramType = _parsePathParamType(param);
      return `${param.name}${param.required ? '' : '?'}: ${paramType}`;
    });
  return params
};
// #endregion

// #region getParamsTyped
export const getParamsTyped = (
  parameters: (IBodyParameter | IQueryParameter)[] | undefined,
): string[] => {
  if (!parameters || !Array.isArray(parameters)) return [];
  // Filter out path parameters to avoid duplication - only include query and body params
  const params = parameters
    .filter((param) => param.in !== 'path')
    .map((param) => {
      const paramType = _parseQueryParamType(param as IQueryParameter);
      return `${param.name}${param.required ? '' : '?'}: ${paramType}`;
    });
  return params;
};
// #endregion

export const _parsePathParamType = (param: IEndpointParameter): string => {
  // OpenAPI 3.x: type is in schema.type
  // OpenAPI 2.0: type is directly on param.type
  let paramType = (param as any).schema?.type || param.type;
  
  if (paramType === 'integer') {
    paramType = 'number';
  } else if (paramType === 'string') {
    paramType = 'string';
  } else if (paramType === 'boolean') {
    paramType = 'boolean';
  } else if (paramType === 'array') {
    const items = (param as any).schema?.items || param.items;
    if (items) {
      const itemType = items.type || 'any';
      paramType = itemType === 'integer' ? 'number[]' : `${itemType}[]`;
    } else {
      paramType = 'any[]';
    }
  } else if (paramType === 'object') {
    paramType = 'Record<string, any>';
  }
  
  return paramType || 'string'; // Default to string for path params
};

export const _parseQueryParamType = (param: IQueryParameter): string => {
  // For enum/complex types (schema refs), return the ref name
  if (param.schema?.$ref) {
    const refName = param.schema.$ref.split('/').pop();
    return refName || 'any';
  }
  
  // OpenAPI 3.x: type is in schema.type
  // OpenAPI 2.0: type is directly on param.type
  const schema = param.schema as any;
  let paramType = schema?.type || (param as any).type;
  
  // Handle anyOf/oneOf schemas (often used for optional types like string | null)
  if (schema?.anyOf && Array.isArray(schema.anyOf)) {
    // First check for $ref (schema references)
    const refType = schema.anyOf.find((t: any) => t.$ref);
    if (refType) {
      const refName = refType.$ref.split('/').pop();
      return refName || 'any';
    }
    
    // Then find the first non-null type
    const nonNullType = schema.anyOf.find((t: any) => t.type && t.type !== 'null');
    if (nonNullType) {
      paramType = nonNullType.type;
    }
  }
  
  if (paramType === 'integer') {
    paramType = 'number';
  } else if (paramType === 'string') {
    paramType = 'string';
  } else if (paramType === 'boolean') {
    paramType = 'boolean';
  } else if (paramType === 'object') {
    paramType = 'Record<string, any>';
  } else if (paramType === 'array') {
    const items = schema?.items || (param as any).items;
    if (items) {
      const itemType = items.type || 'any';
      paramType = itemType === 'integer' ? 'number[]' : `${itemType}[]`;
    } else {
      paramType = 'any[]';
    }
  }
  
  return paramType || 'unknown';
};
