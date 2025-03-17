import { ID, IWithID } from "../types"

/**
 * Returns array of ID.
 * @param {Array<string>} list List of Data with `id`.
 * @returns {Array<string>} An array of IDs.
 */
const toIdsOfDataArray = <T extends IWithID>(list: T[]): Array<ID> => {
  return list.map((item) => item.id)
}

/**
 * Returns array of ID.
 * @param list List of Objects with `id`.
 */
const IDsOfList = <T>(list: IWithID[]) => {
  return list.map((item) => item.id) as T[]
}

/**
 * Filters out item from the list with IDs.
 * @param list List of Objects with `id`.
 * @param idToRemove List of `id` to remove from the list.
 */
const RemoveItemFromListWithID = <T>(
  list: (IWithID & T)[],
  idToRemove: number | string
) => {
  return list.filter((item) => item.id !== idToRemove) as T[]
}

/**
 * Filter out items from the list with IDs.
 * @param list List of Objects with `id`.
 * @param idsToRemove List of `id` to remove from the list.
 */
const RemoveItemsFromListWithIDs = <T>(
  list: (IWithID & T)[],
  idsToRemove: (number | string)[]
) => {
  return list.filter((item) => !idsToRemove.includes(item.id)) as T[]
}

/**
 * Returns an array of objects by subtracting the array `toClear` from the array `list`.
 * @param  {Array<IWithID>} list - The original list of objects with `id` properties.
 * @param  {Array<IWithID>} toClear - The list of objects with `id` properties to be subtracted from the original list.
 * @returns {Array<IWithID>} An array of objects.
 */
const clearDataArrayOf = <T extends IWithID>(
  list: T[],
  toClear: T[]
): Array<IWithID> => {
  const ids = toIdsOfDataArray(toClear)
  return list.filter((item) => !ids.includes(item.id))
}

/**
 * Returns an array of objects by array of IDs.
 * @param  {Array<IWithID>} list - The original list of objects with `id` properties.
 * @param  {Array<IWithID>} ids - The list of `id` to be selected from the original list.
 * @returns {Array<IWithID>} An array of objects.
 */
const selectDataArrayOfByIDs = <T extends IWithID>(
  list: T[] | undefined,
  ids: ID[]
): Array<T> => {
  if (!list) return []
  return list.filter((item) => ids.includes(item.id))
}

/**
 * Extracts the values of a specific field from an array of objects.
 * @param list - Array of objects.
 * @param field - The key of the field to extract values from.
 * @returns An array of values corresponding to the specified field.
 */
const extractFieldValues = <
  T extends Record<string, unknown>,
  K extends keyof T
>(
  list: T[] | undefined,
  field: K
): T[K][] => {
  if (!list) return []
  return list.map((item) => item[field])
}

const toKeyValuePairArray = (obj: object) =>
  Object.entries(obj).map(([name, id]) => ({ id, name }))

/**
 * Retrieves the index of a value in a list. If the value is not found, it returns the index of a default value.
 *
 * @param {unknown[]} list - The array to search in.
 * @param {unknown} value - The value to find in the array.
 * @param {unknown} [defaultValue] - An optional default value to search for if the primary value is not found.
 *
 * @returns {number} - The index of the value in the list, or the index of the default value if the primary value is not found. If neither is found, returns -1.
 *
 * @example
 * ```ts
 * const list = ['apple', 'banana', 'cherry'];
 * const index = getIndexOf(list, 'banana'); // Output: 1
 * const notFoundIndex = getIndexOf(list, 'orange', 'banana'); // Output: 1 (since 'orange' is not found, but 'banana' is)
 * const noDefaultIndex = getIndexOf(list, 'orange'); // Output: -1 (since neither 'orange' nor a default value are found)
 * ```
 */
const getIndexOf = (
  list: unknown[],
  value: unknown,
  defaultValue?: unknown
) => {
  const index = list.indexOf(value)
  if (index === -1) return list.indexOf(defaultValue)
  return index
}

module.exports = {
  toIdsOfDataArray,
  IDsOfList,
  RemoveItemFromListWithID,
  RemoveItemsFromListWithIDs,
  clearDataArrayOf,
  selectDataArrayOfByIDs,
  extractFieldValues,
  toKeyValuePairArray,
  getIndexOf,
}
