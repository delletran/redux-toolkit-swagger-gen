export const parseSwagger = (swagger: any) => {
  // Handle both OpenAPI 2.0 (definitions) and OpenAPI 3.x (components.schemas)
  const definitions = swagger.definitions || (swagger.components && swagger.components.schemas) || {};
  const paths = swagger.paths || {};

  // Debug output
  console.log('Swagger version:', swagger.openapi || swagger.swagger);
  console.log('Definitions found:', Object.keys(definitions).length);
  console.log('Paths found:', Object.keys(paths).length);

  return { definitions, paths };
};
