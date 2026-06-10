import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';

const STORAGE_KEY = 'edupulse_internal_path';

/** Auth routes keep real URLs so /register and /login work on refresh and when deployed. */
const PUBLIC_AUTH_PATHS = new Set(['/register', '/login']);

export function clearStoredAppPath() {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Keep the browser address bar at `/` while preserving the real in-app path
 * in history state for React Router v7 (`state.masked`).
 */
export function maskBrowserUrl(
  internalPathname: string,
  internalSearch = '',
  internalHash = ''
) {
  if (!internalPathname || internalPathname === '/') return;

  const browserAtRoot =
    window.location.pathname === '/' &&
    window.location.search === '' &&
    window.location.hash === '';

  const state = window.history.state ?? {};
  const masked = state.masked;
  const alreadyMasked =
    browserAtRoot &&
    masked?.pathname === internalPathname &&
    (masked?.search ?? '') === internalSearch &&
    (masked?.hash ?? '') === internalHash;

  if (alreadyMasked) return;

  window.history.replaceState(
    {
      ...state,
      masked: {
        pathname: internalPathname,
        search: internalSearch,
        hash: internalHash,
      },
    },
    '',
    `${window.location.origin}/`
  );
}

function persistInternalPath(path: string) {
  if (path && path !== '/') {
    sessionStorage.setItem(STORAGE_KEY, path);
  }
}

/** Restore last in-app page after refresh (URL bar stays at /). */
export function RestoreAppPath() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, onboardingComplete, selectedRole } = useAppStore();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    if (!onboardingComplete || !selectedRole || !isAuthenticated) return;
    if (location.pathname !== '/') return;

    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && stored !== '/') {
      restored.current = true;
      navigate(stored, { replace: true, mask: '/' });
    }
  }, [isAuthenticated, onboardingComplete, selectedRole, location.pathname, navigate]);

  return null;
}

export default function CleanUrlBar() {
  const location = useLocation();

  useEffect(() => {
    const internalPath = `${location.pathname}${location.search}${location.hash}`;
    if (PUBLIC_AUTH_PATHS.has(location.pathname)) {
      persistInternalPath(internalPath);
      return;
    }
    persistInternalPath(internalPath);
    maskBrowserUrl(location.pathname, location.search, location.hash);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
