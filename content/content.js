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

  const DEFAULT_FALLBACK_CONFIG = {
    enabled: true,
    autoScroll: true,
    scanScope: 'all',
    scanIntervalMs: 4000,
    dailyCommentLimit: 30,
    minCommentDelaySec: 60,
    maxCommentDelaySec: 180,
    isCompanyPage: true,
    whitelistKeywords: [
      'tìm dev',
      'cần dev',
      'outsource',
      'freelance',
      'viết tool',
      'làm web',
      'làm app',
      'flutter',
      'react',
      'nodejs',
      'python',
      'backend',
      'fullstack',
      'nhận dự án',
      'cào dữ liệu',
      'viết bot'
    ],
    blacklistKeywords: [
      'tuyển sinh',
      'khóa học',
      'bán acc',
      'tuyển dụng sale',
      'fulltime tại',
      'onsite',
      'yêu cầu lên công ty',
      'đa cấp',
      'tuyển mẫu',
      'cho thuê'
    ],
    spintaxTemplates: [
      '{Dạ chào bạn|Chào bạn|Chào anh/chị}, bài toán {này|kỹ thuật này|dự án này} team bên em đã từng triển khai sản phẩm thực tế tương tự. Nếu bạn cần tham khảo thêm về giải pháp kiến trúc hoặc demo, có thể ghé qua Page bên em nhé ạ.',
      '{Chào bạn|Dạ chào anh/chị}, bên mình là đơn vị chuyên phát triển {hệ thống phần mềm|web app|ứng dụng di động và tool tự động} theo yêu cầu. Rất mong có cơ hội được hỗ trợ và đồng hành cùng dự án của bạn.',
      '{Chào bạn|Hi bạn}, mảng {này|công nghệ này} bên mình có sẵn đội ngũ kỹ thuật có thể tư vấn giải pháp tối ưu và triển khai nhanh chóng. Bạn cần thêm thông tin cứ kết nối với page bên mình nha.',
      '{Dạ chào bạn|Chào anh/chị}, bên em chuyên nhận gia công và phát triển phần mềm chuẩn tiến độ, có thể hỗ trợ tư vấn kỹ thuật chi tiết. Chúc dự án của bạn sớm tìm được team ưng ý nhé ạ!'
    ]
  };

  // Load configuration with robust fallbacks
  const storedData = (await chrome.storage?.local?.get('config'))?.config;
  let config = { ...DEFAULT_FALLBACK_CONFIG, ...(storedData || {}) };
  if (!storedData) {
    try {
      await chrome.storage?.local?.set({ config });
    } catch (e) {}
  }

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
      try {
        chrome.storage?.local?.set({ config: { ...config, enabled: newState } });
      } catch (e) {}
      const locHint = getPageLocationHint();
      updateWidgetStatus(newState ? `${locHint}: ĐANG LẮNG NGHE` : 'TẠM DỪNG', newState ? 'active' : 'idle');
      if (newState) {
        runScanCycle(true);
      }
    },
    onScanNow: () => {
      console.log('[FB Job Hunter] 👉 Người dùng bấm Quét ngay trên widget');
      runScanCycle(true);
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

  function isSupportedFacebookPage(cfg = config) {
    const path = window.location.pathname;

    // Exclude system, chat, or settings pages
    if (
      path.startsWith('/messages') ||
      path.startsWith('/notifications') ||
      path.startsWith('/settings') ||
      path.startsWith('/saved') ||
      path.startsWith('/marketplace') ||
      path.startsWith('/gaming') ||
      path.startsWith('/login') ||
      path.startsWith('/recover')
    ) {
      return false;
    }

    const scope = cfg.scanScope || 'all'; // 'all' | 'feed_only' | 'groups_only'
    const isGroup = path.includes('/groups/');
    const isFeed =
      path === '/' ||
      path === '' ||
      path === '/home.php' ||
      path.startsWith('/feed') ||
      window.location.search.includes('sk=h_chr') ||
      window.location.search.includes('filter=all');

    if (scope === 'groups_only') {
      return isGroup;
    }
    if (scope === 'feed_only') {
      return isFeed;
    }

    // Default 'all': valid on Group, News Feed, or any page containing post articles/feed
    return isGroup || isFeed || Boolean(document.querySelector('[role="feed"], [role="article"]'));
  }

  function getPageLocationHint() {
    const path = window.location.pathname;
    if (path.includes('/groups/')) return 'NHÓM';
    if (path === '/' || path === '' || path === '/home.php' || path.startsWith('/feed')) return 'BẢNG TIN';
    return 'FACEBOOK';
  }

  // Main Scanning & Commenting Loop
  async function runScanCycle(force = false) {
    if (!config.enabled && !force) return;
    if (isProcessing) return;

    if (!isSupportedFacebookPage(config)) {
      const scope = config.scanScope || 'all';
      if (scope === 'groups_only') {
        updateWidgetStatus('VÀO GROUP ĐỂ QUÉT', 'idle');
      } else if (scope === 'feed_only') {
        updateWidgetStatus('VÀO BẢNG TIN ĐỂ QUÉT', 'idle');
      } else {
        updateWidgetStatus('MỞ BẢNG TIN / GROUP', 'idle');
      }
      return;
    }

    isProcessing = true;
    const locHint = getPageLocationHint();

    try {
      // Check current commenting identity (Page vs User)
      const currentIdentity = detectActiveIdentity();
      if (currentIdentity) {
        updateWidgetIdentity(currentIdentity);
      }

      // 1. Check if Facebook has a "New Posts" banner at the top
      checkAndClickNewPostsPill();

      const posts = scanFeed(document);
      console.log(`[FB Job Hunter] (${locHint}) Đã quét thấy ${posts.length} bài viết.`);
      updateWidgetStatus(`${locHint}: QUÉT ${posts.length} BÀI`, 'scanning');

      let matchedCount = 0;
      for (const post of posts) {
        if (!config.enabled && !force) break;

        // Evaluate filter rules
        const evalResult = evaluatePost(post.postText, config);
        if (!evalResult.matched) continue;

        matchedCount++;
        console.log(`[FB Job Hunter] 🎯 PHÁT HIỆN BÀI KHỚP của "${post.authorName}" (Điểm: ${evalResult.score}): [${evalResult.matchedWhitelist.join(', ')}]`);

        // Check safety / duplicate / cooldown
        const safetyCheck = safety.canComment(post.id);
        if (!safetyCheck.allowed) {
          console.log(`[FB Job Hunter] ⏳ Chưa thể bình luận bài "${post.id}": ${safetyCheck.reason}`);
          updateWidgetStatus(`CHỜ: ${safetyCheck.reason.slice(0, 18)}`, 'idle');
          continue;
        }

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

          try {
            await chrome.storage?.local?.set({
              config: { ...config, history: currentHistory }
            });
          } catch (storageErr) {
            console.warn('[FB Job Hunter] Storage set warning:', storageErr);
          }

          // Log in floating widget
          addWidgetJobLog(historyItem);

          // Notify Background Worker (Telegram alert)
          try {
            if (chrome.runtime?.id) {
              chrome.runtime.sendMessage({
                type: 'NOTIFY_JOB_MATCH',
                payload: historyItem
              }).catch(() => {});
            }
          } catch (runtimeErr) {
            // Service worker or extension context reloaded
          }

          console.log(`[FB Job Hunter] ✅ Bình luận thành công bài viết của: ${post.authorName}`);
        } catch (postErr) {
          console.warn(`[FB Job Hunter] ❌ Lỗi khi comment trên bài viết ${post.id}:`, postErr.message);
        }
      }

      if (matchedCount === 0 && posts.length > 0) {
        console.log(`[FB Job Hunter] (${locHint}) Đã quét ${posts.length} bài nhưng chưa có bài nào chứa từ khóa tìm kiếm (whitelist).`);
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

      updateWidgetStatus(config.enabled ? `${locHint}: ĐANG LẮNG NGHE (${posts.length} bài)` : 'TẠM DỪNG', config.enabled ? 'active' : 'idle');
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

  // Kích hoạt quét ngay khi người dùng chuyển lại tab Facebook từ tab khác
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && config.enabled) {
      console.log('[FB Job Hunter] Tab Facebook active trở lại — kích hoạt quét');
      setTimeout(runScanCycle, 800);
    }
  });

  // Tự động nhận diện khi chuyển trang Facebook (Bảng tin, Nhóm, Tab)
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[FB Job Hunter] Chuyển tab/trang Facebook:', lastUrl);
      if (isSupportedFacebookPage(config)) {
        const locHint = getPageLocationHint();
        updateWidgetStatus(config.enabled ? `${locHint}: ĐANG LẮNG NGHE` : 'TẠM DỪNG', config.enabled ? 'active' : 'idle');
        setTimeout(runScanCycle, 1500);
      } else {
        const scope = config.scanScope || 'all';
        if (scope === 'groups_only') {
          updateWidgetStatus('VÀO GROUP ĐỂ QUÉT', 'idle');
        } else if (scope === 'feed_only') {
          updateWidgetStatus('VÀO BẢNG TIN ĐỂ QUÉT', 'idle');
        } else {
          updateWidgetStatus('MỞ BẢNG TIN / GROUP', 'idle');
        }
      }
    }
  }, 1000);

  // Initial trigger
  setTimeout(runScanCycle, 2000);
})();
