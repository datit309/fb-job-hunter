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
  isCompanyPage: true,
  spintaxTemplates: [
    '{Dạ chào bạn|Chào bạn|Chào anh/chị}, bài toán {này|kỹ thuật này|dự án này} team bên em đã từng triển khai sản phẩm thực tế tương tự. Nếu bạn cần tham khảo thêm về giải pháp kiến trúc hoặc demo, có thể ghé qua Page bên em nhé ạ.',
    '{Chào bạn|Dạ chào anh/chị}, bên mình là đơn vị chuyên phát triển {hệ thống phần mềm|web app|ứng dụng di động và tool tự động} theo yêu cầu. Rất mong có cơ hội được hỗ trợ và đồng hành cùng dự án của bạn.',
    '{Chào bạn|Hi bạn}, mảng {này|công nghệ này} bên mình có sẵn đội ngũ kỹ thuật có thể tư vấn giải pháp tối ưu và triển khai nhanh chóng. Bạn cần thêm thông tin cứ kết nối với page bên mình nha.',
    '{Dạ chào bạn|Chào anh/chị}, bên em chuyên nhận gia công và phát triển phần mềm chuẩn tiến độ, có thể hỗ trợ tư vấn kỹ thuật chi tiết. Chúc dự án của bạn sớm tìm được team ưng ý nhé ạ!'
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
      const botToken = conf.telegramConfig?.botToken || conf.telegramBotToken;
      const chatId = conf.telegramConfig?.chatId || conf.telegramChatId;
      if (botToken && chatId) {
        await sendTelegramAlert(botToken, chatId, message.payload);
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
