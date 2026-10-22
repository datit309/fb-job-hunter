/**
 * Safety and Anti-Ban Rate Limiting Controller
 * Manages human-like cooldown delays, daily comment quotas, and persistent deduplication.
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

export class SafetyController {
  constructor(options = {}) {
    this.dailyLimit = options.dailyLimit ?? 30;
    this.minDelaySec = options.minDelaySec ?? 60;
    this.maxDelaySec = options.maxDelaySec ?? 180;
    this.storage = options.storage || null;

    this.commentedPosts = new Map(); // postId -> record
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

  canComment(postId, now = Date.now()) {
    this.checkDateReset();

    // 1. Check duplicate
    if (this.commentedPosts.has(postId)) {
      return {
        allowed: false,
        reason: `Bài viết [${postId}] đã bình luận trước đó`
      };
    }

    // 2. Check daily quota
    if (this.todayCommentCount >= this.dailyLimit) {
      return {
        allowed: false,
        reason: `Đã đạt giới hạn quota hôm nay (${this.todayCommentCount}/${this.dailyLimit} bình luận)`
      };
    }

    // 3. Check cooldown
    if (now < this.nextAvailableTime) {
      const waitSec = Math.ceil((this.nextAvailableTime - now) / 1000);
      return {
        allowed: false,
        reason: `Đang chờ Cooldown an toàn (còn ${waitSec}s)`
      };
    }

    return { allowed: true };
  }

  recordComment(postId, commentText, postUrl, now = Date.now()) {
    this.checkDateReset();
    this.lastRecordedDay = this.currentDateStr || getTodayString();

    const record = {
      postId,
      commentText,
      postUrl,
      timestamp: now
    };

    this.commentedPosts.set(postId, record);
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

  loadHistory(historyList = []) {
    if (Array.isArray(historyList)) {
      for (const item of historyList) {
        if (item && item.postId) {
          this.commentedPosts.set(item.postId, item);
        }
      }
    }
  }
}
