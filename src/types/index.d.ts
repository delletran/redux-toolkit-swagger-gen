type MethodType = 'get' | 'post' | 'put' | 'patch' | 'delete'

// #region EndpointParameterType
interface IEndpointParameter {
  name: string;
  in: string | "path";
  description?: string;
  required?: boolean;
  type: string;
  schema?: any;
  items?: IEndpointParameter
}
// #endregion

// #region BodyParameter
interface IBodyParameter {
  name: string | "data";
  in: string | "body";
  required?: boolean;
  type?: string;
  schema?: {
    '$ref': string;
  };
}
// #endregion

// #region QueryParameter
interface IQueryParameter {
  name: string | "search";
  in: string | "query";
  description?: string;
  required?: boolean;
  schema?: {
    '$ref': string;
  };
  type?: string;
}
// #endregion

// #region BodyParameter
type AnyParameterType = (IEndpointParameter | IBodyParameter | IQueryParameter)
// #endregion

// #region ResponseSchemaType
type ResponseSchemaType = {
  required: string[];
  type?: string;
  properties?: {
    count?: {
      type: 'integer';
    };
    next?: {
      type: 'string';
      format: 'uri';
      'x-nullable': boolean;
    }?;
    previous: {
      type: 'string';
      format: 'uri';
      'x-nullable': boolean;
    }?;
    results?: {
      type: 'array';
      items: {
        '$ref': string;
      };
    };
  };
};
// #endregion

// #region ResponseType
interface IResponse {
  [status: string]: {
    description: string;
    schema?: { '$ref': string } | ResponseSchemaType;
    // OpenAPI 3.x style
    content?: {
      [contentType: string]: {
        schema: {
          '$ref'?: string;
          type?: string;
          properties?: any;
          items?: any;
        }
      }
    }
  };
};
// #endregion

// #region RequestBodyType
interface RequestBodyType {
  description?: string;
  required?: boolean;
  content: {
    [contentType: string]: {
      schema: {
        '$ref'?: string;
        type?: string;
        properties?: any;
        items?: any;
        anyOf?: any[];
        oneOf?: any[];
      }
    }
  }
}
// #endregion

// #region MethodObjectType
type MethodObjectType = {
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: (IBodyParameter | IQueryParameter)[];
  responses: IResponse;
  tags: string[];
  // OpenAPI 3.x style
  requestBody?: RequestBodyType;
};

// #region PathType
type PathType = {
  [m in MethodType]?: MethodObjectType;
}
type ExtendedPathType = PathType & { parameters?: IEndpointParameter[] };
// #endregion

// #region DefinitionType
type DefinitionType = Record<string, {
  required: string[];
  type: 'object';
  properties: Record<string, unknown>;
}>
// #endregion

// #region ReduxApiSliceEndpointType
type ReduxApiEndpointType = {
  // use whole endpoint path as id
  id: string;
  url: string;
  method: MethodType;
  parentPath: string;
  tags: string[];
  parameters: IEndpointParameter[]
  schema?: any;
  methodObj: MethodObjectType;
}
// #endregion