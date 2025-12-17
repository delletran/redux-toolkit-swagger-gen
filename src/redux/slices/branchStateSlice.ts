import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface BranchState {
  selectedBranchId: number | null;
}

const initialState: BranchState = {
  selectedBranchId: null,
};

const branchStateSlice = createSlice({
  name: 'branchState',
  initialState,
  reducers: {
    setSelectedBranch: (state, action: PayloadAction<number | null>) => {
      state.selectedBranchId = action.payload;
    },
  },
});

export const { setSelectedBranch } = branchStateSlice.actions;
export default branchStateSlice.reducer;
