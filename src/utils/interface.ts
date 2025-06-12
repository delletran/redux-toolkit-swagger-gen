import { ResponseStatus } from './constants';

export const getNames = (details: ReduxApiEndpointType): { interfaceName: string, modelName: string, paramName: string } => {
  const responseStatuses = Object.values(ResponseStatus);
  let ref = '';

  // First try to get ref from responses
  for (const status of responseStatuses) {
    // Handle both OpenAPI 2.0 and 3.x response formats
    const response = details.methodObj.responses?.[status];
    if (!response) continue;
    
    // OpenAPI 3.x format uses content.application/json.schema
    const schema = response.schema || 
                   (response.content && response.content['application/json'] && response.content['application/json'].schema);
      if (!schema) continue;
    
    // Use any to handle different schema formats
    ref = (schema as any)?.['$ref'] || 
          (schema as any)?.properties?.results?.items?.$ref || '';
    if (ref) break;
  }

  // If no ref found in responses, try to get from parameters
  if (!ref) {
    // Handle both OpenAPI 2.0 parameters array and OpenAPI 3.x requestBody
    const params = details.methodObj?.parameters || [];
    if (Array.isArray(params)) {
      for (const param of params) {
        ref = param.schema?.$ref || '';
        if (ref) break;
      }
    }
    
    // Check requestBody for OpenAPI 3.x
    if (!ref && details.methodObj?.requestBody?.content) {
      const contentTypes = Object.keys(details.methodObj.requestBody.content);
      for (const contentType of contentTypes) {
        const schema = details.methodObj.requestBody.content[contentType].schema;
        ref = schema?.$ref || '';
        if (ref) break;
      }
    }
  };

  const paramModelName = ref?.split('/').pop();
  const modelName = paramModelName || '';
  const interfaceName = ref ? `I${paramModelName}Serializer` : 'unknown';
  const paramName = ref ? `I${paramModelName}Param` : 'unknown';

  return { interfaceName, modelName, paramName };
};
