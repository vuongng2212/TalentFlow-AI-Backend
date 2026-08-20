# Hướng dẫn Thiết kế & Lộ trình Tích hợp Email Ingestion Automation (n8n + .NET)

Tài liệu này chi tiết hóa phương án thiết kế và lộ trình tích hợp hệ thống tự động hóa thu thập CV từ email (Email Ingestion) vào hệ thống **TalentFlow AI**. Giải pháp này hướng tới việc tối ưu hóa tốc độ phân phối MVP, đồng thời tạo ra không gian phát triển phù hợp cho nhân sự lập trình .NET mới gia nhập.

---

## 1. Bối cảnh & Điểm nghẽn nhân sự (Choke Point)

### Hiện trạng hệ thống
- **API Gateway (NestJS)**: Lớp điều phối, giữ core business logic, database (PostgreSQL via Prisma), lưu trữ S3 (MinIO/R2).
- **CV Parser (Spring Boot)**: Worker nặng xử lý phân tích và chấm điểm CV qua cơ chế Event-driven.
- **Notification (NestJS)**: Websocket & Email service.

### Thử thách nhân sự & MVP
- Nhân sự mới là Core Backend **.NET** (C#).
- Core backend hiện tại viết bằng NestJS và Spring Boot. Việc yêu cầu dev .NET onboard NestJS ngay từ đầu sẽ gây trễ MVP (learning curve từ 2-3 tuần).
- Nếu để dev .NET phát triển hoàn toàn trên **n8n (low-code)**, họ sẽ nhanh chóng cảm thấy nhàm chán vì công việc mang tính chất kéo thả cấu hình, thiếu thử thách lập trình C# đúng thực lực.
- Nếu dựng một Microservice .NET lớn ngay từ đầu sẽ gây phình to hệ thống (tăng gánh nặng deploy, CI/CD, K8s configuration) khi hệ thống chưa có MVP.

---

## 2. Giải pháp Lai (Hybrid Sweet Spot): n8n (Trigger) + .NET (Rule Engine)

Chúng ta chia nhỏ trách nhiệm xử lý để tận dụng điểm mạnh nhất của từng phần:
1. **n8n (Low-code Connector)**: Đóng vai trò là cổng tiếp nhận thô (Ingress Gate). n8n cực kỳ mạnh và nhanh trong việc tích hợp Gmail OAuth, IMAP, lắng nghe hòm mail mới, tải file đính kèm thô và forward webhook.
2. **C# Minimal API (.NET 8 Logic Engine)**: Đóng vai trò bộ não xử lý (Ingestion & Rule Engine). C# Engine sẽ tiếp nhận webhook từ n8n, tính toán hash file để chống trùng (`Idempotency`), chạy thuật toán so khớp tiêu đề email với Job phù hợp (`Priority & Specificity Matching`), và chuẩn hóa dữ liệu trước khi đẩy sang API Gateway.
3. **API Gateway (NestJS)**: Cung cấp API Ingestion endpoint bảo mật bằng API Key.

---

## 3. Lộ trình Triển khai 2 Pha (Two-Stage Implementation)

Để đảm bảo vừa có MVP chạy ngay, vừa chuyển đổi mượt mà không gây đứt gãy hệ thống (no breakpoint), lộ trình được chia thành 2 pha:

```
Pha 1 (MVP):
[Gmail] ──(Mail thô)──> [n8n Workflow] ──(Parse đơn giản + API Key)──> [API Gateway: /applications/ingestion]

Pha 2 (Maintain & Scale):
[Gmail] ──(Mail thô)──> [n8n Workflow] ──(Forward thô)──> [.NET Ingestion Engine] ──(Rule Match + Deduplicate)──> [API Gateway: /applications/ingestion]
```

### PHA 1: Phát triển MVP tốc độ cao (Ship in 1 Week)
*Mục tiêu: Đưa tính năng quét mail tự động vào hoạt động nhanh nhất để demo.*

1. **API Gateway (Core Team)**:
   - Dựng sẵn endpoint `/api/v1/applications/ingestion` (chấp nhận file upload + metadata của ứng viên).
   - Bảo vệ endpoint bằng `ApiKeyGuard` (Header `x-api-key`).
   - Tự động tạo hoặc kết hợp Candidate bằng Email trong workspace, tạo Application, upload file lên R2 và bắn event `cv.uploaded` sang RabbitMQ/Redis.

2. **n8n Workflow (Dev .NET phát triển)**:
   - Cấu hình Gmail trigger kết nối hòm thư tuyển dụng của khách hàng.
   - Khi có email mới, n8n tải file CV đính kèm xuống bộ nhớ tạm.
   - **Xử lý trích xuất thông tin Email (Email Parsing - KHÔNG parse nội dung file CV)**:
     - Trích xuất email ứng viên từ trường `From` (Header email).
     - Trích xuất tên hiển thị của ứng viên từ trường `From`.
     - Lấy phần text thô của nội dung email (Body text) để gửi vào trường `coverLetter`.
   - Gửi request `POST` dạng `multipart/form-data` sang endpoint `/applications/ingestion` của API Gateway kèm file CV gốc (binary) không thay đổi. API Gateway / .NET Engine sẽ tự động thực hiện **Dynamic Job Mapping** (xem chi tiết tại Mục 3.7).

**Đánh giá Pha 1**: Chạy thực tế được ngay. n8n đóng vai trò là "chất keo" kết dính tạm thời.

---

## 3.5. Ranh giới Trách nhiệm Xử lý (Parsing Boundaries)

Để tránh nhầm lẫn giữa các cấu phần trong hệ thống, ranh giới xử lý được quy định rõ như sau:

| Nhiệm vụ | Nơi xử lý | Chi tiết hoạt động |
| :--- | :--- | :--- |
| **Email Metadata Parsing** | n8n (Pha 1) / C# Engine (Pha 2) | Chỉ phân tích cấu trúc của email nhận được để lấy: email gửi, tên ứng viên, nội dung thư, và file đính kèm. Hoàn toàn không mở đọc dữ liệu bên trong file CV. |
| **Job Mapping & Deduplication** | n8n (Pha 1) / C# Engine (Pha 2) | So khớp tiêu đề email với Job ID trong hệ thống. Tính mã băm MD5/SHA256 của file CV đính kèm để chặn xử lý trùng lặp theo cơ chế ở Mục 3.6. |
| **Semantic CV Parsing** | `cv-parser` (Java/Spring Boot) | Sau khi API Gateway nhận file CV và đẩy event `cv.uploaded`. Service Java này sẽ thực hiện đọc nội dung chi tiết bên trong file PDF/DOCX (Skills, Education, Experience) và chạy AI scoring. n8n/C# Engine không tham gia vào bước này. |

---

## 3.6. Chi tiết Cơ chế Chống Trùng lặp (Deduplication & Anti-Spam)

Để giải quyết bài toán chống trùng lặp hiệu quả trên mô hình B2B SaaS, hệ thống áp dụng cơ chế lọc trùng chia làm 2 tầng rõ rệt:

### A. Tầng Hệ thống (Technical Idempotency)
* **Mục tiêu:** Tránh xử lý trùng lặp khi n8n gặp sự cố mạng (network retry), gọi Webhook nhiều lần cho cùng một email, hoặc lỗi MQ/Redis Event trigger lặp lại.
* **Giải pháp:** Sử dụng **`externalMessageId`** (Message ID gốc của Gmail).
* **Cơ chế hoạt động:**
  1. Khi nhận webhook, .NET Engine check `externalMessageId` trong Redis Cache (TTL: 24 - 48 giờ).
  2. Nếu ID đã tồn tại $\rightarrow$ Loại bỏ ngay request (Skip/Ignore), không xử lý tiếp và trả về status `200 OK` (hoặc `208 Already Reported`) để n8n không retry nữa.
  3. Nếu chưa tồn tại $\rightarrow$ Lưu ID vào Redis và tiếp tục xử lý.

### B. Tầng Nghiệp vụ (Anti-Spam & Multi-Job Application)
* **Mục tiêu:** Chống spam khi ứng viên nộp đi nộp lại 1 file CV cho cùng một Job trong nhiều ngày liên tục, đồng thời vẫn cho phép ứng viên dùng CV đó nộp cho nhiều Job khác nhau (hợp lệ).
* **Giải pháp:** Sử dụng mã băm file CV (**`cvHash`** - MD5 hoặc SHA256) làm khóa nhận diện.
* **Quy tắc lọc trùng (Deduplication Rules):**
  1. **Cô lập Workspace (Tenant Isolation):** Không check trùng mã hash CV xuyên suốt toàn hệ thống. Việc lọc trùng chỉ diễn ra trong phạm vi của từng **Workspace ID** cụ thể để đảm bảo bảo mật dữ liệu.
  2. **Khóa lọc trùng tổ hợp (Compound Deduplication Key):**
     $$\text{Deduplication Key} = \text{Workspace ID} + \text{Job ID} + \text{CV Hash (hoặc Candidate Email)}$$
     * *Trường hợp trùng Key:* Ứng viên nộp cùng một CV vào cùng một Job. Hệ thống sẽ **từ chối tạo Application mới** (hoặc cập nhật coverLetter/timeline vào Application cũ nếu cần) và không đẩy sang CV Parser nhằm tiết kiệm chi phí AI/LLM.
     * *Trường hợp khác Key:* Ứng viên nộp cùng một CV nhưng cho các **Job ID khác nhau** trong cùng một Workspace. Hệ thống **chấp nhận** và tạo các Application riêng biệt cho từng Job.
  3. **Tối ưu hóa hiệu năng & Chi phí AI Parsing:**
     * *CV Parsing (Bóc tách thông tin):* Nếu file CV với `cvHash` đã tồn tại trong Workspace $\rightarrow$ Không cần gửi file qua thư viện Java Parser để bóc tách thông tin cá nhân/kỹ năng/học vấn nữa. Gateway sẽ tái sử dụng thông tin cũ đã parse trong DB.
     * *AI Scoring (Chấm điểm CV vs JD):* Vì mỗi Job có một JD (Job Description) khác nhau, nên mặc dù không cần parse lại CV, hệ thống **bắt buộc vẫn phải chạy AI Scoring** cho Application mới này để chấm điểm sự phù hợp của ứng viên đối với JD của Job đó.

---

## 3.7. Cơ chế So khớp Job Động (Dynamic Job Mapping) & Email Forwarding

Để hệ thống hoạt động linh hoạt và đảm bảo an toàn bảo mật dữ liệu khách hàng (B2B SaaS Multi-tenant), hệ thống áp dụng cơ chế **Email Forwarding** kết hợp với **Dynamic Job Mapping**:

### A. Mô hình Email Forwarding (Kiến trúc phân phối hòm thư)
* Thay vì yêu cầu HR phải cấp quyền OAuth đăng nhập Gmail/Outlook nội bộ (phức tạp, rủi ro bảo mật và đòi hỏi verify Google App rất lâu), chúng ta cung cấp cơ chế chuyển tiếp:
  1. Mỗi Workspace (Khách hàng B2B) khi đăng ký hệ thống sẽ được sinh một email ảo (Alias email) duy nhất, định dạng: `<tenant-slug>@ingest.talentflow.ai` (ví dụ: `mindx@ingest.talentflow.ai`).
  2. HR chỉ cần vào Gmail tuyển dụng của công ty (`jobs@mindx.edu.vn`) thiết lập một luật tự động chuyển tiếp (**Auto-Forwarding Rule**): *Mọi email gửi đến đây sẽ tự động chuyển tiếp sang `mindx@ingest.talentflow.ai`*.
  3. **n8n Workflow** chỉ cần kết nối và lắng nghe duy nhất **một hòm thư tổng** (`@ingest.talentflow.ai`) của TalentFlow.

### B. Nhận diện Workspace động
* Khi có email được chuyển tiếp đến hòm thư tổng, n8n/Backend sẽ phân tích trường **`To` (Người nhận)** của Email:
  * Trích xuất phần `<tenant-slug>` trước ký tự `@` (ví dụ: `mindx`).
  * Thực hiện truy vấn cơ sở dữ liệu để ánh xạ (map) từ `<tenant-slug>` sang `Workspace ID` thực tế trong hệ thống.
  * Đính kèm `Workspace ID` này vào header `x-workspace-id` khi gửi payload sang API Gateway.

### C. Thuật toán so khớp Job động (Matching Algorithm)
* Phía Backend lấy toàn bộ danh sách các Job đang hoạt động (`status = ACTIVE`) của Workspace đó kèm theo danh sách từ khóa được HR cấu hình sẵn: `subjectKeywords: string[]` (ví dụ: Job Java Backend lưu `["Java Backend", "Java Developer", "MindX - HCM - Java"]`).
* So khớp chuỗi tiêu đề email nhận được với các keywords của từng Job.
* **Độ ưu tiên (Specificity Priority):** Job nào có keyword khớp dài nhất (hoặc khớp chính xác nhất) sẽ được chọn.
* *Trường hợp không khớp (Unassigned Route):* Nếu tiêu đề email không khớp với bất kỳ từ khóa nào, hệ thống tự động map vào **Job ảo mặc định (General Inbox)** của Workspace để HR tự phân loại bằng kéo-thả thủ công sau.

---

## 3.8. Xử lý các Tình huống Biên (Edge Cases & Solutions)

| Phân loại | Tình huống biên (Edge Case) | Giải pháp xử lý |
| :--- | :--- | :--- |
| **Email Metadata** | **Email chuyển tiếp (Fwd Email)**<br>HR nhận CV ở mail cá nhân rồi forward sang mail tuyển dụng chung (Sender lúc này là HR). | Nếu tiêu đề email chứa tiền tố `Fwd:` hoặc `Forwarded:`, logic engine sẽ quét Email Body để trích xuất email của ứng viên gốc từ pattern `From: ... <email>`. |
| **File Attachments** | **Nhiều file đính kèm trong 1 email**<br>Ứng viên gửi kèm CV, ảnh chân dung, Cover letter hoặc portfolio. | 1. Chỉ lọc và chấp nhận các định dạng `.pdf`, `.docx`, `.doc`. Bỏ qua ảnh, zip, xlsx.<br>2. Quét tên file để tìm các từ khóa chứa: `CV`, `Resume`, `Profile`, `Ung-tuyen`. Nếu vẫn không phân biệt được, đính kèm cả 2 file vào Application. |
| **File Attachments** | **Ảnh chữ ký (Signature Logo) nhận nhầm là CV**<br>Các logo công ty, icon MXH đính kèm ở chân trang email. | Loại bỏ các file đính kèm có thuộc tính `Content-Disposition: inline` hoặc định dạng ảnh dưới kích thước nhất định (ví dụ < 100KB). |
| **Cloud CV Link** | **Ứng viên không đính kèm file mà gửi link Cloud**<br>Gửi link Google Drive, OneDrive, Dropbox. | (Pha 3): Quét body email tìm link cloud và tải stream trực tiếp. Nếu link private, tạo Application ở trạng thái `Missing CV` và gửi mail thông báo yêu cầu ứng viên mở quyền truy cập. |

---

### PHA 2: Chuyển đổi sang Maintain & Scale (Đưa .NET Engine vào)
*Mục tiêu: Tối ưu kiến trúc, xử lý các logic nghiệp vụ phức tạp, giảm tải cho n8n, và tạo đất diễn cho dev .NET.*

1. **C# Ingestion Engine (Dev .NET phát triển)**:
   - Phát triển một ứng dụng siêu nhẹ bằng **.NET 8 Minimal API** đóng gói trong Docker Container.
   - Nhận webhook thô từ n8n gồm email gửi, tiêu đề, nội dung email và file đính kèm.
   - Triển khai **Rule Engine & Dynamic Job Mapping**:
     - Lấy danh sách Job và `subjectKeywords` (qua cache Redis hoặc gọi API Gateway nội bộ).
     - Thực hiện thuật toán so khớp tiêu đề email để map với `jobId` và xử lý các **Edge Cases** ở Mục 3.8.
   - Triển khai **Deduplication**:
     - Tính mã băm MD5/SHA256 của file CV.
     - Lọc trùng theo cơ chế ở Mục 3.6 (System & Business Deduplication).
   - Sau khi xử lý sạch dữ liệu, gọi API `/applications/ingestion` của API Gateway để lưu trữ.

2. **Cấu hình n8n (Dev .NET chuyển đổi)**:
   - Thay vì n8n gọi trực tiếp API Gateway, n8n chỉ cần đổi URL Webhook đích hướng sang **C# Ingestion Engine**.
   - n8n không cần giữ bất kỳ code JavaScript parse text hay hardcode mapping nào nữa. Toàn bộ workflow n8n chỉ gồm 3 node kéo thả thuần túy: `Gmail Trigger` -> `Download Attachment` -> `HTTP Request to C# Engine`.

3. **API Gateway (Core Team)**:
   - **Không cần thay đổi bất kỳ dòng code nào**. API endpoint `/applications/ingestion` vẫn tiếp tục hoạt động bình thường vì payload do C# Engine gửi sang hoàn toàn tương thích với payload n8n gửi ở Pha 1.

---

## 4. Đặc tả API Contract (`POST /applications/ingestion`)

API Gateway NestJS sẽ cung cấp endpoint này cho cả n8n (Pha 1) và C# Engine (Pha 2) gọi.

### Request Headers
```http
Content-Type: multipart/form-data
x-api-key: tf_ingest_prod_xxxxxx # API Key bảo mật
x-workspace-id: workspace-uuid-here # Xác định workspace đích
```

### Request Body (Multipart Form)
| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `file` | File (Binary) | Yes | CV file (PDF, DOCX) tối đa 10MB |
| `jobId` | String (UUID) | Yes | Id của Job cần ứng tuyển |
| `candidateEmail` | String | Yes | Email của ứng viên trích xuất từ email gửi |
| `candidateName` | String | Yes | Họ tên ứng viên trích xuất từ email gửi / body email |
| `coverLetter` | String | No | Nội dung email (body text) làm cover letter |
| `externalMessageId` | String | No | Id của Email gốc từ Gmail để phục vụ truy vết / chống trùng |

### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "applicationId": "app-uuid-123",
    "candidateId": "cand-uuid-456",
    "status": "processing",
    "message": "CV ingestion initiated successfully."
  }
}
```

---

## 5. Phân công Công việc & Phối hợp (Team Alignment)

Để tạo động lực làm việc cho Dev .NET mới mà không làm chậm MVP:

1. **Tuần 1 (Giai đoạn MVP)**:
   - **Core Dev (NestJS)**: Phát triển API endpoint `/applications/ingestion` theo đúng contract trên NestJS.
   - **Dev .NET**: 
     - Thiết lập n8n workspace, kết nối Gmail.
     - Dựng workflow n8n Pha 1 (quét mail -> parse regex cơ bản -> gọi NestJS API).
     - Đạt mục tiêu: Hệ thống tự động intake CV hoạt động thực tế.

2. **Tuần 2 trở đi (Giai đoạn Maintain & Scale)**:
   - **Dev .NET**:
     - Khởi tạo dự án **.NET 8 Minimal API**, cấu hình Dockerfile gọn nhẹ.
     - Code logic Rule Engine so khớp Job và Deduplicate bằng C# (đúng sở trường, tha hồ thiết kế cấu trúc clean code, dependency injection, viết unit test bài bản).
     - Cấu hình lại n8n để trỏ sang .NET service.
     - Tích hợp .NET service vào file `docker-compose.yml` của hệ thống.

Mô hình này giúp dự án vừa đi nhanh, vừa giữ được cấu trúc code sạch sẽ, vừa tạo ra lộ trình phát triển kỹ năng và đóng góp rõ ràng cho nhân sự mới.
