// default form slices
export const DEFAULT_FORM_SLICES = {
  AUTH: 'auth-slice',
  LOGIN: 'login-form-slice',
  RESET_PASSWORD: 'reset-password-form-slice',
  ACCOUNT_RECOVERY: 'account-recovery-form-slice',
} as const

// #region Form Slice
export const FORM_SLICE = {
} as const
// #endregion

// #region Thunk Slice
export const ASYNC_THUNK_SLICE = {
  LOGIN: 'login-thunk-slice'
} as const
// #endregion

export const SKIP_KEYS = ['created_at', 'updated_at', 'deleted_at']

const REDUX_SLICE = {
  SAMPLE: 'sample-slice',
  ...FORM_SLICE,
  ...DEFAULT_FORM_SLICES
} as const

const REDUX_API = {
  SAMPLE: 'sample-api',
  USER: 'user-api',
  AUTH_GROUP: 'auth-group-api',
  BRANCH: 'branch-api',
  PARAMS: {
    ALL: {
      SIZE: 1000
    }
  }
} as const

export const REDUX = {
  FIELD: {
    KEY: '_latestKey',
    SKIPS: SKIP_KEYS
  },
  SLICE: REDUX_SLICE,
  THUNK: ASYNC_THUNK_SLICE,
  API: REDUX_API
} as const
