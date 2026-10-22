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
});
