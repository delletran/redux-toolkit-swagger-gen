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

/**
 * Clean schema name by removing common patterns while preserving domain context
 * to avoid name collisions. Returns the cleaned name but preserves underscores/hyphens
 * for later PascalCase conversion:
 * - app__schemas__billing_automation_schemas__ChargeCardRequest -> Billing_Automation_ChargeCardRequest
 * - app__schemas__payment_gateway_schemas__ChargeCardRequest -> Payment_Gateway_ChargeCardRequest  
 * - PaginatedResponse_ModelName_ -> PaginatedResponse_ModelName
 * @param schemaName - The schema name to clean
 * @returns Cleaned schema name with domain prefix and preserved separators
 */
export const cleanSchemaName = (schemaName: string): string => {
  // Pattern 1: app__schemas__{domain}_schemas__ModelName -> {Domain}_ModelName
  const pattern1 = /^app__schemas__([a-z_]+)_schemas__(.+)$/i;
  const match1 = schemaName.match(pattern1);
  if (match1) {
    const domain = match1[1];
    const modelName = match1[2];
    // Keep domain and model name with underscore separator for PascalCase conversion
    return `${domain}_${modelName}`;
  }
  
  // Pattern 2: App_schemas_{domain}Schemas_ModelName -> {Domain}_ModelName
  const pattern2 = /^App_schemas_([a-z]+)Schemas_(.+)$/i;
  const match2 = schemaName.match(pattern2);
  if (match2) {
    const domain = match2[1];
    const modelName = match2[2];
    // Keep domain and model name with underscore separator
    return `${domain}_${modelName}`;
  }
  
  // Pattern 3: Remove trailing underscores (e.g., PaginatedResponse_ModelName_ -> PaginatedResponse_ModelName)
  return schemaName.replace(/_+$/, '');
};
