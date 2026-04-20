#  PART 1: PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Project Name:** TalentFlow AI - Intelligent Recruitment Platform
**Version:** 1.0.0
**Status:** Draft
**Last Updated:** 2026-02-01

## 1. Executive Summary

**TalentFlow AI** là hệ thống quản lý tuyển dụng (ATS) thế hệ mới, giải quyết bài toán quá tải hồ sơ của bộ phận HR bằng cách ứng dụng AI. Hệ thống tự động hóa quy trình từ lúc nhận CV, trích xuất dữ liệu, đến việc đánh giá độ phù hợp của ứng viên với Job Description (JD) thông qua công nghệ Semantic Search (Tìm kiếm ngữ nghĩa).

## 2. Problem Statement

* **Thủ công & Tốn thời gian:** HR mất trung bình 5-10 phút để đọc và nhập liệu một CV vào hệ thống.
* **Bỏ sót nhân tài:** Tìm kiếm theo từ khóa (Keyword matching) truyền thống thường bỏ sót các ứng viên tiềm năng do khác biệt về cách dùng từ.
* **Quy trình rời rạc:** Việc quản lý trạng thái ứng viên, lịch phỏng vấn và gửi email thường làm trên nhiều công cụ khác nhau (Excel, Calendar, Gmail).

## 3. Target Audience (User Personas)

1. **Recruiter (HR Staff):** Người đăng tin, lọc hồ sơ, lên lịch phỏng vấn. Cần công cụ để giảm bớt các thao tác lặp lại.
2. **Hiring Manager (Technical Lead/Manager):** Người xem xét hồ sơ đã lọc, phỏng vấn và đưa ra quyết định tuyển dụng. Cần thông tin tóm tắt chính xác.
3. **Admin:** Quản trị hệ thống, phân quyền, xem báo cáo tổng quan.

## 4. Key Features & Scope (MVP Phase)

### 4.1. Job Management (Quản lý tin tuyển dụng)

* Tạo, sửa, đóng/mở Job Description.
* Tùy chỉnh quy trình tuyển dụng (Workflow) cho từng vị trí (VD: Applied -> Screening -> Tech Interview -> Offer).

### 4.2. Smart CV Pipeline (Tính năng lõi)

* **Auto-Parsing:** Upload CV (PDF/Docx) -> Hệ thống tự động trích xuất: Tên, Email, SĐT, Kỹ năng, Kinh nghiệm -> Điền vào form.
* **AI Scoring & Matching:** Tự động chấm điểm hồ sơ dựa trên độ phù hợp với JD (sử dụng RAG/Vector Search).
* **Resume Screening:** Highlight các từ khóa quan trọng và tóm tắt điểm mạnh/yếu của ứng viên.

### 4.3. Candidate Management

* **Kanban Board:** Kéo thả ứng viên qua các vòng phỏng vấn (tương tự Trello/Jira).
* **Centralized Profile:** Xem toàn bộ lịch sử tương tác, ghi chú phỏng vấn, file đính kèm tại một nơi.

### 4.4. Automation & Communication

* Gửi email tự động khi chuyển trạng thái (VD: Gửi thư cảm ơn khi loại, thư mời khi qua vòng hồ sơ).

## 5. Non-Functional Goals

* **Accuracy:** Độ chính xác khi trích xuất thông tin CV > 85%.
* **Performance:** Xử lý Parse & Match một CV < 10 giây.
* **Security:** Tuân thủ bảo mật dữ liệu cá nhân (PII), mã hóa file CV lưu trữ.
