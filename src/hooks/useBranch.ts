import { useBranchStore } from '../store/branchStore';

export const useBranch = () => {
  const {
    selectedBranchId,
    selectedBranchIds,
    setSelectedBranchId,
    setSelectedBranchIds,
    toggleSelectedBranchId,
    clearSelectedBranch,
  } = useBranchStore();

  return {
    selectedBranchId,
    selectedBranchIds,
    setSelectedBranchId,
    setSelectedBranchIds,
    toggleSelectedBranchId,
    clearSelectedBranch,
  };
};
