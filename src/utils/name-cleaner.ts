/**
 * Strip API base path from schema names to create cleaner model/slice names
 * @param schemaName - The original schema name from OpenAPI spec
 * @param apiBasePath - The API base path (e.g., "api/v1") - optional
 * @returns Cleaned schema name without the API path
 */
export const stripApiBasePath = (schemaName: string, apiBasePath?: string): string => {
  if (!apiBasePath) return schemaName;
  
  // Convert api/v1 to api_v1 pattern to match OpenAPI schema naming
  const apiPathPattern = apiBasePath.replace(/\//g, '_');
  
  // Split by _api_v1_ pattern
  const parts = schemaName.split(new RegExp(`_${apiPathPattern}_`, 'i'));
  
  if (parts.length === 2) {
    const prefix = parts[0]; // e.g., "Body_upload_project_photo"
    const suffix = parts[1]; // e.g., "project_photos__post"
    
    // Remove the resource path portion from the suffix (everything before the HTTP method)
    // Common patterns: resource_name_method, resource_name__method
    const suffixParts = suffix.split('_');
    
    // Find the method suffix (get, post, put, patch, delete)
    const methods = ['get', 'post', 'put', 'patch', 'delete'];
    let methodIndex = -1;
    
    for (let i = suffixParts.length - 1; i >= 0; i--) {
      if (methods.includes(suffixParts[i].toLowerCase())) {
        methodIndex = i;
        break;
      }
    }
    
    // If we found a method, remove everything between start and method
    if (methodIndex > 0) {
      // Keep only the method and any trailing parts
      const methodPart = suffixParts.slice(methodIndex).join('_');
      return `${prefix}_${methodPart}`;
    }
    
    // If no method found, just return prefix + suffix
    return `${prefix}_${suffix}`;
  }
  
  return schemaName;
};
