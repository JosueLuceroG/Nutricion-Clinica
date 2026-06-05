import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const { getSyncEngineMock, isAuthSelector, conflictCountSel } = vi.hoisted(() => ({
  getSyncEngineMock: vi.fn(),
  isAuthSelector: vi.fn(),
  conflictCountSel: vi.fn(),
}));

vi.mock('./syncBootstrap.js', () => ({
  getSyncEngine: getSyncEngineMock,
}));

vi.mock('@store/authStore', () => ({
  useAuthStore: isAuthSelector,
}));

vi.mock('@store/syncStore', () => ({
  useSyncStore: conflictCountSel,
}));

import { useSyncActions } from './useSyncActions.js';

describe('useSyncActions', () => {
  it('retorna conflictCount y pendingCount como n\u00fameros', () => {
    isAuthSelector.mockReturnValue(true);
    conflictCountSel.mockReturnValue(0);
    getSyncEngineMock.mockReturnValue({ sync: vi.fn().mockResolvedValue(undefined) });
    const { result } = renderHook(() => useSyncActions());
    expect(typeof result.current.conflictCount).toBe('number');
    expect(typeof result.current.syncNow).toBe('function');
  });

  it('syncNow: si no hay auth, no llama al engine', async () => {
    isAuthSelector.mockReturnValue(false);
    conflictCountSel.mockReturnValue(0);
    const { result } = renderHook(() => useSyncActions());
    await result.current.syncNow();
    expect(getSyncEngineMock).not.toHaveBeenCalled();
  });
});
