const parseSwagger = (swagger: any) => {
  const definitions = swagger.definitions || {}
  const paths = swagger.paths || {}

  return { definitions, paths }
}

module.exports = { parseSwagger }
