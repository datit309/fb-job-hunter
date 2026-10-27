# 🎯 FB Job Hunter - Auto Comment Nhận Job Phần Mềm Facebook

Extension trình duyệt (Chrome / Brave / Edge - Manifest V3) tự động quét các bài đăng tuyển dụng, tìm freelancer, outsource trong các nhóm Facebook, thông minh lọc đúng bài liên quan đến chuyên môn phần mềm và tự động bình luận ứng tuyển an toàn, tự nhiên như người thật.

---

## ✨ Tính Năng Nổi Bật

1. **Bộ Lọc Thông Minh (Rule-based Filter Engine)**:
   - **Từ khóa bắt buộc (Whitelist)**: Nhận diện các bài cần dev, làm web, làm app, tool bot, python, react, nodejs, flutter,... Hỗ trợ cả **tiếng Việt có dấu và không dấu**.
   - **Từ khóa loại trừ (Blacklist)**: Tự động bỏ qua các bài tuyển sale, tuyển sinh, bán khóa học, đa cấp, bất động sản, tuyển dụng onsite fulltime.
   - **Tính điểm độ phù hợp (Match Score)**: Ưu tiên các bài có độ liên quan cao nhất.

2. **Soạn Nội Dung Ứng Tuyển Đa Dạng**:
   - **Cơ chế Spintax Chống Trùng**: Hỗ trợ cú pháp xoay từ đa tầng `{Chào bạn|Hi bạn} {mình|em} chuyên nhận {làm web|viết tool}...` giúp mỗi comment gửi đi là độc nhất, không bị Facebook quét spam.
   - **AI Smart Pitch (DeepSeek / OpenAI / Gemini)**: Đọc hiểu ngữ cảnh bài đăng của khách hàng và tự động tạo câu chào hàng may đo chuẩn xác theo đúng bài toán và công nghệ khách đang cần.

3. **Auto Đăng Bài Lên Fanpage (Meta Graph API & AI Copywriter)**:
   - **Đăng bài chính thống qua Meta Graph API v19.0**: Đăng bài trực tiếp lên Fanpage của bạn mà không lo checkpoint tài khoản hay dính hạn chế spam.
   - **AI Copywriter chuyên sâu B2B**: Tự động soạn bài viết quảng bá dịch vụ phần mềm, thiết kế web, làm app di động, viết tool tự động hóa với hook hấp dẫn, thế mạnh công nghệ, CTA thôi thúc và hashtag chuẩn SEO.
   - **Mẫu bài viết dự phòng chuyên nghiệp**: Luôn sẵn sàng tạo bài ngay cả khi chưa gắn API Key.
   - **Kiểm tra quyền Page trực tiếp**: Bấm nút kiểm tra để xác thực Page ID và Token trước khi đăng.

4. **Cơ Chế Bảo Vệ Tài Khoản Facebook (Anti-Checkpoint)**:
   - **Random Jitter Delay**: Giãn cách ngẫu nhiên giữa 2 lần comment (mặc định 60s - 180s).
   - **Human Typing Emulation**: Gõ từng ký tự với tốc độ biến thiên kèm độ trễ tự nhiên, kích hoạt đầy đủ DOM events (`InputEvent`, `beforeinput`, `input`, `change`).
   - **4-Tier Anti-Duplication Engine**: Kiểm tra trùng 4 lớp (Post ID, Post URL, Author + Text Hash, và nhận diện comment đã tồn tại trong DOM).
   - **Daily Quota**: Giới hạn tối đa số comment/ngày (khuyên dùng 20-30 cmt/ngày).

5. **Trực Quan & Tiện Lợi**:
   - **Floating In-Page Widget**: Hiển thị radar trạng thái ngay góc màn hình Facebook, có nút tạm dừng nhanh và xem danh sách việc mới tìm thấy.
   - **Telegram Instant Alert**: Gửi thông báo bài đăng và nội dung comment về bot Telegram cá nhân ngay tức thì (kèm nút test bắn thử tin nhắn).
   - **Giao Diện Popup SaaS Cao Cấp**: Thống kê số bài quét, tỷ lệ khớp, lịch sử comment có link trực tiếp đến bài viết.

---

## 📦 Hướng Dẫn Cài Đặt Lên Trình Duyệt

Extension tuân thủ chuẩn **Manifest V3** không cần build hay biên dịch phức tạp.

1. Mở trình duyệt Chrome, Brave hoặc Microsoft Edge.
2. Truy cập vào đường dẫn: `chrome://extensions/` (trên Chrome/Brave) hoặc `edge://extensions/` (trên Edge).
3. Bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
4. Bấm vào nút **"Tải tiện ích đã giải nén" (Load unpacked)**.
5. Chọn thư mục `fb-job-hunter` trong máy của bạn:
   ```
   /Users/trantandat/GIC/Freelancer/fb-job-hunter
   ```
6. Ghim (Pin) biểu tượng 🎯 **FB Job Hunter** lên thanh công cụ của trình duyệt.

---

## ⚙️ Hướng Dẫn Cấu Hình Chi Tiết

Bấm vào icon Extension trên thanh công cụ để mở bảng điều khiển:

### 1. Từ Khóa (Tab "Từ khóa")
- **Từ khóa bắt buộc**: Nhập các từ phản ánh dịch vụ của bạn, ví dụ:
  ```text
  cần dev, tìm dev, outsource, freelance, làm web, làm app, viết tool, cào data, python, nodejs, reactjs, flutter
  ```
- **Từ khóa loại trừ**: Loại bỏ tin rác:
  ```text
  tuyển sale, bán khóa học, tuyển sinh, đa cấp, bất động sản, fulltime onsite
  ```

### 2. Mẫu Comment Spintax (Tab "Mẫu cmt")
Nhập các mẫu xoay từ để mỗi lần comment một nội dung khác nhau:
```text
{Chào bạn|Hi bạn|Chào anh/chị}, mình chuyên nhận {làm web|phát triển app|viết tool tự động hóa}. Đã từng làm nhiều dự án tương tự, bạn check inbox mình trao đổi chi tiết nhé!
{Hello bạn|Chào bạn}, mình là fullstack dev có kinh nghiệm với {Python|NodeJS|React}. Mình vừa nhắn tin qua inbox bạn check giúp mình nha!
```
*Bạn có thể bấm nút **"🎲 Thử tạo 1 câu mẫu"** để xem trước câu bình luận ngẫu nhiên sinh ra.*

### 3. Kích Hoạt AI May Đo (Tab "AI Pitch")
Nếu muốn câu trả lời được AI viết riêng cho từng bài:
- Bật công tắc **"Kích hoạt AI Smart Pitch"**.
- Chọn nhà cung cấp: **DeepSeek** (rẻ và viết tiếng Việt rất mượt) hoặc **OpenAI**.
- Dán **API Key** của bạn vào.
- Tùy chỉnh chỉ dẫn thêm (Prompt): Ví dụ *"Nhấn mạnh mình có 5 năm kinh nghiệm, làm việc đúng hẹn, có thể xuất hóa đơn VAT"*.

### 4. Đăng Bài Lên Fanpage (Tab "Đăng Page")
Tính năng giúp bạn phủ sóng thương hiệu dịch vụ phần mềm và thu hút khách hàng tiềm năng với 2 chế độ linh hoạt:

#### 🔹 Chế độ 1: ⚡ Meta Bulk Post Composer & Planner (Lên lịch hàng loạt — 100% Không cần Token ⭐)
- **Không cần tạo App hay lấy Access Token**: Dùng trực tiếp phiên đăng nhập Facebook chính thức của bạn trên `business.facebook.com`.
- **Tự động lên lịch 7 ngày bằng AI**: Bấm **"✨ AI Tạo chiến dịch bài đăng"**, AI sẽ tự động soạn 7 bài viết với 7 chủ đề công nghệ khác nhau (Web, Tool Automation, Mobile App, Outsource...) và tự động chia vào các khung giờ vàng có lượt tương tác cao nhất (`08:30`, `11:45`, `19:30`).
- **⚡ Cách 1 — Lên lịch hàng loạt qua Bulk Post Composer (Nhanh nhất)**:
  - Bấm **"📥 Tải CSV Meta Bulk ⭐"**: Extension sẽ xuất file CSV chuẩn 2 cột (`Date and time, Text`) được thiết kế riêng cho Meta Business Suite.
  - Bấm **"🚀 Mở Meta Bulk Post Composer"** (`https://business.facebook.com/latest/bulk_post_composer`).
  - Trong giao diện Facebook, bấm nút **"Tải file CSV lên"** (Upload CSV) và chọn file vừa tải. Meta sẽ tự động nhập toàn bộ 7 bài viết vào đúng ngày giờ lên lịch!
- **✍️ Cách 2 — Trợ lý nổi trong trang Planner / Composer**:
  - Bấm mở **Meta Planner** hoặc **Composer**, thanh trợ lý nổi của extension sẽ xuất hiện ở góc phải.
  - Bấm **"🚀 Điền vào Composer & Copy"**, nội dung bài viết và hashtag sẽ tự động được gõ vào ô đăng bài.
  - Sau khi lưu, bấm **"✅ Đã lên lịch xong"** để chuyển sang bài tiếp theo!
- **Hỗ trợ xuất CSV chi tiết**: Nút **"📥 Tải CSV Đầy đủ"** để lưu trữ kế hoạch nội dung với đầy đủ Tiêu đề, Ngày, Giờ, Trạng thái.

#### 🔹 Chế độ 2: 🔑 Meta Graph API (Đăng bài tức thì qua Token)
- **Page ID**: Nhập ID Trang Fanpage của bạn.
- **Page Access Token**: Nhập Access Token được cấp từ Meta for Developers (có quyền `pages_manage_posts`).
- Bấm **"🔍 Kiểm tra quyền Page"** để kiểm tra tính hợp lệ của token ngay lập tức.
- Chọn chủ đề bài đăng: *Web, Tool tự động hóa, Mobile App, hoặc Tự nhập theo ý thích*.
- Bấm **"🤖 AI Soạn bài viết ngay"**: AI sẽ tự động tạo bài viết hoàn chỉnh với tiêu đề lôi cuốn, giải pháp công nghệ, cam kết và hashtag.
- Xem lại nội dung và bấm **"🚀 Đăng lên Fanpage ngay"**: Bài viết sẽ được xuất bản trực tiếp lên Page qua API v19.0!

### 5. Cấu Hình An Toàn & Telegram (Tab "An toàn")
- **Thời gian nghỉ ngẫu nhiên**: Để mặc định `60` - `180` giây.
- **Giới hạn số comment / ngày**: Đặt `20` - `30` comment để tài khoản an toàn tuyệt đối.
- **Telegram Webhook**:
  - Nhập `Bot Token` (tạo từ `@BotFather`).
  - Nhập `Chat ID` (lấy từ `@userinfobot`).
  - Bấm **"✈️ Bắn tin nhắn Test Telegram"** để thử nghiệm kết nối.
  - Mỗi khi tool tìm thấy việc và comment thành công, điện thoại bạn sẽ nhận được thông báo ngay lập tức!

---

## 🛡️ Khuyến Nghị Giữ Tài Khoản Facebook An Toàn

1. **Dùng tài khoản phụ uy tín (Clone có tương tác)** hoặc nick chính nhưng chỉ nên comment ở mức độ vừa phải (20 - 30 comment/ngày).
2. **Không giảm thời gian nghỉ xuống dưới 45 giây**. Facebook có thuật toán phát hiện tần suất click/comment bất thường.
3. **Bật AI hoặc chuẩn bị ít nhất 5-10 mẫu Spintax phong phú** để các comment không bị trùng lặp câu chữ.
4. Mở tab Facebook Group muốn quét, cuộn chuột xuống vài lần để Facebook tải các bài đăng mới nhất, sau đó để tool tự động làm việc.

---

## 📂 Cấu Trúc Mã Nguồn

```
fb-job-hunter/
├── manifest.json              # Khai báo extension Manifest V3
├── icons/                     # Icons kích thước 16, 48, 128px
├── background/
│   └── service-worker.js      # Background worker, Telegram webhook, lifecycle
├── content/
│   ├── content.js             # Content script đã đóng gói (Bundle)
│   ├── dom-scanner.js         # Quét và trích xuất cấu trúc bài viết Facebook
│   ├── commenter.js           # Tự động gõ phím kiểu người thật và gửi comment
│   ├── safety.js              # Quản lý cooldown, giới hạn ngày và tránh trùng bài
│   ├── floating-widget.js     # Widget nổi trực tiếp trên trang web (Shadow DOM)
│   ├── floating-widget.css    # Stylesheets cho floating widget
│   ├── business-suite-helper.js   # Trợ lý tự động lên lịch trên Meta Business Suite
│   └── business-suite-helper.css  # Giao diện trợ lý Meta Business Suite
├── lib/
│   ├── filter-engine.js       # Bộ lọc từ khóa có dấu / không dấu & tính điểm
│   ├── spintax.js             # Parser xoay từ spintax đa tầng {A|B|C}
│   ├── ai-matcher.js          # Tích hợp API DeepSeek / OpenAI sinh pitch
│   ├── ai-post-writer.js      # Trình tạo bài đăng truyền thông bằng AI / mẫu
│   ├── business-suite-planner.js # Lập lịch chiến dịch & xuất CSV cho Meta Planner
│   ├── page-publisher.js      # Module đăng bài lên Fanpage qua Meta Graph API
│   ├── telegram.js            # Module gửi thông báo Telegram
│   └── config-helper.js       # Xử lý và kiểm tra dữ liệu cấu hình
├── popup/
│   ├── popup.html             # Giao diện bảng điều khiển chính
│   ├── popup.css              # Giao diện Dark theme chuẩn SaaS
│   └── popup.js               # Logic điều khiển, lưu trữ và hiển thị thống kê
└── tests/                     # 66 unit & E2E tests tự động
    ├── spintax.test.js
    ├── filter-engine.test.js
    ├── ai-matcher.test.js
    ├── ai-post-writer.test.js
    ├── business-suite-planner.test.js
    ├── page-publisher.test.js
    ├── telegram.test.js
    ├── dom-scanner.test.js
    ├── safety.test.js
    ├── manifest.test.js
    ├── popup-logic.test.js
    └── e2e-workflow.test.js
```

---

## 🧪 Chạy Kiểm Thử Tự Động (Test Suite)

Để kiểm tra toàn bộ tính năng và logic của tool:

```bash
cd fb-job-hunter
npm test
```

Toàn bộ 66 test case bao gồm parser, filter, scanner, safety, Graph API publisher, AI post writer, Business Suite Planner, Telegram, UI logic và kịch bản E2E sẽ được chạy tự động.
