/**
 * AI Promotional Post Copywriter Module
 * Generates marketing posts for software services using AI (DeepSeek / OpenAI) or high-converting fallback templates
 */

export const TOPIC_TEMPLATES = {
  general: [
    `🚀 NHẬN TƯ VẤN & GIA CÔNG PHẦN MỀM THEO YÊU CẦU CHO DOANH NGHIỆP & CÁ NHÂN

Bạn đang tìm kiếm đội ngũ lập trình viên chuyên nghiệp để biến ý tưởng thành sản phẩm thực tế?
Chúng tôi chuyên cung cấp giải pháp chuyển đổi số toàn diện:

✨ Dịch vụ cung cấp:
• Thiết kế & lập trình Website, Landing page chuyên nghiệp
• Phát triển Web App, Dashboard quản trị dữ liệu
• Lập trình ứng dụng di động iOS & Android
• Viết tool tự động hóa quy trình, bot cào dữ liệu tự động

🎯 Cam kết từ chúng tôi:
✔️ Bàn giao mã nguồn 100%, bảo mật tuyệt đối
✔️ Tối ưu hiệu năng, bảo hành và hỗ trợ kỹ thuật dài hạn
✔️ Chi phí hợp lý, rõ ràng theo từng giai đoạn

📩 Đừng ngần ngại liên hệ ngay hôm nay để nhận báo giá & giải pháp chi tiết:
👉 {CONTACT_INFO}

#Outsource #GiaCongPhanMem #LapTrinhWeb #LapTrinhApp #ChuyenDoiSo #DevFreelancer`
  ],

  web: [
    `🌐 DỊCH VỤ THIẾT KẾ WEBSITE & WEB APP CHUYÊN NGHIỆP — CHUẨN SEO — TỐC ĐỘ CAO

Website không chỉ là bộ mặt của doanh nghiệp mà còn là cỗ máy tạo doanh thu 24/7!
Nếu bạn đang cần một website chuẩn chỉ, hiện đại và chuẩn UX/UI:

🔥 Thế mạnh công nghệ:
• Giao diện Responsive hoàn hảo trên Mobile, Tablet, PC
• Chuẩn SEO On-page, tối ưu Google PageSpeed 90+
• Tích hợp thanh toán online, CRM, Chatbot CSKH
• Stack hiện đại: React, Next.js, Node.js, Vue, Laravel

🎁 Ưu đãi đặc biệt: Tặng kèm tư vấn kiến trúc & bảo trì miễn phí trong 3 tháng đầu!

💬 Nhắn tin trực tiếp cho Page để xem các dự án thực tế đã hoàn thành:
👉 {CONTACT_INFO}

#ThietKeWeb #LapTrinhWeb #NextJS #ReactJS #ChuanSEO #LandingPage #DevViet`
  ],

  automation: [
    `⚡ TỰ ĐỘNG HÓA QUY TRÌNH (RPA) & LẬP TRÌNH TOOL THEO YÊU CẦU

Bạn đang mất hàng giờ mỗi ngày để làm các công việc thủ công lặp đi lặp lại?
Hãy để máy tính và bot tự động làm việc thay bạn 24/7!

🤖 Các giải pháp Tool & Automation chúng tôi nhận phát triển:
• Tool cào dữ liệu (Crawler) sản phẩm, giá cả, bài viết từ mọi nền tảng
• Bot auto tương tác, auto comment, lọc khách hàng tiềm năng trên Mạng xã hội
• Auto fill form, xử lý Excel, đồng bộ dữ liệu vào Google Sheets / Database
• Tích hợp API Zalo, Telegram, Facebook, OpenAI ChatGPT tự động

💡 Tăng 300% hiệu suất làm việc — Tiết kiệm tối đa chi phí nhân sự!

📥 Liên hệ ngay để demo tool và nhận giải pháp phù hợp nhất:
👉 {CONTACT_INFO}

#ToolTuDongHoa #RPA #AutoBot #CrawlerData #PythonBot #TietKiemChiPhi #CongNghe`
  ],

  mobile: [
    `📱 THIẾT KẾ & PHÁT TRIỂN ỨNG DỤNG DI ĐỘNG (IOS & ANDROID) ĐẲNG CẤP

Sở hữu ứng dụng di động riêng giúp tiếp cận hàng triệu khách hàng tiềm năng ngay trên đầu ngón tay!

🚀 Dịch vụ làm App di động:
• Lập trình ứng dụng Bán hàng, E-commerce, Đặt lịch, Booking
• Ứng dụng nội bộ quản lý nhân sự, kho bãi, đơn hàng
• Giao diện mượt mà 60fps chuẩn chuẩn phong cách Apple & Material Design
• Công nghệ: Flutter, React Native, Native Swift / Kotlin

🔒 Đảm bảo: Hỗ trợ đẩy App lên App Store & Google Play từ A-Z!

📞 Nhận tư vấn lộ trình và báo giá chi tiết:
👉 {CONTACT_INFO}

#LapTrinhApp #MobileApp #Flutter #ReactNative #IOS #Android #AppStore #GooglePlay`
  ]
};

/**
 * Sanitize post content to prevent Markdown headings (#) from turning into accidental hashtags on Facebook,
 * and ensure the title line does not contain hashtags.
 * @param {string} rawContent
 * @returns {string}
 */
export function sanitizePostContent(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return '';

  let text = rawContent.trim();

  // 1. Remove Markdown heading symbols (#, ##, ###, ...) at the start of any line
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 2. Remove markdown bold/italic tags around standalone title lines (e.g. "**TIÊU ĐỀ**" -> "TIÊU ĐỀ")
  text = text.replace(/^(\*{2,3}|_{2,3})(.*?)\1$/gm, '$2');

  // 3. Clean up first line (Title): strip any leading hashtag tags (e.g. "#Tag1 #Tag2 🚀 Title" -> "🚀 Title")
  const lines = text.split('\n');
  if (lines.length > 0) {
    let firstLine = lines[0].trim();
    // Strip leading hashtags from the title line
    while (/^#[a-zA-Z0-9_\u00C0-\u1EF9]+\s*/.test(firstLine)) {
      firstLine = firstLine.replace(/^#[a-zA-Z0-9_\u00C0-\u1EF9]+\s*/, '');
    }
    // Remove any leftover leading hash
    firstLine = firstLine.replace(/^#+\s*/, '').trim();
    lines[0] = firstLine;
    text = lines.join('\n');
  }

  return text.trim();
}

/**
 * Return available topic templates
 */
export function getTopicTemplates() {
  return TOPIC_TEMPLATES;
}

/**
 * Generate a promotional Facebook post using AI or curated fallback templates
 * @param {Object} options
 * @param {string} options.topic - Topic key ('general', 'web', 'automation', 'mobile', 'custom')
 * @param {string} [options.serviceHighlights] - Specific tech or service highlights
 * @param {string} [options.contactInfo] - Call to action / contact string
 * @param {string} [options.customTopicText] - Custom topic description if topic === 'custom'
 * @param {Object} [options.config] - AI configuration { apiKey, provider, model }
 * @param {Function} [customFetch] - Optional custom fetch function
 * @returns {Promise<{success: boolean, content: string, source: string, warning?: string}>}
 */
export async function generateFanpagePost(
  {
    topic = 'general',
    serviceHighlights = '',
    contactInfo = 'Inbox trực tiếp cho Page để nhận tư vấn chi tiết.',
    customTopicText = '',
    config = {}
  },
  customFetch = fetch
) {
  const effectiveContact = contactInfo.trim() || 'Inbox trực tiếp cho Page để nhận tư vấn chi tiết.';

  // If AI API key is configured or custom endpoint provided, attempt AI generation
  const hasApiKey = Boolean(config.apiKey && config.apiKey.trim());
  const isCustomWithEndpoint = config.provider === 'custom' && Boolean(config.customEndpoint && config.customEndpoint.trim());

  if (hasApiKey || isCustomWithEndpoint) {
    try {
      const provider = config.provider || 'deepseek';
      const customEndpoint = (config.customEndpoint || '').trim();
      const customModel = (config.customModel || '').trim();

      let defaultEndpoint = 'https://api.openai.com/v1/chat/completions';
      let defaultModel = 'gpt-4o-mini';

      if (provider === 'deepseek') {
        defaultEndpoint = 'https://api.deepseek.com/chat/completions';
        defaultModel = 'deepseek-chat';
      } else if (provider === 'gemini') {
        defaultEndpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        defaultModel = 'gemini-1.5-flash';
      }

      const endpoint = customEndpoint || defaultEndpoint;
      const model = customModel || config.model || defaultModel;

      const promptUser = `
Viết bài đăng Facebook quảng bá dịch vụ phần mềm cho Fanpage:
- Chủ đề: ${topic === 'custom' && customTopicText ? customTopicText : topic}
- Điểm nổi bật / Công nghệ dịch vụ: ${serviceHighlights || 'Chuyên nghiệp, nhanh chóng, bảo mật cao'}
- Thông tin liên hệ / CTA: ${effectiveContact}

Yêu cầu bài viết:
1. Tiêu đề: Viết hoa cuốn hút kèm icon bắt mắt (TUYỆT ĐỐI KHÔNG dùng ký tự '#' ở tiêu đề, không chèn hashtag vào tiêu đề bài viết, không dùng Markdown heading #).
2. Nêu bật nỗi đau của khách hàng và giải pháp công nghệ.
3. Gạch đầu dòng rõ ràng các tính năng / lợi ích.
4. Lời kêu gọi hành động (Call to action) thôi thúc nhắn tin vào Page.
5. Hashtag: CHỈ đặt ở dòng cuối cùng của bài viết (5-7 hashtag liên quan), TUYỆT ĐỐI KHÔNG đặt hashtag ở tiêu đề hoặc phần thân bài.
Không viết dài dòng, định dạng chuẩn Facebook post.
`.trim();

      const headers = {
        'Content-Type': 'application/json'
      };
      if (hasApiKey) {
        headers.Authorization = `Bearer ${config.apiKey.trim()}`;
      }

      const response = await customFetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'Bạn là chuyên gia Content Marketing công nghệ B2B hàng đầu. Bạn viết các bài đăng Facebook chuyển đổi cao, câu văn tự nhiên, chuyên nghiệp và giàu sức thuyết phục.'
            },
            {
              role: 'user',
              content: promptUser
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error) {
        throw new Error(data.error?.message || `Lỗi AI API (HTTP ${response.status})`);
      }

      const rawPostContent = data.choices?.[0]?.message?.content?.trim();
      if (rawPostContent) {
        const postContent = sanitizePostContent(rawPostContent);
        return {
          success: true,
          content: postContent,
          source: 'ai'
        };
      }
    } catch (err) {
      // Fallback to curated template if AI fails
      const fallback = selectFallbackTemplate(topic, effectiveContact, serviceHighlights, customTopicText);
      return {
        success: true,
        content: fallback,
        source: 'fallback_template',
        warning: `Không thể gọi AI (${err.message}). Đã tạo bài từ mẫu tiêu chuẩn chuyên nghiệp!`
      };
    }
  }

  // Pure template generation
  const templateResult = selectFallbackTemplate(topic, effectiveContact, serviceHighlights, customTopicText);
  return {
    success: true,
    content: templateResult,
    source: 'template'
  };
}

/**
 * Select and interpolate fallback template
 */
function selectFallbackTemplate(topic, contactInfo, serviceHighlights, customTopicText) {
  if (topic === 'custom' && customTopicText) {
    return `🚀 GIẢI PHÁP PHẦN MỀM CHUYÊN NGHIỆP: ${customTopicText.toUpperCase()}

Bạn đang tìm kiếm giải pháp kỹ thuật tối ưu cho dự án của mình?
Chúng tôi chuyên nhận tư vấn và phát triển các sản phẩm công nghệ theo yêu cầu!

⭐ Điểm nổi bật dịch vụ:
${serviceHighlights ? `• ${serviceHighlights}` : '• Lập trình chuẩn kiến trúc, dễ dàng mở rộng\n• Tối ưu hiệu năng và bảo mật tối đa\n• Hỗ trợ kỹ thuật tận tâm và bảo hành dài hạn'}

📩 Liên hệ ngay hôm nay để nhận tư vấn lộ trình và giải pháp:
👉 ${contactInfo}

#GiaCongPhanMem #LapTrinh #Outsource #GiaiPhapCongNghe #DevFreelancer`;
  }

  const list = TOPIC_TEMPLATES[topic] || TOPIC_TEMPLATES.general;
  const rawTemplate = list[Math.floor(Math.random() * list.length)];
  return rawTemplate.replace('{CONTACT_INFO}', contactInfo);
}
