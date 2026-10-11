# Giai Đoạn 4: Triển Khai Các Dịch Vụ Ứng Dụng (Application Services & Web Frontend)

Tài liệu này hướng dẫn quy trình chuẩn hóa đóng gói (Docker build) và triển khai toàn bộ 4 tầng microservices của TalentFlow ATS vào Kubernetes thông qua Kustomize hoặc từng manifest độc lập:
1. **API Gateway** (NestJS 11 + Prisma ORM)
2. **Notification Service** (NestJS 10 + Prisma + Socket.IO)
3. **CV Parser Worker** (Java 21 + Spring Boot 3.3 + AMQP)
4. **Web Frontend** (Next.js 16 App Router + Tailwind 4 Standalone)

---

## 1. Đóng Gói Docker Images (Containerization)

Tất cả các dịch vụ đều được tối ưu hóa multi-stage build để đạt kích thước ảnh đĩa tối thiểu và bảo mật cao:

### 1.1 Build API Gateway Image
```bash
docker build -t talentflow/api-gateway:latest ./api-gateway
```
*Port:* `8080` | *Health check:* `GET /health` | *Readiness:* `GET /ready`

### 1.2 Build Notification Service Image
```bash
docker build -t talentflow/notification:latest ./notification
```
*Port:* `5000` | *Health check:* `GET /health` | *Readiness:* `GET /health/ready`

### 1.3 Build CV Parser Worker Image (Spring Boot 3.3)
Build fat JAR cục bộ để tận dụng cache Maven, sau đó đóng gói runtime `eclipse-temurin:21-jre-alpine`:
```bash
cd cv-parser
./mvnw clean package -DskipTests
docker build -t talentflow/cv-parser:latest .
```
*Port:* `8081` | *Health check:* `GET /actuator/health`

### 1.4 Build Web Frontend Image (Next.js 16 Standalone)
Trong `TalentFlow-AI-Frontend/next.config.ts`, cấu hình `output: "standalone"`.
```bash
cd /home/vuongnguyen/Projects/TalentFlow/TalentFlow-AI-Frontend
corepack pnpm build
docker build -t talentflow/frontend:latest .
```
*Port:* `3000` | *Health check:* `GET /`

---

## 2. Nạp Image Vào Cụm Kubernetes

### 2.1 Cụm Kind (Local Development)
```bash
kind load docker-image talentflow/api-gateway:latest --name talentflow
kind load docker-image talentflow/notification:latest --name talentflow
kind load docker-image talentflow/cv-parser:latest --name talentflow
kind load docker-image talentflow/frontend:latest --name talentflow
```

### 2.2 Cụm K3s / Khác (Containerd Local Import)
```bash
docker save --platform linux/amd64 talentflow/api-gateway:latest | ctr -n k8s.io images import -
docker save --platform linux/amd64 talentflow/notification:latest | ctr -n k8s.io images import -
docker save --platform linux/amd64 talentflow/cv-parser:latest | ctr -n k8s.io images import -
docker save --platform linux/amd64 talentflow/frontend:latest | ctr -n k8s.io images import -
```

---

## 3. Triển Khai Toàn Diện Bằng Kustomize

Tại thư mục `k8s/`:
```bash
# 1. Tạo namespace
kubectl apply -f k8s/namespace.yaml

# 2. Triển khai toàn bộ Middleware + Ứng dụng
kubectl apply -k k8s/
```

Hoặc deploy từng thành phần theo thứ tự phụ thuộc:
```bash
# Middleware Stateful Services
kubectl apply -f k8s/middleware/postgres-secret.yaml
kubectl apply -f k8s/middleware/postgres.yaml
kubectl apply -f k8s/middleware/redis.yaml
kubectl apply -f k8s/middleware/rabbitmq.yaml
kubectl apply -f k8s/middleware/minio.yaml

# Cấu hình & Core Backend
kubectl apply -f k8s/api-gateway/configmap.yaml
kubectl apply -f k8s/api-gateway/secret.yaml
kubectl apply -f k8s/api-gateway/service.yaml
kubectl apply -f k8s/api-gateway/deployment.yaml

kubectl apply -f k8s/cv-parser/configmap.yaml
kubectl apply -f k8s/cv-parser/secret.yaml
kubectl apply -f k8s/cv-parser/service.yaml
kubectl apply -f k8s/cv-parser/deployment.yaml

kubectl apply -f k8s/notification/configmap.yaml
kubectl apply -f k8s/notification/secret.yaml
kubectl apply -f k8s/notification/service.yaml
kubectl apply -f k8s/notification/deployment.yaml

# Web Frontend
kubectl apply -f k8s/frontend/configmap.yaml
kubectl apply -f k8s/frontend/service.yaml
kubectl apply -f k8s/frontend/deployment.yaml

# Ingress Routing
kubectl apply -f k8s/api-gateway/ingress.yaml
kubectl apply -f k8s/notification/ingress.yaml
kubectl apply -f k8s/frontend/ingress.yaml
```

---

## 4. Khởi Tạo Bucket MinIO & Migration Database

### 4.1 Khởi tạo Bucket MinIO `talentflow-cvs`
```bash
kubectl exec -n talentflow deploy/minio -- sh -c '
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/talentflow-cvs || true
mc anonymous set public local/talentflow-cvs || true
'
```

### 4.2 Migration Database
PostgreSQL trong cụm chạy cơ sở dữ liệu `talentflow_dev`.
* **Prisma (API Gateway & Notification)**: Có thể sync nhanh schema và seed data từ backup hoặc port-forward:
```bash
kubectl port-forward -n talentflow svc/postgres-service 15432:5432 &
PG_PID=$!
cd api-gateway && DATABASE_URL="postgresql://postgres:your-strong-postgres-password@localhost:15432/talentflow_dev" npx prisma migrate deploy
cd ../notification && DATABASE_URL="postgresql://postgres:your-strong-postgres-password@localhost:15432/talentflow_dev" npx prisma migrate deploy
cd ../api-gateway && DATABASE_URL="postgresql://postgres:your-strong-postgres-password@localhost:15432/talentflow_dev" SEED_DEFAULT_PASSWORD="Password123!" npm run db:seed
kill $PG_PID
```
* **Flyway (CV Parser)**: Tự động chạy tạo schema `cv_parser` khi pod `cv-parser` khởi động.

---

## 5. Xác Minh Tình Trạng Vận Hành (Health & Diagnostics)

```bash
# Kiểm tra toàn bộ Pods
kubectl get pods -n talentflow -o wide

# Kiểm tra Ingress routes
kubectl get ingress -n talentflow

# Kiểm thử endpoint qua Ingress (Host port 8088 hoặc 80)
curl -s -H "Host: api.talentflow.local" http://localhost:8088/ready
curl -s -H "Host: notification.talentflow.local" http://localhost:8088/health/ready
curl -s -H "Host: app.talentflow.local" http://localhost:8088/
```
