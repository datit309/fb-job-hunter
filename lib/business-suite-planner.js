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
 * Format a Date object to YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
export function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generate schedule slots for N days
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

  for (let i = 0; i < daysCount; i++) {
    const targetDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = formatDate(targetDate);
    const timeStr = hours[i % hours.length];

    slots.push({
      date: dateStr,
      time: timeStr,
      slotIndex: i
    });
  }

  return slots;
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
    const title = TOPIC_TITLES[topic] || `Chiến dịch bài đăng #${i + 1}`;

    const res = await generateFanpagePost(
      {
        topic,
        serviceHighlights,
        contactInfo,
        config
      },
      customFetch
    );

    posts.push({
      id: `campaign_${Date.now()}_${i + 1}`,
      scheduledDate: slot.date,
      scheduledTime: slot.time,
      topic,
      title,
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
