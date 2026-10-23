import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { publishToPage, verifyPageToken } from '../lib/page-publisher.js';

describe('Meta Graph API Page Publisher', () => {
  describe('publishToPage', () => {
    it('should throw an error if pageId or accessToken or message is missing', async () => {
      await assert.rejects(
        () => publishToPage({ pageId: '', accessToken: 'token', message: 'Hello' }),
        /thiếu thông tin/i
      );
      await assert.rejects(
        () => publishToPage({ pageId: '12345', accessToken: '', message: 'Hello' }),
        /thiếu thông tin/i
      );
      await assert.rejects(
        () => publishToPage({ pageId: '12345', accessToken: 'token', message: '' }),
        /nội dung bài viết không được để trống/i
      );
    });

    it('should post message to Graph API feed endpoint successfully', async () => {
      const mockFetch = async (url, options) => {
        assert.ok(url.includes('graph.facebook.com'));
        assert.ok(url.includes('123456789/feed'));
        assert.equal(options.method, 'POST');

        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: '123456789_987654321'
          })
        };
      };

      const result = await publishToPage(
        {
          pageId: '123456789',
          accessToken: 'EAAtestToken123',
          message: 'Chào mừng quý khách đến với dịch vụ phần mềm!'
        },
        mockFetch
      );

      assert.equal(result.success, true);
      assert.equal(result.postId, '123456789_987654321');
      assert.ok(result.postUrl.includes('facebook.com/123456789_987654321'));
    });

    it('should throw informative error if Graph API returns an error response', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid OAuth access token - Cannot parse access token',
            type: 'OAuthException',
            code: 190
          }
        })
      });

      await assert.rejects(
        () =>
          publishToPage(
            {
              pageId: '123456789',
              accessToken: 'expired_or_invalid_token',
              message: 'Hello'
            },
            mockFetch
          ),
        /Invalid OAuth access token/
      );
    });
  });

  describe('verifyPageToken', () => {
    it('should return page metadata when token is valid', async () => {
      const mockFetch = async (url) => {
        assert.ok(url.includes('graph.facebook.com'));
        assert.ok(url.includes('123456789'));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: '123456789',
            name: 'Tech Solution Page'
          })
        };
      };

      const result = await verifyPageToken(
        {
          pageId: '123456789',
          accessToken: 'EAAvalidToken'
        },
        mockFetch
      );

      assert.equal(result.valid, true);
      assert.equal(result.name, 'Tech Solution Page');
      assert.equal(result.id, '123456789');
    });

    it('should return valid: false with error details when token is invalid', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Session has expired',
            code: 190
          }
        })
      });

      const result = await verifyPageToken(
        {
          pageId: '123456789',
          accessToken: 'bad_token'
        },
        mockFetch
      );

      assert.equal(result.valid, false);
      assert.ok(result.error.includes('Session has expired'));
    });
  });
});
