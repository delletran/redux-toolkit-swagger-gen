
export type ReduxErrorResType<T = unknown> = {
  status?: number
  message?: string
  detail?: string
  hint?: string
  error: T
}

export type RCE<T> = React.ChangeEvent<T>
export type RME<T> = React.MouseEvent<T>

export type IOrdering = Record<string, unknown> & {
  order?: 'asc' | 'desc' | false
  orderBy?: string
}

export type ILayout = Readonly<{
  children: React.ReactNode
}>

export type IRoute = {
  name: string
  href: string
  icon?: React.ReactNode
  path: string
  activeClassName?: string
  className?: string
  subLinks?: IRoute[]
  subRoute?: { [key in string]: IRoute }
  isRoute?: boolean
}

export type IApiProps = {
  params?: IApiParams
  skip?: boolean
  ignore?: string[]
  defaultParams?: IApiParams
  overrideParams?: IApiParams
}

export type IApiParams = Record<string, unknown>

export type IApiSuccessResponse<T> = {
  status: 'ok'
  code: number
  data: T
  error?: null
}

export type IApiErrorResponse<T> = {
  status: null
  code: number
  error: string
  data?: T
}

export type IApiResponse<T> = IApiSuccessResponse<T> | IApiErrorResponse<T>

export type ID = number | string

export type IApiPostProps<T = Record<string, unknown>> = {
  payload: T
}

export type IApiPutProps<T = Record<string, unknown>> = {
  id: ID
  payload: T
}

export type IWithID = { id: ID }
export type IWithError<T> = {
  error?: Partial<Record<keyof T, string>>
}
// #region Next JS

export type INextPage = {
  params?: Record<string, unknown>
  searchParams?: { q?: string } & Record<string, unknown>
}

// #endregion

export type IQueryParams = {
  page?: number
}
export type IFilters = Record<string, unknown> & IQueryParams
export type ISearchParams = IFilters & IOrdering
