/**
 * Content Script Orchestrator for FB Job Hunter
 * Runs inside facebook.com/groups/*
 * Realtime post listener via MutationObserver, auto humanized scrolling & smart comment dispatching.
 */

(async () => {
  console.log('[FB Job Hunter] Realtime Content Script loaded on Facebook.');

  // Dynamically import modules via extension runtime URLs
  const { scanFeed } = await import(chrome.runtime.getURL('content/dom-scanner.js'));
  const { evaluatePost } = await import(chrome.runtime.getURL('lib/filter-engine.js'));
  const { generateAIPitch } = await import(chrome.runtime.getURL('lib/ai-matcher.js'));
  const { SafetyController } = await import(chrome.runtime.getURL('content/safety.js'));
  const { postCommentOnFacebook } = await import(chrome.runtime.getURL('content/commenter.js'));
  const { initFloatingWidget, updateWidgetStatus, addWidgetJobLog, updateWidgetIdentity } = await import(chrome.runtime.getURL('content/floating-widget.js'));

  // Load configuration
  let config = (await chrome.storage.local.get('config'))?.config || {};
  if (config.autoScroll === undefined) config.autoScroll = true; // Auto listen enabled by default

  const safety = new SafetyController({
    dailyLimit: config.dailyCommentLimit || 30,
    minDelaySec: config.minCommentDelaySec || 60,
    maxDelaySec: config.maxCommentDelaySec || 180
  });

  // Load existing history
  if (config.history && Array.isArray(config.history)) {
    safety.loadHistory(config.history);
  }

  // Initialize in-page floating widget
  initFloatingWidget({
    enabled: config.enabled,
    onToggle: (newState) => {
      config.enabled = newState;
      chrome.storage.local.set({ config: { ...config, enabled: newState } });
      updateWidgetStatus(newState ? 'ĐANG LẮNG NGHE' : 'TẠM DỪNG', newState ? 'active' : 'idle');
    }
  });

  // Listen to configuration updates from Popup
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.config?.newValue) {
      config = changes.config.newValue;
      safety.dailyLimit = config.dailyCommentLimit || 30;
      safety.minDelaySec = config.minCommentDelaySec || 60;
      safety.maxDelaySec = config.maxCommentDelaySec || 180;
      updateWidgetStatus(config.enabled ? 'ĐANG LẮNG NGHE' : 'TẠM DỪNG', config.enabled ? 'active' : 'idle');
    }
  });

  let isProcessing = false;
  let scrollStepCount = 0;

  /**
   * Automatically check and click Facebook's "New Posts" / "Có bài viết mới" pill button
   */
  function checkAndClickNewPostsPill() {
    const candidateButtons = document.querySelectorAll('div[role="button"], span');
    for (const el of candidateButtons) {
      const text = el.textContent?.toLowerCase() || '';
      if (text.includes('bài viết mới') || text.includes('new posts') || text.includes('bài mới')) {
        const clickable = el.closest('div[role="button"]') || el;
        clickable.click();
        console.log('[FB Job Hunter] Đã click nút tải bài viết mới của Facebook');
        return true;
      }
    }
    return false;
  }

  function detectActiveIdentity() {
    const switchers = document.querySelectorAll('[aria-label*="Tương tác dưới tên"], [aria-label*="Bình luận dưới tên"], [aria-label*="Interacting as"], [aria-label*="Comment as"]');
    for (const el of switchers) {
      const label = el.getAttribute('aria-label') || '';
      const match = label.match(/(?:dưới tên|as)\s+([^.,;]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  // Main Scanning & Commenting Loop
  async function runScanCycle() {
    if (!config.enabled || isProcessing) return;

    // Only run on group pages or feed
    if (!window.location.pathname.includes('/groups/') && !window.location.pathname.includes('/feed')) {
      updateWidgetStatus('VÀO GROUP ĐỂ QUÉT', 'idle');
      return;
    }

    isProcessing = true;
    updateWidgetStatus('ĐANG LẮNG NGHE BÀI...', 'scanning');

    try {
      // Check current commenting identity (Page vs User)
      const currentIdentity = detectActiveIdentity();
      if (currentIdentity) {
        updateWidgetIdentity(currentIdentity);
      }

      // 1. Check if Facebook has a "New Posts" banner at the top
      checkAndClickNewPostsPill();

      const posts = scanFeed(document);

      for (const post of posts) {
        if (!config.enabled) break;

        // Evaluate filter rules
        const evalResult = evaluatePost(post.postText, config);
        if (!evalResult.matched) continue;

        // Check safety / duplicate / cooldown
        const safetyCheck = safety.canComment(post.id);
        if (!safetyCheck.allowed) continue;

        // Generate Comment text (AI or Spintax)
        updateWidgetStatus(`PHÁT HIỆN: ${post.authorName}`, 'active');
        const pitchResult = await generateAIPitch(post.postText, config);
        const commentText = pitchResult.comment;

        // Post comment
        try {
          updateWidgetStatus(`ĐANG COMMENT: ${post.authorName}`, 'active');
          await postCommentOnFacebook(post.element, commentText);

          // Record comment
          safety.recordComment(post.id, commentText, post.postUrl);

          // Save to persistent storage
          const historyItem = {
            id: post.id,
            authorName: post.authorName,
            postUrl: post.postUrl,
            postText: post.postText.slice(0, 200),
            matchScore: evalResult.score,
            matchedKeywords: evalResult.matchedWhitelist,
            commentText,
            commentedAt: Date.now(),
            status: 'commented'
          };

          const currentHistory = config.history || [];
          currentHistory.unshift(historyItem);
          if (currentHistory.length > 200) currentHistory.pop(); // Keep max 200 items

          await chrome.storage.local.set({
            config: { ...config, history: currentHistory }
          });

          // Log in floating widget
          addWidgetJobLog(historyItem);

          // Notify Background Worker (Telegram alert)
          chrome.runtime.sendMessage({
            type: 'NOTIFY_JOB_MATCH',
            payload: historyItem
          });

          console.log(`[FB Job Hunter] Comment thành công trên bài viết của: ${post.authorName}`);
        } catch (postErr) {
          console.warn(`[FB Job Hunter] Không thể comment trên bài viết ${post.id}:`, postErr.message);
        }
      }

      // Smart Autonomous Scrolling:
      // Tự động cuộn theo nhịp tự nhiên để Facebook load bài mới.
      // Sau 15-20 lần cuộn (~ 1-2 phút), tự động cuộn lên đầu để kiểm tra bài vừa mới đăng!
      if (config.autoScroll) {
        scrollStepCount++;
        if (scrollStepCount > 15) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          scrollStepCount = 0;
          setTimeout(checkAndClickNewPostsPill, 1500);
        } else {
          const randomScroll = 300 + Math.floor(Math.random() * 200);
          window.scrollBy({ top: randomScroll, behavior: 'smooth' });
        }
      }

      updateWidgetStatus(config.enabled ? 'ĐANG LẮNG NGHE' : 'TẠM DỪNG', config.enabled ? 'active' : 'idle');
    } catch (err) {
      console.error('[FB Job Hunter] Lỗi chu kỳ quét:', err);
    } finally {
      isProcessing = false;
    }
  }

  // Realtime DOM Mutation Observer:
  // Lắng nghe ngay khi Facebook render thêm bài viết mới vào feed
  let debounceTimeout = null;
  const feedObserver = new MutationObserver((mutations) => {
    if (!config.enabled || isProcessing) return;

    let hasNewArticle = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.matches?.('div[role="article"]') || node.querySelector?.('div[role="article"]')) {
              hasNewArticle = true;
              break;
            }
          }
        }
      }
      if (hasNewArticle) break;
    }

    if (hasNewArticle) {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        runScanCycle();
      }, 1000); // 1s debounce to let FB render content
    }
  });

  feedObserver.observe(document.body, { childList: true, subtree: true });

  // Fallback periodic scan timer (mỗi 4-5s)
  const intervalMs = config.scanIntervalMs || 4000;
  setInterval(runScanCycle, intervalMs);

  // Initial trigger
  setTimeout(runScanCycle, 2000);
})();
