export interface AttendanceSubmissionLock {
  current: boolean;
}

export interface AttendanceSaveResponse {
  success: boolean;
  sessionId: string;
}

export type AttendanceSaveOutcome = 'duplicate' | 'success' | 'failure';

export function isCurrentAttendanceScope(capturedScope: string, activeScope: string): boolean {
  return capturedScope === activeScope;
}

export function isCurrentAttendanceLoad(
  requestId: number,
  activeRequestId: number,
  capturedScope: string,
  activeScope: string,
): boolean {
  return requestId === activeRequestId && isCurrentAttendanceScope(capturedScope, activeScope);
}

export async function runAttendanceSubmission(
  lock: AttendanceSubmissionLock,
  submit: () => Promise<AttendanceSaveResponse>,
  callbacks: {
    onStart: () => void;
    onSuccess: (response: AttendanceSaveResponse) => void;
    onFailure: (error: unknown) => void;
    onFinish: () => void;
  },
): Promise<AttendanceSaveOutcome> {
  if (lock.current) return 'duplicate';

  lock.current = true;
  try {
    callbacks.onStart();
    const response = await submit();
    if (!response || response.success !== true || typeof response.sessionId !== 'string' || !response.sessionId) {
      throw new Error('The server did not confirm that attendance was saved. Please retry.');
    }
    callbacks.onSuccess(response);
    return 'success';
  } catch (error) {
    callbacks.onFailure(error);
    return 'failure';
  } finally {
    lock.current = false;
    callbacks.onFinish();
  }
}

export interface AttendanceIdempotencyAttempt {
  fingerprint: string;
  key: string;
}

export function getAttendanceIdempotencyAttempt(
  current: AttendanceIdempotencyAttempt | null,
  fingerprint: string,
  createKey: () => string,
): AttendanceIdempotencyAttempt {
  if (current?.fingerprint === fingerprint) return current;
  return { fingerprint, key: createKey() };
}
