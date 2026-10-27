import { describe, expect, it } from 'vitest';
import {
  getAttendanceIdempotencyAttempt,
  isCurrentAttendanceLoad,
  isCurrentAttendanceScope,
  runAttendanceSubmission,
  type AttendanceSubmissionLock,
} from '../../src/utils/attendanceSubmission';
import {
  ATTENDANCE_ENROLLMENT_QUERY_CHUNK_SIZE,
  chunkAttendanceStudentIds,
} from '../../src/worker/routes/attendance';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('attendance save lifecycle', () => {
  it('activates saving synchronously, blocks a duplicate, and reports success only after confirmation', async () => {
    const lock: AttendanceSubmissionLock = { current: false };
    const response = deferred<{ success: boolean; sessionId: string }>();
    const events: string[] = [];
    let requests = 0;
    const callbacks = {
      onStart: () => events.push('saving'),
      onSuccess: () => events.push('success'),
      onFailure: () => events.push('error'),
      onFinish: () => events.push('finished'),
    };
    const submit = () => {
      requests += 1;
      return response.promise;
    };

    const first = runAttendanceSubmission(lock, submit, callbacks);
    expect(lock.current).toBe(true);
    expect(events).toEqual(['saving']);
    expect(await runAttendanceSubmission(lock, submit, callbacks)).toBe('duplicate');
    expect(requests).toBe(1);
    expect(events).not.toContain('success');

    response.resolve({ success: true, sessionId: 'session-1' });
    expect(await first).toBe('success');
    expect(events).toEqual(['saving', 'success', 'finished']);
    expect(lock.current).toBe(false);
  });

  it('releases the lock after API errors and rejects unconfirmed responses without success', async () => {
    const lock: AttendanceSubmissionLock = { current: false };
    const events: string[] = [];
    const callbacks = {
      onStart: () => events.push('saving'),
      onSuccess: () => events.push('success'),
      onFailure: () => events.push('error'),
      onFinish: () => events.push('finished'),
    };

    expect(await runAttendanceSubmission(lock, async () => { throw new Error('network error'); }, callbacks)).toBe('failure');
    expect(lock.current).toBe(false);
    expect(events).toEqual(['saving', 'error', 'finished']);

    events.length = 0;
    expect(await runAttendanceSubmission(lock, async () => ({ success: false, sessionId: '' }), callbacks)).toBe('failure');
    expect(events).toEqual(['saving', 'error', 'finished']);
    expect(lock.current).toBe(false);
  });

  it('reuses the idempotency key for an identical retry and replaces it for changed attendance', () => {
    const createKey = () => `key-${Math.random()}`;
    const original = getAttendanceIdempotencyAttempt(null, 'same-snapshot', createKey);
    expect(getAttendanceIdempotencyAttempt(original, 'same-snapshot', createKey)).toBe(original);
    const changed = getAttendanceIdempotencyAttempt(original, 'edited-snapshot', createKey);
    expect(changed.key).not.toBe(original.key);
  });

  it('ignores a delayed response from an obsolete institution, cohort, or newer request', () => {
    expect(isCurrentAttendanceScope('inst-a/class-a/batch-a/day-1', 'inst-b/class-b/batch-b/day-2')).toBe(false);
    expect(isCurrentAttendanceLoad(1, 2, 'inst-a/class-a', 'inst-a/class-a')).toBe(false);
    expect(isCurrentAttendanceLoad(2, 2, 'inst-b/class-b', 'inst-b/class-b')).toBe(true);
  });
});

describe('attendance enrollment query chunking', () => {
  it.each([
    [10, 10, 1],
    [50, 50, 1],
    [90, 90, 1],
    [91, 91, 2],
    [300, 300, 4],
    [500, 500, 6],
  ])('for %i students, replaces %i serial lookups with %i bulk queries', (studentCount, previousQueryCount, queryCount) => {
    const ids = Array.from({ length: studentCount }, (_, index) => `student-${index}`);
    const chunks = chunkAttendanceStudentIds(ids);
    expect(previousQueryCount).toBe(studentCount);
    expect(chunks).toHaveLength(queryCount);
    expect(chunks.flat()).toEqual(ids);
    expect(chunks.every((chunk) => chunk.length <= ATTENDANCE_ENROLLMENT_QUERY_CHUNK_SIZE)).toBe(true);
    expect(6 + ATTENDANCE_ENROLLMENT_QUERY_CHUNK_SIZE).toBeLessThanOrEqual(100);
  });
});
