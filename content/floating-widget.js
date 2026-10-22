/**
 * Floating In-Page Widget for FB Job Hunter
 * Uses Shadow DOM to isolate styles from Facebook's complex CSS.
 */

let widgetContainer = null;
let shadowRoot = null;
let currentStatus = 'ĐANG CHẠY';
let currentStateClass = 'active'; // 'active' | 'scanning' | 'idle'

export function initFloatingWidget(options = {}) {
  if (document.getElementById('fb-job-hunter-host')) return;

  const host = document.createElement('div');
  host.id = 'fb-job-hunter-host';
  document.body.appendChild(host);

  shadowRoot = host.attachShadow({ mode: 'open' });

  // Load widget styles
  const style = document.createElement('style');
  style.textContent = getWidgetStyles();
  shadowRoot.appendChild(style);

  // Widget HTML structure
  widgetContainer = document.createElement('div');
  widgetContainer.className = 'fb-jh-widget';
  widgetContainer.innerHTML = `
    <div class="fb-jh-badge" id="fb-jh-badge">
      <div class="fb-jh-indicator ${options.enabled ? 'active' : 'idle'}">
        <span class="fb-jh-dot"></span>
        <span class="fb-jh-label" id="fb-jh-status-text">${options.enabled ? 'ĐANG CHẠY' : 'TẠM DỪNG'}</span>
      </div>
      <div class="fb-jh-controls">
        <button id="fb-jh-toggle-btn" class="fb-jh-btn" title="Bật/Tắt tự động">
          ${options.enabled ? '⏸️' : '▶️'}
        </button>
        <button id="fb-jh-expand-btn" class="fb-jh-btn" title="Xem nhật ký bài khớp">
          📜
        </button>
      </div>
    </div>
    <div class="fb-jh-drawer hidden" id="fb-jh-drawer">
      <div class="fb-jh-drawer-header">
        <span>🎯 Việc mới phát hiện</span>
        <button id="fb-jh-close-drawer" class="fb-jh-close">✕</button>
      </div>
      <div class="fb-jh-drawer-body" id="fb-jh-drawer-list">
        <div class="fb-jh-empty">Chưa có bài nào khớp gần đây</div>
      </div>
    </div>
  `;

  shadowRoot.appendChild(widgetContainer);

  // Event handlers
  const toggleBtn = shadowRoot.getElementById('fb-jh-toggle-btn');
  const expandBtn = shadowRoot.getElementById('fb-jh-expand-btn');
  const drawer = shadowRoot.getElementById('fb-jh-drawer');
  const closeDrawer = shadowRoot.getElementById('fb-jh-close-drawer');

  let isEnabled = Boolean(options.enabled);

  toggleBtn.addEventListener('click', () => {
    isEnabled = !isEnabled;
    toggleBtn.textContent = isEnabled ? '⏸️' : '▶️';
    updateWidgetStatus(isEnabled ? 'ĐANG CHẠY' : 'TẠM DỪNG', isEnabled ? 'active' : 'idle');
    if (typeof options.onToggle === 'function') {
      options.onToggle(isEnabled);
    }
  });

  expandBtn.addEventListener('click', () => {
    drawer.classList.toggle('hidden');
  });

  closeDrawer.addEventListener('click', () => {
    drawer.classList.add('hidden');
  });

  // Make draggable
  makeDraggable(widgetContainer, shadowRoot.getElementById('fb-jh-badge'));
}

export function updateWidgetStatus(text, state = 'active') {
  if (!shadowRoot) return;
  const statusLabel = shadowRoot.getElementById('fb-jh-status-text');
  const indicator = shadowRoot.querySelector('.fb-jh-indicator');
  if (statusLabel) statusLabel.textContent = text;
  if (indicator) {
    indicator.className = `fb-jh-indicator ${state}`;
  }
}

export function addWidgetJobLog(job) {
  if (!shadowRoot) return;
  const drawerList = shadowRoot.getElementById('fb-jh-drawer-list');
  const empty = drawerList.querySelector('.fb-jh-empty');
  if (empty) empty.remove();

  const timeStr = new Date(job.commentedAt || Date.now()).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const item = document.createElement('div');
  item.className = 'fb-jh-item';
  item.innerHTML = `
    <div class="fb-jh-item-header">
      <strong>👤 ${escapeHtml(job.authorName || 'Khách hàng')}</strong>
      <span class="fb-jh-time">${timeStr}</span>
    </div>
    <div class="fb-jh-item-text">${escapeHtml((job.postText || '').slice(0, 80))}...</div>
    <div class="fb-jh-item-cmt">💬 "${escapeHtml(job.commentText || '')}"</div>
    ${job.postUrl ? `<a href="${job.postUrl}" target="_blank" class="fb-jh-link">🔗 Xem bài</a>` : ''}
  `;

  drawerList.prepend(item);

  // Keep max 5 items in mini drawer
  while (drawerList.children.length > 5) {
    drawerList.lastElementChild.remove();
  }
}

function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    if (e.target.tagName.toLowerCase() === 'button') return;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + 'px';
    element.style.left = (element.offsetLeft - pos1) + 'px';
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getWidgetStyles() {
  return `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 99999999;
    }
    .fb-jh-widget {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999999;
      font-size: 12px;
      user-select: none;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }
    .fb-jh-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 30px;
      padding: 6px 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      color: #fff;
      cursor: grab;
    }
    .fb-jh-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      letter-spacing: -0.2px;
    }
    .fb-jh-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #10b981;
    }
    .fb-jh-indicator.scanning .fb-jh-dot {
      background-color: #3b82f6;
      animation: pulse 1s infinite alternate;
    }
    .fb-jh-indicator.idle .fb-jh-dot {
      background-color: #94a3b8;
    }
    @keyframes pulse {
      from { transform: scale(0.9); opacity: 0.6; }
      to { transform: scale(1.2); opacity: 1; }
    }
    .fb-jh-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      border-left: 1px solid rgba(255, 255, 255, 0.15);
      padding-left: 8px;
    }
    .fb-jh-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      padding: 2px 4px;
      border-radius: 4px;
      transition: background 0.15s;
    }
    .fb-jh-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    /* Drawer */
    .fb-jh-drawer {
      width: 290px;
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      color: #fff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .fb-jh-drawer.hidden {
      display: none;
    }
    .fb-jh-drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-weight: 700;
      font-size: 11px;
    }
    .fb-jh-close {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 12px;
    }
    .fb-jh-close:hover {
      color: #fff;
    }
    .fb-jh-drawer-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 240px;
      overflow-y: auto;
    }
    .fb-jh-empty {
      color: #64748b;
      font-size: 11px;
      text-align: center;
      padding: 16px 0;
    }
    .fb-jh-item {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 11px;
    }
    .fb-jh-item-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .fb-jh-time {
      color: #94a3b8;
      font-size: 10px;
    }
    .fb-jh-item-text {
      color: #cbd5e1;
      margin-bottom: 4px;
      line-height: 1.3;
    }
    .fb-jh-item-cmt {
      color: #93c5fd;
      background: rgba(59, 130, 246, 0.12);
      border-left: 2px solid #3b82f6;
      padding: 2px 6px;
      border-radius: 0 4px 4px 0;
      font-style: italic;
    }
    .fb-jh-link {
      display: inline-block;
      margin-top: 4px;
      color: #60a5fa;
      text-decoration: none;
      font-size: 10px;
    }
    .fb-jh-link:hover {
      text-decoration: underline;
    }
  `;
}
