# Giai Đoạn 4: Triển Khai Các Dịch Vụ Ứng Dụng (Application Services)

Giai đoạn này hướng dẫn cách build docker image cho các Service (`api-gateway` và `notification`), đẩy lên cụm, thiết lập các file config và deploy các App Service vào các node stateless `tf-worker-1` và `tf-worker-2`.

---

## 1. Build Docker Images Cho Các Service

Chúng ta cần đóng gói code NodeJS của các Service thành Docker image. 

Chạy lệnh build docker trên máy thật (Host) hoặc trên một node ảo đã cài sẵn Docker:

### 1.1 Build API Gateway Image
Di chuyển vào thư mục dự án và build image:
```bash
docker build -t talentflow/api-gateway:latest ./api-gateway
```

### 1.2 Build Notification Service Image
```bash
docker build -t talentflow/notification:latest ./notification
```

### 1.3 Đẩy Image Vào Cụm K3s (Local Registry Import)
K3s chạy container runtime bằng containerd nội bộ thay vì Docker. Nếu không sử dụng Docker Hub/Private Registry, bạn có thể "import" trực tiếp các file ảnh đĩa (`.tar`) vào cụm K3s:

```bash
# 1. Export docker image ra file tar trên máy thật
docker save talentflow/api-gateway:latest -o api-gateway.tar
docker save talentflow/notification:latest -o notification.tar

# 2. Copy file tar sang node master (hoặc các node worker cần chạy app)
scp api-gateway.tar notification.tar devops@192.168.56.10:/tmp/

# 3. Trên tf-master (và tf-worker-1, tf-worker-2), import file tar vào containerd
sudo k3s ctr images import /tmp/api-gateway.tar
sudo k3s ctr images import /tmp/notification.tar
```

---

## 2. Triển Khai Nginx Ingress Controller

K3s cài sẵn Traefik làm Ingress Controller mặc định. Vì ở Giai đoạn 2 chúng ta đã cài tham số tắt Traefik (`--disable=traefik`), bây giờ chúng ta sẽ cài **Nginx Ingress Controller** chuẩn hóa để điều hướng HTTP & WebSocket (Socket.IO):

```bash
# Cài đặt Nginx Ingress Controller thông qua Helm hoặc file manifest chính thức
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

Kiểm tra trạng thái Nginx Ingress Controller chạy thành công:
```bash
kubectl get pods -n ingress-nginx
```

---

## 3. Cấu Hình Biến Môi Trường (ConfigMap & Secret)

Các ứng dụng cần kết nối đến PostgreSQL, Redis, RabbitMQ và MinIO. Chúng ta khai báo thông tin kết nối thông qua Kubernetes ConfigMap và Secret.

### 3.1 Cấu hình [configmap.yaml](file:///home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Backend/k8s/notification/configmap.yaml)
Cấu hình địa chỉ của các middleware. Vì tất cả chạy trong cùng 1 cụm Kubernetes, các service có thể kết nối nội bộ bằng DNS ảo của Kubernetes (ví dụ: `postgres-service.talentflow.svc.cluster.local`).

Apply cấu hình ConfigMap:
```bash
kubectl apply -f k8s/notification/configmap.yaml -n talentflow
```

### 3.2 Cấu hình [secret.yaml](file:///home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Backend/k8s/notification/secret.yaml)
Chứa các thông tin bảo mật nhạy cảm (Username, Password, Secret Key).

Apply cấu hình Secret:
```bash
kubectl apply -f k8s/notification/secret.yaml -n talentflow
```

---

## 4. Triển Khai Notification Service Pods

Notification Service sẽ được deploy lên cụm và tự động scale từ 2 đến 6 bản sao (Pods) nhờ vào Horizontal Pod Autoscaler (HPA) dựa theo tải lượng CPU/Memory.

Triển khai các manifest của Notification Service:
```bash
# 1. Triển khai deployment (Quản lý các Pods chạy code NodeJS)
kubectl apply -f k8s/notification/deployment.yaml -n talentflow

# 2. Triển khai service (Tạo đầu mối IP/DNS nội bộ cho Service)
kubectl apply -f k8s/notification/service.yaml -n talentflow

# 3. Triển khai HPA (Tự động co giãn Pod)
kubectl apply -f k8s/notification/hpa.yaml -n talentflow
```

---

## 5. Thiết Lập Đường Truy Cập Bằng Ingress (HTTP & WebSockets)

Do dịch vụ Notification có chứa tính năng thông báo Real-time bằng WebSocket (Socket.IO), Ingress cần cấu hình thêm các tham số `Upgrade` Header để Nginx chuyển tiếp kết nối TCP bền vững (Persistent Connection) thay vì ngắt kết nối.

Tệp tin [ingress.yaml](file:///home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Backend/k8s/notification/ingress.yaml) đã được thiết lập sẵn các annotations tối ưu này:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: notification-ingress
  namespace: talentflow
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
...
```

Triển khai Ingress:
```bash
kubectl apply -f k8s/notification/ingress.yaml -n talentflow
```

---

## 6. Kiểm Tra Và Xác Minh Ứng Dụng

Xem danh sách Pods để đảm bảo các service của ứng dụng đang chạy ổn định:
```bash
kubectl get pods -n talentflow -l app=notification
```
*Kết quả mẫu:*
```text
NAME                            READY   STATUS    RESTARTS   AGE   NODE
notification-84bf48d888-abcd1   1/1     Running   0          5m    tf-worker-1
notification-84bf48d888-efgh2   1/1     Running   0          5m    tf-worker-2
```

Dịch vụ chạy thành công và tự động chia đều tải trên 2 node `tf-worker-1` và `tf-worker-2`! Bây giờ hãy chuyển sang Giai đoạn 5 để cấu hình hạ tầng Observability giám sát hệ thống.
