import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, formatKeywordsInput } from '../lib/config-helper.js';

describe('Config Helper & Validation', () => {
  it('should format comma-separated and newline-separated keywords into clean array', () => {
    const raw = 'tìm dev, làm web\npython, react, ,  nodejs  ';
    const list = formatKeywordsInput(raw);
    assert.deepEqual(list, ['tìm dev', 'làm web', 'python', 'react', 'nodejs']);
  });

  it('should validate and clamp safety parameters safely', () => {
    const valid = validateConfig({
      dailyCommentLimit: 150, // should clamp or allow
      minCommentDelaySec: 5,   // too low, should clamp to minimum safe value (e.g. 30s)
      maxCommentDelaySec: 10
    });

    assert.ok(valid.minCommentDelaySec >= 30, 'minCommentDelaySec must be clamped to safe minimum');
    assert.ok(valid.maxCommentDelaySec >= valid.minCommentDelaySec, 'max must be >= min');
  });

  it('should validate and normalize scanScope correctly', () => {
    const cfg1 = validateConfig({ scanScope: 'feed_only' });
    assert.equal(cfg1.scanScope, 'feed_only');

    const cfg2 = validateConfig({ scanScope: 'groups_only' });
    assert.equal(cfg2.scanScope, 'groups_only');

    const cfg3 = validateConfig({ scanScope: 'invalid_scope' });
    assert.equal(cfg3.scanScope, 'all');

    const cfg4 = validateConfig({});
    assert.equal(cfg4.scanScope, 'all');
  });

  it('should validate and sanitize fanpageConfig correctly', () => {
    const valid = validateConfig({
      fanpageConfig: {
        pageId: ' 123456789 ',
        pageToken: ' EAAToken123 ',
        defaultTopic: 'web'
      }
    });

    assert.equal(valid.fanpageConfig.pageId, '123456789');
    assert.equal(valid.fanpageConfig.pageToken, 'EAAToken123');
    assert.equal(valid.fanpageConfig.defaultTopic, 'web');

    const empty = validateConfig({});
    assert.ok(empty.fanpageConfig);
    assert.equal(empty.fanpageConfig.pageId, '');
    assert.equal(empty.fanpageConfig.pageToken, '');
  });
});
