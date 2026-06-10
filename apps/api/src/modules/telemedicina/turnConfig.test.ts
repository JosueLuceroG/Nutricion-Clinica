import { describe, expect, it } from 'vitest';
import { buildTurnConfig } from './turnConfig.js';

describe('buildTurnConfig', () => {
  it('returns default STUN when no env vars set', () => {
    const config = buildTurnConfig({});
    expect(config.configured).toBe(false);
    expect(config.iceServers).toHaveLength(1);
    expect(config.iceServers[0]!.urls).toContain('stun:stun.l.google.com:19302');
  });

  it('uses custom STUN URLs when provided', () => {
    const config = buildTurnConfig({ VITE_STUN_URLS: 'stun:custom1.example.com,stun:custom2.example.com' });
    expect(config.iceServers).toHaveLength(1);
    expect(config.iceServers[0]!.urls).toEqual(['stun:custom1.example.com', 'stun:custom2.example.com']);
  });

  it('includes TURN servers when configured', () => {
    const config = buildTurnConfig({
      VITE_STUN_URLS: 'stun:stun.example.com',
      VITE_TURN_URLS: 'turn:turn.example.com:3478',
      VITE_TURN_USERNAME: 'test-user',
      VITE_TURN_CREDENTIAL: 'test-pass',
    });
    expect(config.configured).toBe(true);
    expect(config.iceServers).toHaveLength(2);
    expect(config.iceServers[1]!.urls).toEqual(['turn:turn.example.com:3478']);
    expect(config.iceServers[1]!.username).toBe('test-user');
    expect(config.iceServers[1]!.credential).toBe('test-pass');
  });

  it('reports configured=false when no TURN URLs', () => {
    const config = buildTurnConfig({ VITE_STUN_URLS: 'stun:stun.example.com' });
    expect(config.configured).toBe(false);
    expect(config.iceServers).toHaveLength(1);
  });
});
