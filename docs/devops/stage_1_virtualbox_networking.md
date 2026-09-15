# Giai Đoạn 1: Thiết Lập Máy Ảo VirtualBox & Hạ Tầng Mạng

Giai đoạn này tập trung vào việc tạo các máy ảo trên VirtualBox, thiết lập cấu hình mạng kép (NAT + Host-Only) để đảm bảo các node vừa có thể ra Internet vừa có thể giao tiếp nội bộ qua mạng riêng với IP tĩnh cố định.

---

## 1. Thiết Kế Mạng Lưới Node (Network Planning)

Để 5 máy ảo VirtualBox giao tiếp với nhau ổn định, chúng ta sẽ gán cho chúng các IP tĩnh cố định trong dải mạng nội bộ riêng (Host-Only).

Dưới đây là kế hoạch phân chia IP:
- **Dải mạng Host-Only**: `192.168.56.0/24` (IP của card mạng Host-only trên máy thật thường là `192.168.56.1`)
- **Dải mạng NAT**: Nhận DHCP tự động (Dùng để tải phần mềm từ Internet).

| VM Name | Hostname | IP Mạng Host-Only | Cấu Hình Khuyến Nghị | Role |
| :--- | :--- | :--- | :--- | :--- |
| **tf-master** | `tf-master` | `192.168.56.10` | 1 vCPU, 2GB RAM, 20GB Disk | Master Node (Control Plane) |
| **tf-worker-1** | `tf-worker-1` | `192.168.56.11` | 1 vCPU, 2GB RAM, 20GB Disk | Stateless Applications Worker |
| **tf-worker-2** | `tf-worker-2` | `192.168.56.12` | 1 vCPU, 2GB RAM, 20GB Disk | Stateless Applications Worker |
| **tf-worker-3** | `tf-worker-3` | `192.168.56.13` | 1 vCPU, 2GB RAM, 20GB Disk | Stateful Databases Worker |
| **tf-worker-4** | `tf-worker-4` | `192.168.56.14` | 2 vCPU, 4GB RAM, 30GB Disk | Observability Stack Worker |

---

## 2. Tạo Card Mạng Host-Only Trên VirtualBox

Trước khi tạo máy ảo, chúng ta cần tạo card mạng Host-only trên VirtualBox:

1. Mở VirtualBox Manager.
2. Chọn **Tools** (biểu tượng 3 dấu gạch ngang) -> Chọn **Network**.
3. Tại tab **Host-only Networks**, bấm **Create**.
4. VirtualBox sẽ tạo ra một card mạng ảo (ví dụ: `vboxnet0` trên Linux/macOS hoặc `VirtualBox Host-Only Ethernet Adapter` trên Windows).
5. Chọn card mạng vừa tạo, kiểm tra cấu hình:
   - **IPv4 Address**: `192.168.56.1`
   - **IPv4 Network Mask**: `255.255.255.0`
   - Tích chọn **Disable DHCP Server** (Chúng ta sẽ tự gán IP tĩnh cho các node để tránh bị đổi IP khi restart).

---

## 3. Tạo Máy Ảo Gốc (Template VM)

Chúng ta cài đặt 1 máy ảo cơ sở hoàn chỉnh trước, sau đó nhân bản ra để không phải lặp lại các bước cài đặt hệ điều hành.

1. Bấm **New** để tạo máy ảo mới:
   - Name: `tf-template`
   - OS: Ubuntu Server 22.04 LTS (ISO).
   - RAM: 2048 MB.
   - CPU: 1 Core.
   - Hard Disk: 30 GB (Dynamically Allocated).
2. Thiết lập Network cho máy ảo trước khi khởi động:
   - Chọn máy ảo -> Bấm **Settings** -> Chọn tab **Network**.
   - **Adapter 1**: Chọn `NAT` (Dùng để ra Internet tải package).
   - **Adapter 2**: Chọn `Host-Only Adapter`, mục Name chọn đúng card mạng Host-only vừa tạo ở mục 2 (ví dụ: `vboxnet0`).
3. Khởi động máy ảo và tiến hành cài đặt Ubuntu Server:
   - Ngôn ngữ: `English`.
   - Cài đặt mạng (Network Connections): Để mặc định nhận IP DHCP cho cả 2 card (Chúng ta sẽ cấu hình tĩnh sau).
   - Đặt username: `devops` (mật khẩu: tùy chọn, ví dụ `123456`).
   - Tích chọn **Install OpenSSH Server** (Để có thể điều khiển máy ảo từ terminal máy thật).
   - Sau khi cài xong, chọn **Reboot Now**.

---

## 4. Cấu Hình Chuẩn Hóa Hệ Điều Hành (OS Preparation)

Sau khi reboot, SSH vào máy ảo gốc `tf-template` bằng tài khoản `devops` và chuẩn bị các cấu hình hệ thống cần thiết cho Kubernetes:

### 4.1 Tắt Swap (Bắt buộc đối với Kubernetes)
Kubernetes yêu cầu tắt hoàn toàn bộ nhớ swap để quản lý tài nguyên RAM chính xác:
```bash
# Tắt swap tạm thời
sudo swapoff -a

# Tắt swap vĩnh viễn (comment dòng swap trong fstab)
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
```

### 4.2 Cấu hình Kernel Modules & Network Bridging
K3s yêu cầu iptables kiểm tra được bridging traffic để điều hướng mạng giữa các container:
```bash
# Nạp module bridge
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
br_netfilter
EOF

sudo modprobe br_netfilter

# Cấu hình sysctl
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-ip6tables = 1
net.bridge.bridge-nf-call-iptables = 1
net.ipv4.ip_forward = 1
EOF

# Áp dụng cấu hình ngay lập tức
sudo sysctl --system
```

### 4.3 Cập nhật Hệ thống & Shutdown
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git net-tools apt-transport-https ca-certificates gnupg
sudo poweroff
```

---

## 5. Nhân Bản Và Cấu Hình IP Tĩnh

### 5.1 Nhân bản (Clone)
Trong VirtualBox Manager:
1. Click chuột phải vào `tf-template` -> Chọn **Clone**.
2. Đặt tên node ảo tương ứng (ví dụ: `tf-master`, `tf-worker-1`, ...).
3. Tại **MAC Address Policy**, bắt buộc chọn **Generate new MAC addresses for all network adapters**.
4. Tại **Clone type**, chọn **Linked Clone** (tiết kiệm dung lượng đĩa máy thật) hoặc **Full Clone**.
5. Làm tương tự cho cả 5 node.

> 💡 **Mẹo quan trọng sau khi Clone**: Do các máy ảo được nhân bản từ một máy ảo gốc `tf-template`, chúng sẽ kế thừa cùng một bộ mã định danh SSH Host Keys. Điều này có thể dẫn đến lỗi bảo mật SSH (`WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED`) khi bạn SSH từ máy thật vào các máy ảo khác nhau. 
> 
> Để khắc phục, hãy chạy các lệnh sau trên **mỗi máy ảo đã clone** để tạo lại bộ khóa SSH riêng biệt:
> ```bash
> sudo rm -f /etc/ssh/ssh_host_*
> sudo dpkg-reconfigure openssh-server
> sudo systemctl restart ssh
> ```

### 5.2 Tìm tên Card mạng
Khởi động cả 5 node ảo lên. Để biết tên các card mạng của hệ thống, gõ lệnh:
```bash
ip link
```
Kết quả thường xuất hiện dạng:
- `lo`: Loopback interface.
- `enp0s3`: Card mạng thứ 1 (gắn vào NAT).
- `enp0s8`: Card mạng thứ 2 (gắn vào Host-Only).

### 5.3 Cấu hình Netplan IP tĩnh cho từng Node
Chỉnh sửa file cấu hình Netplan trên từng node:
```bash
sudo nano /etc/netplan/00-installer-config.yaml
```
Sửa nội dung file cấu hình theo mẫu dưới đây (chú ý thay thế IP tương ứng với từng node và tên interface đúng với máy ảo của bạn):

**Mẫu cho Node Master (`tf-master`):**
```yaml
network:
  ethernets:
    enp0s3:
      dhcp4: true  # Nhận IP tự động để ra Internet
    enp0s8:
      dhcp4: false
      addresses:
        - 192.168.56.10/24  # IP tĩnh nội bộ
  version: 2
```

**Mẫu cho Node Worker 1 (`tf-worker-1`):**
```yaml
network:
  ethernets:
    enp0s3:
      dhcp4: true
    enp0s8:
      dhcp4: false
      addresses:
        - 192.168.56.11/24
  version: 2
```
*(Thực hiện tương tự cho các worker khác với IP lần lượt là `.12`, `.13`, `.14`)*

Áp dụng cấu hình mạng mới:
```bash
sudo netplan apply
```

### 5.4 Cập nhật Hostname
Đặt hostname tương ứng cho từng node:
- Trên Master: `sudo hostnamectl set-hostname tf-master`
- Trên Worker 1: `sudo hostnamectl set-hostname tf-worker-1`
- (Thực hiện tương tự cho các worker khác)

### 5.5 Cập nhật File `/etc/hosts`
Sửa file `/etc/hosts` trên **tất cả 5 node**:
```bash
sudo nano /etc/hosts
```
Thêm các dòng sau vào cuối file để các node có thể phân giải tên miền ảo của nhau:
```text
192.168.56.10 tf-master
192.168.56.11 tf-worker-1
192.168.56.12 tf-worker-2
192.168.56.13 tf-worker-3
192.168.56.14 tf-worker-4
```

Hãy thử chạy lệnh `ping tf-worker-3` từ `tf-master` để đảm bảo mạng lưới đã thông suốt. Bạn đã hoàn thành Giai đoạn 1!
