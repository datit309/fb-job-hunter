/**
 * Facebook Human-like Safe Commenter Engine
 * Emulates human mouse clicks, Lexical typing/paste events, and keyboard submission.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Finds the comment input textbox inside a post element or dialog
 */
export function findCommentInput(container) {
  if (!container || typeof container.querySelector !== 'function') return null;

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
    const nodes = container.querySelectorAll ? container.querySelectorAll(sel) : [];
    for (const el of nodes) {
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      // Skip status composer or search bar
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
export async function triggerCommentBox(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return false;

  const buttons = container.querySelectorAll('[role="button"], div[tabindex="0"]');
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
      aria === 'comment' ||
      (text.includes('bình luận') && text.length < 20)
    ) {
      btn.click();
      console.log('[FB Job Hunter] Đã click nút mở ô bình luận Facebook');
      await sleep(1200);
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
    innerParagraph.click();
  }

  // Clear existing content if any
  try {
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
  } catch (e) {}
  await sleep(150);

  // Technique 1: Lexical Paste simulation via DataTransfer (native Lexical PASTE_COMMAND)
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const pasteEvt = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    element.dispatchEvent(pasteEvt);
    await sleep(250);
  } catch (pasteErr) {
    console.warn('[FB Job Hunter] Paste simulation warning:', pasteErr);
  }

  // Technique 2: If paste didn't set content, use character-by-character typing
  if (!element.textContent || element.textContent.trim().length === 0) {
    try {
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        document.execCommand('insertText', false, char);
        const jitter = Math.floor(Math.random() * 20);
        await sleep(speedMs + jitter);
      }
    } catch (typeErr) {
      console.warn('[FB Job Hunter] execCommand typing warning:', typeErr);
    }
  }

  // Technique 3: InputEvent beforeinput fallback
  if (!element.textContent || element.textContent.trim().length === 0) {
    try {
      const inputEvt = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      element.dispatchEvent(inputEvt);
    } catch (e) {}
  }

  // Technique 4: Direct DOM content insertion if all else failed
  if (!element.textContent || element.textContent.trim().length === 0) {
    if (innerParagraph) {
      innerParagraph.textContent = text;
    } else {
      element.textContent = text;
    }
  }

  // Trigger input, change and key events
  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  await sleep(500);

  return true;
}

/**
 * Submits the typed comment via Enter key and Facebook's Send button
 */
export async function submitComment(element, container = null) {
  if (!element) return false;

  // 1. Dispatch full keyboard Enter event (keydown, keypress, keyup)
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

  await sleep(800);

  // 2. Search for Facebook Send / Submit Button
  const searchRoot = container || element.closest('form') || element.closest('[role="article"]') || document;
  const submitSelectors = [
    'div[aria-label="Bình luận"][role="button"]',
    'div[aria-label="Comment"][role="button"]',
    'div[aria-label*="Gửi"][role="button"]',
    'div[aria-label*="Send"][role="button"]',
    'div[aria-label*="Nhấn Enter để gửi"][role="button"]',
    'div[aria-label*="Post"][role="button"]',
    'form button[type="submit"]',
    'form div[role="button"][tabindex="0"]'
  ];

  for (const sel of submitSelectors) {
    const btn = searchRoot.querySelector ? searchRoot.querySelector(sel) : null;
    if (btn && btn !== element) {
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      // Skip emoji, sticker, attachment buttons
      if (
        !aria.includes('emoji') &&
        !aria.includes('nhãn') &&
        !aria.includes('ảnh') &&
        !aria.includes('gif') &&
        !aria.includes('sticker') &&
        !aria.includes('tệp')
      ) {
        btn.click();
        console.log('[FB Job Hunter] Đã click nút Gửi bình luận Facebook');
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
  // 1. Resolve full post container (article or feed unit)
  const article =
    postElement?.closest?.('[role="article"]') ||
    postElement?.closest?.('div[data-pagelet^="FeedUnit"]') ||
    postElement?.closest?.('[role="feed"] > div') ||
    postElement;

  // 2. Locate or trigger comment input
  let input = findCommentInput(article);
  if (!input) {
    await triggerCommentBox(article);
    await sleep(1200);
    input = findCommentInput(article);
  }

  // 3. Fallback: search immediate dialog if opened in popup
  if (!input) {
    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog) {
      input = findCommentInput(dialog);
    }
  }

  if (!input) {
    throw new Error('Không tìm thấy ô nhập bình luận trên bài viết này');
  }

  console.log('[FB Job Hunter] Bắt đầu gõ nội dung bình luận vào ô input...');
  await humanTypeIntoElement(input, commentText);

  console.log('[FB Job Hunter] Đang gửi bình luận...');
  await submitComment(input, article);
  return true;
}
