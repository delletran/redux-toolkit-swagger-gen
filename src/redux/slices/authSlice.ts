import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  token: string | null;
  role: string | null;
  branch_id: number | null;
}

const initialState: AuthState = {
  token: null,
  role: null,
  branch_id: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthState>) => {
      state.token = action.payload.token;
      state.role = action.payload.role;
      state.branch_id = action.payload.branch_id;
    },
    logout: (state) => {
      state.token = null;
      state.role = null;
      state.branch_id = null;
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
