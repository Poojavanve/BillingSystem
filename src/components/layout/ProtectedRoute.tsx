import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getDefaultAuthorizedPath } from '../../auth/featurePermissions';
import { Loader } from '../ui/Loader';
import { useAuth } from '../../hooks/useAuth';
import { useBranchAutoSelect } from '../../hooks/useBranchAutoSelect';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permissions?: string | string[];
  requireAll?: boolean;
}

interface CreateFlowState {
  pageKey?: string;
  parentPageKey?: string;
}

interface CachedPage {
  key: string;
  parentKey?: string;
  element: React.ReactNode;
}

const ProtectedPageStack: React.FC<{
  pageKey: string;
  flow?: CreateFlowState;
  children: React.ReactNode;
}> = ({ pageKey, flow, children }) => {
  const [pages, setPages] = React.useState<CachedPage[]>(() => [
    { key: pageKey, element: children },
  ]);
  const restoredPage = flow?.pageKey
    ? pages.find((page) => page.key === flow.pageKey)
    : undefined;
  const activeKey = restoredPage?.key || pageKey;
  let nextPages = pages;

  if (!restoredPage && !pages.some((page) => page.key === pageKey)) {
    nextPages = [...pages, { key: pageKey, parentKey: flow?.parentPageKey, element: children }];
  }

  const retainedKeys = new Set<string>();
  let parentKey: string | undefined = activeKey;
  while (parentKey && !retainedKeys.has(parentKey)) {
    retainedKeys.add(parentKey);
    parentKey = nextPages.find((page) => page.key === parentKey)?.parentKey;
  }
  const visiblePages = nextPages.filter((page) => retainedKeys.has(page.key));

  if (visiblePages.length !== pages.length || visiblePages.some((page, index) => page !== pages[index])) {
    setPages(visiblePages);
  }

  return <>{visiblePages.map((page) => (
    <div key={page.key} className={page.key === activeKey ? 'contents' : 'hidden'}>
      {page.element}
    </div>
  ))}</>;
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permissions,
  requireAll = false,
}) => {
  const {
    token,
    user,
    expiresAt,
    isAuthenticated,
    isSessionValid,
    logout,
    hasAnyPermission,
    hasAllPermissions,
  } = useAuth();
  const location = useLocation();
  const sessionValid = isSessionValid();
  const requiredPermissions = permissions
    ? Array.isArray(permissions) ? permissions : [permissions]
    : [];

  // Resolves the branch used for X-Branch-Id on every request - runs here so it applies
  // to every protected route, including ones (like POS) that don't render AppLayout/BranchSwitcher.
  // Rendering children is gated on the first resolution below so a page's own queries can't
  // race ahead of it and fire without X-Branch-Id (that race is what caused "Branch is required"
  // errors on fresh sessions even after branch auto-select was added).
  const { isLoading: branchLoading } = useBranchAutoSelect();

  React.useEffect(() => {
    if (token && !sessionValid) logout();
  }, [logout, sessionValid, token]);

  React.useEffect(() => {
    if (!token || !expiresAt) return undefined;
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      logout();
      return undefined;
    }
    const timeoutId = window.setTimeout(logout, delay);
    return () => window.clearTimeout(timeoutId);
  }, [expiresAt, logout, token]);

  if (!isAuthenticated || !sessionValid) {
    return <Navigate to="/login" replace />;
  }

  if (
    requiredPermissions.length > 0
    && !(requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions))
  ) {
    const fallbackPath = getDefaultAuthorizedPath(user?.permissions, user?.role);

    if (fallbackPath !== location.pathname) {
      return <Navigate to={fallbackPath} replace />;
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
          Your account does not have permission to access this page.
        </div>
      </div>
    );
  }

  if (branchLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader />
      </div>
    );
  }

  const flow = (location.state as { __createFlow?: CreateFlowState } | null)?.__createFlow;

  return (
    <ProtectedPageStack pageKey={location.key} flow={flow}>
      {children}
    </ProtectedPageStack>
  );
};
