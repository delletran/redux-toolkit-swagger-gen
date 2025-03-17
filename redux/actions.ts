// const { PayloadAction } = require('@reduxjs/toolkit')
const {
  clearDataArrayOf,
  IDsOfList,
  RemoveItemFromListWithID,
  RemoveItemsFromListWithIDs,
} = require("./helper/array")
// const { IWithError, IWithID } = require('./types')

// const { REDUX } = require("./constants")
import { PayloadAction } from "@reduxjs/toolkit"
// import {
//   clearDataArrayOf,
//   IDsOfList,
//   RemoveItemFromListWithID,
//   RemoveItemsFromListWithIDs
// } from "./helper/array"
import { IWithError, IWithID } from "./types"
import { REDUX } from "./constants"

/**
 * Generates a function to set a specific field in the state.
 * @template T - The type of the state.
 * @template D - The type of the payload.
 * @param field - The field to be set in the state.
 * @returns A function that takes the state and action, and sets the specified field.
 */
const setAction = <T extends Record<string, IValue>, D = unknown>(
  field: keyof T
) => {
  return (state: T, action: PayloadAction<D>) => {
    state[field] = action.payload as T[keyof T]
  }
}

/**
 * Generates a function to clear a specific field in the state.
 * @template T - The type of the state.
 * @param field - The field to be cleared in the state.
 * @returns A function that takes the state and clears the specified field.
 */
const clearAction = <T extends Record<string, unknown>>(
  field: keyof T,
  defaultValue?: unknown
) => {
  return (state: T) => {
    state[field] = (defaultValue ?? undefined) as T[keyof T]
  }
}

/**
 * Sets the form state with the provided payload.
 * @template T - The type of the form state.
 * @param state - The current form state.
 * @param action - The action containing the payload to set.
 * @returns The updated form state.
 */
const setFormAction = <T>(
  state: IReduxFormState<T>,
  action: PayloadAction<Record<string, unknown>>
) => {
  const { payload } = action
  return { ...state, ...payload, error: {} }
}

/**
 * Edits the form state with the provided payload and clears the error for the edited field.
 * @template T - The type of the form state.
 * @param state - The current form state.
 * @param action - The action containing the payload to edit.
 * @returns The updated form state.
 */
const editFormAction = <T>(
  state: IReduxFormState<T>,
  action: PayloadAction<Record<string, IValue>>
) => {
  const { payload } = action
  const error = { ...state.error, [payload[REDUX.FIELD.KEY]]: "" }
  return { ...state, error, ...payload }
}

/**
 * Sets the form error state with the provided payload.
 * @template T - The type of the form state.
 * @param state - The current form state.
 * @param action - The action containing the error payload to set.
 */
const setFormErrorAction = <T>(
  state: IReduxFormState<T>,
  action: PayloadAction<Record<string, unknown>>
) => {
  const { payload } = action
  state.error = payload as Partial<Record<keyof T, string>> | undefined
}

/**
 * Edits the form error state with the provided payload.
 * @template T - The type of the form state.
 * @param state - The current form state.
 * @param action - The action containing the error payload to update.
 */
const editFormErrorAction = <T>(
  state: IReduxFormState<T>,
  action: PayloadAction<Record<string, unknown>>
) => {
  const { payload } = action
  state.error = { ...state.error, ...payload }
}

/**
 * Clears the form error state.
 * @template T - The type of the form state.
 * @param state - The current form state.
 */
const clearFormErrorAction = <T>(state: IReduxFormState<T>) => {
  state.error = {}
}

/**
 * Creates an action to set a field in the state.
 * Merges the payload with the existing field value and resets the error.
 *
 * @template T - The type of the state object.
 * @param {keyof T} field - The field in the state to be set.
 * @returns {Function} The set field action function.
 */
const setFieldAction = <T>(field: keyof T) => {
  const setField = (
    state: T,
    action: PayloadAction<Record<string, IValue>>
  ) => {
    const { payload } = action
    state[field] = { ...state[field], ...payload, error: {} }
  }
  return setField
}

/**
 * Creates an action to clear a field in the state.
 * Resets the field to its initial state.
 *
 * @template T - The type of the state object.
 * @param {T} initialState - The initial state of the field.
 * @param {keyof T} field - The field in the state to be cleared.
 * @returns {Function} The clear field action function.
 */
const clearFieldAction = <T>(initialState: T, field: keyof T) => {
  const clearField = (state: T) => {
    state[field] = initialState[field]
  }
  return clearField
}

/**
 * Set array of object to object array field.
 * @param field Object array field name.
 */
const setArrayAction = <T extends Record<string, unknown>>(field: keyof T) => {
  return (state: T, action: PayloadAction<IWithID[]>) => {
    const { payload } = action
    state[field] = payload as T[keyof T]
  }
}

/**
 * Adds/Selects or Removes/unselects object to list.
 * @note Object to add / remove must have `id` field
 * @param  field Array field name.
 */
const selectItemAction = <T extends Record<string, unknown>, D extends IWithID>(
  field: keyof T
) => {
  return (state: T, action: PayloadAction<{ item: D; select?: boolean }>) => {
    const { payload } = action
    const { item, select } = payload
    const list = state[field] as IWithID[]
    if (select) {
      const cleanList = clearDataArrayOf(list, [item])
      cleanList.push(item)
      state[field] = cleanList as T[keyof T]
    } else {
      const cleanList = clearDataArrayOf(list, [item])
      state[field] = cleanList as T[keyof T]
    }
  }
}

/**
 * Add/Select items to list. Multiple
 * @note Items to add / select must have `id` field
 * @param field Array field name.
 */
const selectItemsAction = <
  T extends Record<string, any>,
  D extends { id: number | string }
>(
  field: keyof T
) => {
  return (state: T, action: PayloadAction<{ items: D[]; select: boolean }>) => {
    const { payload } = action
    const { items, select } = payload
    if (select) {
      const selectedIDs = IDsOfList(items)
      const cleanList = RemoveItemsFromListWithIDs(state[field], selectedIDs)
      cleanList.push(...items)
      state[field] = cleanList as T[keyof T]
    } else {
      const selectedIDs = IDsOfList(items)
      const cleanList = RemoveItemsFromListWithIDs(state[field], selectedIDs)
      state[field] = cleanList as T[keyof T]
    }
  }
}

/**
 * Unselects / removes item to list
 * @note Item to unselect / remove must have `id` field
 * @param field Array field name.
 */
const unselectItemAction = <T extends Record<string, any> & IWithError<T>>(
  field: keyof T,
  errorField?: string
) => {
  return (state: T, action: PayloadAction<number | string>) => {
    if (errorField && state.error)
      state.error = { ...state.error, [errorField]: undefined }
    const { payload } = action
    const cleanList = RemoveItemFromListWithID(state[field], payload)
    state[field] = cleanList as T[keyof T]
  }
}

/**
 * Unselect / remove items to list, Multiple
 * @note Items to unselect / remove must have `id` field
 * @param field Array field name.
 */
const unselectItemsAction = <T extends Record<string, any>>(field: keyof T) => {
  return (state: T, action: PayloadAction<number[]>) => {
    const { payload } = action
    const cleanList = RemoveItemsFromListWithIDs(state[field], payload)
    state[field] = cleanList as T[keyof T]
  }
}

type IProcessFormActionOptions<T> = {
  keyRelations?: IFormKeysRelation<T>
}

/**
 * Same function of `editFormAction`, with `options` for processing fields
 * @param initialState Initial state object of the form
 * @param keyRelations Arrays of field keys to clear when invoked, see example below.
 * @example
 * ```json
 * {
 *   "campus": ["building_id", "room_id"],
 * }
 * ```
 * If `campus` is passed as latest key, clears the `building_id` and `room_id` fields base on their `initialState` value
 */

const processFormAction = <T>(
  initialState: T,
  options?: IProcessFormActionOptions<T>
) => {
  const keysToClear = options?.keyRelations
  const setFormFunction = (
    state: IReduxFormState<T>,
    action: PayloadAction<Record<string, unknown>>
  ) => {
    const { payload: initialPayload } = action

    const { [REDUX.FIELD.KEY]: _key, ...payload } = initialPayload
    const key = _key as keyof T
    // Overrides key pair values
    let fieldToClears = {}
    // Maps key to clear if found in the options
    if (keysToClear && key in keysToClear) {
      keysToClear[key]?.forEach((item) => {
        fieldToClears = { ...fieldToClears, [item]: initialState[item] }
      })
    }
    const error = { ...state.error, [key]: "", ...fieldToClears }
    return { ...state, error, ...payload, ...fieldToClears }
  }
  return setFormFunction
}

module.exports = {
  setAction,
  clearAction,
  setFormAction,
  editFormAction,
  setFormErrorAction,
  editFormErrorAction,
  clearFormErrorAction,
  setFieldAction,
  clearFieldAction,
  setArrayAction,
  selectItemAction,
  selectItemsAction,
  unselectItemAction,
  unselectItemsAction,
  processFormAction,
}
