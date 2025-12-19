import { REDUX } from './constants';
import { IApiParams } from './types';


export const toQueryString = (params: IApiParams) => {
  const { order, orderBy, [REDUX.FIELD.KEY]: lastKey, ...otherParams } = params
  const ordering = orderBy ? `${order === 'asc' ? '' : '-'}${orderBy}` : ''
  
  // Filter out undefined, null, and empty string values
  const filteredParams = Object.entries({
    ordering,
    ...otherParams
  }).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = String(value);
    }
    return acc;
  }, {} as Record<string, string>);
  
  const queryString = new URLSearchParams(filteredParams).toString();
  return queryString;
}
