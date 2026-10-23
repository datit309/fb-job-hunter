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

  it('should validate and sanitize campaignConfig correctly', () => {
    const valid = validateConfig({
      campaignConfig: {
        postsCount: 14,
        defaultContact: '  0987654321  ',
        defaultHighlights: '  Next.js, Flutter  '
      }
    });

    assert.equal(valid.campaignConfig.postsCount, 14);
    assert.equal(valid.campaignConfig.defaultContact, '0987654321');
    assert.equal(valid.campaignConfig.defaultHighlights, 'Next.js, Flutter');

    const clamped = validateConfig({
      campaignConfig: {
        postsCount: 999
      }
    });
    assert.equal(clamped.campaignConfig.postsCount, 30);
  });

  it('should validate and sanitize aiConfig with custom endpoint and model correctly', () => {
    const valid = validateConfig({
      aiConfig: {
        enabled: true,
        provider: 'custom',
        apiKey: '  sk-secret  ',
        customEndpoint: '  https://api.groq.com/openai/v1/chat/completions  ',
        customModel: '  llama-3.3-70b-versatile  ',
        customPrompt: '  Viết ngắn gọn  '
      }
    });

    assert.equal(valid.aiConfig.enabled, true);
    assert.equal(valid.aiConfig.provider, 'custom');
    assert.equal(valid.aiConfig.apiKey, 'sk-secret');
    assert.equal(valid.aiConfig.customEndpoint, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(valid.aiConfig.customModel, 'llama-3.3-70b-versatile');
    assert.equal(valid.aiConfig.customPrompt, 'Viết ngắn gọn');

    const empty = validateConfig({});
    assert.ok(empty.aiConfig);
    assert.equal(empty.aiConfig.enabled, false);
    assert.equal(empty.aiConfig.provider, 'deepseek');
    assert.equal(empty.aiConfig.customEndpoint, '');
    assert.equal(empty.aiConfig.customModel, '');
  });

  it('should validate and sanitize plannerConfig correctly', () => {
    const valid = validateConfig({
      plannerConfig: {
        targetType: 'composer',
        customUrl: '  https://www.facebook.com/my-page  '
      }
    });
    assert.equal(valid.plannerConfig.targetType, 'composer');
    assert.equal(valid.plannerConfig.customUrl, 'https://www.facebook.com/my-page');

    const fallback = validateConfig({
      plannerConfig: {
        targetType: 'invalid_type'
      }
    });
    assert.equal(fallback.plannerConfig.targetType, 'planner');
  });
});

