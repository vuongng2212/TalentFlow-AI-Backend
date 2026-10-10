# Hướng Dẫn Vận Hành & Triển Khai TalentFlow Trên Kubernetes (K8s Operations Guide)

## 1. Tổng Quan Kiến Trúc Cụm & Cổng Dịch Vụ (Port Map & DNS)

Hệ thống TalentFlow ATS chạy trên Kubernetes (namespace: `talentflow`) theo mô hình Microservices hướng sự kiện:

```
                                  ┌───────────────────────────┐
                                  │   NGINX Ingress (:80/8088) │
                                  └─────────────┬─────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼ (Host: app.talentflow.local)         ▼ (Host: api.talentflow.local)         ▼ (Host: notification.talentflow.local)
┌──────────────────┐                   ┌──────────────────┐                   ┌──────────────────┐
│  frontend-service│                   │api-gateway-servic│                   │notification-servi│
│    Port: 3000    │                   │    Port: 80      │                   │    Port: 80      │
│  (Next.js 16)    │                   │  (NestJS 11)     │                   │ (NestJS + WS)    │
└──────────────────┘                   └────────┬─────────┘                   └────────┬─────────┘
                                                │                                      │
                                                ▼ (AMQP / SQL)                         ▼ (AMQP / SQL)
                                       ┌────────────────────────────────────────────────────────┐
                                       │            K8s Internal Cluster DNS & Mesh             │
                                       │  - postgres-service.talentflow.svc.cluster.local:5432  │
                                       │  - rabbitmq-service.talentflow.svc.cluster.local:5672  │
                                       │  - redis-service.talentflow.svc.cluster.local:6379     │
                                       │  - minio-service.talentflow.svc.cluster.local:9000     │
                                       │  - cv-parser-service.talentflow.svc.cluster.local:80   │
                                       └────────────────────────────────────────────────────────┘
```

| Service | Pod Replica | Container Port | Service Port | Liveness Probe | Readiness Probe | Ghi chú |
|---|---|---|---|---|---|---|
| **api-gateway** | 2 | 8080 | 80 (TCP) | `GET /health` | `GET /ready` | Excludes `/api/v1` prefix |
| **notification** | 2 | 5000 | 80 (TCP) | `GET /health` | `GET /health/ready` | WS namespace: `/notifications` |
| **cv-parser** | 2 | 8081 | 80 (TCP) | `GET /actuator/health` | `GET /actuator/health` | Spring Boot 3.3 worker |
| **frontend** | 2 | 3000 | 3000 (TCP) | `GET /` | `GET /` | Next.js standalone runner |
| **postgres** | 1 | 5432 | 5432 (TCP) | PostgreSQL ping | PostgreSQL ping | DB: `talentflow_dev` |
| **rabbitmq** | 1 | 5672, 15672 | 5672, 15672 | AMQP ping | AMQP ping | Exchange: `talentflow.events` |
| **redis** | 1 | 6379 | 6379 (TCP) | PING / PONG | PING / PONG | Cache & Throttle store |
| **minio** | 1 | 9000, 9001 | 9000, 9001 | HTTP 9000 | HTTP 9000 | Bucket: `talentflow-cvs` |

---

## 2. Chuẩn Bị Môi Trường K8s (Local Cụm Kind)

### 2.1 Cài đặt CLI cần thiết
```bash
# kubectl (v1.31+)
curl -sLo ~/.local/bin/kubectl "https://dl.k8s.io/release/v1.31.0/bin/linux/amd64/kubectl" && chmod +x ~/.local/bin/kubectl

# kind (v0.24+)
curl -sLo ~/.local/bin/kind "https://kind.sigs.k8s.io/dl/v0.24.0/kind-linux-amd64" && chmod +x ~/.local/bin/kind
```

### 2.2 Tạo Kind Cluster với Port Mappings
Tạo file cấu hình `/tmp/kind-cluster.yaml`:
```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: talentflow
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 8088
    protocol: TCP
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
```
Khởi tạo cluster:
```bash
kind create cluster --config /tmp/kind-cluster.yaml
kubectl label node talentflow-control-plane app-type=database
```

### 2.3 Cài Đặt NGINX Ingress Controller
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### 2.4 Cài Đặt StorageClass Alias
Nếu StorageClass mặc định là `standard` (trên Kind/Rancher), tạo alias `local-path` để tương thích PVC:
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-path
provisioner: rancher.io/local-path
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
```

---

## 3. Quy Trình Build & Load Docker Images

### 3.1 Build 4 Ứng Dụng Chính
```bash
# 1. API Gateway
docker build -t talentflow/api-gateway:latest ./api-gateway

# 2. Notification Service
docker build -t talentflow/notification:latest ./notification

# 3. CV Parser Worker (Java 21)
cd cv-parser && ./mvnw clean package -DskipTests && docker build -t talentflow/cv-parser:latest . && cd ..

# 4. Web Frontend (Next.js 16 Standalone)
cd ../TalentFlow-AI-Frontend && corepack pnpm build && docker build -t talentflow/frontend:latest . && cd ../TalentFlow-AI-Backend
```

### 3.2 Load Vào Node Kind (Tránh Mất Thời Gian Pull Từ Registry Ngoài)
```bash
docker save --platform linux/amd64 talentflow/api-gateway:latest | docker exec -i talentflow-control-plane ctr -n k8s.io images import -
docker save --platform linux/amd64 talentflow/notification:latest | docker exec -i talentflow-control-plane ctr -n k8s.io images import -
docker save --platform linux/amd64 talentflow/cv-parser:latest | docker exec -i talentflow-control-plane ctr -n k8s.io images import -
docker save --platform linux/amd64 talentflow/frontend:latest | docker exec -i talentflow-control-plane ctr -n k8s.io images import -
```

---

## 4. Triển Khai Hạ Tầng & Dịch Vụ (Kustomize)

Tại thư mục `TalentFlow-AI-Backend/k8s/`:
```bash
# Áp dụng tất cả manifests (Namespace, Middleware, App Services, Ingress)
kubectl apply -k .
```

Sau khi pod MinIO và PostgreSQL khởi động:
```bash
# Tạo bucket MinIO
kubectl exec -n talentflow deploy/minio -- sh -c '
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/talentflow-cvs || true
mc anonymous set public local/talentflow-cvs || true
'
```

---

## 5. Bảng Khắc Phục Lỗi Vận Hành K8s (Troubleshooting Matrix)

| Triệu chứng | Nguyên nhân gốc | Giải pháp chuẩn |
|---|---|---|
| Pod `api-gateway` dính `CrashLoopBackOff` với lỗi `Cannot GET /api/v1/health` | Route `/health` và `/ready` trong code NestJS không gắn prefix `api/v1` | Đổi probe trong Deployment thành `/health` (liveness) và `/ready` (readiness). |
| `Config validation error: "RABBITMQ_URL" fails to match /^amqps:\/\//i` | Joi validation bắt buộc `amqps://` (TLS) khi `NODE_ENV: production` | Đặt `NODE_ENV: development` trong K8s ConfigMap để cho phép kết nối `amqp://` nội bộ cluster. |
| `Config validation error: INGESTION_API_KEY is required` | Thiếu biến bắt buộc cho n8n webhook | Khai báo `INGESTION_API_KEY: "development-ingestion-key-123"` trong `api-gateway-secret`. |
| Admission webhook từ chối `notification-ingress`: `configuration-snippet annotation cannot be used` | Ingress-NGINX v1.10+ mặc định vô hiệu hóa snippet vì lý do bảo mật (CVE-2021-25742) | Bỏ `configuration-snippet`. Dùng `nginx.ingress.kubernetes.io/websocket-services: "notification-service"` để kích hoạt WebSocket. |
| Pod Middleware Pending với lỗi `unbound immediate PersistentVolumeClaims` | Thiếu nhãn `app-type=database` trên node Kind hoặc thiếu StorageClass `local-path` | Gán nhãn cho node (`kubectl label node <node> app-type=database`) và apply StorageClass alias `local-path`. |
| Pod `cv-parser` hoặc `minio` dính `ImagePullBackOff` trên `quay.io` | Tag `:latest` kích hoạt `imagePullPolicy: Always` và bị registry ngoài chặn | Đặt `imagePullPolicy: IfNotPresent` trong Deployment manifest. |
| `kind load docker-image` lỗi `ctr: content digest ... not found` | Docker 29 dùng containerd image store đa nền tảng | Lưu image với cờ `--platform linux/amd64` và import trực tiếp: `docker save --platform linux/amd64 <img\> \| docker exec -i <node\> ctr -n k8s.io images import -`. |

---

## 6. Kiểm Thử Hệ Thống (End-to-End Verification)

Thực hiện kiểm thử các endpoint thông qua Ingress (`Host: *.talentflow.local`, port `8088`):
```bash
# 1. API Health & Ready
curl -s -H "Host: api.talentflow.local" http://localhost:8088/ready

# 2. Notification Ready
curl -s -H "Host: notification.talentflow.local" http://localhost:8088/health/ready

# 3. Frontend Web SSR
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: app.talentflow.local" http://localhost:8088/

# 4. Authentication qua Ingress
curl -s -X POST http://localhost:8088/api/v1/auth/login \
  -H "Host: api.talentflow.local" \
  -H "Content-Type: application/json" \
  -d '{"email":"seed-admin@talentflow.invalid","password":"Password123!"}'
```
