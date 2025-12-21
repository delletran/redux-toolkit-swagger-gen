import Mustache from 'mustache';
import { EndpointFactory } from '../utils/end-points';
import { toCamelCase } from '../utils/formater';
import { loadTemplate } from '../utils/template-loader';

const thunkTemplate = loadTemplate('thunkTemplate.mustache');

const getModelDomain = (modelName: string): string => {
  const name = modelName.toLowerCase();
  
  if (/^(user|login|token|refresh|account|password)/.test(name)) return 'auth';
  if (/^(member|membership)/.test(name)) return 'members';
  if (/^(attendance|checkin|checkout)/.test(name)) return 'attendance';
  if (/^(transaction|payment)/.test(name)) return 'transactions';
  if (/^branch/.test(name)) return 'branches';
  if (/^lead/.test(name)) return 'leads';
  if (/^(goal|unit)/.test(name)) return 'goals';
  if (/^(discount|referral)/.test(name)) return 'discounts';
  if (/^expense/.test(name)) return 'expenses';
  if (/^(product|inventory|stock|sale)/.test(name)) return 'products';
  if (/^(role|permission|module|submodule|department)/.test(name)) return 'permissions';
  if (/^notification/.test(name)) return 'notifications';
  if (/^(report|profit|revenue|export)/.test(name)) return 'reports';
  if (/^(analytics|churn|retention|cohort|segment|ltv|engagement|atrisk|renewal|prediction)/.test(name)) return 'analytics';
  if (/^(setting|systemconfiguration|category)/.test(name)) return 'settings';
  if (/^(file|upload)/.test(name)) return 'files';
  if (/^(billing|schedule|upcoming)/.test(name)) return 'billing';
  if (/^(paymentintent|paymentstatus|cardtokenize|refund)/.test(name)) return 'payment-gateway';
  if (/^training/.test(name)) return 'training';
  if (/^dashboard/.test(name)) return 'dashboard';
  if (/^(validation|http|body_|app_schemas_|app__|quick)/.test(name)) return 'common';
  
  return 'common';
};

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
