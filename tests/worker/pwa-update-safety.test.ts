import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setFormDirty,
  unregisterDirtyForm,
  beginMutation,
  getUpdateSafety,
  subscribeUpdateSafety,
  setUpdateDeferred,
  isDeferredUpdatePending,
  setReloadRequested,
  isReloadRequested,
  resetUpdateSafetyForTesting,
} from '../../src/pwa/updateSafety';
import swTemplate from '../../src/pwa/sw.template.js?raw';

describe('PWA Update Safety and Unsaved Work Protection (F008)', () => {
  beforeEach(() => {
    resetUpdateSafetyForTesting();
  });

  it('1. No update available: state is clean, no pending deferred update, and no reload requested', () => {
    const safety = getUpdateSafety();
    expect(safety.isSafe).toBe(true);
    expect(safety.blockingReasons).toEqual([]);
    expect(safety.dirtyForms).toEqual([]);
    expect(safety.activeMutationsCount).toBe(0);
    expect(isDeferredUpdatePending()).toBe(false);
    expect(isReloadRequested()).toBe(false);
  });

  it('2. Update available with no unsaved work: user can update successfully', () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    };
    let reloadCalled = false;
    const reload = () => { reloadCalled = true; };

    // Simulate safe update activation flow
    const safety = getUpdateSafety();
    expect(safety.isSafe).toBe(true);

    if (safety.isSafe) {
      setReloadRequested(true);
      waitingWorker.postMessage({ type: 'TUTORLY_ACTIVATE_UPDATE' });
    }

    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'TUTORLY_ACTIVATE_UPDATE' });
    expect(isReloadRequested()).toBe(true);

    // When controllerchange arrives while safe and reload was requested
    if (isReloadRequested() && getUpdateSafety().isSafe) {
      reload();
    }
    expect(reloadCalled).toBe(true);
  });

  it('3. Update available with dirty form: reload is deferred and reasons are reported', () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    };
    let reloadCalled = false;
    const reload = () => { reloadCalled = true; };

    // Student admission form is open with unsaved changes
    setFormDirty('student-admission', true, 'Student admission form');

    const safety = getUpdateSafety();
    expect(safety.isSafe).toBe(false);
    expect(safety.blockingReasons).toContain('Student admission form');

    // User attempts to trigger update
    if (!safety.isSafe) {
      setUpdateDeferred(true);
    } else {
      setReloadRequested(true);
      waitingWorker.postMessage({ type: 'TUTORLY_ACTIVATE_UPDATE' });
    }

    expect(isDeferredUpdatePending()).toBe(true);
    expect(waitingWorker.postMessage).not.toHaveBeenCalled();
    expect(reloadCalled).toBe(false);
  });

  it('4. Update available during an in-flight mutation: reload is deferred', () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    };
    let reloadCalled = false;
    const reload = () => { reloadCalled = true; };

    // An API write mutation is started
    const endMutation = beginMutation('Payment transaction recording');
    const safety = getUpdateSafety();
    expect(safety.isSafe).toBe(false);
    expect(safety.activeMutationsCount).toBe(1);
    expect(safety.blockingReasons[0]).toContain('1 save operation in progress');

    // User attempts update while mutation is in flight
    if (!safety.isSafe) {
      setUpdateDeferred(true);
    } else {
      waitingWorker.postMessage({ type: 'TUTORLY_ACTIVATE_UPDATE' });
    }

    expect(isDeferredUpdatePending()).toBe(true);
    expect(waitingWorker.postMessage).not.toHaveBeenCalled();
    expect(reloadCalled).toBe(false);

    endMutation();
    expect(getUpdateSafety().isSafe).toBe(true);
  });

  it('5. Successful save clears the dirty state and allows a pending deferred update to proceed', () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    };
    let reloadCalled = false;

    // Attendance register has unsaved entries
    setFormDirty('attendance-register', true, 'Attendance register');
    setUpdateDeferred(true);

    // Subscriber reacts to safety changes
    const unsubscribe = subscribeUpdateSafety(() => {
      const current = getUpdateSafety();
      if (isDeferredUpdatePending() && current.isSafe) {
        setUpdateDeferred(false);
        setReloadRequested(true);
        waitingWorker.postMessage({ type: 'TUTORLY_ACTIVATE_UPDATE' });
        reloadCalled = true;
      }
    });

    expect(waitingWorker.postMessage).not.toHaveBeenCalled();
    expect(reloadCalled).toBe(false);

    // Attendance save succeeds: form dirty state is cleared
    setFormDirty('attendance-register', false, 'Attendance register');

    expect(getUpdateSafety().isSafe).toBe(true);
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'TUTORLY_ACTIVATE_UPDATE' });
    expect(reloadCalled).toBe(true);
    expect(isDeferredUpdatePending()).toBe(false);

    unsubscribe();
  });

  it('6. Explicitly discarding changes clears the dirty state and allows deferred update', () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    };
    let reloadCalled = false;

    // Fee payment modal opened
    setFormDirty('fee-payment', true, 'Fee payment submission');
    setUpdateDeferred(true);

    const unsubscribe = subscribeUpdateSafety(() => {
      const current = getUpdateSafety();
      if (isDeferredUpdatePending() && current.isSafe) {
        setUpdateDeferred(false);
        setReloadRequested(true);
        waitingWorker.postMessage({ type: 'TUTORLY_ACTIVATE_UPDATE' });
        reloadCalled = true;
      }
    });

    expect(waitingWorker.postMessage).not.toHaveBeenCalled();

    // User explicitly closes/cancels the payment modal (discard action)
    unregisterDirtyForm('fee-payment');

    expect(getUpdateSafety().isSafe).toBe(true);
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'TUTORLY_ACTIVATE_UPDATE' });
    expect(reloadCalled).toBe(true);

    unsubscribe();
  });

  it('7. Multiple update notifications/requests do not cause duplicate reloads', () => {
    let reloadCount = 0;
    let reloadExecuted = false;

    const safeReloadHandler = () => {
      if (isReloadRequested() && !reloadExecuted && getUpdateSafety().isSafe) {
        reloadExecuted = true;
        reloadCount++;
      }
    };

    setReloadRequested(true);

    // Simulate multiple controllerchange or update events
    safeReloadHandler();
    safeReloadHandler();
    safeReloadHandler();

    expect(reloadCount).toBe(1);
  });

  it('8. Service-worker activation does not trigger an unexpected reload if reload was not requested', () => {
    let reloadCalled = false;
    const reload = () => { reloadCalled = true; };

    // Controller changed without user asking for reload (e.g. background SW lifecycle)
    const handleControllerChange = () => {
      if (isReloadRequested() && getUpdateSafety().isSafe) {
        reload();
      }
    };

    handleControllerChange();
    expect(reloadCalled).toBe(false);
  });

  it('9. Cancelling a deferred update prevents unexpected automatic reload when forms are later saved', () => {
    const waitingWorker = {
      postMessage: vi.fn(),
    };

    setFormDirty('school-exam-marks', true, 'School examination marks');
    setUpdateDeferred(true);

    // User chooses to cancel the deferred update
    setUpdateDeferred(false);
    expect(isDeferredUpdatePending()).toBe(false);

    const unsubscribe = subscribeUpdateSafety(() => {
      const current = getUpdateSafety();
      if (isDeferredUpdatePending() && current.isSafe) {
        waitingWorker.postMessage({ type: 'TUTORLY_ACTIVATE_UPDATE' });
      }
    });

    // Form is saved later
    setFormDirty('school-exam-marks', false, 'School examination marks');

    expect(waitingWorker.postMessage).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('10. Service worker template preserves offline fallback and bypasses API/auth routes', () => {
    // API/auth traffic never touches Cache Storage
    expect(swTemplate).toContain("if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;");
    // Offline navigation fallback
    expect(swTemplate).toContain("const OFFLINE_URL = '/offline.html';");
    expect(swTemplate).toContain("if (request.mode === 'navigate')");
    // Explicit update activation message
    expect(swTemplate).toContain("event.data?.type === 'TUTORLY_ACTIVATE_UPDATE'");
    expect(swTemplate).toContain("self.skipWaiting()");
  });
});
