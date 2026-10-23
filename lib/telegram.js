/**
 * Telegram Notification Service for FB Job Hunter
 */

/**
 * Send a message to Telegram using bot token and chat id
 * @param {string} botToken - Telegram Bot Token
 * @param {string} chatId - Telegram Chat ID or channel username
 * @param {string} text - Message text formatted in Markdown
 * @param {function} fetchFn - Fetch implementation (defaults to global fetch)
 * @returns {Promise<object>} Result from Telegram API
 */
export async function sendTelegramMessage(botToken, chatId, text, fetchFn = fetch) {
  const cleanToken = (botToken || '').trim();
  const cleanChatId = (chatId || '').trim();

  if (!cleanToken || !cleanChatId) {
    throw new Error('Thiếu Bot Token hoặc Chat ID');
  }

  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: cleanChatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    const errorMsg = data.description || `Lỗi HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return { success: true, result: data.result };
}

/**
 * Formats a post match alert for Telegram
 */
export function formatJobAlertMessage(postData = {}) {
  const author = postData.authorName || 'Ẩn danh';
  const score = postData.matchScore || 0;
  const keywords = Array.isArray(postData.matchedKeywords) ? postData.matchedKeywords.join(', ') : '';
  const comment = postData.commentText || '(Chưa gửi comment)';
  const url = postData.postUrl || 'https://www.facebook.com';

  return `🎯 *[FB Job Hunter]* Phát hiện Job Mới!
👤 *Tác giả:* ${author}
💯 *Điểm phù hợp:* ${score}%
🔍 *Từ khóa:* \`${keywords}\`
💬 *Bình luận đã gửi:*
_${comment}_

🔗 [Xem bài viết trên Facebook](${url})`;
}

/**
 * Formats a test connectivity message
 */
export function formatTestMessage() {
  const now = new Date().toLocaleTimeString('vi-VN');
  return `🔔 *[FB Job Hunter] - Kiểm tra kết nối Telegram*
✅ Kết nối thành công tới Bot của bạn lúc *${now}*!
Khi tool quét thấy bài đăng tìm dev trên Facebook phù hợp, bạn sẽ nhận được thông báo ngay lập tức tại đây.`;
}
