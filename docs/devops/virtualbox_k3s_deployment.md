# Hướng Dẫn Triển Khai TalentFlow Trên VirtualBox (5 Node K3s Cluster)

Bộ tài liệu này hướng dẫn chi tiết từng bước (từ thiết lập mạng ban đầu đến cấu hình giám sát chuyên sâu) cách triển khai hệ thống TalentFlow trên một cụm máy ảo ảo hóa (Virtual Private Servers - VPS) tạo bởi **VirtualBox** sử dụng **K3s (lightweight Kubernetes)**.

Để dễ học và thực hành, tài liệu được chia thành **5 Giai đoạn độc lập**:

---

## 🗺️ Bản Đồ Các Bước Triển Khai (Roadmap)

### 📌 [Giai Đoạn 1: Cấu Hình Mạng & Tạo Máy Ảo](file:///home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Backend/docs/devops/stage_1_virtualbox_networking.md)
*Thiết lập hạ tầng máy ảo nền tảng.*
- Tạo card mạng riêng nội bộ (Host-Only Adapter).
- Tạo máy ảo Ubuntu Server 22.04 LTS làm gốc (Template VM).
- Nhân bản (Clone) ra 5 node ảo và cấu hình IP tĩnh qua Netplan.
- Tắt Swap và cấu hình các kernel module hỗ trợ Kubernetes.

### 📌 [Giai Đoạn 2: Khởi Tạo Cụm K3s Cluster](file:///home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Backend/docs/devops/stage_2_k3s_cluster_setup.md)
*Xây dựng cụm Kubernetes siêu nhẹ.*
- Khởi tạo K3s Control Plane trên Node Master (`tf-master`).
- Gia nhập các node worker ảo vào cụm bằng mã Token bảo mật.
- Phân tách vai trò của các Node bằng nhãn (Gán label Node).
- Trích xuất tệp Kubeconfig quản trị Kubernetes từ máy thật (Host).

### 📌 [Giai Đoạn 3: Triển Khai Middleware & Cơ Sở Dữ Liệu](file:///home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Backend/docs/devops/stage_3_databases_middleware.md)
*Thiết lập hạ tầng lưu trữ bền vững và hàng đợi.*
- Khái niệm lưu trữ Local Path Provisioner của K3s.
- Triển khai các database chính: PostgreSQL và Redis.
- Triển khai hàng đợi thông điệp RabbitMQ.
- Triển khai bộ nhớ chứa file upload MinIO (Giả lập AWS S3).
- Sử dụng `nodeSelector` để ép các Pod chạy đúng trên node `tf-worker-3`.

### 📌 [Giai Đoạn 4: Triển Khai Các Dịch Vụ Ứng Dụng](file:///home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Backend/docs/devops/stage_4_application_deployment.md)
*Triển khai các Pod ứng dụng NodeJS và cấu hình Ingress.*
- Build Docker Image từ source code của các Service.
- Nạp (Import) docker image trực tiếp vào containerd cụm K3s.
- Cấu hình Ingress Nginx Controller hỗ trợ các giao thức HTTP và WebSocket.
- Triển khai API Gateway và Notification Service lên node stateless.

### 📌 [Giai Đoạn 5: Triển Khai & Hướng Dẫn Sử Dụng Hệ Thống Giám Sát](file:///home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Backend/docs/devops/stage_5_observability_dashboards.md)
*Cấu hình và hướng dẫn tương tác với logs, metrics, traces.*
- Cấu hình Data View trong Kibana để tìm kiếm và lọc logs.
- Tích hợp Prometheus Datasource và Import Dashboard TalentFlow Overview vào Grafana.
- Hướng dẫn truy vết luồng Request (Trace ID) qua giao diện Jaeger UI.
- Thử nghiệm hệ thống cảnh báo (AlertManager Testing).
