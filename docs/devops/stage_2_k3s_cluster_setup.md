# Giai Đoạn 2: Khởi Tạo & Thiết Lập Cụm K3s Cluster

Giai đoạn này hướng dẫn cách cài đặt K3s Control Plane (Master Node), kết nối các Worker Node vào cụm, phân chia vai trò của các node thông qua nhãn (Labeling) và cấu hình quyền quản trị cụm từ máy thật (Host).

---

## 1. Giới Thiệu Về K3s

**K3s** là bản phân phối Kubernetes siêu nhẹ được phát triển bởi Rancher Labs, được chứng nhận bởi CNCF. K3s cực kỳ phù hợp cho môi trường lab, học tập, máy ảo VirtualBox local hoặc thiết bị IoT vì:
- Dung lượng nhẹ, chỉ mất ~500MB RAM để chạy master node.
- Loại bỏ các cloud provider driver không cần thiết.
- Tích hợp sẵn Containerd, Flannel CNI, CoreDNS, Local Path Storage Provisioner và Traefik Ingress.

---

## 2. Khởi Tạo Master Node (`tf-master`)

Đăng nhập SSH vào máy `tf-master` (`192.168.56.10`):

```bash
# Cài đặt K3s Control Plane
# --node-ip: Chỉ định lắng nghe trên card Host-Only
# --flannel-iface: Ép mạng flannel sử dụng card Host-Only enp0s8 để kết nối các pod chéo node
# --disable=traefik: Tắt Ingress Controller mặc định của K3s để cài Nginx Ingress Controller (tương thích các manifest đã viết)
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--node-ip=192.168.56.10 --flannel-iface=enp0s8 --disable=traefik" sh -
```

> ⚠️ **Chú ý**: Hãy thay `enp0s8` bằng tên card mạng Host-only thực tế mà bạn kiểm tra được ở Giai đoạn 1.

Kiểm tra xem Control Plane đã chạy thành công chưa:
```bash
sudo kubectl get nodes
```
Kết quả xuất hiện dạng:
```text
NAME        STATUS   ROLES                  AGE   VERSION
tf-master   Ready    control-plane,master   15s   v1.28.x+k3s1
```

Lấy **Join Token** để kết nối các node worker sau này:
```bash
sudo cat /var/lib/rancher/k3s/server/node-token
# Hãy copy mã token này (Ví dụ: K109df53...::server:456cbb...)
```

---

## 3. Gắn Các Worker Nodes Vào Cụm

Thực hiện lần lượt các bước sau trên cả 4 máy ảo worker (`tf-worker-1` đến `tf-worker-4`):

```bash
# Thay đổi <JOIN_TOKEN> bằng token bạn lấy ở Master
# Thay đổi <WORKER_IP> bằng IP tĩnh Host-only của từng worker (Ví dụ: 192.168.56.11 cho worker-1)
curl -sfL https://get.k3s.io | K3S_URL=https://192.168.56.10:6443 K3S_TOKEN="<JOIN_TOKEN>" INSTALL_K3S_EXEC="--node-ip=<WORKER_IP> --flannel-iface=enp0s8" sh -
```

*Ví dụ trên máy `tf-worker-4` (`192.168.56.14`):*
```bash
curl -sfL https://get.k3s.io | K3S_URL=https://192.168.56.10:6443 K3S_TOKEN="K109df53...::server:456cbb..." INSTALL_K3S_EXEC="--node-ip=192.168.56.14 --flannel-iface=enp0s8" sh -
```

---

## 4. Xác Minh Cụm Node Hoạt Động

Quay lại SSH của node `tf-master`, kiểm tra trạng thái toàn bộ cụm:
```bash
sudo kubectl get nodes -o wide
```
Nếu tất cả 5 node đều hiển thị trạng thái `Ready` và IP mạng nội bộ là `192.168.xxx.xxx`, cụm mạng lưới của bạn đã được thiết lập thành công!

---

## 5. Phân Chia Vai Trò Node Bằng Nhãn (Node Labeling)

Để Kubernetes biết được Pod nào nên chạy trên node nào (ví dụ: các database nặng nên chạy trên `tf-worker-3`, Elasticsearch cần nhiều RAM nên chạy trên `tf-worker-4`), chúng ta cần gán nhãn cho các node ảo:

```bash
# Gán nhãn cho 2 node chạy ứng dụng Stateless (api-gateway, notification, cv-parser)
sudo kubectl label node tf-worker-1 app-type=stateless
sudo kubectl label node tf-worker-2 app-type=stateless

# Gán nhãn cho node chạy Database & Queue
sudo kubectl label node tf-worker-3 app-type=database

# Gán nhãn cho node chạy Hệ thống giám sát (Observability)
sudo kubectl label node tf-worker-4 app-type=monitoring
```

---

## 6. Cấu Hình Quản Trị Cụm K3s Từ Máy Thật (Host Machine)

Để không phải SSH vào `tf-master` mỗi khi muốn chạy lệnh `kubectl`, bạn có thể cấu hình để điều khiển cụm Kubernetes trực tiếp từ máy thật.

### 6.1 Cài đặt `kubectl` trên máy thật (Host)
Tùy thuộc vào hệ điều hành trên máy thật của bạn:
- **macOS (Homebrew)**: `brew install kubernetes-cli`
- **Linux (Debian/Ubuntu)**: 
  ```bash
  sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl
  sudo curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg
  echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list
  sudo apt-get update && sudo apt-get install -y kubectl
  ```
- **Windows (Chocolatey / Scoop)**: `choco install kubernetes-cli` hoặc tải file `.exe` trực tiếp.

### 6.2 Sao chép tệp cấu hình Kubeconfig
Lấy nội dung tệp kubeconfig từ node master:
```bash
# Trên máy tf-master:
sudo cat /etc/rancher/k3s/k3s.yaml
```
Copy toàn bộ nội dung xuất hiện trên màn hình.

Trên máy thật (Host):
1. Tạo thư mục cấu hình nếu chưa có: `mkdir -p ~/.kube`
2. Tạo tệp cấu hình: `nano ~/.kube/config` (hoặc mở bằng Notepad/VS Code trên Windows).
3. Dán nội dung vừa copy vào.
4. Tìm đến dòng:
   ```yaml
   server: https://127.0.0.1:6443
   ```
   Sửa thành IP tĩnh của master node:
   ```yaml
   server: https://192.168.56.10:6443
   ```
5. Lưu lại. Kiểm tra kết nối từ máy thật:
   ```bash
   kubectl get nodes
   ```
   Nếu hiển thị danh sách 5 node thành công, bạn đã có thể quản trị cụm từ máy thật của mình! Bạn đã sẵn sàng bước sang Giai đoạn 3.
