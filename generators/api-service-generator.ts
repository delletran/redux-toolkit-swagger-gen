const serviceTemplate = fsRead("../templates/serviceTemplate.mustache")

const generateApiService = (
  path: string,
  methods: Record<string, ReduxApiEndpointType>
): string => {
  const endpoints = EndpointFactory.getEndpoints("service", path, methods)
  interface UniqueImport {
    interface: string
    modelName: string
  }

  interface UniqueParamImport {
    interface: string
    paramName: string
  }

  const uniqueImports: UniqueImport[] = Array.from(
    new Map<string, UniqueImport>(
      endpoints.map((ep: { interface: string; modelName: string }) => [
        `${ep.interface}|${ep.modelName}`,
        { interface: ep.interface, modelName: ep.modelName },
      ])
    ).values()
  )

  const uniqueParamImports: UniqueParamImport[] = Array.from(
    new Map<string, UniqueParamImport>(
      endpoints.map(
        (ep: {
          iNameParam: string
          modelName: string
          paramInterface: string
          paramName: string
        }) => [
          `${ep.iNameParam}|${ep.modelName}`,
          { interface: ep.paramInterface, paramName: ep.paramName },
        ]
      )
    ).values()
  )

  return Mustache.render(serviceTemplate, {
    endpoints,
    uniqueImports,
    uniqueParamImports,
    sliceName: toCamelCase(path),
    slicePath: '"' + `${path}-api` + '"',
  })
}

module.exports = { generateApiService }
