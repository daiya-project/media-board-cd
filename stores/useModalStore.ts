import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * All modal identifiers in the application.
 */
export type ModalType =
  | "recordAction"
  | "newPipeline"
  | "clientOverview"
  | "clientEdit"
  | "actionHistory"
  | "memo"
  | "memoView"
  | "followup"
  | "cvrImport"
  | "import";

interface ModalStore {
  /** Currently open modal, or null if none */
  openModal: ModalType | null;
  /** Arbitrary payload passed when opening a modal (e.g. clientId) */
  payload: Record<string, unknown>;
  /**
   * Opens a modal with optional payload.
   * @param modal - The modal to open
   * @param payload - Optional data passed to the modal
   */
  open: (modal: ModalType, payload?: Record<string, unknown>) => void;
  /** Closes the currently open modal and clears payload */
  close: () => void;
}

export const useModalStore = create<ModalStore>()(
  devtools(
    (set) => ({
      openModal: null,
      payload: {},
      open: (modal, payload = {}) => set({ openModal: modal, payload }),
      close: () => set({ openModal: null, payload: {} }),
    }),
    { name: "modal-store" },
  ),
);
