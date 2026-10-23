/**
 * Meta Graph API Page Publisher Module
 * Handles publishing posts and verifying Page Access Tokens via Meta Graph API
 */

export const GRAPH_API_VERSION = 'v19.0';
export const GRAPH_BASE_URL = 'https://graph.facebook.com';

/**
 * Publish a post to a Facebook Page via Graph API
 * @param {Object} options
 * @param {string} options.pageId - Facebook Page ID
 * @param {string} options.accessToken - Page Access Token (requires pages_manage_posts or pages_read_engagement)
 * @param {string} options.message - Post text content
 * @param {string} [options.link] - Optional link/URL to attach to the post
 * @param {Function} [customFetch] - Optional custom fetch function for testing
 * @returns {Promise<{success: boolean, postId: string, postUrl: string, raw: Object}>}
 */
export async function publishToPage(
  { pageId, accessToken, message, link },
  customFetch = fetch
) {
  if (!pageId || !accessToken) {
    throw new Error('Thiếu thông tin: Cần cung cấp đầy đủ Page ID và Page Access Token');
  }

  const trimmedMessage = (message || '').trim();
  if (!trimmedMessage) {
    throw new Error('Nội dung bài viết không được để trống');
  }

  const endpoint = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${encodeURIComponent(pageId)}/feed`;

  const params = new URLSearchParams();
  params.append('message', trimmedMessage);
  params.append('access_token', accessToken.trim());
  if (link && link.trim()) {
    params.append('link', link.trim());
  }

  const response = await customFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || `Lỗi từ Meta Graph API (HTTP ${response.status})`;
    const errorCode = data.error?.code ? ` [Mã lỗi: ${data.error.code}]` : '';
    throw new Error(`${errorMsg}${errorCode}`);
  }

  const postId = data.id;
  const postUrl = `https://www.facebook.com/${postId}`;

  return {
    success: true,
    postId,
    postUrl,
    raw: data
  };
}

/**
 * Verify if the Page ID and Page Access Token are valid
 * @param {Object} options
 * @param {string} options.pageId - Facebook Page ID
 * @param {string} options.accessToken - Page Access Token
 * @param {Function} [customFetch] - Optional custom fetch function
 * @returns {Promise<{valid: boolean, id?: string, name?: string, error?: string}>}
 */
export async function verifyPageToken(
  { pageId, accessToken },
  customFetch = fetch
) {
  if (!pageId || !accessToken) {
    return {
      valid: false,
      error: 'Cần nhập Page ID và Page Access Token'
    };
  }

  const endpoint = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${encodeURIComponent(pageId)}?fields=name,id&access_token=${encodeURIComponent(accessToken.trim())}`;

  try {
    const response = await customFetch(endpoint, {
      method: 'GET'
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      return {
        valid: false,
        error: data.error?.message || `Lỗi xác thực (HTTP ${response.status})`
      };
    }

    return {
      valid: true,
      id: data.id,
      name: data.name
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message || 'Lỗi kết nối tới Meta Graph API'
    };
  }
}
