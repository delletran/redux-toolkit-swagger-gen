import { ResponseStatus } from './constants';
import { toPascalCase } from './formater';

export const getNames = (details: ReduxApiEndpointType): { 
  interfaceName: string, 
  modelName: string, 
  paramName: string, 
  requestBodyModelName: string, 
  requestBodyInterfaceName: string,
  isRequestBodyArray: boolean,
  isResponseArray: boolean
} => {
  const responseStatuses = Object.values(ResponseStatus);
  let ref = '';
  let requestBodyRef = '';
  let isRequestBodyArray = false;
  let isResponseArray = false;
  // First check for request body ref in OpenAPI 3.x style
  if (details.methodObj?.requestBody?.content) {
    const contentTypes = Object.keys(details.methodObj.requestBody.content);
    
    for (const contentType of contentTypes) {
      const schema = details.methodObj.requestBody.content[contentType].schema;
      // Check if schema is an array type with items ref
      if (schema?.type === 'array' && schema?.items?.$ref) {
        requestBodyRef = schema.items.$ref;
        isRequestBodyArray = true;
      } else {
        requestBodyRef = schema?.$ref || '';
      }
      if (requestBodyRef) break;
    }
  }

  // If no requestBodyRef yet, check parameters for OpenAPI 2.0 style
  if (!requestBodyRef) {
    const params = details.methodObj?.parameters || [];
    if (Array.isArray(params)) {
      for (const param of params) {
        if (param.in === 'body' && param.schema?.$ref) {
          requestBodyRef = param.schema.$ref;
          break;
        }
      }
    }
  }

  // Get response ref
  for (const status of responseStatuses) {
    // Handle both OpenAPI 2.0 and 3.x response formats
    const response = details.methodObj.responses?.[status];
    if (!response) continue;
    
    // OpenAPI 3.x format uses content.application/json.schema
    const schema = response.schema || 
                   (response.content && response.content['application/json'] && response.content['application/json'].schema);
    if (!schema) continue;
    
    // Use any to handle different schema formats
    // Check if schema is an array type with items ref
    if ((schema as any)?.type === 'array' && (schema as any)?.items?.$ref) {
      ref = (schema as any).items.$ref;
      isResponseArray = true;
    } else {
      ref = (schema as any)?.['$ref'] || 
            (schema as any)?.properties?.results?.items?.$ref || '';
    }
    if (ref) break;
  }

  // const paramModelName = ref ? toPascalCase(ref.split('/').pop() || '') : '';
  // const requestBodyModelName = requestBodyRef ? toPascalCase(requestBodyRef.split('/').pop() || '') : '';
  
  const paramModelName = ref ? toPascalCase(ref.split('/').pop() || '') : '';
  const requestBodyModelName = requestBodyRef ? toPascalCase(requestBodyRef.split('/').pop() || '') : '';
  
  // If no response ref but have request body ref, use that instead
  const modelName = paramModelName || requestBodyModelName || '';
  
  const interfaceName = ref ? `I${paramModelName}Serializer` : (requestBodyModelName ? `I${requestBodyModelName}Serializer` : 'unknown');
  const requestBodyInterfaceName = requestBodyModelName ? `I${requestBodyModelName}Serializer` : interfaceName;  const paramName = ref ? `I${paramModelName}Param` : 'unknown';

  return { interfaceName, modelName, paramName, requestBodyModelName, requestBodyInterfaceName, isRequestBodyArray, isResponseArray };
};
