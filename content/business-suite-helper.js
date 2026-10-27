/**
 * Meta Business Suite Planner Assistant Content Script
 * Injected into business.facebook.com to assist bulk post scheduling
 */

(function initBusinessSuiteHelper() {
  if (window.__fbJobHunterBusinessSuiteLoaded) return;
  window.__fbJobHunterBusinessSuiteLoaded = true;

  let campaignPosts = [];
  let currentIndex = 0;
  let widgetEl = null;

  async function loadCampaign() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['campaign_posts'], (res) => {
        campaignPosts = Array.isArray(res.campaign_posts) ? res.campaign_posts : [];
        // Point to first pending post if available
        const firstPending = campaignPosts.findIndex((p) => p.status === 'pending');
        currentIndex = firstPending !== -1 ? firstPending : 0;
        resolve(campaignPosts);
      });
    });
  }

  function findTitleInput() {
    const titleSelectors = [
      'input[placeholder*="tiêu đề" i]',
      'input[placeholder*="title" i]',
      'input[aria-label*="tiêu đề" i]',
      'input[aria-label*="title" i]',
      'textarea[placeholder*="tiêu đề" i]',
      'textarea[aria-label*="tiêu đề" i]'
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  function findComposerEditor() {
    // Selectors commonly used in Meta Business Suite Composer
    const selectors = [
      'div[data-lexical-editor="true"]',
      'div[role="textbox"][aria-label*="Văn bản" i]',
      'div[role="textbox"][aria-label*="Text" i]',
      'div[role="textbox"][aria-placeholder*="nghĩ gì" i]',
      'div[role="textbox"][aria-placeholder*="mind" i]',
      'div[role="textbox"][aria-placeholder*="viết" i]',
      'div[role="textbox"][aria-placeholder*="write" i]',
      'div[data-editor="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="viết" i]',
      'textarea[placeholder*="post" i]',
      'textarea'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        // Skip title inputs, search boxes, and hashtag boxes
        const placeholder = (el.getAttribute('placeholder') || el.getAttribute('aria-label') || '').toLowerCase();
        if (
          placeholder.includes('tìm kiếm') ||
          placeholder.includes('search') ||
          placeholder.includes('hashtag') ||
          placeholder.includes('thẻ') ||
          placeholder.includes('tiêu đề') ||
          placeholder.includes('title')
        ) {
          continue;
        }
        return el;
      }
    }
    return null;
  }

  function fillElement(el, text) {
    if (!el || !text) return false;
    try {
      el.focus();
      if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
        return true;
      } else if (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input') {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } else {
        el.innerText = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
        return true;
      }
    } catch (e) {
      console.warn('[FB Job Hunter] fillElement error:', e);
      return false;
    }
  }

  async function fillComposer(postData) {
    const content = typeof postData === 'string' ? postData : postData?.content || '';
    const title = typeof postData === 'object' ? postData?.title : '';

    // If there is a title input and a clean title, fill title input
    if (title) {
      const titleInput = findTitleInput();
      if (titleInput) {
        fillElement(titleInput, title);
      }
    }

    const editor = findComposerEditor();
    let filled = false;

    if (editor) {
      filled = fillElement(editor, content);
    }

    // Always copy to clipboard as 100% reliable backup
    try {
      await navigator.clipboard.writeText(content);
    } catch (e) {
      // Clipboard fallback
      const tmp = document.createElement('textarea');
      tmp.value = content;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
    }

    return filled;
  }

  function showToast(msg) {
    if (!widgetEl) return;
    const toast = widgetEl.querySelector('.bsp-toast');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3500);
    }
  }

  function renderWidget() {
    if (!widgetEl) {
      widgetEl = document.createElement('div');
      widgetEl.id = 'fb-suite-planner-widget';
      document.body.appendChild(widgetEl);
    }

    if (campaignPosts.length === 0) {
      widgetEl.innerHTML = `
        <div class="bsp-header">
          <div class="bsp-title">
            <span>📅 FB Job Hunter</span>
            <span class="bsp-badge">Chưa có bài</span>
          </div>
          <button class="bsp-toggle-btn" title="Thu gọn">−</button>
        </div>
        <div class="bsp-body">
          <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
            Chưa có chiến dịch bài đăng nào. Hãy mở Popup Extension và bấm <strong>"AI Tạo chiến dịch 7 ngày"</strong> để bắt đầu lên lịch tự động!
          </p>
          <button class="bsp-btn bsp-btn-secondary" id="bsp-reload-btn">🔄 Tải lại chiến dịch</button>
        </div>
      `;
      attachEvents();
      return;
    }

    const currentPost = campaignPosts[currentIndex] || campaignPosts[0];
    const totalCount = campaignPosts.length;
    const scheduledCount = campaignPosts.filter((p) => p.status === 'scheduled').length;

    const statusBadge =
      currentPost.status === 'scheduled'
        ? '<span class="bsp-post-status bsp-status-scheduled">Đã lên lịch</span>'
        : '<span class="bsp-post-status bsp-status-pending">Chờ lên lịch</span>';

    widgetEl.innerHTML = `
      <div class="bsp-header">
        <div class="bsp-title">
          <span>📅 Meta Planner Helper</span>
          <span class="bsp-badge">${scheduledCount}/${totalCount} Đã xong</span>
        </div>
        <button class="bsp-toggle-btn" title="Thu gọn">−</button>
      </div>
      <div class="bsp-body">
        <div class="bsp-meta-info">
          <span>Bài số: <strong>${currentIndex + 1} / ${totalCount}</strong></span>
          <span>${currentPost.scheduledDate} Lúc <strong>${currentPost.scheduledTime}</strong></span>
        </div>

        <div class="bsp-post-card">
          <div class="bsp-post-header">
            <span class="bsp-post-time">⏰ ${currentPost.scheduledTime} (${currentPost.scheduledDate})</span>
            ${statusBadge}
          </div>
          <div class="bsp-post-title">${currentPost.title || 'Bài viết quảng bá'}</div>
          <div class="bsp-post-preview">${escapeHtml(currentPost.content)}</div>
        </div>

        <div class="bsp-actions">
          <button class="bsp-btn bsp-btn-primary" id="bsp-autofill-btn">
            🚀 Điền nội dung vào Composer & Copy
          </button>
          <button class="bsp-btn bsp-btn-success" id="bsp-mark-done-btn">
            ✅ Đã lên lịch xong (Chuyển bài kế)
          </button>
          <div class="bsp-nav-row">
            <button class="bsp-btn bsp-btn-secondary" id="bsp-prev-btn" ${currentIndex === 0 ? 'disabled' : ''}>⏮️ Bài trước</button>
            <button class="bsp-btn bsp-btn-secondary" id="bsp-next-btn" ${currentIndex >= totalCount - 1 ? 'disabled' : ''}>Bài sau ⏭️</button>
          </div>
        </div>

        <div class="bsp-toast"></div>
      </div>
    `;

    attachEvents();
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function attachEvents() {
    const toggleBtn = widgetEl.querySelector('.bsp-toggle-btn');
    if (toggleBtn) {
      toggleBtn.onclick = (e) => {
        e.stopPropagation();
        widgetEl.classList.toggle('minimized');
        toggleBtn.textContent = widgetEl.classList.contains('minimized') ? '+' : '−';
      };
    }

    const header = widgetEl.querySelector('.bsp-header');
    if (header) {
      header.onclick = () => {
        if (widgetEl.classList.contains('minimized')) {
          widgetEl.classList.remove('minimized');
          if (toggleBtn) toggleBtn.textContent = '−';
        }
      };
    }

    const autofillBtn = widgetEl.querySelector('#bsp-autofill-btn');
    if (autofillBtn) {
      autofillBtn.onclick = async () => {
        const currentPost = campaignPosts[currentIndex];
        if (!currentPost) return;

        const filled = await fillComposer(currentPost.content);
        if (filled) {
          showToast('✅ Đã tự động điền vào ô soạn thảo & copy nội dung!');
        } else {
          showToast('📋 Đã copy nội dung! Nhấp vào ô viết bài và nhấn Ctrl+V / Cmd+V');
        }
      };
    }

    const markDoneBtn = widgetEl.querySelector('#bsp-mark-done-btn');
    if (markDoneBtn) {
      markDoneBtn.onclick = () => {
        const currentPost = campaignPosts[currentIndex];
        if (!currentPost) return;

        currentPost.status = 'scheduled';
        currentPost.updatedAt = Date.now();

        chrome.storage.local.set({ campaign_posts: campaignPosts }, () => {
          showToast(`🎉 Đã đánh dấu bài #${currentIndex + 1} lên lịch thành công!`);
          if (currentIndex < campaignPosts.length - 1) {
            currentIndex++;
          }
          renderWidget();
        });
      };
    }

    const prevBtn = widgetEl.querySelector('#bsp-prev-btn');
    if (prevBtn) {
      prevBtn.onclick = () => {
        if (currentIndex > 0) {
          currentIndex--;
          renderWidget();
        }
      };
    }

    const nextBtn = widgetEl.querySelector('#bsp-next-btn');
    if (nextBtn) {
      nextBtn.onclick = () => {
        if (currentIndex < campaignPosts.length - 1) {
          currentIndex++;
          renderWidget();
        }
      };
    }

    const reloadBtn = widgetEl.querySelector('#bsp-reload-btn');
    if (reloadBtn) {
      reloadBtn.onclick = async () => {
        await loadCampaign();
        renderWidget();
        showToast('🔄 Đã làm mới danh sách bài đăng!');
      };
    }
  }

  // Listen for campaign updates from Popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.campaign_posts) {
      campaignPosts = changes.campaign_posts.newValue || [];
      renderWidget();
    }
  });

  // Initial load
  loadCampaign().then(() => {
    renderWidget();
  });
})();
