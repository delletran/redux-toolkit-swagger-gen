import { REDUX } from './constants';
import { IApiParams } from './types';


export const toQueryString = (params: IApiParams) => {
  const { order, orderBy, [REDUX.FIELD.KEY]: lastKey, ...otherParams } = params
  const ordering = orderBy ? `${order === 'asc' ? '' : '-'}${orderBy}` : ''
  const newParams = {
    ordering,
    ...otherParams
  } as Record<string, string>
  const queryString = new URLSearchParams(newParams).toString()
  return queryString
}
