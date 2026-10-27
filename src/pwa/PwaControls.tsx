import { useEffect, useRef, useState } from 'react';
import { getInstallationMessage, isStandaloneMode } from './pwaState';
import {
  getUpdateSafety,
  subscribeUpdateSafety,
  setUpdateDeferred,
  isDeferredUpdatePending,
  setReloadRequested,
  UpdateSafetyStatus,
} from './updateSafety';
import './pwa.css';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaControls() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [safetyStatus, setSafetyStatus] = useState<UpdateSafetyStatus>(() => getUpdateSafety());
  const [isDeferred, setIsDeferred] = useState(() => isDeferredUpdatePending());
  const [installationMessage, setInstallationMessage] = useState('');
  const reloadAfterUpdate = useRef(false);
  const reloadExecuted = useRef(false);
  const activationSent = useRef(false);

  // Subscribe to update safety changes (dirty forms and active mutations)
  useEffect(() => {
    const unsubscribe = subscribeUpdateSafety(() => {
      const current = getUpdateSafety();
      setSafetyStatus(current);
      const pendingDeferred = isDeferredUpdatePending();
      setIsDeferred(pendingDeferred);

      // If user requested an update and it was deferred, automatically proceed when work is safe
      if (pendingDeferred && current.isSafe) {
        setUpdateDeferred(false);
        setIsDeferred(false);

        if (activationSent.current) {
          // Worker was already told to activate, proceed with reload
          if (!reloadExecuted.current) {
            reloadExecuted.current = true;
            window.location.reload();
          }
        } else if (registration?.waiting) {
          activationSent.current = true;
          reloadAfterUpdate.current = true;
          setReloadRequested(true);
          registration.waiting.postMessage({ type: 'TUTORLY_ACTIVATE_UPDATE' });
        }
      }
    });

    return unsubscribe;
  }, [registration]);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const updateInstalledState = () => {
      const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setIsInstalled(isStandaloneMode(displayMode.matches, iosStandalone));
    };
    updateInstalledState();
    displayMode.addEventListener('change', updateInstalledState);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallationMessage(getInstallationMessage('installed'));
    };
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator) {
      let active = true;
      const handleControllerChange = () => {
        if (reloadAfterUpdate.current && !reloadExecuted.current) {
          const current = getUpdateSafety();
          if (current.isSafe) {
            reloadExecuted.current = true;
            window.location.reload();
          } else {
            // Unsafe work was started before controller changed; defer reload
            setUpdateDeferred(true);
            setIsDeferred(true);
          }
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      void navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((nextRegistration) => {
          if (!active) return;
          setRegistration(nextRegistration);
          if (nextRegistration.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
          nextRegistration.addEventListener('updatefound', () => {
            const installing = nextRegistration.installing;
            installing?.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true);
            });
          });
        })
        .catch((error) => console.warn('Tutorly offline support could not be started:', error));

      return () => {
        active = false;
        displayMode.removeEventListener('change', updateInstalledState);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
        window.removeEventListener('appinstalled', handleInstalled);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      displayMode.removeEventListener('change', updateInstalledState);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const installTutorly = async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    setInstallPrompt(null);
    setInstallationMessage('');
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setInstallationMessage(getInstallationMessage(choice.outcome));
    } catch {
      setInstallationMessage('The browser could not open its installation prompt. Try its menu instead.');
    }
  };

  const activateUpdate = () => {
    if (!registration?.waiting) return;
    const current = getUpdateSafety();
    if (!current.isSafe) {
      setUpdateDeferred(true);
      setIsDeferred(true);
      return;
    }

    if (!activationSent.current) {
      activationSent.current = true;
      reloadAfterUpdate.current = true;
      setReloadRequested(true);
      registration.waiting.postMessage({ type: 'TUTORLY_ACTIVATE_UPDATE' });
    }
  };

  const cancelDeferredUpdate = () => {
    setUpdateDeferred(false);
    setIsDeferred(false);
  };

  const showInstallHelp = !isInstalled;
  if (!isOffline && !updateReady && !showInstallHelp && !installationMessage) return null;

  return (
    <div className="pwa-controls" aria-live="polite">
      {isOffline && (
        <div className="pwa-notice pwa-offline" role="status">
          <strong>You're offline.</strong> A connection is required for current school data, attendance, and payments.
        </div>
      )}

      {updateReady && (
        isDeferred ? (
          <div className="pwa-notice pwa-notice-deferred" role="status" aria-live="polite">
            <div className="pwa-notice-content">
              <strong>Update deferred</strong>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#475569' }}>
                {safetyStatus.blockingReasons.length > 0
                  ? `Unsaved work: ${safetyStatus.blockingReasons.join(', ')}. The update will apply automatically once changes are saved or discarded.`
                  : 'An operation is in progress. The update will apply automatically once finished.'}
              </p>
            </div>
            <button
              type="button"
              className="pwa-button pwa-button-secondary"
              onClick={cancelDeferredUpdate}
              aria-label="Cancel deferred update"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="pwa-notice" role="status" aria-live="polite">
            <div className="pwa-notice-content">
              <span>A Tutorly update is ready.</span>
            </div>
            <button type="button" className="pwa-button" onClick={activateUpdate}>
              Reload to update
            </button>
          </div>
        )
      )}

      {(showInstallHelp || installationMessage) && (
        <div className="pwa-install-help">
          {showInstallHelp && (
            <>
              {installPrompt && (
                <button type="button" className="pwa-button" onClick={() => void installTutorly()}>
                  Install Tutorly
                </button>
              )}
              <details>
                <summary>{installPrompt ? 'Installation help' : 'Install Tutorly'}</summary>
                <p>
                  In Chrome on Android, use the browser menu and choose “Install app” or “Add to Home screen” when available.
                  On iPhone or iPad, use Safari’s Share menu and choose “Add to Home Screen.” Other browsers may use different
                  options or may not support installation.
                </p>
              </details>
            </>
          )}
          {installationMessage && <p className="pwa-install-message" role="status">{installationMessage}</p>}
        </div>
      )}
    </div>
  );
}
