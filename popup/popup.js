import { parseSpintax } from '../lib/spintax.js';
import { formatKeywordsInput, validateConfig } from '../lib/config-helper.js';
import { sendTelegramMessage, formatTestMessage } from '../lib/telegram.js';
import { publishToPage, verifyPageToken } from '../lib/page-publisher.js';
import { generateFanpagePost } from '../lib/ai-post-writer.js';
import {
  generateBulkCampaignPosts,
  exportCampaignToCsv,
  updateCampaignPostStatus
} from '../lib/business-suite-planner.js';

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

  // Fanpage Auto-Publisher elements
  const fanpageIdInput = document.getElementById('fanpage-id');
  const fanpageTokenInput = document.getElementById('fanpage-token');
  const toggleTokenVisibility = document.getElementById('toggle-token-visibility');
  const btnVerifyPageToken = document.getElementById('btn-verify-page-token');
  const pageVerifyStatus = document.getElementById('page-verify-status');
  const fanpageTopicSelect = document.getElementById('fanpage-topic');
  const customTopicGroup = document.getElementById('custom-topic-group');
  const fanpageCustomTopicInput = document.getElementById('fanpage-custom-topic');
  const fanpageHighlightsInput = document.getElementById('fanpage-highlights');
  const fanpageContactInfoInput = document.getElementById('fanpage-contact-info');
  const btnGenerateFanpagePost = document.getElementById('btn-generate-fanpage-post');
  const aiGenerateStatus = document.getElementById('ai-generate-status');
  const fanpagePostContent = document.getElementById('fanpage-post-content');
  const fanpagePostLink = document.getElementById('fanpage-post-link');
  const btnPublishFanpagePost = document.getElementById('btn-publish-fanpage-post');
  const fanpagePublishResult = document.getElementById('fanpage-publish-result');

  // Meta Business Suite Planner elements
  const subtabBtns = document.querySelectorAll('.subtab-btn');
  const subpanes = document.querySelectorAll('.subpane');
  const campaignPostsCount = document.getElementById('campaign-posts-count');
  const campaignHighlights = document.getElementById('campaign-highlights');
  const campaignContact = document.getElementById('campaign-contact');
  const btnGenerateCampaign = document.getElementById('btn-generate-campaign');
  const campaignGenerateStatus = document.getElementById('campaign-generate-status');
  const campaignCountBadge = document.getElementById('campaign-count-badge');
  const btnOpenMetaPlanner = document.getElementById('btn-open-meta-planner');
  const btnExportCampaignCsv = document.getElementById('btn-export-campaign-csv');
  const btnClearCampaign = document.getElementById('btn-clear-campaign');
  const campaignPostsList = document.getElementById('campaign-posts-list');

  let currentCampaignPosts = [];

  // Helper to load campaign posts
  async function loadCampaignPosts() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const res = await chrome.storage.local.get('campaign_posts');
        currentCampaignPosts = Array.isArray(res.campaign_posts) ? res.campaign_posts : [];
      } catch (e) {
        currentCampaignPosts = [];
      }
    }
    renderCampaignList(currentCampaignPosts);
  }

  // Render campaign posts
  function renderCampaignList(posts = []) {
    if (campaignCountBadge) {
      const scheduledCount = posts.filter((p) => p.status === 'scheduled').length;
      campaignCountBadge.textContent = `${scheduledCount}/${posts.length} bài xong`;
    }

    if (!campaignPostsList) return;

    if (posts.length === 0) {
      campaignPostsList.innerHTML = `
        <div class="empty-state">
          Chưa có bài đăng nào trong chiến dịch.<br>Hãy bấm <strong>"✨ AI Tạo chiến dịch bài đăng"</strong> ở trên!
        </div>
      `;
      return;
    }

    campaignPostsList.innerHTML = posts.map((post, idx) => {
      const isDone = post.status === 'scheduled';
      const badgeClass = isDone ? 'scheduled' : 'pending';
      const badgeText = isDone ? 'Đã lên lịch' : 'Chờ lên lịch';

      return `
        <div class="campaign-post-item" data-id="${post.id}">
          <div class="campaign-post-header">
            <span class="campaign-post-slot">#${idx + 1} — 📅 ${post.scheduledDate} ⏰ ${post.scheduledTime}</span>
            <span class="campaign-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="campaign-post-title">${escapeHtml(post.title || 'Bài quảng bá')}</div>
          <div class="campaign-post-snippet">${escapeHtml(post.content || '')}</div>
          <div class="campaign-post-actions">
            <button type="button" class="btn btn-secondary btn-copy-post" data-id="${post.id}">📋 Copy</button>
            <button type="button" class="btn ${isDone ? 'btn-secondary' : 'btn-success'} btn-toggle-status" data-id="${post.id}">
              ${isDone ? '↩️ Đặt lại chờ' : '✅ Đã lên lịch'}
            </button>
            <button type="button" class="btn btn-danger-outline btn-delete-post" data-id="${post.id}">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach row events
    campaignPostsList.querySelectorAll('.btn-copy-post').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = currentCampaignPosts.find((item) => item.id === id);
        if (p) {
          navigator.clipboard.writeText(p.content);
          btn.textContent = 'Đã copy!';
          setTimeout(() => {
            btn.textContent = '📋 Copy';
          }, 1500);
        }
      });
    });

    campaignPostsList.querySelectorAll('.btn-toggle-status').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const p = currentCampaignPosts.find((item) => item.id === id);
        if (p) {
          const nextStatus = p.status === 'scheduled' ? 'pending' : 'scheduled';
          currentCampaignPosts = updateCampaignPostStatus(currentCampaignPosts, id, nextStatus);
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({ campaign_posts: currentCampaignPosts });
          }
          renderCampaignList(currentCampaignPosts);
        }
      });
    });

    campaignPostsList.querySelectorAll('.btn-delete-post').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        currentCampaignPosts = currentCampaignPosts.filter((item) => item.id !== id);
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ campaign_posts: currentCampaignPosts });
        }
        renderCampaignList(currentCampaignPosts);
      });
    });
  }

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

    if (fanpageIdInput) fanpageIdInput.value = cfg.fanpageConfig?.pageId || '';
    if (fanpageTokenInput) fanpageTokenInput.value = cfg.fanpageConfig?.pageToken || '';
    if (fanpageTopicSelect) {
      fanpageTopicSelect.value = cfg.fanpageConfig?.defaultTopic || 'general';
      if (customTopicGroup) {
        customTopicGroup.style.display = fanpageTopicSelect.value === 'custom' ? 'block' : 'none';
      }
    }

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

  // Fanpage Token Visibility Toggle
  if (toggleTokenVisibility && fanpageTokenInput) {
    toggleTokenVisibility.addEventListener('click', () => {
      if (fanpageTokenInput.type === 'password') {
        fanpageTokenInput.type = 'text';
        toggleTokenVisibility.textContent = '🙈';
      } else {
        fanpageTokenInput.type = 'password';
        toggleTokenVisibility.textContent = '👁️';
      }
    });
  }

  // Fanpage Topic Change
  if (fanpageTopicSelect && customTopicGroup) {
    fanpageTopicSelect.addEventListener('change', () => {
      customTopicGroup.style.display = fanpageTopicSelect.value === 'custom' ? 'block' : 'none';
    });
  }

  // Verify Fanpage Token
  if (btnVerifyPageToken) {
    btnVerifyPageToken.addEventListener('click', async () => {
      const pageId = (fanpageIdInput?.value || '').trim();
      const accessToken = (fanpageTokenInput?.value || '').trim();

      if (!pageId || !accessToken) {
        if (pageVerifyStatus) {
          pageVerifyStatus.textContent = '⚠️ Vui lòng nhập Page ID và Page Access Token trước!';
          pageVerifyStatus.style.color = '#f59e0b';
        }
        return;
      }

      btnVerifyPageToken.disabled = true;
      if (pageVerifyStatus) {
        pageVerifyStatus.textContent = '⏳ Đang kiểm tra quyền với Meta Graph API...';
        pageVerifyStatus.style.color = '#38bdf8';
      }

      const res = await verifyPageToken({ pageId, accessToken });
      btnVerifyPageToken.disabled = false;

      if (res.valid) {
        pageVerifyStatus.textContent = `✅ Hợp lệ! Trang: "${res.name}" (ID: ${res.id})`;
        pageVerifyStatus.style.color = '#10b981';
      } else {
        pageVerifyStatus.textContent = `❌ Lỗi: ${res.error}`;
        pageVerifyStatus.style.color = '#ef4444';
      }
    });
  }

  // Generate Fanpage Promotional Post with AI / Templates
  if (btnGenerateFanpagePost) {
    btnGenerateFanpagePost.addEventListener('click', async () => {
      btnGenerateFanpagePost.disabled = true;
      if (aiGenerateStatus) {
        aiGenerateStatus.textContent = '⏳ Đang tạo bài viết...';
        aiGenerateStatus.style.color = '#38bdf8';
      }

      const topic = fanpageTopicSelect?.value || 'general';
      const customTopicText = (fanpageCustomTopicInput?.value || '').trim();
      const serviceHighlights = (fanpageHighlightsInput?.value || '').trim();
      const contactInfo = (fanpageContactInfoInput?.value || '').trim();

      const aiCfg = {
        apiKey: (aiApiKey?.value || '').trim(),
        provider: aiProvider?.value || 'deepseek',
        model: aiProvider?.value === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'
      };

      try {
        const res = await generateFanpagePost({
          topic,
          customTopicText,
          serviceHighlights,
          contactInfo,
          config: aiCfg
        });

        if (fanpagePostContent) {
          fanpagePostContent.value = res.content;
        }

        if (aiGenerateStatus) {
          if (res.source === 'ai') {
            aiGenerateStatus.textContent = '✨ Đã tạo bài bằng AI thành công!';
            aiGenerateStatus.style.color = '#10b981';
          } else if (res.warning) {
            aiGenerateStatus.textContent = `⚠️ Dùng mẫu chuẩn (${res.warning})`;
            aiGenerateStatus.style.color = '#f59e0b';
          } else {
            aiGenerateStatus.textContent = '📋 Đã tạo bài từ mẫu dịch vụ chuyên nghiệp!';
            aiGenerateStatus.style.color = '#38bdf8';
          }
        }
      } catch (err) {
        if (aiGenerateStatus) {
          aiGenerateStatus.textContent = `❌ Lỗi: ${err.message}`;
          aiGenerateStatus.style.color = '#ef4444';
        }
      } finally {
        btnGenerateFanpagePost.disabled = false;
      }
    });
  }

  // Publish Post to Facebook Page via Meta Graph API
  if (btnPublishFanpagePost) {
    btnPublishFanpagePost.addEventListener('click', async () => {
      const pageId = (fanpageIdInput?.value || '').trim();
      const accessToken = (fanpageTokenInput?.value || '').trim();
      const message = (fanpagePostContent?.value || '').trim();
      const link = (fanpagePostLink?.value || '').trim();

      if (!fanpagePublishResult) return;

      if (!pageId || !accessToken) {
        fanpagePublishResult.className = 'publish-result-box error';
        fanpagePublishResult.textContent = '⚠️ Vui lòng nhập Page ID và Page Access Token ở trên trước khi đăng!';
        fanpagePublishResult.style.display = 'block';
        return;
      }

      if (!message) {
        fanpagePublishResult.className = 'publish-result-box error';
        fanpagePublishResult.textContent = '⚠️ Vui lòng nhập hoặc tạo nội dung bài viết trước khi đăng!';
        fanpagePublishResult.style.display = 'block';
        return;
      }

      btnPublishFanpagePost.disabled = true;
      fanpagePublishResult.className = 'publish-result-box';
      fanpagePublishResult.textContent = '⏳ Đang đăng bài lên Fanpage qua Meta Graph API...';
      fanpagePublishResult.style.color = '#38bdf8';
      fanpagePublishResult.style.display = 'block';

      try {
        const result = await publishToPage({ pageId, accessToken, message, link });
        fanpagePublishResult.className = 'publish-result-box success';
        fanpagePublishResult.innerHTML = `🎉 Đăng bài thành công!<br>Mã bài viết: <strong>${result.postId}</strong><br><a href="${result.postUrl}" target="_blank">👉 Bấm vào đây để xem bài viết trên Facebook</a>`;
      } catch (err) {
        fanpagePublishResult.className = 'publish-result-box error';
        fanpagePublishResult.textContent = `❌ Đăng bài thất bại: ${err.message}`;
      } finally {
        btnPublishFanpagePost.disabled = false;
      }
    });
  }

  // Subtab navigation in tab-fanpage
  subtabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      subtabBtns.forEach((b) => b.classList.remove('active'));
      subpanes.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-subpane');
      const pane = document.getElementById(target);
      if (pane) pane.classList.add('active');
    });
  });

  // Generate Bulk Campaign Posts
  if (btnGenerateCampaign) {
    btnGenerateCampaign.addEventListener('click', async () => {
      btnGenerateCampaign.disabled = true;
      if (campaignGenerateStatus) {
        campaignGenerateStatus.textContent = '⏳ Đang lên lịch & soạn chiến dịch bài viết...';
        campaignGenerateStatus.style.color = '#38bdf8';
      }

      const count = Number(campaignPostsCount?.value) || 7;
      const serviceHighlights = (campaignHighlights?.value || '').trim();
      const contactInfo = (campaignContact?.value || '').trim();

      const aiCfg = {
        apiKey: (aiApiKey?.value || '').trim(),
        provider: aiProvider?.value || 'deepseek',
        model: aiProvider?.value === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'
      };

      try {
        const posts = await generateBulkCampaignPosts({
          count,
          serviceHighlights,
          contactInfo,
          config: aiCfg
        });

        currentCampaignPosts = posts;
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ campaign_posts: posts });
        }
        renderCampaignList(currentCampaignPosts);

        if (campaignGenerateStatus) {
          campaignGenerateStatus.textContent = `✨ Đã tạo thành công chiến dịch ${posts.length} bài đăng!`;
          campaignGenerateStatus.style.color = '#10b981';
        }
      } catch (err) {
        if (campaignGenerateStatus) {
          campaignGenerateStatus.textContent = `❌ Lỗi: ${err.message}`;
          campaignGenerateStatus.style.color = '#ef4444';
        }
      } finally {
        btnGenerateCampaign.disabled = false;
      }
    });
  }

  // Open Meta Business Suite Planner
  if (btnOpenMetaPlanner) {
    btnOpenMetaPlanner.addEventListener('click', () => {
      const url = 'https://business.facebook.com/latest/composer?ref=mini_planner';
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
    });
  }

  // Export Campaign to CSV
  if (btnExportCampaignCsv) {
    btnExportCampaignCsv.addEventListener('click', () => {
      if (currentCampaignPosts.length === 0) {
        alert('Chưa có bài đăng nào trong chiến dịch để xuất CSV!');
        return;
      }
      const csvContent = exportCampaignToCsv(currentCampaignPosts);
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `meta-planner-campaign-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // Clear Campaign
  if (btnClearCampaign) {
    btnClearCampaign.addEventListener('click', async () => {
      if (confirm('Bạn có chắc chắn muốn xóa toàn bộ chiến dịch bài đăng hiện tại không?')) {
        currentCampaignPosts = [];
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ campaign_posts: [] });
        }
        renderCampaignList([]);
        if (campaignGenerateStatus) {
          campaignGenerateStatus.textContent = '';
        }
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
        telegramChatId: (tgChatIdInput?.value || '').trim(),
        fanpageConfig: {
          pageId: (fanpageIdInput?.value || '').trim(),
          pageToken: (fanpageTokenInput?.value || '').trim(),
          defaultTopic: fanpageTopicSelect?.value || 'general'
        }
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
  loadCampaignPosts();
}

// Immediate execution if DOM is already ready, or listen to DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}
