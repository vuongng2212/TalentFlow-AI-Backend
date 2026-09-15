# Giai Đoạn 5: Triển Khai & Hướng Dẫn Sử Dụng Hệ Thống Giám Sát (Observability Stack)

Giai đoạn này hướng dẫn cách deploy và tương tác chi tiết với các giao diện quản trị Logs (Kibana), Metrics (Grafana + Prometheus) và Traces (Jaeger) chạy trên node ảo `tf-worker-4`.

---

## 1. Bản Đồ Hạ Tầng Giám Sát (Observability Infrastructure)

Chúng ta gom toàn bộ các Pod giám sát và phân tích hiệu năng hệ thống lên node ảo **tf-worker-4** (Node được cấp phát cấu hình 4GB RAM đặc thù):

- **Prometheus**: Thu thập (Scrape) dữ liệu hiệu năng thời gian thực từ các Endpoint `/metrics`.
- **Grafana**: Hiển thị biểu đồ Metrics sinh động và chuyên nghiệp.
- **Elasticsearch + Kibana (ELK)**: Lưu trữ và lọc tìm kiếm log phi cấu trúc có Correlation ID.
- **Jaeger**: Phân tích Trace ID luồng đi qua các Microservice để tìm điểm nghẽn (latency bottleneck).

---

## 2. Truy Cập Vào Giao Diện (Accessing Giao Diện)

Hãy đảm bảo bạn đã thêm IP master node ảo (`192.168.56.10`) vào file `hosts` của máy thật (Host) như hướng dẫn ở cuối Giai đoạn 2:

```text
192.168.56.10 kibana.talentflow.local
192.168.56.10 grafana.talentflow.local
192.168.56.10 jaeger.talentflow.local
```

---

## 3. Hướng Dẫn Sử Dụng & Setup Kibana (Quản Lý Logs)

Mở trình duyệt trên máy thật, truy cập: `http://kibana.talentflow.local:5601` (hoặc qua domain `http://kibana.talentflow.local` nếu bạn đã apply Ingress).

### 3.1 Cấu hình Data View (Index Pattern)
Để Kibana hiểu và tìm kiếm được các bản ghi log từ Elasticsearch:
1. Tại màn hình Kibana, bấm vào biểu tượng Menu ở góc trên bên trái -> Chọn **Management** -> Chọn **Stack Management**.
2. Chọn **Data Views** ở cột bên trái -> Bấm nút **Create data view**.
3. Điền thông tin:
   - **Name**: `TalentFlow Logs`
   - **Index pattern**: `talentflow-*` (mã này khớp với prefix ghi nhận log của API Gateway và Notification).
   - **Timestamp field**: Chọn `@timestamp`.
4. Bấm **Save data view to Kibana**.

### 3.2 Khám phá Logs (Discover logs)
1. Bấm vào Menu góc trái -> Chọn **Analytics** -> Chọn **Discover**.
2. Chọn Data View `TalentFlow Logs` vừa tạo ở góc trên bên trái.
3. Bạn sẽ nhìn thấy toàn bộ log được ghi nhận dưới dạng JSON chuyên nghiệp.
4. **Tìm kiếm bằng Correlation ID / Request ID**:
   - Khi có một request lỗi hoặc chậm, bạn có thể lọc trực tiếp: `requestId : "your-request-uuid"` hoặc `traceId: "otel-trace-uuid"`.
   - Toàn bộ các dòng log liên quan đến luồng giao dịch đó chạy xuyên suốt qua `api-gateway` và `notification` sẽ được hiện ra liền mạch.

---

## 4. Hướng Dẫn Cấu Hình Grafana (Theo Dõi Metrics)

Mở trình duyệt máy thật truy cập: `http://grafana.talentflow.local:3001` (hoặc cổng mặc định k8s `3000`).
*Tài khoản mặc định:* `admin` / `admin` (Yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên).

### 4.1 Thêm Datasource Prometheus
Grafana cần lấy dữ liệu từ Prometheus.
1. Tại màn hình chính Grafana, chọn **Connections** -> Chọn **Data Sources**.
2. Bấm **Add data source** -> Chọn **Prometheus**.
3. Tại trường **Connection URL**, gõ địa chỉ dịch vụ nội bộ của cụm:
   ```text
   http://prometheus-service.talentflow.svc.cluster.local:9090
   ```
4. Cuộn xuống dưới cùng và bấm **Save & Test**. Nếu hiện tích xanh lá cây, kết nối đã thành công!

### 4.2 Import Dashboard TalentFlow Overview
Chúng ta sử dụng tệp JSON dashboard đã thiết kế sẵn để hiển thị hiệu năng hệ thống:
1. Di chuyển chuột đến menu bên trái, chọn **Dashboards**.
2. Bấm nút **New** (ở góc phải) -> Chọn **Import**.
3. Bạn có thể copy toàn bộ nội dung file [talentflow-overview.json](file:///home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Backend/monitoring/grafana/dashboards/talentflow-overview.json) dán vào ô nhập JSON, hoặc bấm **Upload JSON file** trỏ đến đường dẫn đó trên máy của bạn.
4. Chọn data source là **Prometheus** vừa tạo ở mục 4.1.
5. Bấm **Import**.
6. **Màn hình Dashboard bao gồm**:
   - Biểu đồ số lượng thông báo đã gửi qua Email & WebSocket.
   - Thời gian đáp ứng HTTP trung bình (API Gateway Latency).
   - Trạng thái CPU/RAM sử dụng của các máy ảo Linux.
   - Trạng thái của cụm hàng đợi RabbitMQ.

---

## 5. Hướng Dẫn Sử Dụng Jaeger UI (Truy Vết Traces)

Mở trình duyệt truy cập: `http://jaeger.talentflow.local`.

### 5.1 Tìm vết giao dịch (Find Trace)
1. Tại màn hình Jaeger, cột bên trái mục **Service**, chọn service bạn muốn theo dõi (ví dụ: `api-gateway` hoặc `notification-service`).
2. Bấm **Find Traces**.
3. Jaeger sẽ liệt kê toàn bộ các yêu cầu HTTP/Websocket hoặc các tin nhắn Queue trong khoảng thời gian đã chọn.
4. Click vào một Trace cụ thể để xem biểu đồ Gantt Chart chi tiết:
   - Request bắt đầu đi vào API Gateway lúc nào.
   - API Gateway gọi sang Notification Service mất bao lâu.
   - Đoạn xử lý nội bộ ở service kéo dài bao nhiêu mili-giây.
   - *Mẹo*: Nếu có lỗi xảy ra, dòng trace đó sẽ được tô màu đỏ và hiển thị chi tiết stack trace lỗi trong tab tags để devops dễ dàng sửa lỗi.

---

## 6. Kiểm Tra Hệ Thống Cảnh Báo (AlertManager Testing)

Prometheus được thiết lập để tự động kích hoạt cảnh báo thông qua AlertManager khi có sự cố.

### 6.1 Gây lỗi để Test cảnh báo
Bạn có thể giả lập lỗi bằng cách tắt bớt pod của Notification Service để kích hoạt rule `NotificationDown`:
```bash
# Giảm số lượng pod của notification về 0
kubectl scale deployment notification --replicas=0 -n talentflow
```

### 6.2 Kiểm tra Alert trạng thái
1. Mở trang quản trị Prometheus: `http://192.168.56.10:9090` (qua Master IP).
2. Chọn menu **Alerts**. Bạn sẽ thấy cảnh báo `NotificationDown` chuyển sang màu vàng nhạt (**Pending**).
3. Sau 1 phút (theo tham số `for: 1m` cấu hình trong file rule), cảnh báo sẽ chuyển sang màu đỏ rực (**Firing**).
4. AlertManager sẽ gom cảnh báo và gửi một tin nhắn định dạng chuyên nghiệp đến kênh Slack/Webhook được chỉ định.
5. Scalepod trở lại bình thường sau khi test xong:
   ```bash
   kubectl scale deployment notification --replicas=2 -n talentflow
   ```
   Cảnh báo trong Prometheus sẽ tự động chuyển sang màu xanh lá cây và gửi tin nhắn báo sửa thành công (**RESOLVED**).
