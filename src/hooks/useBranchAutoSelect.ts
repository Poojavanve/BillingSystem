import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { branchApi } from '../api/endpoints';
import { useAuth } from './useAuth';
import { useBranch } from './useBranch';

// Resolves the active branch for the current user regardless of which page they're on -
// some routes (POS) render outside AppLayout, so branch selection can't live only in
// BranchSwitcher or requests from those pages never get X-Branch-Id and fail with
// "Branch is required". A single branch is selected immediately; with several, the first
// is selected by default and BranchSwitcher (wherever it's rendered) lets the user change it.
export const useBranchAutoSelect = () => {
  const { isAuthenticated } = useAuth();
  const { selectedBranchIds, setSelectedBranchIds } = useBranch();

  const branches = useQuery({
    queryKey: ['my-branches'],
    queryFn: () => branchApi.getMine(),
    enabled: isAuthenticated,
  });
  const rows = branches.data?.data || [];

  useEffect(() => {
    if (rows.length === 0) return;
    const validIds = selectedBranchIds.filter((id) => rows.some((branch) => branch.id === id));
    if (validIds.length === 0) {
      setSelectedBranchIds([rows[0].id]);
    } else if (validIds.length !== selectedBranchIds.length) {
      // Drop any previously-selected branch the user is no longer authorized for.
      setSelectedBranchIds(validIds);
    }
  }, [rows, selectedBranchIds, setSelectedBranchIds]);

  const branchSelected = rows.length === 0 || selectedBranchIds.some((id) => rows.some((branch) => branch.id === id));

  return { branches: rows, isLoading: branches.isLoading || !branchSelected };
};
