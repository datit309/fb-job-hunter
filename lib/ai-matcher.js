/**
 * AI Matcher and Comment Pitch Generator
 * Supports DeepSeek, OpenAI, and Gemini models.
 * Automatically generates tailored, human-like comment pitches based on Facebook post requirements.
 * Includes graceful fallback to Spintax templates upon API error, network failure, or missing keys.
 */

import { parseSpintax } from './spintax.js';

export function buildSystemPrompt(customPrompt = '') {
  let prompt = `Bạn là một lập trình viên/freelancer phần mềm chuyên nghiệp, lịch sự, nhiệt tình.
Nhiệm vụ của bạn là đọc bài đăng tìm người làm phần mềm trên Facebook và viết 1 câu bình luận ứng tuyển (1-2 câu ngắn gọn).
Yêu cầu:
- Tự nhiên, thân thiện, giống người thật gõ, tuyệt đối không dùng văn phong máy móc rập khuôn.
- Nêu đúng điểm chạm: nhắc đúng công nghệ/bài toán khách đang cần (ví dụ: cào web, làm app flutter, fix bug react...).
- Kêu gọi hành động ngắn gọn (ví dụ: "Check inbox mình gửi portfolio/trao đổi chi tiết nhé", "Mình đã ib bạn nhé").
- Độ dài tối đa 2 câu (dưới 40 từ), không dài dòng, không dùng emoji quá lố (chỉ tối đa 1 emoji hoặc không dùng).`;

  if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) {
    prompt += `\nYêu cầu bổ sung từ người dùng:\n${customPrompt.trim()}`;
  }

  return prompt;
}

/**
 * Returns API endpoint and default model for the selected provider
 */
function getProviderConfig(provider) {
  switch (provider) {
    case 'deepseek':
      return {
        url: 'https://api.deepseek.com/chat/completions',
        model: 'deepseek-chat'
      };
    case 'gemini':
      return {
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        model: 'gemini-1.5-flash'
      };
    case 'openai':
    default:
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini'
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
    : ['{Chào bạn|Hi bạn}, bên mình chuyên nhận làm dự án phần mềm theo yêu cầu. Check inbox mình trao đổi nhé!'];

  const fallbackComment = () => {
    const template = spintaxTemplates[Math.floor(Math.random() * spintaxTemplates.length)];
    return parseSpintax(template);
  };

  // If AI is not enabled or no API key, use Spintax fallback
  if (!config.aiEnabled || !config.aiApiKey || typeof config.aiApiKey !== 'string' || !config.aiApiKey.trim()) {
    return {
      success: true,
      comment: fallbackComment(),
      fallbackUsed: true,
      provider: 'none'
    };
  }

  const provider = config.aiProvider || 'deepseek';
  const providerConf = getProviderConfig(provider);
  const systemPrompt = buildSystemPrompt(config.aiCustomPrompt);

  try {
    const payload = {
      model: providerConf.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Hãy viết 1 câu bình luận ứng tuyển nhận job phù hợp cho bài đăng Facebook này:\n"""\n${postText}\n"""` }
      ],
      temperature: 0.7,
      max_tokens: 150
    };

    const response = await fetchFn(providerConf.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.aiApiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error HTTP ${response.status}`);
    }

    const data = await response.json();
    const comment = data?.choices?.[0]?.message?.content?.trim();

    if (!comment) {
      throw new Error('Empty response from AI model');
    }

    // Strip quotation marks if AI wrapped the response in quotes
    const cleanedComment = comment.replace(/^["']|["']$/g, '');

    return {
      success: true,
      comment: cleanedComment,
      provider,
      fallbackUsed: false
    };
  } catch (err) {
    return {
      success: true,
      comment: fallbackComment(),
      fallbackUsed: true,
      provider,
      error: err.message
    };
  }
}
