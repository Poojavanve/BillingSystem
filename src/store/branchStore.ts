import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface BranchStore {
  // The full set of branches currently selected in the branch switcher. Read/report
  // screens filter and merge data across every id in this list. Always has at least
  // one id once a branch has been selected.
  selectedBranchIds: number[];
  // The first id in selectedBranchIds - used as the single active branch for writes
  // (creating a sale, expense, etc.) and by any screen that only needs one branch.
  selectedBranchId: number | null;
  setSelectedBranchId: (branchId: number) => void;
  setSelectedBranchIds: (branchIds: number[]) => void;
  toggleSelectedBranchId: (branchId: number) => void;
  clearSelectedBranch: () => void;
}

const useBranchStore = create<BranchStore>()(
  devtools(
    persist(
      (set, get) => ({
        selectedBranchIds: [],
        selectedBranchId: null,

        setSelectedBranchId: (branchId: number) => {
          set({ selectedBranchIds: [branchId], selectedBranchId: branchId });
        },

        setSelectedBranchIds: (branchIds: number[]) => {
          const unique = Array.from(new Set(branchIds));
          set({ selectedBranchIds: unique, selectedBranchId: unique[0] ?? null });
        },

        toggleSelectedBranchId: (branchId: number) => {
          const current = get().selectedBranchIds;
          const isSelected = current.includes(branchId);
          if (isSelected && current.length === 1) {
            // Always keep at least one branch selected.
            return;
          }
          const next = isSelected
            ? current.filter((id) => id !== branchId)
            : [...current, branchId];
          set({ selectedBranchIds: next, selectedBranchId: next[0] ?? null });
        },

        clearSelectedBranch: () => {
          set({ selectedBranchIds: [], selectedBranchId: null });
        },
      }),
      {
        name: 'branch-storage',
        partialize: (state) => ({
          selectedBranchIds: state.selectedBranchIds,
          selectedBranchId: state.selectedBranchId,
        }),
        // Older persisted sessions only ever wrote selectedBranchId (pre-multi-select),
        // so backfill selectedBranchIds from it to avoid a single-branch user landing
        // on an empty selection after this upgrade.
        merge: (persistedState, currentState) => {
          const persisted = (persistedState as Partial<BranchStore>) || {};
          const merged = { ...currentState, ...persisted };
          if (!merged.selectedBranchIds || merged.selectedBranchIds.length === 0) {
            merged.selectedBranchIds = merged.selectedBranchId ? [merged.selectedBranchId] : [];
          }
          return merged;
        },
      }
    )
  )
);

export { useBranchStore };
