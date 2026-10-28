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
      assert.ok(result.postUrl.includes('facebook.com/123456789/posts/987654321'));
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

  describe('publishOrSchedulePost', () => {
    it('should schedule photo post to /{pageId}/photos when imageUrl and scheduledPublishTime provided', async () => {
      const { publishOrSchedulePost } = await import('../lib/page-publisher.js');
      assert.ok(publishOrSchedulePost, 'publishOrSchedulePost must be exported');

      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // +1 hour

      let requestedUrl = '';
      let requestBody = '';

      const mockFetch = async (url, options) => {
        requestedUrl = url;
        requestBody = options.body;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'photo_123456', post_id: '12345_67890' })
        };
      };

      const result = await publishOrSchedulePost(
        {
          pageId: 'page_999',
          accessToken: 'token_abc',
          message: 'Bài viết có hình ảnh đẹp!',
          imageUrl: 'https://images.unsplash.com/photo-test',
          scheduledPublishTime: futureTimestamp
        },
        mockFetch
      );

      assert.equal(result.success, true);
      assert.ok(requestedUrl.includes('/page_999/photos'), 'Must call /{pageId}/photos');
      const params = new URLSearchParams(requestBody);
      assert.equal(params.get('url'), 'https://images.unsplash.com/photo-test');
      assert.equal(params.get('caption'), 'Bài viết có hình ảnh đẹp!');
      assert.equal(params.get('published'), 'false');
      assert.equal(params.get('scheduled_publish_time'), String(futureTimestamp));
    });

    it('should schedule text post to /{pageId}/feed when no imageUrl provided', async () => {
      const { publishOrSchedulePost } = await import('../lib/page-publisher.js');
      const futureTimestamp = Math.floor(Date.now() / 1000) + 7200;

      let requestedUrl = '';
      let requestBody = '';

      const mockFetch = async (url, options) => {
        requestedUrl = url;
        requestBody = options.body;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'page_999_post_111' })
        };
      };

      const result = await publishOrSchedulePost(
        {
          pageId: 'page_999',
          accessToken: 'token_abc',
          message: 'Bài viết text thuần',
          scheduledPublishTime: futureTimestamp
        },
        mockFetch
      );

      assert.equal(result.success, true);
      assert.ok(requestedUrl.includes('/page_999/feed'), 'Must call /{pageId}/feed');
      const params = new URLSearchParams(requestBody);
      assert.equal(params.get('message'), 'Bài viết text thuần');
      assert.equal(params.get('published'), 'false');
      assert.equal(params.get('scheduled_publish_time'), String(futureTimestamp));
    });
  });

  describe('scheduleAllCampaignPosts', () => {
    it('should iterate through all posts and schedule them with progress tracking', async () => {
      const { scheduleAllCampaignPosts } = await import('../lib/page-publisher.js');
      assert.ok(scheduleAllCampaignPosts, 'scheduleAllCampaignPosts must be exported');

      const posts = [
        {
          id: 'p1',
          title: 'Post 1',
          content: 'Nội dung bài 1',
          imageUrl: 'https://images.unsplash.com/photo-1',
          scheduledDate: '2026-10-30',
          scheduledTime: '08:30',
          status: 'pending'
        },
        {
          id: 'p2',
          title: 'Post 2',
          content: 'Nội dung bài 2',
          imageUrl: 'https://images.unsplash.com/photo-2',
          scheduledDate: '2026-10-31',
          scheduledTime: '11:45',
          status: 'pending'
        }
      ];

      const calls = [];
      const mockFetch = async (url, options) => {
        calls.push({ url, body: options.body });
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: `id_${calls.length}` })
        };
      };

      const progressLogs = [];
      const onProgress = (info) => {
        progressLogs.push(info);
      };

      const res = await scheduleAllCampaignPosts(
        {
          pageId: 'page_test',
          accessToken: 'token_test',
          posts,
          onProgress
        },
        mockFetch
      );

      assert.equal(res.scheduledCount, 2);
      assert.equal(res.total, 2);
      assert.equal(calls.length, 2);
      assert.equal(progressLogs.length, 2);
      assert.equal(res.updatedPosts[0].status, 'scheduled');
      assert.equal(res.updatedPosts[1].status, 'scheduled');
    });
  });
});

