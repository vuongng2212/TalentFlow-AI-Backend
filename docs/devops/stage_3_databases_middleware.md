# Giai Đoạn 3: Triển Khai Cơ Sở Dữ Liệu & Hàng Đợi (Databases & Middleware)

Giai đoạn này hướng dẫn cách cấu hình bộ nhớ lưu trữ bền vững (Persistent Storage), viết các manifest Kubernetes và triển khai PostgreSQL, Redis, RabbitMQ, MinIO lên node chuyên dụng `tf-worker-3`.

---

## 1. Cơ Chế Lưu Trữ Trên K3s (Storage Class)

K3s tích hợp sẵn cơ chế lưu trữ tự động gọi là **Local Path Provisioner** (`local-path`). Cơ chế này sẽ tự động tạo thư mục trên ổ đĩa của node chạy Pod để lưu dữ liệu khi Pod yêu cầu bộ nhớ bền vững (Persistent Volume Claim - PVC).

Vì chúng ta lưu trữ trên ổ đĩa cục bộ của node, nếu Pod di chuyển sang node khác, dữ liệu sẽ không thể đọc được. Đó là lý do chúng ta phải sử dụng `nodeSelector` và gán nhãn `app-type=database` để ép các Pod cơ sở dữ liệu luôn chạy trên đúng node **tf-worker-3**.

---

## 2. Tạo File Manifests Cho Các Dịch Vụ

Tạo các file cấu hình YAML dưới đây trên máy thật hoặc node master của bạn và chạy deploy.

### 2.1 Triển khai PostgreSQL (`k8s/postgres.yaml`)
PostgreSQL dùng để lưu dữ liệu chính của hệ thống.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: talentflow
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path # Dùng StorageClass mặc định của K3s
  resources:
    requests:
      storage: 5Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: talentflow
  labels:
    app: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      nodeSelector:
        app-type: database # Chỉ định chạy trên node tf-worker-3
      containers:
        - name: postgres
          image: postgres:16-alpine
          env:
            - name: POSTGRES_USER
              value: "postgres"
            - name: POSTGRES_PASSWORD
              value: "123"
            - name: POSTGRES_DB
              value: "talentflow_dev"
          ports:
            - containerPort: 5432
              name: postgres
          volumeMounts:
            - name: postgres-db-data
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
      volumes:
        - name: postgres-db-data
          persistentVolumeClaim:
            claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: talentflow
spec:
  ports:
    - port: 5432
      targetPort: 5432
  selector:
    app: postgres
```

### 2.2 Triển khai Redis Cache (`k8s/redis.yaml`)
Redis dùng làm cache tốc độ cao cho API Gateway và Notification Service.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: talentflow
  labels:
    app: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      nodeSelector:
        app-type: database # Chạy trên node tf-worker-3
      containers:
        - name: redis
          image: redis:7-alpine
          command: ["redis-server", "--appendonly", "yes"]
          ports:
            - containerPort: 6379
              name: redis
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "256Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: talentflow
spec:
  ports:
    - port: 6379
      targetPort: 6379
  selector:
    app: redis
```

### 2.3 Triển khai RabbitMQ Message Queue (`k8s/rabbitmq.yaml`)
RabbitMQ điều phối các tin nhắn không đồng bộ giữa api-gateway, cv-parser và notification.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: rabbitmq-pvc
  namespace: talentflow
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 2Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
  namespace: talentflow
  labels:
    app: rabbitmq
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      nodeSelector:
        app-type: database # Chạy trên node tf-worker-3
      containers:
        - name: rabbitmq
          image: rabbitmq:3-management-alpine
          env:
            - name: RABBITMQ_DEFAULT_USER
              value: "rabbitmq"
            - name: RABBITMQ_DEFAULT_PASS
              value: "rabbitmq"
          ports:
            - containerPort: 5672
              name: amqp
            - containerPort: 15672
              name: management
          volumeMounts:
            - name: rabbitmq-data
              mountPath: /var/lib/rabbitmq
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "400m"
              memory: "512Mi"
      volumes:
        - name: rabbitmq-data
          persistentVolumeClaim:
            claimName: rabbitmq-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq-service
  namespace: talentflow
spec:
  ports:
    - port: 5672
      name: amqp
      targetPort: 5672
    - port: 15672
      name: management
      targetPort: 15672
  selector:
    app: rabbitmq
```

### 2.4 Triển khai MinIO S3 Mock Storage (`k8s/minio.yaml`)
MinIO giả lập dịch vụ lưu trữ AWS S3/Cloudflare R2 trên máy local để chứa CV file upload.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minio-pvc
  namespace: talentflow
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: local-path
  resources:
    requests:
      storage: 5Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: talentflow
  labels:
    app: minio
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      nodeSelector:
        app-type: database # Chạy trên node tf-worker-3
      containers:
        - name: minio
          image: minio/minio:latest
          args: ["server", "/data", "--console-address", ":9001"]
          env:
            - name: MINIO_ROOT_USER
              value: "minioadmin"
            - name: MINIO_ROOT_PASSWORD
              value: "minioadmin"
          ports:
            - containerPort: 9000
              name: api
            - containerPort: 9001
              name: console
          volumeMounts:
            - name: minio-data
              mountPath: /data
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
      volumes:
        - name: minio-data
          persistentVolumeClaim:
            claimName: minio-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: minio-service
  namespace: talentflow
spec:
  ports:
    - port: 9000
      name: api
      targetPort: 9000
    - port: 9001
      name: console
      targetPort: 9001
  selector:
    app: minio
```

---

## 3. Chạy Triển Khai (Deployment)

Từ máy thật (hoặc master node), chạy lệnh sau để triển khai các file cấu hình cơ sở dữ liệu:

```bash
# Tạo namespace trước nếu chưa tạo
kubectl create namespace talentflow

# Apply các manifest
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/rabbitmq.yaml
kubectl apply -f k8s/minio.yaml
```

Kiểm tra trạng thái khởi tạo của các Pod:
```bash
kubectl get pods -n talentflow -o wide
```
Bạn sẽ thấy 4 dịch vụ trên đều được lên lịch chạy thành công trên node `tf-worker-3`. Khi trạng thái chuyển sang `Running`, cơ sở hạ tầng lưu trữ và hàng đợi đã sẵn sàng phục vụ các Application Service!
