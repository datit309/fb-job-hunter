import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sendTelegramMessage, formatJobAlertMessage, formatTestMessage } from '../lib/telegram.js';

describe('Telegram Notification Service', () => {
  it('should throw an error if botToken or chatId is missing', async () => {
    await assert.rejects(
      async () => {
        await sendTelegramMessage('', '12345', 'Hello');
      },
      /Thiếu Bot Token hoặc Chat ID/
    );

    await assert.rejects(
      async () => {
        await sendTelegramMessage('token', '', 'Hello');
      },
      /Thiếu Bot Token hoặc Chat ID/
    );
  });

  it('should call Telegram sendMessage endpoint with valid payload and return success', async () => {
    let capturedUrl = '';
    let capturedBody = null;

    const mockFetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 999 } })
      };
    };

    const res = await sendTelegramMessage('123:ABC', '88888', 'Tin nhắn test', mockFetch);
    assert.equal(res.success, true);
    assert.equal(capturedUrl, 'https://api.telegram.org/bot123:ABC/sendMessage');
    assert.equal(capturedBody.chat_id, '88888');
    assert.equal(capturedBody.text, 'Tin nhắn test');
    assert.equal(capturedBody.parse_mode, 'Markdown');
  });

  it('should throw a descriptive error if Telegram API returns an error response', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, description: 'Unauthorized: invalid token' })
    });

    await assert.rejects(
      async () => {
        await sendTelegramMessage('wrong_token', '88888', 'Hello', mockFetch);
      },
      /Unauthorized: invalid token/
    );
  });

  it('should format job alert and test message with correct Markdown tags', () => {
    const jobMsg = formatJobAlertMessage({
      authorName: 'Nguyễn Văn A',
      matchScore: 85,
      matchedKeywords: ['tìm dev', 'react'],
      commentText: 'Chào bạn, team mình nhận làm nhé.',
      postUrl: 'https://facebook.com/posts/123'
    });

    assert.ok(jobMsg.includes('FB Job Hunter'));
    assert.ok(jobMsg.includes('Nguyễn Văn A'));
    assert.ok(jobMsg.includes('85%'));
    assert.ok(jobMsg.includes('tìm dev, react'));

    const testMsg = formatTestMessage();
    assert.ok(testMsg.includes('Kiểm tra kết nối Telegram'));
    assert.ok(testMsg.includes('✅ Kết nối thành công'));
  });
});
