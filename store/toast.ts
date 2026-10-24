import { create } from "zustand";

const CLEAR_AFTER_MS = 4000;
let timer: ReturnType<typeof setTimeout> | undefined;

type ToastState = { message: string | null; show: (message: string) => void };

export const useToast = create<ToastState>()((set) => ({
  message: null,
  show: (message) => {
    clearTimeout(timer);
    set({ message });
    timer = setTimeout(() => set({ message: null }), CLEAR_AFTER_MS);
  },
}));
