const thunkTemplate = fsRead("../templates/thunkTemplate.mustache")

const thunkGenerator = (
  path: string,
  methods: Record<string, ReduxApiEndpointType>
): string => {
  const endpoints = EndpointFactory.getEndpoints("thunk", path, methods)

  const allTypes = endpoints
    .flatMap((ep) => ep.types)
    .filter((type, index, self) => self.indexOf(type) === index)

  const uniqueImports = Array.from(
    new Map(
      endpoints
        .filter(
          (ep) =>
            ep.interface && allTypes.some((type) => type.includes(ep.interface))
        )
        .map((ep) => [
          `${ep.interface}|${ep.modelName}`,
          { interface: ep.interface, modelName: ep.modelName },
        ])
    ).values()
  )

  return Mustache.render(thunkTemplate, {
    endpoints,
    uniqueImports,
    sliceName: toCamelCase(path),
    slicePath: '"' + `${path}-thunk` + '"',
  })
}

module.exports = { thunkGenerator }
