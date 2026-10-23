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

  // Direct textbox selectors inside post
  const textboxSelectors = [
    'div[role="textbox"][contenteditable="true"]',
    'div[aria-label*="Viết bình luận" i][role="textbox"]',
    'div[aria-label*="Write a comment" i][role="textbox"]',
    'div[aria-label*="bình luận" i][role="textbox"]',
    'div[aria-label*="comment" i][role="textbox"]',
    'form div[role="textbox"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"]'
  ];

  for (const sel of textboxSelectors) {
    const nodes = postElement.querySelectorAll ? postElement.querySelectorAll(sel) : [];
    for (const el of nodes) {
      // Exclude main status creator or search bars
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      if (
        aria.includes('tìm kiếm') ||
        aria.includes('search') ||
        aria.includes('bạn đang nghĩ gì') ||
        aria.includes("what's on your mind")
      ) {
        continue;
      }
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

  const buttons = postElement.querySelectorAll('[role="button"], div[tabindex="0"]');
  for (const btn of buttons) {
    const text = (btn.textContent || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (
      text === 'bình luận' ||
      text === 'comment' ||
      aria.includes('để lại bình luận') ||
      aria.includes('leave a comment') ||
      aria.includes('viết bình luận') ||
      aria.includes('write a comment') ||
      aria === 'bình luận' ||
      aria === 'comment'
    ) {
      btn.click();
      console.log('[FB Job Hunter] Đã click nút mở ô bình luận Facebook');
      await sleep(1000);
      return true;
    }
  }

  return false;
}

/**
 * Simulates human typing text character by character into Facebook's Lexical / Draft editor
 */
export async function humanTypeIntoElement(element, text, speedMs = 25) {
  if (!element) return false;

  element.focus();
  element.click();
  await sleep(200);

  // Focus internal paragraph if present (Facebook Lexical editor)
  const innerParagraph = element.querySelector ? element.querySelector('p') : null;
  if (innerParagraph) {
    innerParagraph.focus();
  }

  // Clear existing content if any
  try {
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
  } catch (e) {}
  await sleep(150);

  // Type characters with natural human jitter
  let typedSuccessfully = false;
  try {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      document.execCommand('insertText', false, char);
      const jitter = Math.floor(Math.random() * 25);
      await sleep(speedMs + jitter);
    }
    typedSuccessfully = true;
  } catch (typeErr) {
    console.warn('[FB Job Hunter] execCommand typing fallback:', typeErr);
  }

  // Fallback if text is still empty (modern Lexical beforeinput event)
  if (!element.textContent || element.textContent.trim().length === 0) {
    try {
      const inputEvt = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(inputEvt);

      if (!element.textContent || element.textContent.trim().length === 0) {
        if (innerParagraph) {
          innerParagraph.textContent = text;
        } else {
          element.textContent = text;
        }
      }
    } catch (e) {}
  }

  // Trigger input events to notify React/Lexical listeners
  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  await sleep(500);

  return true;
}

/**
 * Submits the typed comment via Enter key and Facebook's Send button
 */
export async function submitComment(element, postElement = null) {
  if (!element) return false;

  // 1. Dispatch full keyboard Enter event
  const enterEventDown = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true
  });
  element.dispatchEvent(enterEventDown);

  const enterEventPress = new KeyboardEvent('keypress', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true
  });
  element.dispatchEvent(enterEventPress);

  const enterEventUp = new KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true
  });
  element.dispatchEvent(enterEventUp);

  await sleep(600);

  // 2. Look for Facebook Send / Submit Button
  const container = postElement || element.closest('form') || element.closest('div[role="article"]') || document;
  const submitSelectors = [
    'div[aria-label="Bình luận"][role="button"]',
    'div[aria-label="Comment"][role="button"]',
    'div[aria-label*="Gửi"][role="button"]',
    'div[aria-label*="Send"][role="button"]',
    'div[aria-label*="Nhấn Enter để gửi"][role="button"]',
    'div[aria-label*="Post"][role="button"]',
    'form button[type="submit"]'
  ];

  for (const sel of submitSelectors) {
    const btn = container.querySelector ? container.querySelector(sel) : null;
    if (btn && btn !== element) {
      btn.click();
      console.log('[FB Job Hunter] Đã click nút Gửi bình luận Facebook');
      await sleep(1000);
      return true;
    }
  }

  // 3. Fallback: check toolbar buttons inside the comment form
  const form = element.closest ? element.closest('form') : null;
  if (form && typeof form.querySelectorAll === 'function') {
    const candidateButtons = form.querySelectorAll('div[role="button"]');
    for (const b of candidateButtons) {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      // Skip emoji, sticker, gif, image buttons
      if (
        !aria.includes('emoji') &&
        !aria.includes('nhãn') &&
        !aria.includes('ảnh') &&
        !aria.includes('gif') &&
        !aria.includes('sticker')
      ) {
        b.click();
        await sleep(1000);
        return true;
      }
    }
  }

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

  console.log('[FB Job Hunter] Bắt đầu gõ nội dung bình luận vào ô input...');
  await humanTypeIntoElement(input, commentText);

  console.log('[FB Job Hunter] Đang gửi bình luận...');
  await submitComment(input, postElement);
  return true;
}
