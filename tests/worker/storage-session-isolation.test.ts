import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activateVerifiedStorageScope,
  clearAllStoredBusinessData,
  clearLegacyStoredBusinessData,
  getStoredData,
  isStorageScopeCurrent,
  setStoredData,
  STORAGE_KEYS,
} from '../../src/utils/storage';
import { api, setApiSessionScope } from '../../src/api/client';
import worker from '../../src/worker/index';
import { env } from 'cloudflare:workers';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const userA = { userId: 'user-a', institutionId: 'school-a', role: 'admin' };
const userB = { userId: 'user-b', institutionId: 'school-a', role: 'teacher' };
const schoolB = { userId: 'user-a', institutionId: 'school-b', role: 'admin' };

afterEach(() => {
  activateVerifiedStorageScope(null);
  setApiSessionScope(null);
  vi.unstubAllGlobals();
});

describe('private browser cache isolation', () => {
  it('does not expose a prior user, role, or institution cache and clears scoped private data on logout', () => {
    const storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    setStoredData(STORAGE_KEYS.STUDENTS, [{ id: 'private-student-a' }]);
    expect(getStoredData(STORAGE_KEYS.STUDENTS, [])).toEqual([]);

    const userAToken = activateVerifiedStorageScope(userA);
    setStoredData(STORAGE_KEYS.STUDENTS, [{ id: 'private-student-a' }]);
    expect(getStoredData(STORAGE_KEYS.STUDENTS, [])).toEqual([{ id: 'private-student-a' }]);

    activateVerifiedStorageScope(userB);
    expect(getStoredData(STORAGE_KEYS.STUDENTS, [])).toEqual([]);
    activateVerifiedStorageScope(schoolB);
    expect(getStoredData(STORAGE_KEYS.STUDENTS, [])).toEqual([]);
    expect(isStorageScopeCurrent(userAToken)).toBe(false);

    storage.setItem('tutorly_theme', 'dark');
    clearAllStoredBusinessData();
    expect(storage.getItem('tutorly_theme')).toBe('dark');
    activateVerifiedStorageScope(userA);
    expect(getStoredData(STORAGE_KEYS.STUDENTS, [])).toEqual([]);
  });

  it('removes legacy business keys while preserving unrelated preferences', () => {
    const storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    storage.setItem(STORAGE_KEYS.STUDENTS, '[{"id":"legacy-private"}]');
    storage.setItem(STORAGE_KEYS.INSTITUTION_SETTINGS, '{"name":"legacy"}');
    storage.setItem('tutorly_theme', 'dark');
    clearLegacyStoredBusinessData();
    expect(storage.getItem(STORAGE_KEYS.STUDENTS)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.INSTITUTION_SETTINGS)).toBeNull();
    expect(storage.getItem('tutorly_theme')).toBe('dark');
  });

  it('ignores an API response that resolves after the verified session changes', async () => {
    let resolveFetch!: (response: Response) => void;
    const mockedFetch = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', mockedFetch);
    setApiSessionScope('session-a:school-a:admin');
    const pending = api.students.list('school-a');
    setApiSessionScope('session-b:school-a:teacher');
    resolveFetch(new Response(JSON.stringify({ students: [{ id: 'private-student-a' }], total: 1 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed for private API requests before a verified session scope exists', async () => {
    const mockedFetch = vi.fn();
    vi.stubGlobal('fetch', mockedFetch);
    await expect(api.students.list('school-a')).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('sets no-store headers on Worker API responses', async () => {
    const response = await worker.fetch(new Request('http://local/api/health'), env, {} as ExecutionContext);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });
});
