import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SafetyController, calculateRandomDelay } from '../content/safety.js';

describe('Safety Controller', () => {
  let safety;
  const mockStorage = {};

  beforeEach(() => {
    safety = new SafetyController({
      dailyLimit: 5,
      minDelaySec: 60,
      maxDelaySec: 120,
      storage: {
        get: async (key) => mockStorage[key] || null,
        set: async (key, val) => { mockStorage[key] = val; }
      }
    });
  });

  describe('calculateRandomDelay', () => {
    it('should generate delay strictly within min and max seconds', () => {
      for (let i = 0; i < 50; i++) {
        const delayMs = calculateRandomDelay(30, 90);
        assert.ok(delayMs >= 30000, `Delay ${delayMs} should be >= 30000ms`);
        assert.ok(delayMs <= 90000, `Delay ${delayMs} should be <= 90000ms`);
      }
    });

    it('should use deterministic randomFn when provided', () => {
      const minDelay = calculateRandomDelay(10, 20, () => 0);
      assert.equal(minDelay, 10000);

      const maxDelay = calculateRandomDelay(10, 20, () => 1);
      assert.equal(maxDelay, 20000);
    });
  });

  describe('canComment and recordComment', () => {
    it('should allow first comment if within quota', () => {
      const check = safety.canComment('post_1', 1000000);
      assert.equal(check.allowed, true);
    });

    it('should prevent commenting on the same post twice', () => {
      const now = 1000000;
      safety.recordComment('post_1', 'Chào bạn', 'https://fb.com/1', now);

      const check = safety.canComment('post_1', now + 150000);
      assert.equal(check.allowed, false);
      assert.ok(check.reason.includes('đã bình luận'));
    });

    it('should enforce cooldown delay between consecutive comments', () => {
      const now = 1000000;
      safety.recordComment('post_1', 'Chào bạn', 'https://fb.com/1', now);

      // Attempting 10s later when min delay is 60s
      const checkTooSoon = safety.canComment('post_2', now + 10000);
      assert.equal(checkTooSoon.allowed, false);
      assert.ok(checkTooSoon.reason.includes('Cooldown') || checkTooSoon.reason.includes('Đang chờ'));

      // Attempting after cooldown expires (e.g. 130s later)
      const checkAfterCooldown = safety.canComment('post_2', now + 130000);
      assert.equal(checkAfterCooldown.allowed, true);
    });

    it('should block comments when daily quota is reached', () => {
      let time = 1000000;
      // Record 5 comments (dailyLimit is 5)
      for (let i = 1; i <= 5; i++) {
        safety.recordComment(`post_${i}`, `Comment ${i}`, `url_${i}`, time);
        time += 150000;
      }

      const checkExceeded = safety.canComment('post_6', time + 200000);
      assert.equal(checkExceeded.allowed, false);
      assert.ok(checkExceeded.reason.includes('giới hạn') || checkExceeded.reason.includes('quota'));
    });

    it('should reset quota when a new day arrives', () => {
      const today = '2026-10-22';
      const tomorrow = '2026-10-23';

      safety.currentDateStr = today;
      for (let i = 1; i <= 5; i++) {
        safety.recordComment(`post_${i}`, 'Hi', 'url', 1000000);
      }

      // Check today is blocked
      assert.equal(safety.canComment('post_6', 1000000).allowed, false);

      // Switch day to tomorrow
      safety.currentDateStr = tomorrow;
      safety.checkDateReset();

      // Now should be allowed again
      const checkTomorrow = safety.canComment('post_7', 2000000);
      assert.equal(checkTomorrow.allowed, true);
    });
  });
});
