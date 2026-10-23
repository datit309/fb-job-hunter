/**
 * Safety and Anti-Ban Rate Limiting Controller
 * Manages human-like cooldown delays, daily comment quotas, and 4-tier persistent deduplication.
 */

export function calculateRandomDelay(minSec, maxSec, randomFn = Math.random) {
  const min = Math.min(minSec, maxSec);
  const max = Math.max(minSec, maxSec);
  const val = min + (max - min) * randomFn();
  return Math.round(val * 1000);
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeContentHash(author, text) {
  const str = `${(author || 'anon').trim().toLowerCase()}::${(text || '').trim().slice(0, 150).toLowerCase()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `hash_${(hash >>> 0).toString(16)}`;
}

/**
 * Checks if the current Page or User has already commented on this post element in DOM
 */
export function isCommentedByMeInDOM(element, myIdentity = null) {
  if (!element || typeof element.querySelectorAll !== 'function') return false;

  if (myIdentity && typeof myIdentity === 'string' && myIdentity.trim().length > 1) {
    const normMyId = myIdentity.trim().toLowerCase();
    const commentNodes = element.querySelectorAll('a[role="link"], span, h3, h4');
    for (const node of commentNodes) {
      const text = (node.textContent || '').trim().toLowerCase();
      if (text === normMyId) {
        return true;
      }
    }
  }

  return false;
}

export class SafetyController {
  constructor(options = {}) {
    this.dailyLimit = options.dailyLimit ?? 30;
    this.minDelaySec = options.minDelaySec ?? 60;
    this.maxDelaySec = options.maxDelaySec ?? 180;
    this.storage = options.storage || null;

    this.commentedPosts = new Map(); // postId -> record
    this.commentedUrls = new Set();  // Set of post URLs
    this.commentedHashes = new Set();// Set of author+text content hashes

    this.todayCommentCount = 0;
    this.lastCommentTime = 0;
    this.nextAvailableTime = 0;
    this.currentDateStr = getTodayString();
  }

  checkDateReset() {
    const today = this.currentDateStr || getTodayString();
    if (this.lastRecordedDay && this.lastRecordedDay !== today) {
      this.todayCommentCount = 0;
      this.lastRecordedDay = today;
    }
  }

  /**
   * Check whether a post can be commented on (Multi-tier Anti-Duplication & Safety checks)
   * @param {string|object} postOrId - Post ID or full post object
   * @param {number} now - Timestamp
   * @param {string} myIdentity - Current Page/User commenting name
   */
  canComment(postOrId, now = Date.now(), myIdentity = null) {
    this.checkDateReset();

    let postId = '';
    let postUrl = '';
    let postText = '';
    let authorName = '';
    let element = null;

    if (typeof postOrId === 'string') {
      postId = postOrId;
    } else if (postOrId && typeof postOrId === 'object') {
      postId = postOrId.id || postOrId.postId || '';
      postUrl = postOrId.postUrl || '';
      postText = postOrId.postText || '';
      authorName = postOrId.authorName || '';
      element = postOrId.element || null;
    }

    // 1. Tier 1: Post ID Duplicate Check
    if (postId && this.commentedPosts.has(postId)) {
      return {
        allowed: false,
        reason: `Bài viết [${postId}] đã bình luận trước đó (khớp Post ID)`
      };
    }

    // 2. Tier 2: Post URL Duplicate Check
    if (postUrl && this.commentedUrls.has(postUrl)) {
      return {
        allowed: false,
        reason: `Bài viết đã bình luận trước đó (khớp URL bài viết)`
      };
    }

    // 3. Tier 3: Content Hash Duplicate Check (Chống bài đăng lại hoặc xoay ID)
    if (postText) {
      const hash = computeContentHash(authorName, postText);
      if (this.commentedHashes.has(hash)) {
        return {
          allowed: false,
          reason: `Bài viết trùng nội dung của tác giả "${authorName || 'Khách'}" đã bình luận trước đó`
        };
      }
    }

    // 4. Tier 4: In-DOM Commenter Check (Phát hiện comment của Page/User đã tồn tại trên giao diện)
    if (element && isCommentedByMeInDOM(element, myIdentity)) {
      // Mark as already commented so we don't scan it again
      if (postId) {
        this.commentedPosts.set(postId, { postId, timestamp: now, reason: 'dom_detected' });
      }
      return {
        allowed: false,
        reason: `Đã có bình luận của bạn trên bài viết này trong DOM`
      };
    }

    // 5. Daily Comment Limit Check
    if (this.todayCommentCount >= this.dailyLimit) {
      return {
        allowed: false,
        reason: `Đã đạt giới hạn quota hôm nay (${this.todayCommentCount}/${this.dailyLimit} bình luận)`
      };
    }

    // 6. Human-like Cooldown Delay Check
    if (now < this.nextAvailableTime) {
      const waitSec = Math.ceil((this.nextAvailableTime - now) / 1000);
      return {
        allowed: false,
        reason: `Đang chờ Cooldown an toàn (còn ${waitSec}s)`
      };
    }

    return { allowed: true };
  }

  /**
   * Record a newly posted comment
   */
  recordComment(postOrId, commentText, postUrlInput = '', now = Date.now()) {
    this.checkDateReset();
    this.lastRecordedDay = this.currentDateStr || getTodayString();

    let postId = '';
    let postUrl = postUrlInput;
    let authorName = '';
    let postText = '';

    if (typeof postOrId === 'string') {
      postId = postOrId;
    } else if (postOrId && typeof postOrId === 'object') {
      postId = postOrId.id || postOrId.postId || '';
      postUrl = postUrlInput || postOrId.postUrl || '';
      authorName = postOrId.authorName || '';
      postText = postOrId.postText || '';
    }

    const record = {
      postId,
      authorName,
      commentText,
      postUrl,
      timestamp: now
    };

    if (postId) {
      this.commentedPosts.set(postId, record);
    }
    if (postUrl) {
      this.commentedUrls.add(postUrl);
    }
    if (postText) {
      const hash = computeContentHash(authorName, postText);
      this.commentedHashes.add(hash);
    }

    this.todayCommentCount++;
    this.lastCommentTime = now;

    const delayMs = calculateRandomDelay(this.minDelaySec, this.maxDelaySec);
    this.nextAvailableTime = now + delayMs;

    return {
      recorded: true,
      nextAvailableTime: this.nextAvailableTime,
      todayCount: this.todayCommentCount
    };
  }

  exportHistory() {
    return Array.from(this.commentedPosts.values());
  }

  /**
   * Hydrate previous comment history from persistent storage
   */
  loadHistory(historyList = []) {
    if (Array.isArray(historyList)) {
      for (const item of historyList) {
        if (!item) continue;
        const pid = item.id || item.postId;
        if (pid) {
          this.commentedPosts.set(pid, item);
        }
        if (item.postUrl) {
          this.commentedUrls.add(item.postUrl);
        }
        if (item.postText) {
          const hash = computeContentHash(item.authorName || '', item.postText);
          this.commentedHashes.add(hash);
        }
      }
    }
  }
}
