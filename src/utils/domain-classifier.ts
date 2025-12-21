/**
 * Domain classification based on OpenAPI tags
 * Extracts domains directly from operation tags in the OpenAPI spec
 * Falls back to schema name pattern matching when tags aren't available
 */

import { toPascalCase } from './formater';
import { stripApiBasePath, cleanSchemaName } from './name-cleaner';

/**
 * Cache for model-to-domain mappings
 * Stores both original schema names and cleaned versions
 */
let modelDomainCache: Map<string, string> | null = null;

/**
 * Extract wrapped type from a wrapper schema structure
 * Detects wrapper types by their schema properties, not by naming patterns
 */
function extractWrappedTypeRef(schema: any): string | null {
  // Check for paginated response pattern: { results: { items: { $ref } }, total, page }
  if (schema?.properties?.results?.items?.$ref) {
    return schema.properties.results.items.$ref;
  }
  
  // Check for array wrapper pattern: { items: { $ref } }
  if (schema?.items?.$ref && !schema?.properties) {
    return schema.items.$ref;
  }
  
  // Check for list response pattern: { data: { items: { $ref } } }
  if (schema?.properties?.data?.items?.$ref) {
    return schema.properties.data.items.$ref;
  }
  
  return null;
}

/**
 * Normalize a tag string to a valid directory name
 * Examples:
 *   "Billing Automation" -> "billing-automation"
 *   "Member Analytics" -> "member-analytics"
 *   "files" -> "files"
 */
export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
    .replace(/-+/g, '-');           // Collapse multiple hyphens
}

/**
 * Extract domain from schema name patterns
 * Handles schemas like:
 *   - app__schemas__billing_automation_schemas__ChargeCardRequest -> billing-automation
 *   - App_schemas_paymentGatewaySchemas_PaymentResponse -> payment-gateway
 */
function extractDomainFromSchemaName(schemaName: string): string | null {
  // Pattern 1: app__schemas__{domain}_schemas__ModelName
  const pattern1 = /^app__schemas__([a-z_]+)_schemas__/i;
  const match1 = schemaName.match(pattern1);
  if (match1) {
    return normalizeTag(match1[1].replace(/_/g, ' '));
  }
  
  // Pattern 2: App_schemas_{domain}Schemas_ModelName
  const pattern2 = /^App_schemas_([a-z]+)Schemas_/i;
  const match2 = schemaName.match(pattern2);
  if (match2) {
    // Convert camelCase to kebab-case
    return normalizeTag(match2[1].replace(/([A-Z])/g, ' $1').trim());
  }
  
  return null;
}

/**
 * Check if a schema reference is used in an operation
 */
function isSchemaUsedInOperation(operation: any, schemaName: string): boolean {
  if (!operation) return false;
  
  const schemaRef = `#/components/schemas/${schemaName}`;
  const definitionRef = `#/definitions/${schemaName}`;
  
  // Check request body
  if (operation.requestBody?.content) {
    for (const content of Object.values(operation.requestBody.content)) {
      const schema = (content as any).schema;
      if (schema?.$ref === schemaRef || schema?.$ref === definitionRef) {
        return true;
      }
      // Check for arrays
      if (schema?.items?.$ref === schemaRef || schema?.items?.$ref === definitionRef) {
        return true;
      }
      // Check for anyOf/oneOf/allOf
      if (schema?.anyOf) {
        for (const option of schema.anyOf) {
          if (option?.$ref === schemaRef || option?.$ref === definitionRef) {
            return true;
          }
        }
      }
      if (schema?.oneOf) {
        for (const option of schema.oneOf) {
          if (option?.$ref === schemaRef || option?.$ref === definitionRef) {
            return true;
          }
        }
      }
      if (schema?.allOf) {
        for (const option of schema.allOf) {
          if (option?.$ref === schemaRef || option?.$ref === definitionRef) {
            return true;
          }
        }
      }
    }
  }
  
  // Check responses
  if (operation.responses) {
    for (const response of Object.values(operation.responses)) {
      const responseContent = (response as any).content;
      if (responseContent) {
        for (const content of Object.values(responseContent)) {
          const schema = (content as any).schema;
          if (schema?.$ref === schemaRef || schema?.$ref === definitionRef) {
            return true;
          }
          // Check for arrays
          if (schema?.items?.$ref === schemaRef || schema?.items?.$ref === definitionRef) {
            return true;
          }
          // Check for anyOf/oneOf/allOf
          if (schema?.anyOf) {
            for (const option of schema.anyOf) {
              if (option?.$ref === schemaRef || option?.$ref === definitionRef) {
                return true;
              }
            }
          }
          if (schema?.oneOf) {
            for (const option of schema.oneOf) {
              if (option?.$ref === schemaRef || option?.$ref === definitionRef) {
                return true;
              }
            }
          }
          if (schema?.allOf) {
            for (const option of schema.allOf) {
              if (option?.$ref === schemaRef || option?.$ref === definitionRef) {
                return true;
              }
            }
          }
        }
      }
    }
  }
  
  // Check parameters
  if (operation.parameters) {
    for (const param of operation.parameters) {
      if (param.schema?.$ref === schemaRef || param.schema?.$ref === definitionRef) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Build domain mappings from OpenAPI spec
 * Uses ONLY tags from operations - no fallback to "common"
 */
export function buildDomainMappings(openApiSpec: any, apiBasePath?: string): void {
  modelDomainCache = new Map();
  
  const paths = openApiSpec.paths || {};
  const schemas = openApiSpec.components?.schemas || openApiSpec.definitions || {};
  
  console.log('Building domain mappings from OpenAPI tags...');
  
  const wrapperSchemas: Array<{ name: string; wrappedTypeRef: string }> = [];
  
  // FIRST PASS: Process all non-wrapper schemas
  for (const [schemaName, schemaObj] of Object.entries(schemas)) {
    // Check if this is a wrapper type by analyzing its structure
    const wrappedTypeRef = extractWrappedTypeRef(schemaObj);
    if (wrappedTypeRef) {
      wrapperSchemas.push({ name: schemaName, wrappedTypeRef });
      continue;
    }
    
    let foundDomain: string | null = null;
    
    // First, try to extract domain from schema name pattern
    foundDomain = extractDomainFromSchemaName(schemaName);
    
    // If no pattern match, search through operations for tags
    if (!foundDomain) {
      for (const [pathUrl, pathItem] of Object.entries(paths)) {
        for (const [method, operation] of Object.entries(pathItem as any)) {
          if (typeof operation !== 'object' || !operation) continue;
          
          // Check if this operation uses the schema
          if (isSchemaUsedInOperation(operation, schemaName)) {
            const tags = (operation as any).tags || [];
            if (tags.length > 0) {
              // Use the first tag as the primary domain
              foundDomain = normalizeTag(tags[0]);
              break;
            }
          }
        }
        
        if (foundDomain) break;
      }
    }
    
    // If still no domain found, use 'uncategorized' (will be resolved in third pass if possible)
    if (!foundDomain) {
      foundDomain = 'uncategorized';
    }
    
    // Store with original name
    modelDomainCache.set(schemaName, foundDomain);
    
    // Also store with cleaned name (for service/thunk generators)
    const stripped = stripApiBasePath(schemaName, apiBasePath);
    const cleaned = cleanSchemaName(stripped);
    const cleanName = toPascalCase(cleaned);
    if (cleanName !== schemaName) {
      modelDomainCache.set(cleanName, foundDomain);
    }
  }
  
  // SECOND PASS: Process wrapper schemas and inherit from wrapped types
  for (const { name: schemaName, wrappedTypeRef } of wrapperSchemas) {
    let foundDomain: string | null = null;
    
    // FIRST: Check if wrapper itself is used in operations
    for (const [pathUrl, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (typeof operation !== 'object' || !operation) continue;
        
        if (isSchemaUsedInOperation(operation, schemaName)) {
          const tags = (operation as any).tags || [];
          if (tags.length > 0) {
            foundDomain = normalizeTag(tags[0]);
            console.log(`✓ Wrapper "${schemaName}" found in tagged operation "${tags[0]}"`);
            break;
          }
        }
      }
      
      if (foundDomain) break;
    }
    
    // SECOND: If not found in operations, try to inherit from wrapped type
    if (!foundDomain) {
      // Extract the wrapped type name from the $ref
      const wrappedTypeName = wrappedTypeRef.split('/').pop() || '';
      
      if (wrappedTypeName) {
        // Look for the wrapped type's domain in the cache (from first pass)
        foundDomain = modelDomainCache.get(wrappedTypeName) as string | null;
        
        if (foundDomain && foundDomain !== 'uncategorized') {
          console.log(`✓ Wrapper "${schemaName}" inheriting domain "${foundDomain}" from wrapped type "${wrappedTypeName}"`);
        }
        
        // If exact match not found, try partial match
        if (!foundDomain || foundDomain === 'uncategorized') {
          for (const [otherSchemaName, domain] of modelDomainCache.entries()) {
            if (domain !== 'uncategorized' && otherSchemaName.endsWith(wrappedTypeName)) {
              foundDomain = domain as string;
              console.log(`✓ Wrapper "${schemaName}" inheriting domain "${foundDomain}" from "${otherSchemaName}" (partial match)`);
              break;
            }
          }
        }
        
        if (!foundDomain || foundDomain === 'uncategorized') {
          console.log(`⚠️  Wrapper "${schemaName}" wraps uncategorized type "${wrappedTypeName}"`);
        }
      }
    }
    
    // Final fallback
    if (!foundDomain) {
      foundDomain = 'uncategorized';
    }
    
    // Store with original name
    modelDomainCache.set(schemaName, foundDomain);
    
    // Also store with cleaned name (for service/thunk generators)
    const stripped = stripApiBasePath(schemaName, apiBasePath);
    const cleaned = cleanSchemaName(stripped);
    const cleanName = toPascalCase(cleaned);
    if (cleanName !== schemaName) {
      modelDomainCache.set(cleanName, foundDomain);
    }
  }
  
  // THIRD PASS: Resolve uncategorized schemas by analyzing references (iterative)
  // Keep iterating until no more schemas can be categorized
  let previousUncategorizedCount = -1;
  let iteration = 0;
  const maxIterations = 5; // Prevent infinite loops
  
  while (iteration < maxIterations) {
    const uncategorized = Array.from(modelDomainCache.entries())
      .filter(([name, domain]) => domain === 'uncategorized')
      .map(([name]) => name);
    
    // Stop if no more uncategorized schemas or no progress made
    if (uncategorized.length === 0 || uncategorized.length === previousUncategorizedCount) {
      break;
    }
    
    previousUncategorizedCount = uncategorized.length;
    iteration++;
    
    for (const uncategorizedSchema of uncategorized) {
      let foundDomain: string | null = null;
      
      // Check all categorized schemas to see if any reference this uncategorized schema
      for (const [schemaName, schemaObj] of Object.entries(schemas)) {
        const schemaDomain = modelDomainCache.get(schemaName);
        
        // Skip if this schema is also uncategorized or doesn't have a domain
        if (!schemaDomain || schemaDomain === 'uncategorized') continue;
        
        // Check if this schema references the uncategorized schema
        const schemaStr = JSON.stringify(schemaObj);
        if (schemaStr.includes(`"$ref":"#/components/schemas/${uncategorizedSchema}"`) ||
            schemaStr.includes(`"$ref": "#/components/schemas/${uncategorizedSchema}"`)) {
          foundDomain = schemaDomain;
          console.log(`✓ Schema "${uncategorizedSchema}" inheriting domain "${foundDomain}" from referencing schema "${schemaName}"`);
          break;
        }
      }
      
      // Update the cache if we found a domain
      if (foundDomain) {
        modelDomainCache.set(uncategorizedSchema, foundDomain);
        
        // Also update cleaned name version
        const stripped = stripApiBasePath(uncategorizedSchema, apiBasePath);
        const cleaned = cleanSchemaName(stripped);
        const cleanName = toPascalCase(cleaned);
        if (cleanName !== uncategorizedSchema) {
          modelDomainCache.set(cleanName, foundDomain);
        }
      }
    }
  }
  
  // Warn about schemas that are still uncategorized after all passes
  const stillUncategorized = Array.from(modelDomainCache.entries())
    .filter(([name, domain]) => domain === 'uncategorized' && !name.includes('PascalCase'))
    .map(([name]) => name);
  
  if (stillUncategorized.length > 0) {
    console.log(`\n⚠️  ${stillUncategorized.length} schemas remain uncategorized:`);
    stillUncategorized.forEach(name => {
      console.warn(`⚠️  Schema "${name}" has no domain - not used in any tagged operation`);
    });
  }
  
  // Log domain distribution
  const domainCounts = new Map<string, number>();
  for (const domain of modelDomainCache.values()) {
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }
  
  console.log(`✓ Built domain mappings for ${modelDomainCache.size} models`);
  console.log('Domain distribution:', Object.fromEntries(domainCounts));
}

/**
 * Get domain for a model/schema
 * Uses OpenAPI tags extracted from operations
 */
export function getModelDomain(modelName: string, openApiSpec?: any): string {
  // Build cache if not already built and spec is provided
  if (!modelDomainCache && openApiSpec) {
    buildDomainMappings(openApiSpec);
  }
  
  // Return cached domain or default to 'uncategorized'
  return modelDomainCache?.get(modelName) || 'uncategorized';
}

/**
 * Get all unique domains from the cache
 */
export function getAllDomains(): string[] {
  if (!modelDomainCache) {
    return ['uncategorized'];
  }
  
  const domains = new Set(modelDomainCache.values());
  return Array.from(domains).sort();
}

/**
 * Clear the domain cache (useful for testing or regeneration)
 */
export function clearDomainCache(): void {
  modelDomainCache = null;
}
