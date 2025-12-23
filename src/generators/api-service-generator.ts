import Mustache from 'mustache';

import { EndpointFactory } from '../utils/end-points';
import { toCamelCase, toPascalCase } from '../utils/formater';
import { loadTemplate } from '../utils/template-loader';
import { stripApiBasePath as stripPath, cleanSchemaName } from '../utils/name-cleaner';
import { getModelDomain } from '../utils/domain-classifier';

const serviceTemplate = loadTemplate('serviceTemplate.mustache');

export const apiServiceGenerator = (path: string, methods: Record<string, ReduxApiEndpointType>, apiBasePath?: string, useAtAlias?: boolean): string => {
  const rawEndpoints = EndpointFactory.getEndpoints('service', path, methods, undefined, apiBasePath);
  
  // Helper to strip apiBasePath from route for name generation
  const stripApiBasePath = (route: string): string => {
    if (!apiBasePath) return route;
    const basePathPrefix = `/${apiBasePath}/`;
    return route.startsWith(basePathPrefix) ? route.substring(basePathPrefix.length - 1) : route;
  };
  
  // Collect all interfaces that need to be imported
  const importMap = new Map();
  rawEndpoints.forEach(ep => {
    // Add response interface
    if (ep.interface && ep.modelName) {
      const domain = getModelDomain(ep.modelName);
      const importPath = useAtAlias 
        ? `@/api/models/${domain}/${ep.modelName}`
        : `../../models/${domain}/${ep.modelName}`;
      importMap.set(`${ep.interface}|${ep.modelName}`, { 
        interface: ep.interface, 
        modelName: ep.modelName,
        domain: domain,
        importPath: importPath
      });
    }
    // Add request body interface if different from response
    if (ep.requestBodyModelName && ep.requestBodyModelName !== ep.modelName) {
      const requestInterface = `I${ep.requestBodyModelName}Schema`;
      const domain = getModelDomain(ep.requestBodyModelName);
      const importPath = useAtAlias 
        ? `@/api/models/${domain}/${ep.requestBodyModelName}`
        : `../../models/${domain}/${ep.requestBodyModelName}`;
      importMap.set(`${requestInterface}|${ep.requestBodyModelName}`, { 
        interface: requestInterface, 
        modelName: ep.requestBodyModelName,
        domain: domain,
        importPath: importPath
      });
    }
  });
  const uniqueImports = Array.from(importMap.values());
  
  // Generate param interface imports and enhanced endpoint data
  const paramImports = new Map();
  const endpoints = rawEndpoints.map((ep: any) => {
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
    
    // Generate endpoint name from summary if available
    let cleanName = '';
    
    // Try to get summary from methodObj
    const normalizedPath = ep.path.replace(/\$\{([^}]+)\}/g, '{$1}');
    const methodKey = `${normalizedPath}_${ep.httpMethod.toLowerCase()}`;
    const methodObj = methods[methodKey]?.methodObj;
    const summary = methodObj?.summary;
    
    if (summary) {
      // Convert summary to camelCase endpoint name
      // "Get Upcoming Charges" -> "getUpcomingCharges"
      // "Process Billing" -> "processBilling"
      // "Login" -> "login"
      cleanName = toCamelCase(summary.replace(/[^\w\s]/g, ''));
    } else {
      // Fallback to path-based naming
      // Extract meaningful operation names from path segments
      const pathForNaming = stripApiBasePath(ep.path);
      
      // Split path and categorize segments
      const allSegments = pathForNaming.split('/').filter((p: string) => p);
      const pathPattern = /[\$]?\{([^}]+)\}/g;
      
      // Separate path segments into non-param and param segments, preserving order
      const segmentInfo = allSegments.map((segment: string) => {
        const isParam = segment.includes('{') || segment.startsWith('$');
        const paramMatch = segment.match(/[\$]?\{([^}]+)\}/);
        return {
          original: segment,
          isParam,
          paramName: paramMatch ? paramMatch[1] : null,
          value: isParam ? null : segment
        };
      });
      
      const nonParamSegments = segmentInfo.filter(s => !s.isParam).map(s => s.value!);
      const paramNames = segmentInfo.filter(s => s.isParam).map(s => s.paramName!);
      const hasPathParams = paramNames.length > 0;
      
      // Check if it's truly a list endpoint (returns paginated results or has isListEndpoint flag)
      // List endpoints have query params for pagination (limit, page)
      const queryParamsArray = Array.isArray(ep.queryParams) ? ep.queryParams : [];
      const hasListQueryParams = queryParamsArray.some((p: string) => p === 'limit' || p === 'page');
      
        if (ep.isListEndpoint || (ep.isQuery && hasListQueryParams)) {
        // List endpoint: listTransactions, listUsers, etc.
        // Use ALL non-param segments to create unique names
        // e.g., /goals/units/ -> listGoalsUnits, /goals/templates/ -> listGoalsTemplates
        const nameParts = nonParamSegments.map(seg => toPascalCase(seg));
        cleanName = 'list' + nameParts.join('');
      } else if (ep.isQuery && hasPathParams) {
        // GET with path params (no pagination) - these are single resource retrieval
        // Build name from ALL segments, both before and after params
        // e.g., GET /analytics/member/{member_id}/ltv -> getAnalyticsMemberMemberIdLtv
        // e.g., GET /users/{username} -> getUsersUsername
        const nameParts: string[] = [];
        
        segmentInfo.forEach((seg) => {
          if (seg.isParam) {
            // Add param name in PascalCase
            nameParts.push(toPascalCase(seg.paramName!));
          } else {
            // Add segment value in PascalCase
            nameParts.push(toPascalCase(seg.value!));
          }
        });
        
        cleanName = 'get' + nameParts.join('');
        } else if (ep.isMutation) {
        // For mutations, build name from all segments (both before and after params)
        // e.g., POST /check-in -> checkInCheckIn
        // e.g., POST /check-out/{member_id} -> checkOutMemberIdCheckOut
        // e.g., PATCH /users/{username}/change-password -> changePasswordUsernameChangePassword
        const lastNonParamSegment = nonParamSegments[nonParamSegments.length - 1];
        const firstNonParamSegment = nonParamSegments[0];
        
        // Determine mutation type based on HTTP method and path structure
        if (ep.httpMethod.toLowerCase() === 'post' && nonParamSegments.length === 1 && !hasPathParams) {
          // Simple POST to /resource -> insertResource
          cleanName = 'insert' + toCamelCase(firstNonParamSegment).charAt(0).toUpperCase() + toCamelCase(firstNonParamSegment).slice(1);
        } else if (ep.httpMethod.toLowerCase() === 'put' && hasPathParams) {
          // PUT with path params -> typically an update
          // Build from first segment + params + last segment
          const nameParts: string[] = [toPascalCase(firstNonParamSegment)];
          paramNames.forEach(p => nameParts.push(toPascalCase(p)));
          if (nonParamSegments.length > 1) {
            nameParts.push(toPascalCase(lastNonParamSegment));
          }
          cleanName = toCamelCase(nameParts.join(''));
        } else if (ep.httpMethod.toLowerCase() === 'patch') {
          // PATCH -> build full name from all segments
          const nameParts: string[] = [];
          segmentInfo.forEach((seg) => {
            if (seg.isParam) {
              nameParts.push(toPascalCase(seg.paramName!));
            } else {
              nameParts.push(toPascalCase(seg.value!));
            }
          });
          cleanName = toCamelCase(nameParts.join(''));
        } else if (ep.httpMethod.toLowerCase() === 'delete') {
          // DELETE -> deleteResource or more specific name
          const nameParts: string[] = [];
          segmentInfo.forEach((seg) => {
            if (seg.isParam) {
              nameParts.push(toPascalCase(seg.paramName!));
            } else {
              nameParts.push(toPascalCase(seg.value!));
            }
          });
          cleanName = 'delete' + nameParts.join('');
        } else {
          // Default: build name from all segments
          // This handles cases like POST /check-in, POST /quick-check-in, POST /check-out/{member_id}
          const nameParts: string[] = [];
          segmentInfo.forEach((seg) => {
            if (seg.isParam) {
              nameParts.push(toPascalCase(seg.paramName!));
            } else {
              nameParts.push(toPascalCase(seg.value!));
            }
          });
          cleanName = toCamelCase(nameParts.join(''));
        }
        } else {
        // Regular endpoint: use all path segments including those after params
        // For GET requests without path params (like /users/me), use descriptive name
        const nameParts: string[] = [];
        
        segmentInfo.forEach((seg) => {
          if (seg.isParam) {
            nameParts.push(toPascalCase(seg.paramName!));
          } else {
            nameParts.push(toPascalCase(seg.value!));
          }
        });
        
        // For GET queries, prefix with 'get' or 'list'
        if (ep.isQuery && !ep.isListEndpoint) {
          if (nameParts.length > 1 || hasPathParams) {
            // e.g., /users/me -> getUsersMe
            // e.g., /analytics/retention -> getAnalyticsRetention
            cleanName = 'get' + nameParts.join('');
          } else {
            // Single segment without list - treat as list
            cleanName = 'list' + nameParts.join('');
          }
        } else {
          cleanName = toCamelCase(nameParts.join(''));
        }
      }
    }
    
    const methodSuffix = ep.httpMethod.charAt(0).toUpperCase() + ep.httpMethod.slice(1).toLowerCase();
    enhanced.name = cleanName + methodSuffix;
    
    // Generate export name (capitalize first letter for hook generation)
    enhanced.exportName = enhanced.name.charAt(0).toUpperCase() + enhanced.name.slice(1);
    
    // Generate param interface name based on route and method
    const routeParts = ep.path.split('/').filter((p: string) => p && !p.startsWith('$'));
    const pathParamsFromUrl = (ep.path.match(/\$\{([^}]+)\}/g) || []).map((p: string) => p.replace(/\$\{|\}/g, ''));
    
    // Build interface name including path param names and HTTP method
    // e.g., GET /transactions/{branch_id} -> ITransactionsBranchIdGetParams
    // e.g., PATCH /transactions/{transaction_id}/void -> ITransactionsTransactionIdVoidPatchParams
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
      stripApiBasePath(ep.path).split('/').forEach((segment: string) => {
        if (segment && !segment.startsWith('$')) {
          pathSegments.push(segment);
        } else if (segment.startsWith('${')) {
          // Extract param name from ${param}
          const paramName = segment.replace(/\$\{|\}/g, '');
          pathSegments.push(paramName);
        }
      });
      
      // Add HTTP method suffix to distinguish between GET and PATCH/POST/PUT operations
      const httpMethodSuffix = ep.httpMethod.charAt(0).toUpperCase() + ep.httpMethod.slice(1).toLowerCase();
      interfaceName = `I${toPascalCase(pathSegments.join('_'))}${httpMethodSuffix}Params`;
      
      paramImports.set(interfaceName, {
        interface: interfaceName,
        modelName: `${path}.params`
      });
      
      // Add param interface fields
      enhanced.paramInterfaceName = interfaceName;
      enhanced.hasPathParams = pathParamsFromUrl.length > 0;
      enhanced.hasQueryParams = hasQueryParams;
      enhanced.pathParamsList = pathParamsFromUrl.join(', ');
      
      // For mutations: build list of all non-body param names for destructuring
      if (enhanced.isMutation && enhanced.paramInterfaceName) {
        const allParamNames = [...pathParamsFromUrl];
        enhanced.allNonBodyParams = allParamNames.length > 0 ? allParamNames.join(', ') : null;
        
        // Check if mutation has query params (from the endpoint's queryParamsArray)
        // queryParamsArray contains the actual parameter names as an array
        const hasQueryParamsFromEndpoint = Array.isArray(ep.queryParamsArray) && ep.queryParamsArray.length > 0;
        enhanced.hasQueryParamsForMutation = hasQueryParamsFromEndpoint;
      }
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
      // Access the method object using the path+method key
      // Convert path params back from ${param} to {param} format to match methods keys
      const normalizedPath = ep.path.replace(/\$\{([^}]+)\}/g, '{$1}');
      const methodKey = `${normalizedPath}_${ep.httpMethod.toLowerCase()}`;
      const methodObj = methods[methodKey]?.methodObj;
      
      // Check if mutation has a request body with actual schema $ref
      // This matches the logic in params-generator which only adds body property when there's a $ref
      let hasRequestBody = false;
      let requestBodyRef: string | undefined;
      
      if (methodObj?.requestBody?.content) {
        const firstContentType = Object.keys(methodObj.requestBody.content)[0];
        const schema = methodObj.requestBody.content[firstContentType]?.schema;
        
        // Check for direct $ref, anyOf with $ref, or oneOf with $ref
        if (schema?.$ref) {
          hasRequestBody = true;
          requestBodyRef = schema.$ref;
        } else if (schema?.anyOf && Array.isArray(schema.anyOf)) {
          const refItem = schema.anyOf.find((item: any) => item.$ref);
          if (refItem) {
            hasRequestBody = true;
            requestBodyRef = refItem.$ref;
          }
        } else if (schema?.oneOf && Array.isArray(schema.oneOf)) {
          const refItem = schema.oneOf.find((item: any) => item.$ref);
          if (refItem) {
            hasRequestBody = true;
            requestBodyRef = refItem.$ref;
          }
        }
      }
      
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
      // Only set requestBodyType if there's actually a request body with $ref
      if (hasRequestBody && requestBodyRef) {
        // Extract model name from $ref (e.g., "#/components/schemas/app__schemas__billing_automation_schemas__ChargeCardRequest" => "BillingAutomationChargeCardRequest")
        const rawModelName = requestBodyRef.split('/').pop() || '';
        const stripped = stripPath(rawModelName, apiBasePath);
        const cleaned = cleanSchemaName(stripped);
        const cleanedModelName = toPascalCase(cleaned);
        enhanced.requestBodyType = `I${cleanedModelName}Schema`;
      } else if (hasRequestBody && ep.requestBodyModelName) {
        // Fallback to existing logic if we have requestBodyModelName but no ref
        // ep.requestBodyModelName should already be cleaned by getNames function
        enhanced.requestBodyType = `I${ep.requestBodyModelName}Schema`;
      } else if (hasRequestBody && ep.modelName) {
        // Final fallback
        // ep.modelName should already be cleaned by getNames function
        enhanced.requestBodyType = `I${ep.modelName}Schema`;
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
    useAtAlias,
  };

  return Mustache.render(serviceTemplate, modelData);
};
