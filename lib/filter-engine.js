/**
 * Filter Engine for Facebook Job Posts
 * Performs keyword filtering with Vietnamese accent normalization,
 * whitelist validation, blacklist rejection, and relevance scoring.
 */

export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a haystack contains a needle either literally or normalized
 */
function textContains(rawHaystack, normalizedHaystack, keyword) {
  const rawLower = rawHaystack.toLowerCase();
  const kwLower = keyword.toLowerCase();
  if (rawLower.includes(kwLower)) return true;

  const normalizedKw = normalizeText(keyword);
  if (normalizedKw && normalizedHaystack.includes(normalizedKw)) return true;

  return false;
}

/**
 * Evaluate a Facebook post against configured whitelist and blacklist
 * @param {string} postText - Content of the post
 * @param {object} config - Configuration object with whitelistKeywords and blacklistKeywords
 * @returns {object} Evaluation result
 */
export function evaluatePost(postText, config = {}) {
  const result = {
    matched: false,
    score: 0,
    matchedWhitelist: [],
    matchedBlacklist: [],
    reason: ''
  };

  if (!postText || typeof postText !== 'string' || postText.trim().length === 0) {
    result.reason = 'Nội dung bài viết rỗng';
    return result;
  }

  const rawText = postText;
  const normText = normalizeText(rawText);

  const whitelist = Array.isArray(config.whitelistKeywords) ? config.whitelistKeywords : [];
  const blacklist = Array.isArray(config.blacklistKeywords) ? config.blacklistKeywords : [];

  // 1. Check Blacklist first (immediate rejection)
  for (const kw of blacklist) {
    if (!kw || typeof kw !== 'string') continue;
    if (textContains(rawText, normText, kw.trim())) {
      result.matchedBlacklist.push(kw.trim());
    }
  }

  if (result.matchedBlacklist.length > 0) {
    result.matched = false;
    result.score = 0;
    result.reason = `Chứa từ khóa Blacklist: [${result.matchedBlacklist.join(', ')}]`;
    return result;
  }

  // 2. Check Whitelist
  for (const kw of whitelist) {
    if (!kw || typeof kw !== 'string') continue;
    if (textContains(rawText, normText, kw.trim())) {
      result.matchedWhitelist.push(kw.trim());
    }
  }

  if (result.matchedWhitelist.length === 0) {
    result.matched = false;
    result.score = 0;
    result.reason = 'Không khớp từ khóa Whitelist nào';
    return result;
  }

  // 3. Calculate Score
  let score = 50; // Base score for 1 match
  const count = result.matchedWhitelist.length;

  if (count === 2) {
    score = 75;
  } else if (count === 3) {
    score = 88;
  } else if (count >= 4) {
    score = 95;
  }

  // Bonus points for strong hiring intent signals
  const intentSignals = ['gap', 'can tim', 'inbox', 'ib', 'kinh phi', 'budget', 'trao doi', 'gia'];
  let intentBonus = 0;
  for (const signal of intentSignals) {
    if (normText.includes(signal)) {
      intentBonus += 3;
    }
  }

  result.score = Math.min(100, score + intentBonus);
  result.matched = true;
  result.reason = `Khớp ${count} từ khóa: [${result.matchedWhitelist.join(', ')}]`;

  return result;
}
