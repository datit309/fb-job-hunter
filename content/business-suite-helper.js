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

  async function fetchImageFile(imageUrl) {
    if (!imageUrl) return null;
    try {
      // 1. Try direct fetch
      const resp = await fetch(imageUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        return new File([blob], 'marketing-post.jpg', { type: blob.type || 'image/jpeg' });
      }
    } catch (e) {
      console.warn('[FB Job Hunter] Direct fetch image failed, falling back to background worker:', e);
    }

    // 2. Fallback via background service worker
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_BASE64', url: imageUrl }, (res) => {
          resolve(res);
        });
      });
      if (response && response.success && response.base64) {
        const binaryStr = atob(response.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: response.mimeType || 'image/jpeg' });
        return new File([blob], 'marketing-post.jpg', { type: response.mimeType || 'image/jpeg' });
      }
    } catch (err) {
      console.warn('[FB Job Hunter] Background fetch image failed:', err);
    }
    return null;
  }

  async function injectPostImage(imageUrl) {
    if (!imageUrl) return false;
    const file = await fetchImageFile(imageUrl);
    if (!file) return false;

    let fileInput = document.querySelector('input[type="file"][accept*="image"]')
      || document.querySelector('input[type="file"]');

    if (!fileInput) {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span'));
      const addPhotoBtn = buttons.find((b) => {
        const t = (b.textContent || '').toLowerCase();
        return (
          t.includes('thêm ảnh') ||
          t.includes('add photo') ||
          t.includes('ảnh/video') ||
          t.includes('photo/video') ||
          t.includes('thêm phương tiện')
        );
      });
      if (addPhotoBtn) {
        addPhotoBtn.click();
        await new Promise((r) => setTimeout(r, 400));
        fileInput = document.querySelector('input[type="file"][accept*="image"]')
          || document.querySelector('input[type="file"]');
      }
    }

    if (fileInput) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } catch (err) {
        console.warn('[FB Job Hunter] File injection failed:', err);
      }
    }
    return false;
  }

  async function selectScheduleOption(dateStr, timeStr) {
    try {
      const clickables = Array.from(document.querySelectorAll('input[type="radio"], div[role="radio"], div[role="switch"], div[role="checkbox"], label, button, span'));
      const scheduleToggle = clickables.find((el) => {
        const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.value || '').toLowerCase();
        return (
          text.includes('lên lịch') ||
          text.includes('schedule') ||
          text.includes('lên lịch đăng')
        );
      });

      if (scheduleToggle) {
        scheduleToggle.click();
        await new Promise((r) => setTimeout(r, 500));
      }

      if (dateStr) {
        const dateInputs = Array.from(document.querySelectorAll('input[type="date"], input[placeholder*="YYYY" i], input[placeholder*="DD" i], input[placeholder*="MM" i], input[aria-label*="ngày" i], input[aria-label*="date" i]'));
        for (const inp of dateInputs) {
          fillElement(inp, dateStr);
        }
      }

      if (timeStr) {
        const timeInputs = Array.from(document.querySelectorAll('input[type="time"], input[placeholder*="HH" i], input[aria-label*="giờ" i], input[aria-label*="time" i]'));
        for (const inp of timeInputs) {
          fillElement(inp, timeStr);
        }
      }
      return true;
    } catch (e) {
      console.warn('[FB Job Hunter] selectScheduleOption error:', e);
      return false;
    }
  }

  async function fillComposerComplete(postData) {
    if (!postData) return;
    showToast('⏳ Đang tự động nạp Nội dung, Ảnh & Lịch...');

    await fillComposer(postData);

    let imgInjected = false;
    if (postData.imageUrl) {
      imgInjected = await injectPostImage(postData.imageUrl);
    }

    let scheduleSet = false;
    if (postData.scheduledDate && postData.scheduledTime) {
      scheduleSet = await selectScheduleOption(postData.scheduledDate, postData.scheduledTime);
    }

    let statusMsg = '✅ Đã điền nội dung & copy vào clipboard!';
    if (imgInjected) statusMsg += ' 🖼️ Đã nạp ảnh!';
    if (scheduleSet) statusMsg += ` ⏰ Đã chọn lịch (${postData.scheduledDate} ${postData.scheduledTime})!`;
    showToast(statusMsg);
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

    const isBulkComposer = window.location.href.includes('bulk_post_composer');

    widgetEl.innerHTML = `
      <div class="bsp-header">
        <div class="bsp-title">
          <span>📅 Meta Planner Helper</span>
          <span class="bsp-badge">${scheduledCount}/${totalCount} Đã xong</span>
        </div>
        <button class="bsp-toggle-btn" title="Thu gọn">−</button>
      </div>
      <div class="bsp-body">
        ${isBulkComposer ? `
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; font-size: 11px; color: #a7f3d0;">
            ⚡ <strong>Bulk Post Composer:</strong> Tải file CSV lên để Meta tự lên lịch tất cả bài cùng lúc!
          </div>
        ` : ''}

        <div class="bsp-meta-info">
          <span>Bài số: <strong>${currentIndex + 1} / ${totalCount}</strong></span>
          <span>${currentPost.scheduledDate} Lúc <strong>${currentPost.scheduledTime}</strong></span>
        </div>

        <div class="bsp-post-card">
          <div class="bsp-post-header">
            <span class="bsp-post-time">⏰ ${currentPost.scheduledTime} (${currentPost.scheduledDate})</span>
            ${statusBadge}
          </div>
          ${currentPost.imageUrl ? `
            <div style="margin: 6px 0; position: relative; border-radius: 6px; overflow: hidden; max-height: 120px; border: 1px solid rgba(255,255,255,0.1);">
              <img src="${escapeHtml(currentPost.imageUrl)}" alt="Preview" style="width: 100%; height: 110px; object-fit: cover; display: block;">
              <a href="${escapeHtml(currentPost.imageUrl)}" target="_blank" rel="noopener noreferrer" style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-decoration: none;">🖼️ Mở ảnh</a>
            </div>
          ` : ''}
          <div class="bsp-post-title">${currentPost.title || 'Bài viết quảng bá'}</div>
          <div class="bsp-post-preview">${escapeHtml(currentPost.content)}</div>
        </div>

        <div class="bsp-actions">
          <button class="bsp-btn bsp-btn-primary" id="bsp-autofill-complete-btn" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; border: none; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);">
            ⚡ Tự động nạp: Nội dung + Ảnh + Lịch
          </button>
          ${isBulkComposer ? `
            <button class="bsp-btn bsp-btn-primary" id="bsp-inject-csv-btn" style="background:#10b981;color:#fff;border:none;font-weight:600;">
              ⚡ Tự động nạp CSV vào Meta (1-Click)
            </button>
          ` : ''}
          <button class="bsp-btn bsp-btn-secondary" id="bsp-download-bulk-csv-btn" style="background:#0284c7;color:#fff;border:none;">
            📥 Tải CSV Meta Bulk Upload ⭐
          </button>
          <button class="bsp-btn bsp-btn-secondary" id="bsp-autofill-btn" style="font-size: 11px;">
            📝 Chỉ điền nội dung & Copy
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

    function buildCsvContent() {
      const headers = ['Date and time', 'Text'];
      const rows = [headers.join(',')];
      for (const post of campaignPosts) {
        let dt = `${post.scheduledDate} ${post.scheduledTime}`;
        const parts = (post.scheduledDate || '').split('-');
        if (parts.length === 3) {
          dt = `${parts[1]}/${parts[2]}/${parts[0]} ${post.scheduledTime || '08:30'}`;
        }
        const text = post.content || '';
        rows.push(`"${dt}","${text.replace(/"/g, '""')}"`);
      }
      return '\uFEFF' + rows.join('\n');
    }

    function downloadMetaBulkCsv() {
      if (!campaignPosts || campaignPosts.length === 0) {
        showToast('⚠️ Chưa có bài đăng nào trong chiến dịch!');
        return;
      }
      const csvStr = buildCsvContent();
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meta-bulk-composer-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('📥 Đã tải file CSV chuẩn Meta Bulk! Bấm "Tải file CSV lên" trên Meta để lên lịch hàng loạt.');
    }

    const injectCsvBtn = widgetEl.querySelector('#bsp-inject-csv-btn');
    if (injectCsvBtn) {
      injectCsvBtn.onclick = () => {
        if (!campaignPosts || campaignPosts.length === 0) {
          showToast('⚠️ Chưa có bài đăng nào trong chiến dịch!');
          return;
        }
        const fileInput = document.querySelector('input[type="file"][accept*="csv"]')
          || document.querySelector('input[type="file"]');
        if (fileInput) {
          try {
            const csvStr = buildCsvContent();
            const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
            const file = new File([blob], `meta-bulk-posts-${Date.now()}.csv`, { type: 'text/csv' });
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            showToast('🚀 Đã tự động nạp file CSV vào Meta Bulk Composer!');
            return;
          } catch (e) {
            console.warn('[FB Job Hunter] Auto inject CSV failed, falling back to download:', e);
          }
        }
        // If file input not found or failed, trigger download
        downloadMetaBulkCsv();
        showToast('📥 Không tìm thấy ô tải tự động. Đã tải file CSV xuống, hãy bấm "Tải file CSV lên" trên Meta!');
      };
    }

    const downloadCsvBtn = widgetEl.querySelector('#bsp-download-bulk-csv-btn');
    if (downloadCsvBtn) {
      downloadCsvBtn.onclick = () => {
        downloadMetaBulkCsv();
      };
    }

    const autofillCompleteBtn = widgetEl.querySelector('#bsp-autofill-complete-btn');
    if (autofillCompleteBtn) {
      autofillCompleteBtn.onclick = async () => {
        const currentPost = campaignPosts[currentIndex];
        if (!currentPost) return;
        await fillComposerComplete(currentPost);
      };
    }

    const autofillBtn = widgetEl.querySelector('#bsp-autofill-btn');
    if (autofillBtn) {
      autofillBtn.onclick = async () => {
        const currentPost = campaignPosts[currentIndex];
        if (!currentPost) return;

        const filled = await fillComposer(currentPost);
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
