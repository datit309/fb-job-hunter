import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findCommentInput, triggerCommentBox, closeCommentModal } from '../content/commenter.js';

describe('Commenter Engine', () => {
  describe('findCommentInput', () => {
    it('should find contenteditable textbox with aria-label "Viết bình luận"', () => {
      const mockPost = {
        querySelector(sel) {
          return null;
        },
        querySelectorAll(sel) {
          if (sel.includes('role="textbox"') || sel.includes('contenteditable')) {
            return [
              {
                getAttribute(attr) {
                  return attr === 'aria-label' ? 'Viết bình luận công khai...' : null;
                }
              }
            ];
          }
          return [];
        }
      };

      const input = findCommentInput(mockPost);
      assert.ok(input !== null);
      assert.equal(input.getAttribute('aria-label'), 'Viết bình luận công khai...');
    });

    it('should ignore status composer or search box', () => {
      const mockPost = {
        querySelectorAll(sel) {
          return [
            {
              getAttribute(attr) {
                return attr === 'aria-label' ? 'Tìm kiếm trên Facebook' : null;
              }
            },
            {
              getAttribute(attr) {
                return attr === 'aria-label' ? 'Bạn đang nghĩ gì?' : null;
              }
            }
          ];
        }
      };

      const input = findCommentInput(mockPost);
      assert.equal(input, null);
    });
  });

  describe('triggerCommentBox', () => {
    it('should click the "Bình luận" action button if comment box is closed', async () => {
      let clicked = false;
      const mockPost = {
        querySelectorAll(sel) {
          return [
            {
              textContent: 'Thích',
              getAttribute() { return null; }
            },
            {
              textContent: 'Bình luận',
              getAttribute(attr) { return attr === 'aria-label' ? 'Bình luận' : null; },
              click() { clicked = true; }
            }
          ];
        }
      };

      const triggered = await triggerCommentBox(mockPost);
      assert.equal(triggered, true);
      assert.equal(clicked, true);
    });
  });

  describe('closeCommentModal', () => {
    it('should find open dialog and click close button', async () => {
      let closeButtonClicked = false;

      const mockCloseBtn = {
        click() {
          closeButtonClicked = true;
        }
      };

      const mockDialog = {
        closest() { return null; },
        querySelector(sel) {
          if (sel.includes('Đóng') || sel.includes('Close')) {
            return mockCloseBtn;
          }
          return null;
        },
        dispatchEvent() {}
      };

      const mockDoc = {
        activeElement: { blur() {} },
        querySelectorAll(sel) {
          if (sel.includes('dialog')) {
            return [mockDialog];
          }
          return [];
        },
        dispatchEvent() {}
      };

      await closeCommentModal(mockDoc);
      assert.equal(closeButtonClicked, true);
    });

    it('should dispatch Escape key if no close button found in dialog', async () => {
      let escDispatched = false;

      const mockDialog = {
        closest() { return null; },
        querySelector() {
          return null; // no button found
        },
        dispatchEvent(evt) {
          if (evt.key === 'Escape') {
            escDispatched = true;
          }
        }
      };

      const mockDoc = {
        activeElement: null,
        querySelectorAll(sel) {
          if (sel.includes('dialog')) {
            return [mockDialog];
          }
          return [];
        },
        dispatchEvent() {}
      };

      await closeCommentModal(mockDoc);
      assert.equal(escDispatched, true);
    });
  });
});
