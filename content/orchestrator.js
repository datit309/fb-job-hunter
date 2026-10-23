/**
 * Realtime Scanning & Auto-Comment Orchestrator
 */

// Default Whitelist Keywords if user has not configured yet
const DEFAULT_WHITELIST = [
  'tìm dev',
  'cần dev',
  'tuyển dev',
  'tìm coder',
  'cần coder',
  'outsource',
  'freelance',
  'viết tool',
  'làm web',
  'làm website',
  'thiết kế web',
  'làm app',
  'viết app',
  'làm phần mềm',
  'viết bot',
  'cào dữ liệu',
  'cào data',
  'viết extension',
  'nhận dự án',
  'nhận job',
  'flutter',
  'react',
  'nodejs',
  'python',
  'backend',
  'fullstack'
];

const DEFAULT_BLACKLIST = [
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
];

const DEFAULT_SPINTAX = [
  '{Dạ chào bạn|Chào bạn|Chào anh/chị}, bài toán {này|kỹ thuật này|dự án này} team bên em đã từng triển khai sản phẩm thực tế tương tự. Nếu bạn cần tham khảo thêm về giải pháp kiến trúc hoặc demo, có thể ghé qua Page bên em nhé ạ.',
  '{Chào bạn|Dạ chào anh/chị}, bên mình là đơn vị chuyên phát triển {hệ thống phần mềm|web app|ứng dụng di động và tool tự động} theo yêu cầu. Rất mong có cơ hội được hỗ trợ và đồng hành cùng dự án của bạn.',
  '{Chào bạn|Hi bạn}, mảng {này|công nghệ này} bên mình có sẵn đội ngũ kỹ thuật có thể tư vấn giải pháp tối ưu và triển khai nhanh chóng. Bạn cần thêm thông tin cứ kết nối với page bên mình nha.',
  '{Dạ chào bạn|Chào anh/chị}, bên em chuyên nhận gia công và phát triển phần mềm chuẩn tiến độ, có thể hỗ trợ tư vấn kỹ thuật chi tiết. Chúc dự án của bạn sớm tìm được team ưng ý nhé ạ!'
];

(async () => {
  // Load configuration safely with fallbacks
  let stored = null;
  try {
    stored = (await chrome.storage?.local?.get('config'))?.config;
  } catch (e) {
    console.warn('[FB Job Hunter] Storage get warning:', e);
  }

  let config = {
    enabled: true,
    autoScroll: true,
    scanScope: 'all',
    scanIntervalMs: 4000,
    minCommentDelaySec: 60,
    maxCommentDelaySec: 180,
    dailyCommentLimit: 30,
    isCompanyPage: true,
    whitelistKeywords: DEFAULT_WHITELIST,
    blacklistKeywords: DEFAULT_BLACKLIST,
    spintaxTemplates: DEFAULT_SPINTAX,
    ...(stored || {})
  };

  // If stored config was missing whitelist, populate default
  if (!config.whitelistKeywords || config.whitelistKeywords.length === 0) {
    config.whitelistKeywords = DEFAULT_WHITELIST;
  }
  if (!config.spintaxTemplates || config.spintaxTemplates.length === 0) {
    config.spintaxTemplates = DEFAULT_SPINTAX;
  }

  const safety = new SafetyController({
    dailyLimit: config.dailyCommentLimit || 30,
    minDelaySec: config.minCommentDelaySec || 60,
    maxDelaySec: config.maxCommentDelaySec || 180
  });

  if (config.history && Array.isArray(config.history)) {
    safety.loadHistory(config.history);
  }

  let isProcessing = false;
  let scrollStepCount = 0;

  function isSupportedFacebookPage(cfg = config) {
    const path = window.location.pathname;
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

    const scope = cfg.scanScope || 'all';
    const isGroup = path.includes('/groups/');
    const isFeed =
      path === '/' ||
      path === '' ||
      path === '/home.php' ||
      path.startsWith('/feed') ||
      window.location.search.includes('sk=h_chr') ||
      window.location.search.includes('filter=all');

    if (scope === 'groups_only') return isGroup;
    if (scope === 'feed_only') return isFeed;

    return isGroup || isFeed || Boolean(document.querySelector('[role="feed"], [role="article"]'));
  }

  function getPageLocationHint() {
    const path = window.location.pathname;
    if (path.includes('/groups/')) return 'NHÓM';
    if (path === '/' || path === '' || path === '/home.php' || path.startsWith('/feed')) return 'BẢNG TIN';
    return 'FEED';
  }

  function detectActiveIdentity() {
    const switchers = document.querySelectorAll(
      '[aria-label*="Tương tác dưới tên"], [aria-label*="Bình luận dưới tên"], [aria-label*="Interacting as"], [aria-label*="Comment as"]'
    );
    for (const el of switchers) {
      const label = el.getAttribute('aria-label') || '';
      const match = label.match(/(?:dưới tên|as)\s+([^.,;]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

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
    },
    onScanNow: () => {
      console.log('[FB Job Hunter] Kích hoạt Quét Nhanh ngay lập tức...');
      runScanCycle(true);
    }
  });

  // Listen to configuration updates from Popup
  try {
    chrome.storage?.onChanged?.addListener((changes) => {
      if (changes.config?.newValue) {
        config = { ...config, ...changes.config.newValue };
        safety.dailyLimit = config.dailyCommentLimit || 30;
        safety.minDelaySec = config.minCommentDelaySec || 60;
        safety.maxDelaySec = config.maxCommentDelaySec || 180;
        const locHint = getPageLocationHint();
        updateWidgetStatus(config.enabled ? `${locHint}: ĐANG LẮNG NGHE` : 'TẠM DỪNG', config.enabled ? 'active' : 'idle');
      }
    });
  } catch (e) {}

  // Main Scanning & Commenting Loop
  async function runScanCycle(isManual = false) {
    if ((!config.enabled && !isManual) || isProcessing) return;

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
    updateWidgetStatus(`${locHint}: ĐANG QUÉT BÀI...`, 'scanning');

    try {
      const currentIdentity = detectActiveIdentity();
      if (currentIdentity) {
        updateWidgetIdentity(currentIdentity);
      }

      checkAndClickNewPostsPill();

      const posts = scanFeed(document);
      console.log(`[FB Job Hunter] ${locHint}: Phát hiện ${posts.length} bài viết trên màn hình.`);

      let matchCount = 0;

      for (const post of posts) {
        if (!config.enabled && !isManual) break;

        const evalResult = evaluatePost(post.postText, config);
        if (!evalResult.matched) {
          continue;
        }

        matchCount++;
        console.log(`[FB Job Hunter] 🎯 KHỚP JOB: Tác giả: "${post.authorName}" (Điểm: ${evalResult.score}). Từ khóa: [${evalResult.matchedWhitelist.join(', ')}]`);

        // Check safety rules
        const safetyCheck = safety.canComment(post.id);
        if (!safetyCheck.allowed) {
          console.log(`[FB Job Hunter] ⏳ Chưa bình luận bài của ${post.authorName}: ${safetyCheck.reason}`);
          continue;
        }

        // Generate comment text (AI or Spintax)
        updateWidgetStatus(`PHÁT HIỆN: ${post.authorName}`, 'active');
        const pitchResult = await generateAIPitch(post.postText, config);
        const commentText = pitchResult.comment;

        // Post comment
        try {
          updateWidgetStatus(`ĐANG COMMENT: ${post.authorName}`, 'active');
          await postCommentOnFacebook(post.element, commentText);

          // Record comment in safety controller
          safety.recordComment(post.id, commentText, post.postUrl);

          // Save to persistent storage history
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
          if (currentHistory.length > 200) currentHistory.pop();

          try {
            await chrome.storage?.local?.set({
              config: { ...config, history: currentHistory }
            });
          } catch (storageErr) {}

          // Add to widget drawer
          addWidgetJobLog(historyItem);

          // Send Telegram notification
          try {
            if (chrome.runtime?.id) {
              chrome.runtime.sendMessage({
                type: 'NOTIFY_JOB_MATCH',
                payload: historyItem
              }).catch(() => {});
            }
          } catch (runtimeErr) {}

          console.log(`[FB Job Hunter] ✅ Comment thành công trên bài viết của: ${post.authorName}`);
        } catch (postErr) {
          console.warn(`[FB Job Hunter] ❌ Không thể comment bài viết ${post.id}:`, postErr.message);
        }
      }

      // Auto-scrolling
      if (config.autoScroll && !isManual) {
        scrollStepCount++;
        if (scrollStepCount > 12) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          scrollStepCount = 0;
          setTimeout(checkAndClickNewPostsPill, 1500);
        } else {
          const randomScroll = 350 + Math.floor(Math.random() * 250);
          window.scrollBy({ top: randomScroll, behavior: 'smooth' });
        }
      }

      const statusSuffix = matchCount > 0 ? `(${matchCount} việc khớp)` : `(${posts.length} bài)`;
      updateWidgetStatus(
        config.enabled ? `${locHint}: ĐANG LẮNG NGHE ${statusSuffix}` : 'TẠM DỪNG',
        config.enabled ? 'active' : 'idle'
      );
    } catch (err) {
      console.error('[FB Job Hunter] Lỗi chu kỳ quét:', err);
    } finally {
      isProcessing = false;
    }
  }

  // Realtime MutationObserver
  let debounceTimeout = null;
  const feedObserver = new MutationObserver((mutations) => {
    if (!config.enabled || isProcessing) return;

    let hasNewArticle = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
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
      }, 1000);
    }
  });

  feedObserver.observe(document.body, { childList: true, subtree: true });

  // Periodic scan timer
  const intervalMs = config.scanIntervalMs || 4000;
  setInterval(runScanCycle, intervalMs);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && config.enabled) {
      setTimeout(runScanCycle, 800);
    }
  });

  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[FB Job Hunter] Chuyển trang Facebook:', lastUrl);
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
  setTimeout(runScanCycle, 1500);
})();
