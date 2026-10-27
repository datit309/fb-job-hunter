/**
 * Meta Business Suite Planner & Bulk Post Scheduler Module
 * Facilitates bulk scheduling across peak engagement hours on Meta Business Suite Planner
 */

import { generateFanpagePost } from './ai-post-writer.js';

export const PRIME_HOURS = ['08:30', '11:45', '19:30'];

export const TOPIC_TITLES = {
  general: '🚀 Dịch vụ Outsourcing & Gia công phần mềm toàn diện',
  web: '🌐 Thiết kế Website & Web App chuẩn SEO Google',
  automation: '⚡ Tool tự động hóa quy trình, RPA & Bot cào dữ liệu',
  mobile: '📱 Lập trình ứng dụng di động iOS & Android'
};

export const CAMPAIGN_TOPIC_CYCLE = ['web', 'automation', 'mobile', 'general'];

/**
 * Format a Date object to YYYY-MM-DD using local time
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generate schedule slots for N days, ensuring no slots in the past
 * @param {Object} options
 * @param {Date} [options.startDate]
 * @param {number} [options.daysCount]
 * @param {string[]} [options.preferredHours]
 * @returns {Array<{date: string, time: string, slotIndex: number}>}
 */
export function generateCampaignSchedule({
  startDate = new Date(),
  daysCount = 7,
  preferredHours = PRIME_HOURS
} = {}) {
  const slots = [];
  const hours = preferredHours.length > 0 ? preferredHours : PRIME_HOURS;

  const minFutureMs = startDate.getTime() + 30 * 60 * 1000;

  // Find first eligible slot starting today or tomorrow
  let startDayOffset = 0;
  let startHourIdx = 0;
  let foundToday = false;

  for (let h = 0; h < hours.length; h++) {
    const [hh, mm] = hours[h].split(':').map(Number);
    const testDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      hh,
      mm,
      0
    );
    if (testDate.getTime() >= minFutureMs) {
      startHourIdx = h;
      foundToday = true;
      break;
    }
  }

  if (!foundToday) {
    // All slots today have passed or are too close (<30m) -> Start tomorrow morning
    startDayOffset = 1;
    startHourIdx = 0;
  }

  for (let i = 0; i < daysCount; i++) {
    const targetDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + startDayOffset + i
    );
    const dateStr = formatDate(targetDate);
    const timeStr = hours[(startHourIdx + i) % hours.length];

    slots.push({
      date: dateStr,
      time: timeStr,
      slotIndex: i
    });
  }

  return slots;
}

/**
 * Extract clean title from post content, ensuring no leading hashtag or markdown '#'
 * @param {string} content
 * @param {string} defaultTitle
 * @returns {string}
 */
export function extractCleanTitle(content, defaultTitle = '') {
  if (!content || typeof content !== 'string') return defaultTitle;
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    let firstLine = lines[0]
      .replace(/^#{1,6}\s*/, '')
      .replace(/^#[a-zA-Z0-9_\u00C0-\u1EF9]+\s*/g, '')
      .replace(/^(\*{2,3}|_{2,3})(.*?)\1$/, '$2')
      .trim();
    if (firstLine.length >= 5 && firstLine.length <= 100) {
      return firstLine;
    }
  }
  return defaultTitle;
}

/**
 * Generate bulk campaign posts with diverse topics using AI or fallback templates
 * @param {Object} options
 * @param {number} [options.count]
 * @param {string[]} [options.topics]
 * @param {string} [options.serviceHighlights]
 * @param {string} [options.contactInfo]
 * @param {Object} [options.config]
 * @param {Function} [customFetch]
 * @returns {Promise<Array<Object>>}
 */
export async function generateBulkCampaignPosts(
  {
    count = 7,
    topics = CAMPAIGN_TOPIC_CYCLE,
    serviceHighlights = '',
    contactInfo = 'Inbox trực tiếp cho Page để nhận tư vấn chi tiết.',
    config = {}
  } = {},
  customFetch = fetch
) {
  const slots = generateCampaignSchedule({ daysCount: count });
  const posts = [];
  const cycle = topics.length > 0 ? topics : CAMPAIGN_TOPIC_CYCLE;

  for (let i = 0; i < count; i++) {
    const slot = slots[i];
    const topic = cycle[i % cycle.length];
    const baseTitle = TOPIC_TITLES[topic] || `Bài đăng ${i + 1} - ${topic}`;

    const res = await generateFanpagePost(
      {
        topic,
        serviceHighlights,
        contactInfo,
        config
      },
      customFetch
    );

    const cleanTitle = extractCleanTitle(res.content, baseTitle);

    posts.push({
      id: `campaign_${Date.now()}_${i + 1}`,
      scheduledDate: slot.date,
      scheduledTime: slot.time,
      topic,
      title: cleanTitle,
      content: res.content,
      status: 'pending',
      createdAt: Date.now()
    });
  }

  return posts;
}

/**
 * Escape a string for RFC-4180 CSV
 * @param {string} str
 * @returns {string}
 */
function escapeCsv(str) {
  if (str === null || str === undefined) return '""';
  const val = String(str);
  return `"${val.replace(/"/g, '""')}"`;
}

/**
 * Export campaign posts to RFC-4180 CSV format
 * Suitable for archiving and importing into Meta Business Suite Planner
 * @param {Array<Object>} posts
 * @returns {string}
 */
export function exportCampaignToCsv(posts = []) {
  const headers = ['Date', 'Time', 'Title', 'Content', 'Status'];
  const rows = [headers.join(',')];

  for (const post of posts) {
    const row = [
      escapeCsv(post.scheduledDate),
      escapeCsv(post.scheduledTime),
      escapeCsv(post.title || ''),
      escapeCsv(post.content || ''),
      escapeCsv(post.status || 'pending')
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Format a date and time for Meta Business Suite Bulk Upload CSV
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} timeStr HH:mm
 * @param {'us'|'iso'} [format]
 * @returns {string}
 */
export function formatMetaDateTime(dateStr, timeStr, format = 'us') {
  if (!dateStr) return '';
  if (format === 'us') {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${m}/${d}/${y} ${timeStr || '08:30'}`;
    }
  }
  return `${dateStr} ${timeStr || '08:30'}`;
}

/**
 * Export campaign posts to Meta Business Suite Bulk Upload format (bulk_post_composer)
 * Uses the official 2-column format: Date and time, Text
 * @param {Array<Object>} posts
 * @param {Object} [options]
 * @param {'us'|'iso'} [options.format]
 * @returns {string}
 */
export function exportMetaBulkCsv(posts = [], { format = 'us' } = {}) {
  const headers = ['Date and time', 'Text'];
  const rows = [headers.join(',')];

  for (const post of posts) {
    const dateTimeStr = formatMetaDateTime(post.scheduledDate, post.scheduledTime, format);
    // Combine clean content with hashtags for complete post text
    const text = post.content || '';

    const row = [
      escapeCsv(dateTimeStr),
      escapeCsv(text)
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Update the status of a specific post in the campaign list
 * @param {Array<Object>} posts
 * @param {string} postId
 * @param {string} newStatus ('pending' | 'scheduled' | 'failed')
 * @returns {Array<Object>}
 */
export function updateCampaignPostStatus(posts = [], postId, newStatus) {
  return posts.map((post) => {
    if (post.id === postId) {
      return {
        ...post,
        status: newStatus,
        updatedAt: Date.now()
      };
    }
    return post;
  });
}
