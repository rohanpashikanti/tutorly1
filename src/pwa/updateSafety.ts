import { useEffect } from 'react';

export interface UpdateSafetyStatus {
  isSafe: boolean;
  blockingReasons: string[];
  dirtyForms: Array<{ id: string; description: string }>;
  activeMutationsCount: number;
}

const dirtyForms = new Map<string, string>();
let activeMutationsCount = 0;
let isUpdateDeferred = false;
let reloadRequested = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch (e) {
      console.error('Error in update safety listener:', e);
    }
  }
}

export function setFormDirty(id: string, isDirty: boolean, description: string): void {
  const current = dirtyForms.get(id);
  if (isDirty) {
    if (current !== description) {
      dirtyForms.set(id, description);
      notifyListeners();
    }
  } else {
    if (current !== undefined) {
      dirtyForms.delete(id);
      notifyListeners();
    }
  }
}

export function unregisterDirtyForm(id: string): void {
  if (dirtyForms.has(id)) {
    dirtyForms.delete(id);
    notifyListeners();
  }
}

export function beginMutation(description = 'Saving changes'): () => void {
  activeMutationsCount += 1;
  notifyListeners();
  let finished = false;
  return () => {
    if (!finished) {
      finished = true;
      activeMutationsCount = Math.max(0, activeMutationsCount - 1);
      notifyListeners();
    }
  };
}

export function getActiveMutationsCount(): number {
  return activeMutationsCount;
}

export function getUpdateSafety(): UpdateSafetyStatus {
  const reasons: string[] = [];
  for (const [, desc] of dirtyForms) {
    reasons.push(desc);
  }
  if (activeMutationsCount > 0) {
    reasons.push(`${activeMutationsCount} save operation${activeMutationsCount > 1 ? 's' : ''} in progress`);
  }
  return {
    isSafe: dirtyForms.size === 0 && activeMutationsCount === 0,
    blockingReasons: reasons,
    dirtyForms: Array.from(dirtyForms.entries()).map(([id, description]) => ({ id, description })),
    activeMutationsCount,
  };
}

export function subscribeUpdateSafety(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setUpdateDeferred(deferred: boolean): void {
  if (isUpdateDeferred !== deferred) {
    isUpdateDeferred = deferred;
    notifyListeners();
  }
}

export function isDeferredUpdatePending(): boolean {
  return isUpdateDeferred;
}

export function setReloadRequested(requested: boolean): void {
  reloadRequested = requested;
}

export function isReloadRequested(): boolean {
  return reloadRequested;
}

export function resetUpdateSafetyForTesting(): void {
  dirtyForms.clear();
  activeMutationsCount = 0;
  isUpdateDeferred = false;
  reloadRequested = false;
  listeners.clear();
}

/**
 * React hook to register dirty form state with automatic cleanup on unmount or form reset.
 */
export function useTrackDirtyForm(id: string, isDirty: boolean, description: string): void {
  useEffect(() => {
    setFormDirty(id, isDirty, description);
    return () => {
      unregisterDirtyForm(id);
    };
  }, [id, isDirty, description]);
}
