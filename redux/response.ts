import { ApiErrorSchema } from "../schema/api"
import { ReduxErrorResType } from "./types"

import { FetchBaseQueryError, FetchBaseQueryMeta } from "@reduxjs/toolkit/query"
export const transformErrorResponse = (
  returnValue: FetchBaseQueryError,
  meta: FetchBaseQueryMeta | undefined
) => {
  const errorResponseValidation = ApiErrorSchema.safeParse(returnValue.data)
  const errorData = errorResponseValidation.data

  return {
    status: meta?.response?.status || 400,
    message: errorData?.message || errorData?.error || "Something went wrong",
    detail: errorData?.detail || errorData?.error || "Something went wrong",
    hint: errorData?.hint,
    error: returnValue.data || {},
  } as ReduxErrorResType
}
