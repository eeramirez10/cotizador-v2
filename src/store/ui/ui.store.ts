import { create } from "zustand";

interface UiState {
  open: boolean;
  setOpen: () => void;
  setClose: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  open: false,
  setOpen: () => set({ open: true }),
  setClose: () => set({ open: false }),
}));
