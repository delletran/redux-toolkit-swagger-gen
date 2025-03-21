import { ResponseStatus } from './constants';

export const getNames = (details: ReduxApiEndpointType): { interfaceName: string, modelName: string, paramName: string } => {
  const responseStatuses = Object.values(ResponseStatus);
  let ref = '';

  for (const status of responseStatuses) {
    let schema = details.methodObj.responses?.[status]?.schema as ResponseSchemaType;
    ref = (schema as any)?.['$ref'] || schema?.properties?.results?.items?.$ref || '';
    if (ref) break;
  }

  if (!ref) {
    const params = details.methodObj?.parameters
    for (const param of params) {
      ref = param.schema?.$ref && (ref = param.schema.$ref)
      if (ref) break;
    }
  };

  const paramModelName = ref?.split('/').pop();
  const modelName = paramModelName || '';
  const interfaceName = ref ? `I${paramModelName}Serializer` : 'unknown';
  const paramName = ref ? `I${paramModelName}Param` : 'unknown';

  return { interfaceName, modelName, paramName };
};
