/**
 * Configuration Helper & Sanitizer
 */

export function formatKeywordsInput(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

export function validateConfig(config = {}) {
  const safe = { ...config };

  // Safety clamps: Minimum 30s delay to avoid Facebook immediate bot detection
  const minDelay = Number(safe.minCommentDelaySec) || 60;
  safe.minCommentDelaySec = Math.max(30, minDelay);

  const maxDelay = Number(safe.maxCommentDelaySec) || 180;
  safe.maxCommentDelaySec = Math.max(safe.minCommentDelaySec, maxDelay);

  const dailyLimit = Number(safe.dailyCommentLimit) || 30;
  safe.dailyCommentLimit = Math.min(200, Math.max(1, dailyLimit));

  // Validate scanScope: 'all' | 'feed_only' | 'groups_only'
  const allowedScopes = ['all', 'feed_only', 'groups_only'];
  safe.scanScope = allowedScopes.includes(safe.scanScope) ? safe.scanScope : 'all';

  // Validate fanpageConfig
  const rawFp = safe.fanpageConfig || {};
  safe.fanpageConfig = {
    pageId: (rawFp.pageId || '').trim(),
    pageToken: (rawFp.pageToken || '').trim(),
    defaultTopic: rawFp.defaultTopic || 'general'
  };

  return safe;
}
