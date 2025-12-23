import Mustache from 'mustache';
import { loadTemplate } from '../utils/template-loader';
import { toCamelCase, toPascalCase } from '../utils/formater';
import { EndpointFactory } from '../utils/end-points';
import { getModelDomain } from '../utils/domain-classifier';

// Generate short hook name from endpoint name
// E.g., "searchLeadsApiV1LeadsGet" -> "SearchLeadsGet"
function generateShortHookName(name: string, httpMethod: string): string {
  // Remove API path segments (anything that looks like ApiV1...Method pattern)
  let cleanName = name;
  
  // Remove the API version and path parts between operation name and HTTP method
  // Pattern: operationName + ApiV1 + PathSegments + HttpMethod
  // Example: searchLeadsApiV1LeadsGet -> searchLeadsGet
  const methodPattern = new RegExp(`(ApiV\\d+[A-Z][a-zA-Z]+)?(${toPascalCase(httpMethod)})$`);
  cleanName = cleanName.replace(methodPattern, toPascalCase(httpMethod));
  
  // Convert to PascalCase
  return toPascalCase(toCamelCase(cleanName));
}

// Generate short variable name for mutations
// E.g., "assignLeadPost" -> "assignLead"
function generateShortVariableName(name: string): string {
  // Remove method suffix (Get, Post, Put, Delete, Patch)
  return name.replace(/(Get|Post|Put|Delete|Patch)$/, '');
}

// Extract required params from a path for simplified function signature
// E.g., "/api/v1/leads/{lead_id}/notes" -> { signature: "lead_id: string | number", object: "lead_id" }
function extractRequiredParams(path: string, idParamName?: string): { signature: string; object: string } | null {
  const pathParams = path.match(/\{([^}]+)\}/g);
  if (!pathParams || pathParams.length === 0) return null;
  
  // Extract param names
  const params = pathParams.map(p => p.slice(1, -1)); // Remove { }
  
  // If we have the ID param name from the interface, use it
  if (idParamName && params.length === 1) {
    return {
      signature: `${idParamName}: string | number`,
      object: idParamName
    };
  }
  
  // Build signature with all params
  const signature = params.map(p => `${p}: string | number`).join(', ');
  const object = params.join(', ');
  
  return { signature, object };
}

interface HookEndpoint {
  name: string;
  hookName: string;
  isQuery: boolean;
  isMutation: boolean;
  isListEndpoint: boolean;
  paramInterfaceName?: string;
  interface: string;
  summary?: string;
  description?: string;
}

export const customHooksGenerator = (
  servicePath: string,
  methods: any[],
  useAtAlias?: boolean,
  apiBasePath?: string
): string => {
  // Convert methods array to Record for EndpointFactory
  const methodsRecord: Record<string, ReduxApiEndpointType> = {};
  methods.forEach((method: any) => {
    const key = `${method.url}_${method.method.toLowerCase()}`;
    methodsRecord[key] = method;
  });
  
  // Also create a lookup by original URL (with curly braces) for param interface lookup
  const methodsByOriginalPath: Record<string, any> = {};
  methods.forEach((method: any) => {
    const key = `${method.url}_${method.method.toLowerCase()}`;
    methodsByOriginalPath[key] = method;
  });

  // Get processed endpoints from EndpointFactory with apiBasePath
  const endpoints = EndpointFactory.getEndpoints('service', servicePath, methodsRecord, undefined, apiBasePath);
  
  // Skip if no endpoints
  if (!endpoints || endpoints.length === 0) {
    return '';
  }

  // Helper to get summary and description from methodObj
  const getMethodInfo = (endpoint: any) => {
    // Find the original method object
    const key = `${endpoint.path}_${endpoint.httpMethod.toLowerCase()}`;
    const methodObj = methodsRecord[key]?.methodObj;
    return {
      summary: methodObj?.summary,
      description: methodObj?.description,
    };
  };
  
  // Helper to get param interface name from method
  const getParamInterfaceName = (endpoint: any): string | undefined => {
    // First try endpoint.iNameParam
    if (endpoint.iNameParam) {
      return endpoint.iNameParam;
    }
    
    // The endpoint.path has template literals (${id}) while method.url has curly braces ({id})
    // We need to convert endpoint.path back to original format
    const originalPath = endpoint.path.replace(/\$\{([^}]+)\}/g, '{$1}');
    const key = `${originalPath}_${endpoint.httpMethod.toLowerCase()}`;
    const method: any = methodsByOriginalPath[key];
    
    // If method doesn't exist or doesn't have parameters, generate the interface name
    // using the same convention as the params generator
    // Pattern: I{ServicePascal}{PathPascal}{MethodPascal}Params
    if (method) {
      const servicePascal = toPascalCase(servicePath);
      // Extract path parts and convert to PascalCase
      // /api/v1/leads/{lead_id}/notes -> Leads, LeadId, Notes
      const pathSegments = originalPath
        .split('/')
        .filter(Boolean)
        .filter((p: string) => !p.startsWith('api') && !p.match(/^v\d+$/)) // Skip 'api' and version numbers
        .map((p: string) => {
          // Convert {param_name} to ParamName
          if (p.startsWith('{') && p.endsWith('}')) {
            return toPascalCase(p.slice(1, -1));
          }
          return toPascalCase(p);
        });
      
      const pathPascal = pathSegments.join('');
      // HTTP method should be capitalized properly: get -> Get, not GET
      const methodCap = endpoint.httpMethod.charAt(0).toUpperCase() + endpoint.httpMethod.slice(1).toLowerCase();
      const interfaceName = `I${pathPascal}${methodCap}Params`;
      
      return interfaceName;
    }
    
    return undefined;
  };
  
  // Extract resource name from service path (e.g., 'leads' from 'leads' or 'members')
  const resourceName = servicePath.replace(/-/g, '_');
  const resourceNamePascal = toPascalCase(resourceName);
  const resourceNameCamel = toCamelCase(resourceName);
  const resourceNameSingular = resourceName.endsWith('s') 
    ? resourceName.slice(0, -1) 
    : resourceName;
  const resourceNameSingularPascal = toPascalCase(resourceNameSingular);

  // Import path for the service
  const serviceImportPath = useAtAlias 
    ? `@/api/services/${servicePath}/${servicePath}`
    : `@/api/services/${servicePath}/${servicePath}`;

  // Find the list endpoint (usually the main GET endpoint without path params)
  // It could be named with "list", "search", or return a paginated response
  const listEndpoint = endpoints.find(
    ep => ep.isListEndpoint && ep.isQuery
  ) || endpoints.find(
    ep => 
      ep.isQuery && 
      (ep.name.toLowerCase().includes('search') || 
       ep.interface?.includes('PaginatedResponse'))
  ) || endpoints.find(
    ep => 
      ep.isQuery && 
      ep.httpMethod === 'get' &&
      !ep.path.includes('{')  // No path parameters
  );

  // Find the detail endpoint (GET with ID parameter) - usually named getLeadGet, getMemberGet, etc.
  // Pattern: get{Resource}Get where the path has {resource_id}
  const detailEndpoint = endpoints.find(
    ep => 
      ep.isQuery && 
      ep !== listEndpoint && 
      ep.path.includes('{') &&  // Has path parameters
      // Match patterns like getLeadGet, getMemberGet (singular resource name)
      // Pattern: get + PascalCase word + Get
      ep.name.match(/^get[A-Z]\w+Get$/) &&
      // Ensure it's not a nested resource (no additional path segments beyond the ID)
      // The path should end with {id} or {resource_id} without additional segments
      !ep.name.match(/^get[A-Z]\w+[A-Z][a-z]+Get$/) &&
      // The path should match pattern like /resource/{id} not /resource/{id}/subresource
      ep.path.split('/').filter(Boolean).length <= 4  // e.g., /api/v1/leads/{lead_id}
  );

  // Find all mutation endpoints
  const mutations = endpoints.filter(ep => ep.isMutation);

  // Group mutations by type
  const createMutation = mutations.find(ep => 
    ep.name.toLowerCase().includes('create') || 
    (ep.name.toLowerCase().startsWith('post') && !ep.name.toLowerCase().includes('get'))
  );

  const updateMutation = mutations.find(ep => 
    ep.name.toLowerCase().includes('update') || 
    (ep.name.toLowerCase().includes('put') && !ep.name.toLowerCase().includes('output'))
  );

  const deleteMutation = mutations.find(ep => 
    ep.name.toLowerCase().includes('delete') || 
    ep.name.toLowerCase().includes('remove')
  );

  // Other mutations (not CRUD)
  const otherMutations = mutations.filter(ep => 
    ep !== createMutation && 
    ep !== updateMutation && 
    ep !== deleteMutation
  );

  // Find related query endpoints (like notes, activities, statistics)
  const relatedQueries = endpoints.filter(ep => {
    if (!ep.isQuery || ep === listEndpoint || ep === detailEndpoint) {
      return false;
    }
    
    // Include endpoints with parameters (sub-resources)
    // or statistics/overview endpoints
    // Also check if the path has parameters
    const shouldInclude = ep.iNameParam || 
           ep.path.includes('{') ||  // Has path parameters
           ep.name.toLowerCase().includes('statistics') ||
           ep.name.toLowerCase().includes('overview');
    
    return shouldInclude;
  });

  // Collect unique param imports
  const paramImports = new Set<string>();
  const listParamInterface = listEndpoint ? getParamInterfaceName(listEndpoint) : undefined;
  if (listParamInterface) {
    paramImports.add(listParamInterface);
  }
  const detailParamInterface = detailEndpoint ? getParamInterfaceName(detailEndpoint) : undefined;
  if (detailParamInterface) {
    paramImports.add(detailParamInterface);
  }
  relatedQueries.forEach(q => {
    const paramInterface = getParamInterfaceName(q);
    if (paramInterface) paramImports.add(paramInterface);
  });

  // Collect unique model imports with their domains
  const modelImports = new Map<string, { interfaceName: string; modelName: string; domain: string }>();
  const addModelImport = (ep: any) => {
    if (ep.modelName && ep.interface) {
      const domain = getModelDomain(ep.modelName);
      const key = `${ep.interface}|${ep.modelName}`;
      if (!modelImports.has(key)) {
        modelImports.set(key, {
          interfaceName: ep.interface,
          modelName: ep.modelName,
          domain: domain,
        });
      }
    }
  };

  endpoints.forEach(addModelImport);

  // TODO: Collect enum imports from params (needs additional logic to detect enums in param types)
  const enumImports: string[] = [];

  const paramImportsArray = Array.from(paramImports).map(p => ({ interfaceName: p, resourceName }));
  
  console.log(`Service ${servicePath} - paramImportsArray:`, paramImportsArray);

  const data = {
    resourceName,
    resourceNamePascal,
    resourceNameCamel,
    resourceNameSingular,
    resourceNameSingularPascal,
    serviceImportPath,
    paramImports: paramImportsArray,
    modelImports: Array.from(modelImports.values()),
    enumImports: enumImports.map(e => ({ enumName: e })),
    hasListEndpoint: !!listEndpoint,
    listEndpoint: listEndpoint ? {
      name: listEndpoint.name,
      exportName: toPascalCase(listEndpoint.name),  // Use name property converted to PascalCase
      paramInterfaceName: listParamInterface,
      ...getMethodInfo(listEndpoint),
    } : null,
    hasDetailEndpoint: !!detailEndpoint,
    detailEndpoint: detailEndpoint ? {
      name: detailEndpoint.name,
      exportName: toPascalCase(detailEndpoint.name),  // Use name property converted to PascalCase
      paramInterfaceName: detailParamInterface,
      ...getMethodInfo(detailEndpoint),
      // Extract the ID parameter name (e.g., 'lead_id', 'member_id')
      idParamName: extractIdParamName(detailParamInterface, detailEndpoint.path),
      idParamCamel: toCamelCase(extractIdParamName(detailParamInterface, detailEndpoint.path)),
    } : null,
    hasCreateMutation: !!createMutation,
    createMutation: createMutation ? {
      name: createMutation.name,
      exportName: toPascalCase(createMutation.name),  // Use name property converted to PascalCase
      shortHookName: generateShortHookName(createMutation.name, createMutation.httpMethod),
      ...getMethodInfo(createMutation),
    } : null,
    hasUpdateMutation: !!updateMutation,
    updateMutation: updateMutation ? {
      name: updateMutation.name,
      exportName: toPascalCase(updateMutation.name),  // Use name property converted to PascalCase
      shortHookName: generateShortHookName(updateMutation.name, updateMutation.httpMethod),
      ...getMethodInfo(updateMutation),
    } : null,
    hasDeleteMutation: !!deleteMutation,
    deleteMutation: deleteMutation ? {
      name: deleteMutation.name,
      exportName: toPascalCase(deleteMutation.name),  // Use name property converted to PascalCase
      shortHookName: generateShortHookName(deleteMutation.name, deleteMutation.httpMethod),
      ...getMethodInfo(deleteMutation),
    } : null,
    otherMutations: otherMutations.map(m => ({
      name: m.name,
      exportName: toPascalCase(m.name),  // Use name property converted to PascalCase
      shortHookName: generateShortHookName(m.name, m.httpMethod),
      shortVariableName: generateShortVariableName(m.name),
      hookName: `use${toPascalCase(m.name)}`,
      resourceName: resourceName,  // Add resource name for template
      ...getMethodInfo(m),
    })),
    hasOtherMutations: otherMutations.length > 0,
    relatedQueries: relatedQueries.map(q => {
      const relatedMutation = mutations.find(m => 
        m.path === q.path && m.httpMethod === 'post'
      );
      
      // Determine return data name based on endpoint name
      let returnDataName = 'data';
      if (q.name.toLowerCase().includes('note')) returnDataName = 'notes';
      else if (q.name.toLowerCase().includes('activit')) returnDataName = 'activities';
      else if (q.name.toLowerCase().includes('transaction')) returnDataName = 'transactions';
      else if (q.name.toLowerCase().includes('payment')) returnDataName = 'payments';
      else if (q.name.toLowerCase().includes('statistic') || q.name.toLowerCase().includes('overview')) returnDataName = 'stats';
      else if (q.name.toLowerCase().includes('plan')) returnDataName = 'plans';
      
      // Get the param interface name
      const paramInterfaceName = getParamInterfaceName(q);
      
      // Check if the endpoint has an ID parameter (by checking if the interface has an Id field)
      const idParamName = extractIdParamName(paramInterfaceName, q.path);
      const hasIdParam = paramInterfaceName && paramInterfaceName.includes('Id');
      
      // Extract required params for simplified signature
      const requiredParamsInfo = extractRequiredParams(q.path, idParamName);
      
      // Convert param names to camelCase for function signature
      const idParamCamel = idParamName ? toCamelCase(idParamName) : '';
      const requiredParamsCamel = requiredParamsInfo ? {
        signature: requiredParamsInfo.signature.replace(new RegExp(idParamName, 'g'), idParamCamel).replace(/string \| number/g, 'string'),
        object: requiredParamsInfo.object.replace(new RegExp(idParamName, 'g'), idParamCamel),
        objectWithConversion: idParamName && idParamCamel !== idParamName ? `${idParamName}: ${idParamCamel}` : requiredParamsInfo.object
      } : null;
      
      const result = {
        name: q.name,
        exportName: toPascalCase(q.name),
        hookName: generateRelatedHookName(q.name, resourceNameSingular),
        paramInterfaceName: paramInterfaceName,
        idParamName: idParamName,
        idParamCamel: idParamCamel,
        hasIdParam: hasIdParam,
        hasRequiredParams: !!requiredParamsCamel,
        requiredParamsSignature: requiredParamsCamel?.signature || '',
        requiredParamsObject: requiredParamsCamel?.objectWithConversion || '',
        resourceName: resourceName,
        returnDataName: returnDataName,
        hasMutation: !!relatedMutation,
        mutationExportName: relatedMutation ? toPascalCase(relatedMutation.name) : '',
        mutationVariableName: relatedMutation ? generateShortVariableName(relatedMutation.name) : '',
        ...getMethodInfo(q),
      };
      
      if (q.name === 'getLeadNotesGet') {
        console.log('Related query result for getLeadNotesGet:', JSON.stringify(result, null, 2));
      }
      
      return result;
    }),
    hasRelatedQueries: relatedQueries.length > 0,
  };
  
  // Debug final data for leads service
  if (servicePath === 'leads') {
    console.log('=== FINAL DATA FOR MUSTACHE (leads) ===');
    console.log('hasDetailEndpoint:', data.hasDetailEndpoint);
    console.log('detailEndpoint:', data.detailEndpoint);
    console.log('paramImports length:', data.paramImports.length);
    console.log('First paramImport:', data.paramImports[0]);
    console.log('relatedQueries[0].paramInterfaceName:', data.relatedQueries[0]?.paramInterfaceName);
    console.log('relatedQueries[0].hasRequiredParams:', data.relatedQueries[0]?.hasRequiredParams);
    console.log('relatedQueries[0].requiredParamsSignature:', data.relatedQueries[0]?.requiredParamsSignature);
  }

  const rendered = Mustache.render(loadTemplate('customHooksTemplate.mustache'), data);
  
  return rendered;
};

// Extract ID parameter name from interface name or path
// E.g., ILeadsLeadIdGetParams -> lead_id or /api/v1/leads/{lead_id} -> lead_id
function extractIdParamName(interfaceName?: string, path?: string): string {
  // First try to extract from interface name
  if (interfaceName) {
    // Try to extract the ID param from the interface name
    // Pattern: I{Resource}{IdParam}{Method}Params
    const match = interfaceName.match(/I\w+?([A-Z][a-z]+Id)/);
    if (match) {
      // Convert from PascalCase to snake_case
      return match[1]
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    }
  }
  
  // If interface name doesn't have ID, try to extract from path
  if (path) {
    // Extract parameter from path like /api/v1/leads/{lead_id}
    const pathMatch = path.match(/\{([^}]+)\}/);
    if (pathMatch) {
      return pathMatch[1];
    }
  }
  
  return 'id';
}

// Generate a meaningful hook name for related queries
// E.g., getLeadNotesGet -> useLeadNotes
function generateRelatedHookName(endpointName: string, resourceSingular: string): string {
  // Remove common suffixes first
  let cleanName = endpointName
    .replace(/Get$/, '')
    .replace(/Post$/, '')
    .replace(/Put$/, '')
    .replace(/Delete$/, '')
    .replace(/Patch$/, '');
  
  // Remove 'get' prefix if present (getLeadNotes -> LeadNotes)
  if (cleanName.startsWith('get')) {
    cleanName = cleanName.substring(3);
  }
  
  // Convert to PascalCase then add 'use' prefix
  const pascalName = toPascalCase(cleanName);
  return 'use' + pascalName;
}
