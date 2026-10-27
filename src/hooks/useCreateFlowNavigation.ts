import { useLocation, useNavigate } from 'react-router-dom';

interface CreateFlowState {
  pageKey?: string;
  parentPageKey?: string;
  returnState?: NavigationState;
}

interface NavigationState {
  __createFlow?: CreateFlowState;
  [key: string]: unknown;
}

const getSafeReturnPath = (requestedPath: string | null, fallback: string) =>
  requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
    ? requestedPath
    : fallback;

export const useCreateFlowNavigation = (defaultReturnPath: string) => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as NavigationState | null;
  const flow = navigationState?.__createFlow;
  const returnPath = getSafeReturnPath(
    new URLSearchParams(location.search).get('returnTo'),
    defaultReturnPath,
  );

  const navigateToCreate = (target: string) => {
    const url = new URL(target, window.location.origin);
    url.searchParams.set('returnTo', `${location.pathname}${location.search}`);
    const parentPageKey = flow?.pageKey || location.key;

    navigate(`${url.pathname}${url.search}${url.hash}`, {
      state: {
        ...navigationState,
        __createFlow: { parentPageKey, returnState: navigationState || undefined },
      },
    });
  };

  const returnFromCreate = () => {
    const parentState = flow?.returnState;
    const nextState = flow?.parentPageKey
      ? {
        ...parentState,
        __createFlow: {
          ...parentState?.__createFlow,
          pageKey: flow.parentPageKey,
        },
      }
      : parentState;
    navigate(returnPath, { state: nextState });
  };

  return { navigateToCreate, returnFromCreate, returnPath };
};