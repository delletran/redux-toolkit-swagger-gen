import Mustache from 'mustache';
import { EndpointFactory } from '../utils/end-points';
import { toCamelCase } from '../utils/formater';
import { loadTemplate } from '../utils/template-loader';

const thunkTemplate = loadTemplate('thunkTemplate.mustache');

export const thunkGenerator = (path: string, methods: Record<string, ReduxApiEndpointType>): string => {
  const endpoints = EndpointFactory.getEndpoints('thunk', path, methods);

  const allTypes = endpoints
    .flatMap(ep => ep.types)
    .filter((type, index, self) => self.indexOf(type) === index);

  const uniqueImports = Array.from(
    new Map(
      endpoints
        .filter(ep => ep.interface && allTypes.some(type => type.includes(ep.interface))) // remove unused imports
        .map(ep => [`${ep.interface}|${ep.modelName}`, { interface: ep.interface, modelName: ep.modelName }])
    ).values()
  );

  return Mustache.render(thunkTemplate, {
    endpoints,
    uniqueImports,
    sliceName: toCamelCase(path),
    slicePath: '"' + `${path}-thunk` + '"',
  });
};
