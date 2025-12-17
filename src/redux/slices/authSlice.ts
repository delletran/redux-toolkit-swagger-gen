import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  access_token: string | null;
  refresh_token: string | null;
}

const initialState: AuthState = {
  access_token: null,
  refresh_token: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthState>) => {
      state.access_token = action.payload.access_token;
      state.refresh_token = action.payload.refresh_token;
    },
    logout: (state) => {
      state.access_token = null;
      state.refresh_token = null;
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
