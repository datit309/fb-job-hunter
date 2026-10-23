/**
 * AI Matcher and Comment Pitch Generator
 * Supports DeepSeek, OpenAI, and Gemini models.
 * Generates professional, consultative Company Page comments tailored to job posts.
 * Includes anti-spam compliance (no 'check inbox', no bare phone numbers/links) and Spintax fallback.
 */

import { parseSpintax } from './spintax.js';

export function buildSystemPrompt(customPrompt = '', isCompanyPage = true) {
  let prompt = `Bạn là đại diện một công ty công nghệ / team phát triển phần mềm/freelance chuyên nghiệp, uy tín và lịch sự.
Nhiệm vụ của bạn là đọc bài đăng tìm người làm phần mềm trên Facebook và viết 1 câu bình luận tương tác tư vấn giải pháp (1-2 câu ngắn gọn).

QUY TẮC BẮT BUỘC ĐỂ TRÁNH BỊ FACEBOOK QUÉT SPAM / ẨN COMMENT:
1. XƯNG HÔ: Dùng "Bên mình", "Team bên mình", "Bên em", hoặc "Công ty mình". Tuyệt đối không xưng "mình cá nhân" hay "tớ".
2. TỪ KHÓA CẤM: TUYỆT ĐỐI KHÔNG dùng các từ cấm hay bị thuật toán Facebook phạt spam:
   - KHÔNG dùng: "check inbox", "check ib", "ib mình", "nhắn riêng", "inbox ngay".
   - KHÔNG để số điện thoại, Zalo, link website rút gọn hay email trong bình luận.
   - KHÔNG dùng từ "giá rẻ", "phá giá", "cam kết 100%".
3. PHONG CÁCH TỰ NHIÊN & CHUYÊN NGHIỆP:
   - Bình luận như một kỹ sư/đơn vị tư vấn kỹ thuật có tâm: Nhắc đúng công nghệ hoặc bài toán khách đang hỏi (ví dụ: làm app Flutter, viết bot Python, tối ưu web React, backend NodeJS...).
   - Đưa ra định hướng giải pháp hoặc thiện chí hỗ trợ: "Bài toán này bên mình có sẵn kinh nghiệm/giải pháp triển khai tương tự...", "Bên mình có thể hỗ trợ demo giải pháp kỹ thuật trước...".
   - Kêu gọi kết nối tự nhiên, lịch sự: "Nếu bạn quan tâm có thể ghé qua Page bên mình để trao đổi thêm nhé ạ" hoặc "Rất mong có cơ hội được đồng hành và hỗ trợ dự án của bạn."
4. ĐỘ DÀI: Tối đa 2 câu (khoảng 25-45 từ), ngắn gọn, súc tích, không lạm dụng icon (chỉ tối đa 1 icon hoặc không dùng).`;

  if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) {
    prompt += `\nYêu cầu bổ sung từ người dùng:\n${customPrompt.trim()}`;
  }

  return prompt;
}

/**
 * Returns API endpoint and default model for the selected provider
 */
function getProviderConfig(provider, customEndpoint = '', customModel = '') {
  const trimmedEndpoint = customEndpoint?.trim();
  const trimmedModel = customModel?.trim();

  switch (provider) {
    case 'custom':
      return {
        url: trimmedEndpoint || 'https://api.openai.com/v1/chat/completions',
        model: trimmedModel || 'gpt-4o-mini'
      };
    case 'deepseek':
      return {
        url: trimmedEndpoint || 'https://api.deepseek.com/chat/completions',
        model: trimmedModel || 'deepseek-chat'
      };
    case 'gemini':
      return {
        url: trimmedEndpoint || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        model: trimmedModel || 'gemini-1.5-flash'
      };
    case 'openai':
    default:
      return {
        url: trimmedEndpoint || 'https://api.openai.com/v1/chat/completions',
        model: trimmedModel || 'gpt-4o-mini'
      };
  }
}

/**
 * Generate a tailored comment pitch using AI with fallback to Spintax
 * @param {string} postText - Text content of the post
 * @param {object} config - App configuration
 * @param {function} fetchFn - Fetch implementation (defaults to global fetch)
 * @returns {Promise<object>} Result containing comment and metadata
 */
export async function generateAIPitch(postText, config = {}, fetchFn = fetch) {
  const spintaxTemplates = Array.isArray(config.spintaxTemplates) && config.spintaxTemplates.length > 0
    ? config.spintaxTemplates
    : [
        '{Chào bạn|Dạ chào anh/chị}, bên mình chuyên phát triển giải pháp phần mềm và web/app theo yêu cầu. Bài toán này bên mình có kinh nghiệm triển khai tương tự, rất mong có cơ hội hỗ trợ bạn.'
      ];

  const aiConfig = config.aiConfig || {};
  const isEnabled = Boolean(aiConfig.enabled !== undefined ? aiConfig.enabled : config.aiEnabled);
  const apiKey = (aiConfig.apiKey || config.aiApiKey || '').trim();
  const provider = aiConfig.provider || config.aiProvider || 'deepseek';
  const customEndpoint = (aiConfig.customEndpoint || config.aiCustomEndpoint || '').trim();
  const customModel = (aiConfig.customModel || config.aiCustomModel || '').trim();
  const customPrompt = aiConfig.customPrompt || config.aiCustomPrompt || '';

  // Check if AI generation is enabled and has valid requirements
  // For 'custom' provider, allow empty apiKey if customEndpoint is provided (e.g. local Ollama / LM Studio)
  const isCustomWithEndpoint = provider === 'custom' && Boolean(customEndpoint);
  if (!isEnabled || (!apiKey && !isCustomWithEndpoint)) {
    const randomTemplate = spintaxTemplates[Math.floor(Math.random() * spintaxTemplates.length)];
    return {
      comment: parseSpintax(randomTemplate),
      success: true,
      fallbackUsed: true,
      provider: 'spintax'
    };
  }

  const providerMeta = getProviderConfig(provider, customEndpoint, customModel);
  const systemPrompt = buildSystemPrompt(customPrompt, config.isCompanyPage !== false);

  const requestBody = {
    model: providerMeta.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Hãy viết bình luận cho bài đăng này của khách hàng:\n"""\n${postText}\n"""` }
    ],
    temperature: 0.7,
    max_tokens: 120
  };

  const headers = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetchFn(providerMeta.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.warn(`[FB Job Hunter] AI API error: ${response.status} ${response.statusText}`);
      const randomTemplate = spintaxTemplates[Math.floor(Math.random() * spintaxTemplates.length)];
      return {
        comment: parseSpintax(randomTemplate),
        success: true,
        fallbackUsed: true,
        provider: 'spintax',
        error: `API ${response.status}`
      };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '';

    // Clean any surrounding quotes or markdown
    const cleanedComment = rawContent
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanedComment) {
      throw new Error('AI returned empty response');
    }

    return {
      comment: cleanedComment,
      success: true,
      fallbackUsed: false,
      provider
    };
  } catch (err) {
    console.warn('[FB Job Hunter] AI generation failed, falling back to Spintax:', err.message);
    const randomTemplate = spintaxTemplates[Math.floor(Math.random() * spintaxTemplates.length)];
    return {
      comment: parseSpintax(randomTemplate),
      success: true,
      fallbackUsed: true,
      provider: 'spintax',
      error: err.message
    };
  }
}
