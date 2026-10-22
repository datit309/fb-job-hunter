/**
 * Content Script Orchestrator for FB Job Hunter
 * Runs inside facebook.com/groups/*
 * Scans feed, evaluates matching posts, invokes AI or Spintax, and automates safe commenting.
 */

(async () => {
  console.log('[FB Job Hunter] Extension Content Script loaded on Facebook.');

  // Dynamically import modules via extension runtime URLs
  const { scanFeed } = await import(chrome.runtime.getURL('content/dom-scanner.js'));
  const { evaluatePost } = await import(chrome.runtime.getURL('lib/filter-engine.js'));
  const { generateAIPitch } = await import(chrome.runtime.getURL('lib/ai-matcher.js'));
  const { SafetyController } = await import(chrome.runtime.getURL('content/safety.js'));
  const { postCommentOnFacebook } = await import(chrome.runtime.getURL('content/commenter.js'));
  const { initFloatingWidget, updateWidgetStatus, addWidgetJobLog } = await import(chrome.runtime.getURL('content/floating-widget.js'));

  // Load configuration
  let config = (await chrome.storage.local.get('config'))?.config || {};
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
      updateWidgetStatus(newState ? 'ĐANG CHẠY' : 'TẠM DỪNG', newState ? 'active' : 'idle');
    }
  });

  // Listen to configuration updates from Popup
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.config?.newValue) {
      config = changes.config.newValue;
      safety.dailyLimit = config.dailyCommentLimit || 30;
      safety.minDelaySec = config.minCommentDelaySec || 60;
      safety.maxDelaySec = config.maxCommentDelaySec || 180;
      updateWidgetStatus(config.enabled ? 'ĐANG CHẠY' : 'TẠM DỪNG', config.enabled ? 'active' : 'idle');
    }
  });

  let isProcessing = false;

  // Main Scanning & Commenting Loop
  async function runScanCycle() {
    if (!config.enabled || isProcessing) return;

    // Only run on group pages or feed
    if (!window.location.pathname.includes('/groups/') && !window.location.pathname.includes('/feed')) {
      updateWidgetStatus('VÀO GROUP ĐỂ QUÉT', 'idle');
      return;
    }

    isProcessing = true;
    updateWidgetStatus('ĐANG QUÉT BÀI...', 'scanning');

    try {
      const posts = scanFeed(document);

      for (const post of posts) {
        if (!config.enabled) break;

        // 1. Evaluate filter rules
        const evalResult = evaluatePost(post.postText, config);
        if (!evalResult.matched) continue;

        // 2. Check safety / duplicate / cooldown
        const safetyCheck = safety.canComment(post.id);
        if (!safetyCheck.allowed) {
          // If already commented or cooldown, log if not logged
          continue;
        }

        // 3. Generate Comment text (AI or Spintax)
        updateWidgetStatus(`PHÁT HIỆN: ${post.authorName}`, 'active');
        const pitchResult = await generateAIPitch(post.postText, config);
        const commentText = pitchResult.comment;

        // 4. Post comment
        try {
          updateWidgetStatus(`ĐANG COMMENT: ${post.authorName}`, 'active');
          await postCommentOnFacebook(post.element, commentText);

          // 5. Record comment
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

      // Auto scroll if enabled
      if (config.autoScroll) {
        window.scrollBy({ top: 400, behavior: 'smooth' });
      }

      updateWidgetStatus(config.enabled ? 'ĐANG CHẠY' : 'TẠM DỪNG', config.enabled ? 'active' : 'idle');
    } catch (err) {
      console.error('[FB Job Hunter] Lỗi chu kỳ quét:', err);
    } finally {
      isProcessing = false;
    }
  }

  // Periodic scan timer
  const intervalMs = config.scanIntervalMs || 5000;
  setInterval(runScanCycle, intervalMs);

  // Run initial cycle after 2 seconds
  setTimeout(runScanCycle, 2000);
})();
