import Mustache from "mustache"

import { EndpointFactory } from "../utils/end-points"
import { toCamelCase } from "../utils/formater"
import { fsRead } from "../utils/helpers"

const serviceTemplate = fsRead("../templates/serviceTemplate.mustache")

export const apiServiceGenerator = (
  path: string,
  methods: Record<string, ReduxApiEndpointType>
): string => {
  const endpoints = EndpointFactory.getEndpoints("service", path, methods)
  const uniqueImports = Array.from(
    new Map(
      endpoints.map((ep) => [
        `${ep.interface}|${ep.modelName}`,
        { interface: ep.interface, modelName: ep.modelName },
      ])
    ).values()
  )
  const uniqueParamImports = Array.from(
    new Map(
      endpoints.map((ep) => [
        `${ep.iNameParam}|${ep.modelName}`,
        { iNameParam: ep.iNameParam, pathGroup: ep.pathGroup },
      ])
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
