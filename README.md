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

3. **Cơ Chế Bảo Vệ Tài Khoản Facebook (Anti-Checkpoint)**:
   - **Random Jitter Delay**: Giãn cách ngẫu nhiên giữa 2 lần comment (mặc định 60s - 180s).
   - **Human Typing Emulation**: Gõ từng ký tự với tốc độ biến thiên kèm độ trễ tự nhiên, kích hoạt đầy đủ DOM events (`InputEvent`, `beforeinput`, `input`, `change`).
   - **Deduplication Engine**: Lưu vết ID và URL bài viết, tuyệt đối không comment trùng lặp vào 1 bài.
   - **Daily Quota**: Giới hạn tối đa số comment/ngày (khuyên dùng 20-30 cmt/ngày).

4. **Trực Quan & Tiện Lợi**:
   - **Floating In-Page Widget**: Hiển thị radar trạng thái ngay góc màn hình Facebook, có nút tạm dừng nhanh và xem danh sách việc mới tìm thấy.
   - **Telegram Instant Alert**: Gửi thông báo bài đăng và nội dung comment về bot Telegram cá nhân ngay tức thì.
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

### 4. Cấu Hình An Toàn & Telegram (Tab "An toàn")
- **Thời gian nghỉ ngẫu nhiên**: Để mặc định `60` - `180` giây.
- **Giới hạn số comment / ngày**: Đặt `20` - `30` comment để tài khoản an toàn tuyệt đối.
- **Telegram Webhook**:
  - Nhập `Bot Token` (tạo từ `@BotFather`).
  - Nhập `Chat ID` (lấy từ `@userinfobot`).
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
│   ├── content.js             # Content script chính chạy trên Facebook
│   ├── dom-scanner.js         # Quét và trích xuất cấu trúc bài viết Facebook
│   ├── commenter.js           # Tự động gõ phím kiểu người thật và gửi comment
│   ├── safety.js              # Quản lý cooldown, giới hạn ngày và tránh trùng bài
│   ├── floating-widget.js     # Widget nổi trực tiếp trên trang web (Shadow DOM)
│   └── floating-widget.css    # Stylesheets cho floating widget
├── lib/
│   ├── filter-engine.js       # Bộ lọc từ khóa có dấu / không dấu & tính điểm
│   ├── spintax.js             # Parser xoay từ spintax đa tầng {A|B|C}
│   ├── ai-matcher.js          # Tích hợp API DeepSeek / OpenAI sinh pitch
│   └── config-helper.js       # Xử lý và kiểm tra dữ liệu cấu hình
├── popup/
│   ├── popup.html             # Giao diện bảng điều khiển chính
│   ├── popup.css              # Giao diện Dark theme chuẩn SaaS
│   └── popup.js               # Logic điều khiển, lưu trữ và hiển thị thống kê
└── tests/                     # 31 unit & E2E tests tự động
    ├── spintax.test.js
    ├── filter-engine.test.js
    ├── ai-matcher.test.js
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

Toàn bộ 31 test case bao gồm parser, filter, scanner, safety, UI logic và kịch bản E2E sẽ được chạy tự động.
