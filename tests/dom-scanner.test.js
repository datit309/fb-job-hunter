import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractPostData, generatePostId } from '../content/dom-scanner.js';

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
