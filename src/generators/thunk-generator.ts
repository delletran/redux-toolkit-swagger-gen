import Mustache from 'mustache';
import { EndpointFactory } from '../utils/end-points';
import { toCamelCase } from '../utils/formater';
import { loadTemplate } from '../utils/template-loader';
import { getModelDomain } from '../utils/domain-classifier';

const thunkTemplate = loadTemplate('thunkTemplate.mustache');

export const thunkGenerator = (path: string, methods: Record<string, ReduxApiEndpointType>, apiBasePath?: string, useAtAlias?: boolean): string => {
  const endpoints = EndpointFactory.getEndpoints('thunk', path, methods, undefined, apiBasePath);

  // Extract unique imports for interfaces with domain paths
  const uniqueImports = Array.from(
    new Map(
      endpoints
        .filter(ep => ep.interface && ep.modelName) // Only include endpoints with both interface and modelName
        .map(ep => {
          const domain = getModelDomain(ep.modelName);
          const modelPath = `${domain}/${ep.modelName}`;
          return [`${ep.interface}|${modelPath}`, { interface: ep.interface, modelName: modelPath }];
        })
    ).values()
  );

  // Extract unique param imports
  const uniqueParamImports = Array.from(
    new Set(
      endpoints
        .filter(ep => ep.paramInterface) // Only include endpoints with param interfaces
        .map(ep => ep.paramInterface)
    )
  ).map(paramInterface => ({ paramInterface }));

  const modelData = {
    sliceName: toCamelCase(path),
    slicePath: `${path}-thunk`,
    paramPath: path, // Original path for param imports
    uniqueImports,
    uniqueParamImports,
    endpoints,
    useAtAlias,
  };

  return Mustache.render(thunkTemplate, modelData);
};
