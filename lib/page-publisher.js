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
  let postUrl = `https://www.facebook.com/${postId}`;
  if (postId && typeof postId === 'string' && postId.includes('_')) {
    const [pId, fbid] = postId.split('_');
    postUrl = `https://www.facebook.com/${pId}/posts/${fbid}`;
  }

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

/**
 * Publish immediately or schedule a post (with optional image) to a Facebook Page via Graph API
 * @param {Object} options
 * @param {string} options.pageId - Facebook Page ID
 * @param {string} options.accessToken - Page Access Token
 * @param {string} options.message - Post text content
 * @param {string} [options.link] - Optional link/URL
 * @param {string} [options.imageUrl] - Optional image URL to attach as photo post
 * @param {number} [options.scheduledPublishTime] - Optional Unix timestamp in seconds for scheduling
 * @param {Function} [customFetch] - Optional custom fetch function
 * @returns {Promise<{success: boolean, postId: string, postUrl: string, raw: Object}>}
 */
export async function publishOrSchedulePost(
  { pageId, accessToken, message, link, imageUrl, scheduledPublishTime },
  customFetch = fetch
) {
  if (!pageId || !accessToken) {
    throw new Error('Thiếu thông tin: Cần cung cấp đầy đủ Page ID và Page Access Token');
  }

  const trimmedMessage = (message || '').trim();
  if (!trimmedMessage) {
    throw new Error('Nội dung bài viết không được để trống');
  }

  const isPhotoPost = Boolean(imageUrl && imageUrl.trim());
  const endpoint = isPhotoPost
    ? `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${encodeURIComponent(pageId)}/photos`
    : `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${encodeURIComponent(pageId)}/feed`;

  const params = new URLSearchParams();
  params.append('access_token', accessToken.trim());

  if (isPhotoPost) {
    params.append('url', imageUrl.trim());
    params.append('caption', trimmedMessage);
    if (scheduledPublishTime) {
      params.append('published', 'false');
      params.append('scheduled_publish_time', String(scheduledPublishTime));
    } else {
      params.append('published', 'true');
    }
  } else {
    params.append('message', trimmedMessage);
    if (link && link.trim()) {
      params.append('link', link.trim());
    }
    if (scheduledPublishTime) {
      params.append('published', 'false');
      params.append('scheduled_publish_time', String(scheduledPublishTime));
    }
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

  const postId = data.id || data.post_id;
  let postUrl = `https://www.facebook.com/${postId}`;
  if (postId && typeof postId === 'string' && postId.includes('_')) {
    const [pId, fbid] = postId.split('_');
    postUrl = `https://www.facebook.com/${pId}/posts/${fbid}`;
  }

  return {
    success: true,
    postId,
    postUrl,
    raw: data
  };
}

/**
 * Schedule all campaign posts to a Facebook Page via Graph API with live progress tracking
 * @param {Object} options
 * @param {string} options.pageId - Facebook Page ID
 * @param {string} options.accessToken - Page Access Token
 * @param {Array<Object>} options.posts - Array of campaign post objects
 * @param {Function} [options.onProgress] - Callback for each post progress
 * @param {Function} [customFetch] - Custom fetch function
 * @returns {Promise<{total: number, scheduledCount: number, errors: Array<Object>, updatedPosts: Array<Object>}>}
 */
export async function scheduleAllCampaignPosts(
  { pageId, accessToken, posts, onProgress },
  customFetch = fetch
) {
  if (!pageId || !accessToken) {
    throw new Error('Thiếu thông tin: Cần cung cấp đầy đủ Page ID và Page Access Token');
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    return { total: 0, scheduledCount: 0, errors: [], updatedPosts: [] };
  }

  const updatedPosts = JSON.parse(JSON.stringify(posts));
  const errors = [];
  let scheduledCount = 0;

  for (let i = 0; i < updatedPosts.length; i++) {
    const p = updatedPosts[i];
    try {
      // Calculate schedule unix timestamp
      let unixTimestamp = null;
      if (p.scheduledDate && p.scheduledTime) {
        const d = new Date(`${p.scheduledDate}T${p.scheduledTime}:00`);
        let timeInSec = Math.floor(d.getTime() / 1000);
        const minFutureTime = Math.floor(Date.now() / 1000) + 900; // minimum 15 mins in future for Graph API
        if (isNaN(timeInSec) || timeInSec < minFutureTime) {
          timeInSec = minFutureTime + (i * 3600); // space them out
        }
        unixTimestamp = timeInSec;
      } else {
        unixTimestamp = Math.floor(Date.now() / 1000) + 900 + (i * 3600);
      }

      const res = await publishOrSchedulePost(
        {
          pageId,
          accessToken,
          message: p.content,
          imageUrl: p.imageUrl,
          scheduledPublishTime: unixTimestamp
        },
        customFetch
      );

      p.status = 'scheduled';
      p.scheduledPostId = res.postId;
      scheduledCount++;

      if (typeof onProgress === 'function') {
        onProgress({
          index: i + 1,
          total: updatedPosts.length,
          post: p,
          success: true
        });
      }
    } catch (err) {
      errors.push({ id: p.id, title: p.title, error: err.message });
      if (typeof onProgress === 'function') {
        onProgress({
          index: i + 1,
          total: updatedPosts.length,
          post: p,
          success: false,
          error: err.message
        });
      }
    }
  }

  return {
    total: updatedPosts.length,
    scheduledCount,
    errors,
    updatedPosts
  };
}

