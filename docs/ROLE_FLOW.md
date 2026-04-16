# ROLE FLOW (Current from Docs)

> Nguồn tổng hợp: `docs/SRS.md`, `docs/PRD.md`, `docs/DATABASE_SCHEMA.md`, `PLANNING.md`.
> Cách đọc: **Hiện tại (MVP/Phase 1)** là những flow đã được định nghĩa rõ để chạy hệ thống; **Phase 2** là flow đã thiết kế nhưng chưa phải trọng tâm hiện tại.

---

## 1) Recruiter (HR Staff) — Flow chính hiện tại

### A. Đăng nhập và truy cập hệ thống
1. Recruiter đăng nhập bằng Email/Password.
2. API Gateway xác thực JWT + RBAC (role `RECRUITER`).

### B. Quản lý Job
1. Tạo Job (title, description, requirements JSON, salaryRange, status).
2. Sửa Job.
3. Mở/đóng Job (`DRAFT` / `OPEN` / `CLOSED`).
4. Xem danh sách Job và ứng viên theo từng Job.

### C. Nhận CV và tạo Application
1. Recruiter upload CV (PDF/DOCX) cho candidate vào hệ thống.
2. API Gateway validate file (size/type).
3. File được upload lên Cloudflare R2.
4. Metadata candidate/application được lưu vào PostgreSQL.
5. API Gateway publish event `cv.uploaded` lên RabbitMQ.

### D. Chấm điểm AI bất đồng bộ
1. CV Parser consume `cv.uploaded`.
2. Parser tải file từ R2 qua `bucket + fileKey`.
3. Parse PDF/DOCX + OCR (nếu cần), gọi Gemini để trích xuất & scoring.
4. Cập nhật dữ liệu candidate/application (resume text, AI score/summary).
5. Publish event `cv.parsed` hoặc `cv.failed`.

### E. Nhận kết quả real-time
1. Notification service consume event từ queue.
2. Push WebSocket cập nhật dashboard recruiter.
3. Gửi email thông báo cho recruiter khi cần.

### F. Xử lý pipeline ứng viên (MVP)
1. Recruiter xem application theo stage/status.
2. Cập nhật stage ứng viên trong pipeline: `APPLIED -> SCREENING -> INTERVIEW -> OFFER -> HIRED/REJECTED`.

---

## 2) Admin — Flow hiện tại

### A. Quản trị người dùng và phân quyền
1. Đăng nhập bằng tài khoản admin.
2. Quản lý users (đặc biệt vai trò `ADMIN`, `RECRUITER`, `INTERVIEWER`).
3. Thiết lập/kiểm soát quyền truy cập qua RBAC guard.

### B. Giám sát vận hành hệ thống
1. Theo dõi trạng thái API/infrastructure (metrics, logs, healthchecks) theo phần delivery & observability đã hoàn thành trong planning.
2. Quản lý cấu hình môi trường triển khai (dev/docker/k8s).

---

## 3) Interviewer / Hiring Manager — Flow hiện tại

> Theo tài liệu hiện tại, role này **đã có trong RBAC và schema**, nhưng luồng nghiệp vụ chi tiết còn thiên về **Phase 2**.

### A. Đã có ở mức nền tảng
1. Role `INTERVIEWER` tồn tại trong hệ thống auth/RBAC.
2. Có entity `Interview` trong schema thiết kế để hỗ trợ lịch phỏng vấn + feedback.

### B. Flow nghiệp vụ chính (được thiết kế cho Phase 2)
1. Nhận ứng viên từ stage screening/interview.
2. Xem hồ sơ đã parse + điểm AI.
3. Thực hiện phỏng vấn, nhập feedback/rating.
4. Đề xuất pass/fail để recruiter/admin ra quyết định cuối.

---

## 4) Candidate (góc nhìn hệ thống)

Candidate không phải role đăng nhập backend nội bộ như Recruiter/Admin/Interviewer, nhưng có flow dữ liệu:
1. Candidate nộp CV cho một Job.
2. Hệ thống tạo `Candidate` + `Application` (nếu chưa tồn tại).
3. CV được parse/chấm điểm AI.
4. Trạng thái application thay đổi theo pipeline tuyển dụng.

---

## 5) Phân biệt rõ “đang làm được” vs “đã thiết kế”

## Đang làm được / trọng tâm hiện tại (MVP/Phase 1)
- Auth + RBAC cho Admin/Recruiter/Interviewer.
- Job CRUD.
- Upload CV -> R2 -> RabbitMQ -> CV Parser -> AI score -> Notification (WebSocket/Email).
- Application tracking theo stage/status.

## Đã thiết kế nhưng chưa là flow chính hiện tại (Phase 2)
- Interview scheduling chi tiết.
- Candidate notes.
- Audit logs.
- Vector semantic search/matching nâng cao.
- Kanban drag-drop full UX.

---

## 6) Kết luận ngắn

Flow vận hành hiện tại tập trung mạnh vào **Recruiter-centric pipeline**: tạo job, nhận CV, AI xử lý tự động, và cập nhật ứng viên real-time. 
Admin chủ yếu quản trị quyền + vận hành hệ thống. 
Interviewer/Hiring Manager đã có nền tảng role & schema nhưng flow chi tiết vẫn thuộc mở rộng Phase 2.
