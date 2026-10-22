import { parseSpintax } from '../lib/spintax.js';
import { formatKeywordsInput, validateConfig } from '../lib/config-helper.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const masterToggle = document.getElementById('master-toggle');
  const statusText = document.getElementById('status-text');
  const statScanned = document.getElementById('stat-scanned');
  const statMatched = document.getElementById('stat-matched');
  const statCommented = document.getElementById('stat-commented');
  
  const autoScrollToggle = document.getElementById('auto-scroll-toggle');
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

  const historyContainer = document.getElementById('history-container');
  const btnClearHistory = document.getElementById('btn-clear-history');

  const btnSaveConfig = document.getElementById('btn-save-config');
  const saveToast = document.getElementById('save-toast');

  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Toggle API key visibility
  toggleKeyVisibility.addEventListener('click', () => {
    if (aiApiKey.type === 'password') {
      aiApiKey.type = 'text';
      toggleKeyVisibility.textContent = '🙈';
    } else {
      aiApiKey.type = 'password';
      toggleKeyVisibility.textContent = '👁️';
    }
  });

  // Load configuration
  let stored = (await chrome.storage.local.get('config'))?.config || {};

  function populateUI(cfg) {
    masterToggle.checked = Boolean(cfg.enabled);
    updateMasterStatusBadge(cfg.enabled);

    autoScrollToggle.checked = Boolean(cfg.autoScroll);
    scanInterval.value = String(cfg.scanIntervalMs || 5000);

    whitelistInput.value = (cfg.whitelistKeywords || []).join(', ');
    blacklistInput.value = (cfg.blacklistKeywords || []).join(', ');

    companyModeToggle.checked = cfg.isCompanyPage !== false;
    spintaxInput.value = (cfg.spintaxTemplates || []).join('\n');

    aiEnabledToggle.checked = Boolean(cfg.aiConfig?.enabled);
    aiProvider.value = cfg.aiConfig?.provider || 'deepseek';
    aiApiKey.value = cfg.aiConfig?.apiKey || '';
    aiCustomPrompt.value = cfg.aiConfig?.customPrompt || '';

    minDelayInput.value = cfg.minCommentDelaySec || 60;
    maxDelayInput.value = cfg.maxCommentDelaySec || 180;
    dailyLimitInput.value = cfg.dailyCommentLimit || 30;

    tgTokenInput.value = cfg.telegramConfig?.botToken || '';
    tgChatIdInput.value = cfg.telegramConfig?.chatId || '';

    renderHistory(cfg.history || []);
  }

  function updateMasterStatusBadge(enabled) {
    if (enabled) {
      statusText.textContent = 'Đang chạy (Sẵn sàng quét)';
      statusText.style.color = '#10b981';
    } else {
      statusText.textContent = 'Đã tạm dừng';
      statusText.style.color = '#94a3b8';
    }
  }

  masterToggle.addEventListener('change', async () => {
    const isEnabled = masterToggle.checked;
    updateMasterStatusBadge(isEnabled);
    stored.enabled = isEnabled;
    await chrome.storage.local.set({ config: stored });
  });

  // Spintax live test
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

  // Render History List
  function renderHistory(history) {
    const today = new Date().toDateString();
    const todayCount = history.filter((h) => new Date(h.commentedAt).toDateString() === today).length;
    const limit = stored.dailyCommentLimit || 30;

    statScanned.textContent = String(history.length);
    statMatched.textContent = String(history.length);
    statCommented.textContent = `${todayCount}/${limit}`;
    recentCount.textContent = `${Math.min(history.length, 5)} bài`;

    if (!history || history.length === 0) {
      historyContainer.innerHTML = '<div class="empty-state">Chưa có lịch sử ứng tuyển nào.</div>';
      recentList.innerHTML = '<div class="empty-state">Chưa có bài đăng nào được ghi nhận.</div>';
      return;
    }

    // Build history HTML
    historyContainer.innerHTML = history.map((item) => {
      const timeStr = new Date(item.commentedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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
          <span class="history-time">${new Date(item.commentedAt).toLocaleTimeString('vi-VN')}</span>
        </div>
        <div class="history-post-preview">${escapeHtml((item.postText || '').slice(0, 100))}...</div>
      </div>
    `).join('');
  }

  // Clear History
  btnClearHistory.addEventListener('click', async () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử quét và comment không?')) {
      stored.history = [];
      await chrome.storage.local.set({ config: stored });
      renderHistory([]);
    }
  });

  // Save Settings
  btnSaveConfig.addEventListener('click', async () => {
    const rawConfig = {
      ...stored,
      enabled: masterToggle.checked,
      autoScroll: autoScrollToggle.checked,
      scanIntervalMs: Number(scanInterval.value) || 5000,
      whitelistKeywords: formatKeywordsInput(whitelistInput.value),
      blacklistKeywords: formatKeywordsInput(blacklistInput.value),
      isCompanyPage: companyModeToggle.checked,
      spintaxTemplates: spintaxInput.value.split('\n').map((s) => s.trim()).filter((s) => s.length > 0),
      aiConfig: {
        enabled: aiEnabledToggle.checked,
        provider: aiProvider.value,
        apiKey: aiApiKey.value.trim(),
        customPrompt: aiCustomPrompt.value.trim()
      },
      minCommentDelaySec: Number(minDelayInput.value),
      maxCommentDelaySec: Number(maxDelayInput.value),
      dailyCommentLimit: Number(dailyLimitInput.value),
      telegramConfig: {
        botToken: tgTokenInput.value.trim(),
        chatId: tgChatIdInput.value.trim()
      }
    };

    const validated = validateConfig(rawConfig);
    stored = validated;
    await chrome.storage.local.set({ config: validated });

    // Show toast
    saveToast.classList.add('visible');
    setTimeout(() => {
      saveToast.classList.remove('visible');
    }, 2000);
  });

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
});
