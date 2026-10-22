import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePost, normalizeText } from '../lib/filter-engine.js';

describe('Filter Engine', () => {
  const sampleConfig = {
    whitelistKeywords: [
      'tìm dev',
      'cần dev',
      'outsource',
      'freelance',
      'viết tool',
      'làm web',
      'làm app',
      'python',
      'react',
      'nodejs'
    ],
    blacklistKeywords: [
      'tuyển sinh',
      'khóa học',
      'bán acc',
      'tuyển dụng sale',
      'fulltime tại',
      'onsite',
      'đa cấp'
    ]
  };

  describe('normalizeText', () => {
    it('should lowercase and remove Vietnamese diacritics', () => {
      const raw = 'Tìm Dev Làm Web Tại Hà Nội';
      const normalized = normalizeText(raw);
      assert.equal(normalized, 'tim dev lam web tai ha noi');
    });
  });

  describe('evaluatePost', () => {
    it('should match a relevant job post and calculate positive match score', () => {
      const postText = 'Chào mọi người, bên mình đang cần tìm dev làm web bằng React và NodeJS gấp. Ai nhận ib nhé.';
      const res = evaluatePost(postText, sampleConfig);

      assert.equal(res.matched, true);
      assert.ok(res.score >= 70, `Score should be >= 70, got ${res.score}`);
      assert.ok(res.matchedWhitelist.length >= 2);
      assert.equal(res.matchedBlacklist.length, 0);
    });

    it('should match even without Vietnamese accents', () => {
      const postText = 'Minh can dev viet tool python cao data website, ai lam duoc inbox';
      const res = evaluatePost(postText, sampleConfig);

      assert.equal(res.matched, true);
      assert.ok(res.matchedWhitelist.includes('cần dev') || res.matchedWhitelist.includes('viết tool') || res.matchedWhitelist.includes('python'));
    });

    it('should reject a post if any blacklist keyword is present', () => {
      const postText = 'Khóa học React và NodeJS từ cơ bản đến nâng cao, cam kết việc làm fulltime tại công ty.';
      const res = evaluatePost(postText, sampleConfig);

      assert.equal(res.matched, false);
      assert.equal(res.score, 0);
      assert.ok(res.matchedBlacklist.includes('khóa học') || res.matchedBlacklist.includes('fulltime tại'));
      assert.ok(res.reason.includes('Blacklist'));
    });

    it('should reject a post if no whitelist keyword matches', () => {
      const postText = 'Hôm nay trời đẹp quá, có ai đi cafe không?';
      const res = evaluatePost(postText, sampleConfig);

      assert.equal(res.matched, false);
      assert.equal(res.score, 0);
      assert.equal(res.matchedWhitelist.length, 0);
      assert.ok(res.reason.includes('Không khớp từ khóa'));
    });

    it('should handle empty or whitespace post text gracefully', () => {
      const res = evaluatePost('   ', sampleConfig);
      assert.equal(res.matched, false);
      assert.equal(res.score, 0);
    });
  });
});
