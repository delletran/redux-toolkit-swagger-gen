import Mustache from 'mustache';

import { EndpointFactory } from '../utils/end-points';
import { toCamelCase, toPascalCase } from '../utils/formater';
import { loadTemplate } from '../utils/template-loader';

const serviceTemplate = loadTemplate('serviceTemplate.mustache');

export const apiServiceGenerator = (path: string, methods: Record<string, ReduxApiEndpointType>, apiBasePath?: string): string => {
  const rawEndpoints = EndpointFactory.getEndpoints('service', path, methods);
  
  // Collect all interfaces that need to be imported
  const importMap = new Map();
  rawEndpoints.forEach(ep => {
    // Add response interface
    if (ep.interface && ep.modelName) {
      importMap.set(`${ep.interface}|${ep.modelName}`, { interface: ep.interface, modelName: ep.modelName });
    }
    // Add request body interface if different from response
    if (ep.requestBodyModelName && ep.requestBodyModelName !== ep.modelName) {
      const requestInterface = `I${ep.requestBodyModelName}Serializer`;
      importMap.set(`${requestInterface}|${ep.requestBodyModelName}`, { 
        interface: requestInterface, 
        modelName: ep.requestBodyModelName 
      });
    }
  });
  const uniqueImports = Array.from(importMap.values());
  
  // Generate param interface imports and enhanced endpoint data
  const paramImports = new Map();
  const endpoints = rawEndpoints.map((ep: any) => {
    if (ep.path.includes('/users') && ep.httpMethod === 'get') {
      console.log(`USER PATH: ${ep.path}, httpMethod=${ep.httpMethod}, queryParams=${ep.queryParams}, params=${ep.params}`);
    }
    
    // Create a new object with all original properties plus our additions
    const enhanced: any = {
      method: ep.method,
      path: ep.path,
      httpMethod: ep.httpMethod,
      tag: ep.tag,
      interface: ep.interface,
      modelName: ep.modelName,
      isMutation: ep.isMutation,
      isQuery: ep.isQuery,
      isListEndpoint: ep.isListEndpoint,
      params: ep.params,
      queryParams: ep.queryParams,
      body: ep.body,
      bodyParam: ep.bodyParam,
      types: ep.types,
      contentType: ep.contentType,
      requestBodyType: ep.requestBodyType,
      requestBodyModelName: ep.requestBodyModelName,
      isRequestBodyArray: ep.isRequestBodyArray,
      isResponseArray: ep.isResponseArray,
    };
    
    // Generate clean endpoint name
    // Extract meaningful operation names from path segments
    let cleanName = '';
    const pathSegments = ep.path.split('/').filter((p: string) => p && !p.includes('{') && !p.startsWith('$'));
    
    // Check for path params more reliably
    const pathPattern = /[\$]?\{([^}]+)\}/g;
    const paramMatches = ep.path.match(pathPattern);
    const hasPathParams = paramMatches && paramMatches.length > 0;
    
    // Check if it's truly a list endpoint (returns paginated results or has isListEndpoint flag)
    // List endpoints have query params for pagination (limit, page)
    const queryParamsArray = Array.isArray(ep.queryParams) ? ep.queryParams : [];
    const hasListQueryParams = queryParamsArray.some((p: string) => p === 'limit' || p === 'page');
    
    if (ep.isListEndpoint || (ep.isQuery && hasListQueryParams)) {
      // List endpoint: listTransactions, listUsers, etc.
      // Check pagination first because it's more specific - even if it has path params
      const mainResource = pathSegments[0];
      cleanName = 'list' + toCamelCase(mainResource).charAt(0).toUpperCase() + toCamelCase(mainResource).slice(1);
    } else if (ep.isQuery && hasPathParams) {
      // GET with path params (no pagination) - these are single resource retrieval
      // e.g., GET /users/{username} -> getUserUsername
      const mainResource = pathSegments[0];
      const paramNames: string[] = [];
      let match;
      pathPattern.lastIndex = 0; // Reset regex
      while ((match = pathPattern.exec(ep.path)) !== null) {
        paramNames.push(match[1]);
      }
      const paramPart = paramNames.map((p: string) => toPascalCase(p).charAt(0).toUpperCase() + toPascalCase(p).slice(1)).join('');
      const resourcePart = toPascalCase(mainResource).charAt(0).toUpperCase() + toPascalCase(mainResource).slice(1);
      cleanName = 'get' + resourcePart + paramPart;
    } else if (ep.isMutation) {
      // For mutations, look for action verbs in the path
      const lastSegment = pathSegments[pathSegments.length - 1];
      const firstSegment = pathSegments[0];
      
      // Check if last segment is an action (like 'void', 'calculate', 'change-password')
      if (pathSegments.length > 1 && lastSegment && !lastSegment.match(/^\d/)) {
        // Pattern: /resource/{id}/action -> actionParamNameAction
        // e.g., /transactions/{transaction_id}/void -> voidTransactionIdVoid
        // /transactions/{branch_id}/calculate -> calculateBranchIdCalculate
        // /users/{username}/change-password -> changePasswordUsernameChangePassword
        const action = toCamelCase(lastSegment);
        
        // Extract just the path param names (not the segments)
        const pathPattern = /\{([^}]+)\}/g;
        const paramNames: string[] = [];
        let match;
        while ((match = pathPattern.exec(ep.path)) !== null) {
          paramNames.push(match[1]);
        }
        
        // Format: action + PathParamName + Action
        // e.g., void + TransactionId + Void
        const paramPart = paramNames.map(p => toPascalCase(p)).join('');
        cleanName = action + paramPart + action.charAt(0).toUpperCase() + action.slice(1);
      } else if (ep.httpMethod.toLowerCase() === 'post' && pathSegments.length === 1) {
        // POST to /resource -> insertResource
        cleanName = 'insert' + toCamelCase(firstSegment).charAt(0).toUpperCase() + toCamelCase(firstSegment).slice(1);
      } else if (ep.httpMethod.toLowerCase() === 'patch') {
        // PATCH -> updateResource
        cleanName = 'update' + toCamelCase(firstSegment).charAt(0).toUpperCase() + toCamelCase(firstSegment).slice(1);
      } else if (ep.httpMethod.toLowerCase() === 'delete') {
        // DELETE -> deleteResource
        cleanName = 'delete' + toCamelCase(firstSegment).charAt(0).toUpperCase() + toCamelCase(firstSegment).slice(1);
      } else {
        // Fallback: use all path segments
        cleanName = toCamelCase(pathSegments.join('_'));
      }
    } else {
      // Regular endpoint: use path segments without params
      // For GET requests without path params (like /users/me), use descriptive name
      const pathWithoutParams = ep.path
        .replace(/\$\{[^}]+\}/g, '') // Remove ${param}
        .replace(/\/+/g, '/') // Remove double slashes
        .replace(/^\//, '') // Remove leading slash
        .replace(/\/$/, ''); // Remove trailing slash
      
      // For GET queries, prefix with 'get' or 'list'
      if (ep.isQuery && !ep.isListEndpoint) {
        const segments = pathWithoutParams.split('/').filter((s: string) => s);
        if (segments.length > 1) {
          // e.g., /users/me -> getUsersMe
          cleanName = 'get' + segments.map((s: string) => toCamelCase(s).charAt(0).toUpperCase() + toCamelCase(s).slice(1)).join('');
        } else {
          // Single segment without list - treat as list
          cleanName = 'list' + toCamelCase(segments[0]).charAt(0).toUpperCase() + toCamelCase(segments[0]).slice(1);
        }
      } else {
        cleanName = toCamelCase(pathWithoutParams.replace(/\//g, '_'));
      }
    }
    
    const methodSuffix = ep.httpMethod.charAt(0).toUpperCase() + ep.httpMethod.slice(1).toLowerCase();
    enhanced.name = cleanName + methodSuffix;
    
    // Generate export name (capitalize first letter for hook generation)
    enhanced.exportName = enhanced.name.charAt(0).toUpperCase() + enhanced.name.slice(1);
    
    // Generate param interface name based on route and method
    const routeParts = ep.path.split('/').filter((p: string) => p && !p.startsWith('$'));
    const pathParamsFromUrl = (ep.path.match(/\$\{([^}]+)\}/g) || []).map((p: string) => p.replace(/\$\{|\}/g, ''));
    
    // Build interface name including path param names
    // e.g., /transactions/{branch_id} -> ITransactionsBranchIdParams
    // e.g., /transactions/{transaction_id}/void -> ITransactionsTransactionIdVoidParams
    let interfaceName = '';
    // Check both queryParams and params fields as they might be used differently for list vs non-list endpoints
    const hasQueryParams = (ep.queryParams != null && ep.queryParams !== '') || 
                          (ep.params != null && ep.params !== '');
    
    // Only generate param interface if there are actual parameters (path or query)
    // Don't create empty param interfaces - let template use void instead
    // Always generate for list endpoints with params, or any endpoint with path params or query params
    if (pathParamsFromUrl.length > 0 || hasQueryParams || (ep.isListEndpoint && ep.params)) {
      // Include path param names in interface name
      const pathSegments: string[] = [];
      ep.path.split('/').forEach((segment: string) => {
        if (segment && !segment.startsWith('$')) {
          pathSegments.push(segment);
        } else if (segment.startsWith('${')) {
          // Extract param name from ${param}
          const paramName = segment.replace(/\$\{|\}/g, '');
          pathSegments.push(paramName);
        }
      });
      interfaceName = `I${toPascalCase(pathSegments.join('_'))}Params`;
      
      paramImports.set(interfaceName, {
        interface: interfaceName,
        modelName: `${path}.params`
      });
      
      // Add param interface fields
      enhanced.paramInterfaceName = interfaceName;
      enhanced.hasPathParams = pathParamsFromUrl.length > 0;
      enhanced.pathParamsList = pathParamsFromUrl.join(', ');
    } else {
      // No parameters - don't set paramInterfaceName so template uses void
      enhanced.paramInterfaceName = null;
      enhanced.hasPathParams = false;
      enhanced.pathParamsList = '';
      // For queries with no params, explicitly set types to void
      if (ep.isQuery && !ep.requestBodyType) {
        enhanced.types = 'void';
      }
    }
    
    // Patch endpoint for mutations
    if (enhanced.isMutation) {
      const methodKey = Object.keys(methods).find(k => k.includes(ep.path));
      const methodObj = methodKey ? methods[methodKey]?.methodObj : null;
      
      // Check if mutation has a request body (based on whether requestBodyModelName exists)
      const hasRequestBody = !!ep.requestBodyModelName || !!ep.modelName;
      
      // Determine content type from OpenAPI spec
      if (methodObj?.requestBody?.content) {
        const contentTypes = Object.keys(methodObj.requestBody.content);
        if (contentTypes.includes('application/x-www-form-urlencoded')) {
          enhanced.contentType = 'application/x-www-form-urlencoded';
        } else if (contentTypes.includes('application/json')) {
          enhanced.contentType = 'application/json';
        } else if (contentTypes.length > 0) {
          enhanced.contentType = contentTypes[0];
        } else {
          enhanced.contentType = 'application/json';
        }
      } else {
        enhanced.contentType = ep.path.includes('/token') ? 
          'application/x-www-form-urlencoded' : 
          'application/json';
      }
      
      enhanced.contentType = enhanced.contentType.replace(/&/g, '&amp;').replace(/\//g, '/');
      
      // Set correct request body type
      // For mutations with path params, use param interface instead of body type
      if (pathParamsFromUrl.length > 0 && interfaceName) {
        enhanced.requestBodyType = interfaceName;
        enhanced.useBodyDestructuring = true;
        // If no request body, only path params go in body object
        enhanced.bodyParam = !hasRequestBody ? pathParamsFromUrl.join(', ') : null;
      } else if (ep.requestBodyModelName) {
        enhanced.requestBodyType = `I${ep.requestBodyModelName}Serializer`;
      } else if (ep.modelName) {
        enhanced.requestBodyType = `I${ep.modelName}Serializer`;
      }
      
      // For mutations with path params, set body destructuring flag
      if (pathParamsFromUrl.length > 0) {
        enhanced.useBodyDestructuring = true;
      }
    }
    
    return enhanced;
  });

  // Combine and deduplicate all imports
  const allImports = new Map();
  
  uniqueImports.forEach(imp => {
    allImports.set(`${imp.interface}|${imp.modelName}`, imp);
  });

  const modelData = {
    sliceName: path.replace(/-/g, '_'),
    slicePath: `"${path}-api"`,
    uniqueImports: Array.from(allImports.values()),
    uniqueParamImports: Array.from(paramImports.values()),
    endpoints,
    apiBasePath,
  };

  return Mustache.render(serviceTemplate, modelData);
};
