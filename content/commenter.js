/**
 * Facebook Human-like Safe Commenter Engine
 * Emulates human mouse clicks, typing delay, and keyboard submission events.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Finds the comment input textbox inside a post element
 */
export function findCommentInput(postElement) {
  if (!postElement || typeof postElement.querySelector !== 'function') return null;

  // Direct textbox inside post
  const textboxSelectors = [
    'div[role="textbox"][contenteditable="true"]',
    'div[aria-label*="Viết bình luận"][role="textbox"]',
    'div[aria-label*="Write a comment"][role="textbox"]',
    'div[aria-label*="bình luận"][role="textbox"]',
    'form div[role="textbox"]'
  ];

  for (const sel of textboxSelectors) {
    const el = postElement.querySelector(sel);
    if (el && el.offsetParent !== null) {
      return el;
    }
  }

  return null;
}

/**
 * Clicks the "Bình luận" (Comment) button to open the input box if closed
 */
export async function triggerCommentBox(postElement) {
  if (!postElement || typeof postElement.querySelectorAll !== 'function') return false;

  const buttons = postElement.querySelectorAll('[role="button"]');
  for (const btn of buttons) {
    const text = (btn.textContent || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (text === 'bình luận' || text === 'comment' || aria.includes('bình luận') || aria.includes('write a comment')) {
      btn.click();
      await sleep(1000);
      return true;
    }
  }

  return false;
}

/**
 * Simulates human typing text character by character into an editable div
 */
export async function humanTypeIntoElement(element, text, speedMs = 30) {
  if (!element) return false;

  element.focus();
  element.click();
  await sleep(200);

  // Clear existing content if any
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  await sleep(150);

  // Split into chunks or type naturally
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    document.execCommand('insertText', false, char);
    // Random jitter 15ms - 45ms per character
    const jitter = Math.floor(Math.random() * 30);
    await sleep(speedMs + jitter);
  }

  // Trigger input events to notify React/Draft.js/Lexical listeners
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(400);

  return true;
}

/**
 * Submits the typed comment
 */
export async function submitComment(element) {
  if (!element) return false;

  // Press Enter key
  const enterEventDown = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(enterEventDown);

  const enterEventUp = new KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(enterEventUp);

  await sleep(1000);
  return true;
}

/**
 * Complete comment workflow on a post element
 */
export async function postCommentOnFacebook(postElement, commentText) {
  let input = findCommentInput(postElement);
  if (!input) {
    await triggerCommentBox(postElement);
    await sleep(1000);
    input = findCommentInput(postElement);
  }

  if (!input) {
    throw new Error('Không tìm thấy ô nhập bình luận trên bài viết này');
  }

  await humanTypeIntoElement(input, commentText);
  await submitComment(input);
  return true;
}
