import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateFanpagePost, getTopicTemplates } from '../lib/ai-post-writer.js';

describe('AI Promotional Post Copywriter', () => {
  describe('generateFanpagePost with Fallback Templates (No API Key)', () => {
    it('should generate a rich promotional post using fallback templates when no API key is provided', async () => {
      const result = await generateFanpagePost({
        topic: 'automation',
        serviceHighlights: 'Auto bot, cào dữ liệu, tool mkt',
        contactInfo: 'Inbox Page hoặc Zalo: 0987654321',
        config: {}
      });

      assert.equal(result.success, true);
      assert.equal(result.source, 'template');
      assert.ok(result.content.length > 50);
      assert.ok(result.content.includes('#') || result.content.includes('Tự động hóa') || result.content.includes('Tool'));
    });

    it('should handle custom topic input gracefully', async () => {
      const result = await generateFanpagePost({
        topic: 'custom',
        customTopicText: 'Dịch vụ phát triển phần mềm AI ChatGPT theo yêu cầu',
        contactInfo: 'Inbox Page',
        config: {}
      });

      assert.equal(result.success, true);
      assert.ok(result.content.length > 30);
    });
  });

  describe('generateFanpagePost with AI API', () => {
    it('should call DeepSeek API and return generated content', async () => {
      const mockFetch = async (url, options) => {
        assert.ok(url.includes('api.deepseek.com'));
        assert.equal(options.method, 'POST');
        const body = JSON.parse(options.body);
        assert.ok(body.messages.length >= 2);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: '🚀 DỊCH VỤ THIẾT KẾ WEBSITE & PHẦN MỀM CHUYÊN NGHIỆP\n\nBạn đang cần tối ưu vận hành? Hãy liên hệ ngay!'
                }
              }
            ]
          })
        };
      };

      const result = await generateFanpagePost(
        {
          topic: 'web',
          serviceHighlights: 'Next.js, Node.js, Chuẩn SEO',
          contactInfo: 'Inbox Page',
          config: {
            apiKey: 'sk-deepseek-test-key',
            provider: 'deepseek',
            model: 'deepseek-chat'
          }
        },
        mockFetch
      );

      assert.equal(result.success, true);
      assert.equal(result.source, 'ai');
      assert.ok(result.content.includes('DỊCH VỤ THIẾT KẾ WEBSITE'));
    });

    it('should fall back to template if AI API returns error', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Authentication failed' }
        })
      });

      const result = await generateFanpagePost(
        {
          topic: 'mobile',
          contactInfo: 'Inbox Page',
          config: {
            apiKey: 'sk-invalid',
            provider: 'deepseek'
          }
        },
        mockFetch
      );

      assert.equal(result.success, true);
      assert.equal(result.source, 'fallback_template');
      assert.ok(result.content.length > 50);
      assert.ok(result.warning.includes('Authentication failed'));
    });
  });

  describe('getTopicTemplates', () => {
    it('should return available template keys', () => {
      const templates = getTopicTemplates();
      assert.ok(templates.web);
      assert.ok(templates.automation);
      assert.ok(templates.mobile);
      assert.ok(templates.general);
    });
  });
});
