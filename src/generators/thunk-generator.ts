import Mustache from 'mustache';
import { EndpointFactory } from '../utils/end-points';
import { toCamelCase } from '../utils/formater';
import { loadTemplate } from '../utils/template-loader';

const thunkTemplate = loadTemplate('thunkTemplate.mustache');

export const thunkGenerator = (path: string, methods: Record<string, ReduxApiEndpointType>): string => {
  const endpoints = EndpointFactory.getEndpoints('thunk', path, methods);

  // Extract unique imports for interfaces
  const uniqueImports = Array.from(
    new Map(
      endpoints
        .filter(ep => ep.interface && ep.modelName) // Only include endpoints with both interface and modelName
        .map(ep => [`${ep.interface}|${ep.modelName}`, { interface: ep.interface, modelName: ep.modelName }])
    ).values()
  );

  const modelData = {
    sliceName: toCamelCase(path),
    slicePath: `${path}-thunk`,
    uniqueImports,
    endpoints,
  };

  return Mustache.render(thunkTemplate, modelData);
};
