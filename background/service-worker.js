/**
 * Background Service Worker for FB Job Hunter
 * Handles configuration defaults, Telegram webhook notifications, badge updates, and alarm tasks.
 */

const DEFAULT_CONFIG = {
  enabled: true,
  autoScroll: true,
  scanIntervalMs: 4000,
  minCommentDelaySec: 60,
  maxCommentDelaySec: 180,
  dailyCommentLimit: 30,
  whitelistKeywords: [
    'tìm dev',
    'cần dev',
    'outsource',
    'freelance',
    'viết tool',
    'làm web',
    'làm app',
    'flutter',
    'react',
    'nodejs',
    'python',
    'backend',
    'fullstack',
    'nhận dự án',
    'cào dữ liệu',
    'viết bot'
  ],
  blacklistKeywords: [
    'tuyển sinh',
    'khóa học',
    'bán acc',
    'tuyển dụng sale',
    'fulltime tại',
    'onsite',
    'yêu cầu lên công ty',
    'đa cấp',
    'tuyển mẫu',
    'cho thuê'
  ],
  spintaxTemplates: [
    '{Chào bạn|Hi bạn|Hello fen}, {mình|bên mình|team mình} chuyên nhận làm {web, app, tool tự động|phần mềm và bot} theo yêu cầu. Bạn check inbox mình trao đổi chi tiết nhé!',
    '{Chào bạn|Hello bạn}, mình có kinh nghiệm làm các dự án tương tự. Bạn check ib mình gửi portfolio và tư vấn giải pháp nha.',
    '{Hi bạn|Chào bạn}, mình nhận làm dự án này nhé. Mình đã nhắn tin riêng qua inbox cho bạn rồi ạ!'
  ],
  aiEnabled: false,
  aiProvider: 'deepseek',
  aiApiKey: '',
  aiCustomPrompt: '',
  telegramBotToken: '',
  telegramChatId: '',
  history: []
};

// Seed default configs on install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('config');
  if (!existing || !existing.config) {
    await chrome.storage.local.set({ config: DEFAULT_CONFIG });
    console.log('[FB Job Hunter] Default configuration initialized.');
  }
  updateBadge(true);
});

// Update Extension Icon Badge
function updateBadge(enabled, count = 0) {
  if (!enabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#71717a' });
  } else if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  } else {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
  }
}

// Send alert to user's Telegram if token & chatId are configured
async function sendTelegramAlert(botToken, chatId, postData) {
  if (!botToken || !chatId) return;

  const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
  const text = `🎯 *[FB Job Hunter]* Phát hiện Job Mới!
👤 *Tác giả:* ${postData.authorName || 'Ẩn danh'}
💯 *Điểm phù hợp:* ${postData.matchScore || 0}%
🔍 *Từ khóa:* \`${(postData.matchedKeywords || []).join(', ')}\`
💬 *Bình luận đã gửi:*
_${postData.commentText || '(Chưa comment)'}_

🔗 [Xem bài viết trên Facebook](${postData.postUrl})`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    });
  } catch (err) {
    console.error('[FB Job Hunter] Telegram send error:', err);
  }
}

// Message Listener from Content Scripts or Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NOTIFY_JOB_MATCH') {
    chrome.storage.local.get('config', async ({ config }) => {
      const conf = config || DEFAULT_CONFIG;
      if (conf.telegramBotToken && conf.telegramChatId) {
        await sendTelegramAlert(conf.telegramBotToken, conf.telegramChatId, message.payload);
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'UPDATE_BADGE') {
    updateBadge(message.enabled, message.count);
    sendResponse({ success: true });
    return true;
  }
});
