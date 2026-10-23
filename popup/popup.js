import { parseSpintax } from '../lib/spintax.js';
import { formatKeywordsInput, validateConfig } from '../lib/config-helper.js';
import { sendTelegramMessage, formatTestMessage } from '../lib/telegram.js';

// Safe storage access helper
async function getStoredConfig() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const res = await chrome.storage.local.get('config');
      return res?.config || {};
    } catch (e) {
      console.warn('[Popup] Error reading storage:', e);
    }
  }
  return {};
}

async function setStoredConfig(data) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set(data);
      return true;
    } catch (e) {
      console.warn('[Popup] Error writing storage:', e);
    }
  }
  return false;
}

async function initPopup() {
  // Elements
  const masterToggle = document.getElementById('master-toggle');
  const statusText = document.getElementById('status-text');
  const statScanned = document.getElementById('stat-scanned');
  const statMatched = document.getElementById('stat-matched');
  const statCommented = document.getElementById('stat-commented');
  
  const autoScrollToggle = document.getElementById('auto-scroll-toggle');
  const scanScope = document.getElementById('scan-scope');
  const scanInterval = document.getElementById('scan-interval');
  const recentList = document.getElementById('recent-list');
  const recentCount = document.getElementById('recent-count');

  const whitelistInput = document.getElementById('whitelist-input');
  const blacklistInput = document.getElementById('blacklist-input');

  const companyModeToggle = document.getElementById('company-mode-toggle');
  const spintaxInput = document.getElementById('spintax-input');
  const btnTestSpintax = document.getElementById('btn-test-spintax');
  const spintaxPreview = document.getElementById('spintax-preview');

  const aiEnabledToggle = document.getElementById('ai-enabled-toggle');
  const aiProvider = document.getElementById('ai-provider');
  const aiApiKey = document.getElementById('ai-api-key');
  const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
  const aiCustomPrompt = document.getElementById('ai-custom-prompt');

  const minDelayInput = document.getElementById('min-delay');
  const maxDelayInput = document.getElementById('max-delay');
  const dailyLimitInput = document.getElementById('daily-limit');
  const tgTokenInput = document.getElementById('tg-token');
  const tgChatIdInput = document.getElementById('tg-chat-id');
  const btnTestTelegram = document.getElementById('btn-test-telegram');
  const tgTestStatus = document.getElementById('tg-test-status');

  const historyContainer = document.getElementById('history-container');
  const btnClearHistory = document.getElementById('btn-clear-history');

  const btnSaveConfig = document.getElementById('btn-save-config');
  const saveToast = document.getElementById('save-toast');

  // Tab switching logic (Active immediately)
  const navTabs = document.querySelector('.nav-tabs');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function switchTab(targetId) {
    if (!targetId) return;
    tabButtons.forEach((b) => {
      if (b.dataset.tab === targetId) {
        b.classList.add('active');
        // Smoothly scroll active tab into view
        b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        b.classList.remove('active');
      }
    });

    tabPanes.forEach((p) => {
      if (p.id === targetId) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Enable horizontal mouse wheel scrolling across nav tabs
  if (navTabs) {
    navTabs.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        navTabs.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // Drag-to-scroll for desktop mouse navigation
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let hasDragged = false;

    navTabs.addEventListener('mousedown', (e) => {
      isDown = true;
      hasDragged = false;
      startX = e.pageX - navTabs.offsetLeft;
      scrollStart = navTabs.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
      isDown = false;
      setTimeout(() => { hasDragged = false; }, 50);
    });

    navTabs.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const x = e.pageX - navTabs.offsetLeft;
      const walk = (x - startX) * 1.2;
      if (Math.abs(walk) > 4) {
        hasDragged = true;
        e.preventDefault();
        navTabs.scrollLeft = scrollStart - walk;
      }
    });

    // Prevent accidental tab switch if user was dragging
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (hasDragged) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }, true);
    });
  }

  // Toggle API key visibility
  if (toggleKeyVisibility && aiApiKey) {
    toggleKeyVisibility.addEventListener('click', () => {
      if (aiApiKey.type === 'password') {
        aiApiKey.type = 'text';
        toggleKeyVisibility.textContent = '🙈';
      } else {
        aiApiKey.type = 'password';
        toggleKeyVisibility.textContent = '👁️';
      }
    });
  }

  // Load configuration safely
  let stored = await getStoredConfig();

  function populateUI(cfg = {}) {
    if (masterToggle) {
      masterToggle.checked = Boolean(cfg.enabled);
      updateMasterStatusBadge(cfg.enabled);
    }

    if (autoScrollToggle) autoScrollToggle.checked = Boolean(cfg.autoScroll);
    if (scanScope) scanScope.value = cfg.scanScope || 'all';
    if (scanInterval) scanInterval.value = String(cfg.scanIntervalMs || 5000);

    if (whitelistInput) whitelistInput.value = (cfg.whitelistKeywords || []).join(', ');
    if (blacklistInput) blacklistInput.value = (cfg.blacklistKeywords || []).join(', ');

    if (companyModeToggle) companyModeToggle.checked = cfg.isCompanyPage !== false;
    if (spintaxInput) spintaxInput.value = (cfg.spintaxTemplates || []).join('\n');

    if (aiEnabledToggle) aiEnabledToggle.checked = Boolean(cfg.aiConfig?.enabled);
    if (aiProvider) aiProvider.value = cfg.aiConfig?.provider || 'deepseek';
    if (aiApiKey) aiApiKey.value = cfg.aiConfig?.apiKey || '';
    if (aiCustomPrompt) aiCustomPrompt.value = cfg.aiConfig?.customPrompt || '';

    if (minDelayInput) minDelayInput.value = cfg.minCommentDelaySec || 60;
    if (maxDelayInput) maxDelayInput.value = cfg.maxCommentDelaySec || 180;
    if (dailyLimitInput) dailyLimitInput.value = cfg.dailyCommentLimit || 30;

    if (tgTokenInput) tgTokenInput.value = cfg.telegramConfig?.botToken || cfg.telegramBotToken || '';
    if (tgChatIdInput) tgChatIdInput.value = cfg.telegramConfig?.chatId || cfg.telegramChatId || '';

    renderHistory(cfg.history || []);
  }

  function updateMasterStatusBadge(enabled) {
    if (!statusText) return;
    if (enabled) {
      statusText.textContent = 'Đang chạy (Sẵn sàng quét)';
      statusText.style.color = '#10b981';
    } else {
      statusText.textContent = 'Đã tạm dừng';
      statusText.style.color = '#94a3b8';
    }
  }

  if (masterToggle) {
    masterToggle.addEventListener('change', async () => {
      const isEnabled = masterToggle.checked;
      updateMasterStatusBadge(isEnabled);
      stored.enabled = isEnabled;
      await setStoredConfig({ config: stored });
    });
  }

  // Spintax live test
  if (btnTestSpintax && spintaxInput && spintaxPreview) {
    btnTestSpintax.addEventListener('click', () => {
      const lines = spintaxInput.value.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        spintaxPreview.textContent = 'Vui lòng nhập ít nhất 1 dòng mẫu spintax.';
        return;
      }
      const randomLine = lines[Math.floor(Math.random() * lines.length)];
      const generated = parseSpintax(randomLine);
      spintaxPreview.textContent = `"${generated}"`;
    });
  }

  // Telegram test message sender
  if (btnTestTelegram) {
    btnTestTelegram.addEventListener('click', async () => {
      const token = (tgTokenInput?.value || '').trim();
      const chatId = (tgChatIdInput?.value || '').trim();

      if (!token || !chatId) {
        if (tgTestStatus) {
          tgTestStatus.textContent = '⚠️ Vui lòng nhập cả Bot Token và Chat ID trước!';
          tgTestStatus.style.color = '#f59e0b';
        }
        return;
      }

      try {
        btnTestTelegram.disabled = true;
        if (tgTestStatus) {
          tgTestStatus.textContent = '⏳ Đang bắn tin nhắn test tới Telegram...';
          tgTestStatus.style.color = '#38bdf8';
        }

        await sendTelegramMessage(token, chatId, formatTestMessage());

        if (tgTestStatus) {
          tgTestStatus.textContent = '✅ Đã bắn test thành công! Hãy kiểm tra Telegram.';
          tgTestStatus.style.color = '#10b981';
        }
      } catch (err) {
        if (tgTestStatus) {
          tgTestStatus.textContent = `❌ Lỗi: ${err.message}`;
          tgTestStatus.style.color = '#ef4444';
        }
      } finally {
        btnTestTelegram.disabled = false;
      }
    });
  }

  // Render History List
  function renderHistory(history = []) {
    const today = new Date().toDateString();
    const todayCount = history.filter((h) => new Date(h.commentedAt).toDateString() === today).length;
    const limit = stored.dailyCommentLimit || 30;

    if (statScanned) statScanned.textContent = String(history.length);
    if (statMatched) statMatched.textContent = String(history.length);
    if (statCommented) statCommented.textContent = `${todayCount}/${limit}`;
    if (recentCount) recentCount.textContent = `${Math.min(history.length, 5)} bài`;

    if (!historyContainer || !recentList) return;

    if (history.length === 0) {
      historyContainer.innerHTML = '<div class="empty-state">Chưa có lịch sử ứng tuyển nào.</div>';
      recentList.innerHTML = '<div class="empty-state">Chưa có bài đăng nào được ghi nhận.</div>';
      return;
    }

    // Build history HTML
    historyContainer.innerHTML = history.map((item) => {
      const timeStr = new Date(item.commentedAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="history-item">
          <div class="history-item-top">
            <span class="history-author">👤 ${escapeHtml(item.authorName || 'Khách hàng')}</span>
            <span class="history-time">${timeStr}</span>
          </div>
          <div class="history-post-preview">${escapeHtml(item.postText || '')}</div>
          <div class="history-comment-bubble">💬 "${escapeHtml(item.commentText || '')}"</div>
          <div class="history-actions">
            ${item.postUrl ? `<a href="${item.postUrl}" target="_blank" class="history-link">🔗 Xem bài viết</a>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Recent 3 list in overview
    recentList.innerHTML = history.slice(0, 3).map((item) => `
      <div class="history-item">
        <div class="history-item-top">
          <span class="history-author">👤 ${escapeHtml(item.authorName || 'Khách')}</span>
          <span class="history-time">${new Date(item.commentedAt || Date.now()).toLocaleTimeString('vi-VN')}</span>
        </div>
        <div class="history-post-preview">${escapeHtml((item.postText || '').slice(0, 100))}...</div>
      </div>
    `).join('');
  }

  // Clear History
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử quét và comment không?')) {
        stored.history = [];
        await setStoredConfig({ config: stored });
        renderHistory([]);
      }
    });
  }

  // Save Settings
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async () => {
      const rawConfig = {
        ...stored,
        enabled: masterToggle ? masterToggle.checked : true,
        autoScroll: autoScrollToggle ? autoScrollToggle.checked : true,
        scanScope: scanScope?.value || 'all',
        scanIntervalMs: Number(scanInterval?.value) || 5000,
        whitelistKeywords: formatKeywordsInput(whitelistInput?.value || ''),
        blacklistKeywords: formatKeywordsInput(blacklistInput?.value || ''),
        isCompanyPage: companyModeToggle ? companyModeToggle.checked : true,
        spintaxTemplates: (spintaxInput?.value || '').split('\n').map((s) => s.trim()).filter((s) => s.length > 0),
        aiConfig: {
          enabled: aiEnabledToggle ? aiEnabledToggle.checked : false,
          provider: aiProvider?.value || 'deepseek',
          apiKey: (aiApiKey?.value || '').trim(),
          customPrompt: (aiCustomPrompt?.value || '').trim()
        },
        minCommentDelaySec: Number(minDelayInput?.value) || 60,
        maxCommentDelaySec: Number(maxDelayInput?.value) || 180,
        dailyCommentLimit: Number(dailyLimitInput?.value) || 30,
        telegramConfig: {
          botToken: (tgTokenInput?.value || '').trim(),
          chatId: (tgChatIdInput?.value || '').trim()
        },
        telegramBotToken: (tgTokenInput?.value || '').trim(),
        telegramChatId: (tgChatIdInput?.value || '').trim()
      };

      const validated = validateConfig(rawConfig);
      stored = validated;
      await setStoredConfig({ config: validated });

      // Show toast
      if (saveToast) {
        saveToast.classList.add('visible');
        setTimeout(() => {
          saveToast.classList.remove('visible');
        }, 2000);
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  populateUI(stored);
}

// Immediate execution if DOM is already ready, or listen to DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}
