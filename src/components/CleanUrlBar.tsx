import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';

const STORAGE_KEY = 'edupulse_internal_path';

export function clearStoredAppPath() {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Keep the browser address bar at the site root only (no /admin, /parent, etc.). */
export function maskBrowserUrl() {
  if (
    window.location.pathname !== '/' ||
    window.location.search !== '' ||
    window.location.hash !== ''
  ) {
    window.history.replaceState(window.history.state, '', `${window.location.origin}/`);
  }
}

function persistInternalPath(pathname: string) {
  if (pathname && pathname !== '/') {
    sessionStorage.setItem(STORAGE_KEY, pathname);
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
      navigate(stored, { replace: true });
    }
  }, [isAuthenticated, onboardingComplete, selectedRole, location.pathname, navigate]);

  return null;
}

export default function CleanUrlBar() {
  const location = useLocation();

  useEffect(() => {
    persistInternalPath(location.pathname);
    maskBrowserUrl();
  }, [location.pathname]);

  return null;
}
