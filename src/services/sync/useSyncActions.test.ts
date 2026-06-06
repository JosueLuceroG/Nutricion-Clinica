import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const { getSyncEngineMock, useAuthStoreMock, useSyncStoreMock } = vi.hoisted(() => ({
  getSyncEngineMock: vi.fn(),
  useAuthStoreMock: Object.assign(vi.fn(), { getState: vi.fn().mockReturnValue({ isAuthenticated: false }) }),
  useSyncStoreMock: Object.assign(vi.fn(), {
    getState: vi.fn().mockReturnValue({
      setPendingChanges: vi.fn(),
      setStatus: vi.fn(),
      setLastSync: vi.fn(),
      setLastError: vi.fn(),
    }),
  }),
}));

vi.mock('./syncBootstrap.js', () => ({
  getSyncEngine: getSyncEngineMock,
}));

vi.mock('@store/authStore', () => ({
  useAuthStore: useAuthStoreMock,
}));

vi.mock('@store/syncStore', () => ({
  useSyncStore: useSyncStoreMock,
}));

import { useSyncActions } from './useSyncActions.js';

describe('useSyncActions', () => {
  it('retorna conflictCount y syncNow', () => {
    useAuthStoreMock.mockImplementation((sel: (s: { isAuthenticated: boolean }) => unknown) =>
      sel({ isAuthenticated: true }),
    );
    useSyncStoreMock.mockImplementation((sel: (s: { setPendingChanges: () => void }) => unknown) =>
      sel({ setPendingChanges: vi.fn() }),
    );
    getSyncEngineMock.mockReturnValue({ sync: vi.fn().mockResolvedValue(undefined) });
    const { result } = renderHook(() => useSyncActions());
    expect(typeof result.current.conflictCount).toBe('number');
    expect(typeof result.current.syncNow).toBe('function');
  });

  it('syncNow: si no hay auth, no llama al engine', async () => {
    useAuthStoreMock.mockImplementation((sel: (s: { isAuthenticated: boolean }) => unknown) =>
      sel({ isAuthenticated: false }),
    );
    useSyncStoreMock.mockImplementation((sel: (s: { setPendingChanges: () => void }) => unknown) =>
      sel({ setPendingChanges: vi.fn() }),
    );
    const { result } = renderHook(() => useSyncActions());
    await result.current.syncNow();
    expect(getSyncEngineMock).not.toHaveBeenCalled();
  });
});
