/**
 * Facebook Group DOM Scanner and Post Extractor
 * Extracts post ID, author, body text, permalink, and comment trigger targets.
 * Resilient against Facebook's dynamic CSS classes using semantic ARIA attributes.
 */

/**
 * Fast string hash for generating unique post IDs when permalink is unavailable
 */
export function generatePostId(author, text) {
  const str = `${author || 'anon'}::${(text || '').slice(0, 150)}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fb_post_${(hash >>> 0).toString(16)}`;
}

/**
 * Detect if a Facebook feed element is a Sponsored advertisement
 */
export function isSponsoredPost(el) {
  if (!el || typeof el.querySelector !== 'function') return false;

  // Direct aria-label or link check
  if (
    el.querySelector('[aria-label="Được tài trợ"], [aria-label="Sponsored"]') ||
    el.querySelector('a[href*="/ads/about"], a[href*="facebook.com/ads/"]')
  ) {
    return true;
  }

  // Header span check
  const header = el.querySelector('h2, h3, h4, [role="heading"]');
  if (header) {
    const headerParent = header.parentElement;
    if (headerParent) {
      const text = headerParent.textContent?.toLowerCase() || '';
      if (text.includes('được tài trợ') || text.includes('sponsored')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract author name from post element
 */
function extractAuthor(el) {
  const authorCandidates = [
    'h2 strong a',
    'h3 strong a',
    'h4 strong a',
    'h2 a[role="link"]',
    'h3 a[role="link"]',
    'h4 a[role="link"]',
    'h2 a',
    'h3 a',
    'h4 a',
    'h2 span a',
    'h3 span a',
    'h4 span a',
    'strong a',
    'a[role="link"] strong',
    'strong span'
  ];

  for (const sel of authorCandidates) {
    const node = el.querySelector(sel);
    if (node && node.textContent && node.textContent.trim().length > 1) {
      return node.textContent.trim();
    }
  }

  // Fallback: look for first link with meaningful text
  const links = el.querySelectorAll ? el.querySelectorAll('a[role="link"]') : [];
  for (const link of links) {
    const text = link.textContent ? link.textContent.trim() : '';
    if (text.length > 2 && text.length < 50 && !text.includes('·') && !text.includes('phút') && !text.includes('giờ')) {
      return text;
    }
  }

  return 'Khách hàng';
}

/**
 * Extract post permalink URL
 */
function extractPostUrl(el) {
  const linkSelectors = [
    'a[href*="/posts/"]',
    'a[href*="/permalink/"]',
    'a[href*="permalink.php"]',
    'a[href*="story_fbid="]',
    'a[href*="multi_permalinks="]',
    'a[href*="fbid="]',
    'a[href*="/groups/"]'
  ];

  for (const sel of linkSelectors) {
    const link = el.querySelector(sel);
    if (link) {
      const href = link.getAttribute('href');
      if (href) {
        if (href.startsWith('http')) return href;
        return `https://www.facebook.com${href}`;
      }
    }
  }

  return window?.location?.href || '';
}

/**
 * Expand "Xem thêm" / "See more" if collapsed
 */
export function expandTruncatedText(el) {
  try {
    const buttons = el.querySelectorAll ? el.querySelectorAll('[role="button"]') : [];
    for (const btn of buttons) {
      const text = btn.textContent ? btn.textContent.toLowerCase() : '';
      if (text.includes('xem thêm') || text.includes('see more')) {
        btn.click();
        break;
      }
    }
  } catch {
    // Ignore DOM interaction errors
  }
}

/**
 * Extract post text body
 */
function extractPostText(el) {
  expandTruncatedText(el);

  // High priority selector: Facebook Comet post body
  const previewMsg = el.querySelector ? (
    el.querySelector('[data-ad-comet-preview="message"]') ||
    el.querySelector('[data-ad-preview="message"]')
  ) : null;
  if (previewMsg && previewMsg.textContent && previewMsg.textContent.trim().length > 5) {
    return previewMsg.textContent.trim();
  }

  // Look for text container with dir="auto" (div, span, or p)
  const textContainers = el.querySelectorAll ? el.querySelectorAll('div[dir="auto"], span[dir="auto"], p[dir="auto"]') : [];
  let longestText = '';

  for (const container of textContainers) {
    const text = container.textContent ? container.textContent.trim() : '';
    // Avoid small metadata like "10 bình luận", "Thích", "Chia sẻ", " người khác"
    if (
      text.length > longestText.length &&
      !text.startsWith('Thích') &&
      !text.startsWith('Bình luận') &&
      !text.startsWith('Chia sẻ') &&
      !text.includes(' người khác')
    ) {
      longestText = text;
    }
  }

  return longestText;
}

/**
 * Extracts structured data from a Facebook post container element
 * @param {Element} element - Post DOM element
 * @returns {object|null}
 */
export function extractPostData(element) {
  if (!element || typeof element.querySelector !== 'function') {
    return null;
  }

  // Skip sponsored advertising posts (crucial on News Feed)
  if (isSponsoredPost(element)) {
    return null;
  }

  const text = extractPostText(element);
  if (!text || text.length < 10) {
    return null;
  }

  const author = extractAuthor(element);
  const url = extractPostUrl(element);

  // Try to find native post ID from URL
  let id = '';
  const postMatch =
    url.match(/\/posts\/(\d+)/) ||
    url.match(/\/permalink\/(\d+)/) ||
    url.match(/multi_permalinks=(\d+)/) ||
    url.match(/story_fbid=(\d+)/) ||
    url.match(/fbid=(\d+)/);

  if (postMatch && postMatch[1]) {
    id = `fb_${postMatch[1]}`;
  } else {
    id = generatePostId(author, text);
  }

  return {
    id,
    authorName: author,
    postText: text,
    postUrl: url,
    element
  };
}

/**
 * Scan all post elements currently rendered in Facebook feed
 * @param {Element|Document} root - Root element to query within
 * @returns {Array<object>} List of extracted posts
 */
export function scanFeed(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return [];
  }

  const postSelectors = [
    '[role="feed"] > div',
    '[role="article"]',
    'div[data-pagelet^="FeedUnit"]',
    'div.x1yztbdb',
    'div[data-virtualized="false"]'
  ];

  const foundElements = new Set();
  for (const sel of postSelectors) {
    const items = root.querySelectorAll(sel);
    for (const item of items) {
      foundElements.add(item);
    }
  }

  const extracted = [];
  for (const el of foundElements) {
    const data = extractPostData(el);
    if (data) {
      extracted.push(data);
    }
  }

  return extracted;
}
