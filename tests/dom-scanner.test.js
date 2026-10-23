import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractPostData, generatePostId, isSponsoredPost } from '../content/dom-scanner.js';

describe('DOM Scanner', () => {
  describe('generatePostId', () => {
    it('should generate consistent hash-based ID when permalink is absent', () => {
      const id1 = generatePostId('Nguyễn Văn A', 'Cần tìm dev làm web React');
      const id2 = generatePostId('Nguyễn Văn A', 'Cần tìm dev làm web React');
      assert.equal(id1, id2);
      assert.ok(id1.startsWith('fb_post_'));
    });

    it('should generate different IDs for different post contents', () => {
      const id1 = generatePostId('Nguyễn Văn A', 'Cần tìm dev làm web React');
      const id2 = generatePostId('Nguyễn Văn A', 'Cần tìm dev làm tool Python');
      assert.notEqual(id1, id2);
    });
  });

  describe('isSponsoredPost', () => {
    it('should detect sponsored Facebook ads and return true', () => {
      const sponsoredEl = {
        querySelector(selector) {
          if (selector.includes('Được tài trợ') || selector.includes('Sponsored')) {
            return { textContent: 'Được tài trợ' };
          }
          return null;
        }
      };
      assert.equal(isSponsoredPost(sponsoredEl), true);
    });

    it('should return false for organic non-ad posts', () => {
      const organicEl = {
        querySelector() { return null; }
      };
      assert.equal(isSponsoredPost(organicEl), false);
    });
  });

  describe('extractPostData', () => {
    it('should extract author, text, and URL from mock Facebook post element', () => {
      // Mocking a Facebook post DOM element structure
      const mockElement = {
        querySelector(selector) {
          if (selector.includes('role="link"') || selector.includes('h2') || selector.includes('h3') || selector.includes('strong')) {
            return {
              textContent: 'Trần Văn Tuyển',
              getAttribute(attr) {
                if (attr === 'href') return 'https://www.facebook.com/groups/12345/posts/987654321/';
                return null;
              }
            };
          }
          if (selector.includes('data-ad-preview') || selector.includes('dir="auto"')) {
            return {
              textContent: 'Mình đang cần outsource làm một landing page bán hàng, budget 5 triệu.'
            };
          }
          if (selector.includes('posts/') || selector.includes('permalink')) {
            return {
              getAttribute() { return 'https://www.facebook.com/groups/12345/posts/987654321/'; }
            };
          }
          return null;
        },
        querySelectorAll(selector) {
          if (selector.includes('dir="auto"')) {
            return [
              { textContent: 'Mình đang cần outsource làm một landing page bán hàng, budget 5 triệu.' }
            ];
          }
          if (selector.includes('a[href]')) {
            return [
              { getAttribute(attr) { return attr === 'href' ? 'https://www.facebook.com/groups/12345/posts/987654321/' : null; } }
            ];
          }
          return [];
        }
      };

      const data = extractPostData(mockElement);
      assert.equal(data.authorName, 'Trần Văn Tuyển');
      assert.ok(data.postText.includes('outsource làm một landing page'));
      assert.equal(data.postUrl, 'https://www.facebook.com/groups/12345/posts/987654321/');
      assert.ok(data.id.length > 0);
    });

    it('should extract author and post details from News Feed style post (h4 author and fbid URL)', () => {
      const newsFeedElement = {
        querySelector(selector) {
          if (selector.includes('h4') || selector.includes('a[role="link"]')) {
            return {
              textContent: 'Lê Hoàng Nam',
              getAttribute(attr) {
                if (attr === 'href') return 'https://www.facebook.com/lehoangnam/posts/5544332211';
                return null;
              }
            };
          }
          if (selector.includes('data-ad-preview') || selector.includes('dir="auto"')) {
            return {
              textContent: 'Cần một bạn coder viết web app quản lý kho hàng gấp, ai rảnh inbox mình.'
            };
          }
          if (selector.includes('fbid=') || selector.includes('posts/')) {
            return {
              getAttribute() { return 'https://www.facebook.com/permalink.php?story_fbid=5544332211&id=10001'; }
            };
          }
          return null;
        },
        querySelectorAll(selector) {
          if (selector.includes('dir="auto"')) {
            return [{ textContent: 'Cần một bạn coder viết web app quản lý kho hàng gấp, ai rảnh inbox mình.' }];
          }
          return [];
        }
      };

      const data = extractPostData(newsFeedElement);
      assert.ok(data !== null);
      assert.equal(data.authorName, 'Lê Hoàng Nam');
      assert.ok(data.postText.includes('coder viết web app'));
      assert.ok(data.id.includes('5544332211'));
    });

    it('should skip sponsored / ads posts on News Feed', () => {
      const adElement = {
        querySelector(selector) {
          if (selector.includes('Được tài trợ') || selector.includes('Sponsored')) {
            return { textContent: 'Được tài trợ' };
          }
          if (selector.includes('dir="auto"')) {
            return { textContent: 'Khóa học lập trình Fullstack bao việc làm sau 3 tháng...' };
          }
          return null;
        },
        querySelectorAll(selector) {
          if (selector.includes('dir="auto"')) {
            return [{ textContent: 'Khóa học lập trình Fullstack bao việc làm sau 3 tháng...' }];
          }
          return [];
        }
      };

      const data = extractPostData(adElement);
      assert.equal(data, null);
    });

    it('should handle elements with missing author or text gracefully without crashing', () => {
      const emptyElement = {
        querySelector() { return null; },
        querySelectorAll() { return []; }
      };

      const data = extractPostData(emptyElement);
      assert.equal(data, null);
    });
  });
});
