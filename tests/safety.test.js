import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SafetyController, calculateRandomDelay, isCommentedByMeInDOM } from '../content/safety.js';

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

  describe('Multi-tier Anti-Duplication Engine', () => {
    it('should prevent commenting on the same post twice by postId', () => {
      const now = 1000000;
      safety.recordComment('post_1', 'Chào bạn', 'https://fb.com/1', now);

      const check = safety.canComment('post_1', now + 150000);
      assert.equal(check.allowed, false);
      assert.ok(check.reason.includes('đã bình luận'));
    });

    it('should prevent commenting by matching postUrl even with different post id', () => {
      const now = 1000000;
      safety.recordComment(
        { id: 'post_1', postUrl: 'https://www.facebook.com/groups/123/posts/999/', authorName: 'A', postText: 'Hello' },
        'Chào bạn',
        '',
        now
      );

      // Same URL, different ID
      const check = safety.canComment(
        { id: 'post_diff_id', postUrl: 'https://www.facebook.com/groups/123/posts/999/', authorName: 'A', postText: 'Hello' },
        now + 150000
      );
      assert.equal(check.allowed, false);
      assert.ok(check.reason.includes('khớp URL bài viết'));
    });

    it('should prevent commenting if author and content hash match (re-posted or ID rotation)', () => {
      const now = 1000000;
      safety.recordComment(
        { id: 'post_1', postUrl: 'https://fb.com/1', authorName: 'Trần Văn Tuyển', postText: 'Cần tìm dev làm web NextJS và Tailwind' },
        'Chào bạn',
        '',
        now
      );

      // Different ID and URL, but exact same author and content
      const check = safety.canComment(
        { id: 'post_rotated_99', postUrl: 'https://fb.com/rotated', authorName: 'Trần Văn Tuyển', postText: 'Cần tìm dev làm web NextJS và Tailwind' },
        now + 150000
      );
      assert.equal(check.allowed, false);
      assert.ok(check.reason.includes('trùng nội dung'));
    });

    it('should detect existing comments by my identity directly from post DOM element', () => {
      const mockElement = {
        querySelectorAll() {
          return [
            { textContent: 'Tech Agency' },
            { textContent: 'Chào bạn, bên mình nhận làm nhé' }
          ];
        }
      };

      const isCommented = isCommentedByMeInDOM(mockElement, 'Tech Agency');
      assert.equal(isCommented, true);

      const check = safety.canComment({ id: 'new_post', element: mockElement }, Date.now(), 'Tech Agency');
      assert.equal(check.allowed, false);
      assert.ok(check.reason.includes('trong DOM'));
    });

    it('should correctly hydrate history whether stored with "id" or "postId"', () => {
      safety.loadHistory([
        { id: 'hist_1', postUrl: 'https://fb.com/hist1', authorName: 'User 1', postText: 'Tìm dev Flutter' },
        { postId: 'hist_2', postUrl: 'https://fb.com/hist2', authorName: 'User 2', postText: 'Tìm dev Python' }
      ]);

      assert.equal(safety.canComment('hist_1', Date.now()).allowed, false);
      assert.equal(safety.canComment('hist_2', Date.now()).allowed, false);
      assert.equal(safety.canComment({ postUrl: 'https://fb.com/hist1' }, Date.now()).allowed, false);
    });
  });

  describe('Cooldown & Quota Limits', () => {
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
