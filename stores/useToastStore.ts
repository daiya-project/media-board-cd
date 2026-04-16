import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning";
  title?: string;
  message: string;
  /** Custom auto-dismiss duration in ms. Falls back to type-based default. */
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  /**
   * Adds a new toast to the queue.
   * @param toast - Toast data without an id (auto-generated)
   */
  add: (toast: Omit<Toast, "id">) => void;
  /**
   * Removes a toast by its id.
   * @param id - Toast id to remove
   */
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>()(
  devtools(
    (set) => ({
      toasts: [],
      add: (toast) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { ...toast, id: crypto.randomUUID() },
          ],
        })),
      remove: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
    }),
    { name: "toast-store" },
  ),
);
