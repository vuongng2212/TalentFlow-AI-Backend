# Phân Tích & Kế Hoạch Tái Cấu Trúc Hệ Thống Workspace Theo Chuẩn B2B SaaS

Tài liệu này tổng hợp phân tích về cơ chế hoạt động hiện tại của module Workspace trong hệ thống TalentFlow, chỉ ra những khoảng trống kỹ thuật (gaps) so với một hệ thống B2B SaaS tiêu chuẩn và đề xuất kế hoạch tái cấu trúc (refactoring) chi tiết để đưa hệ thống đạt chuẩn doanh nghiệp (Enterprise-grade).

---

## 1. Hiện Trạng Triển Khai Workspace Trong Hệ Thống

Hiện tại, cấu trúc dữ liệu và logic phân quyền của module Workspace đang được thiết kế theo hướng **Lấy User làm trọng tâm (User-centric)** thay vì **Lấy Workspace làm ranh giới bảo mật dữ liệu (Workspace-centric/Tenant-centric)**.

### Cấu trúc cơ sở dữ liệu hiện tại
*   **Quan hệ User - Workspace**: Mối quan hệ giữa User và Workspace là **Nhiều - Nhiều (Many-to-Many)** được thiết lập qua bảng trung gian `WorkspaceMember`.
*   **Cơ chế lưu trữ tài nguyên cốt lõi (Jobs, Candidates, Applications, Interviews)**:
    *   Các bảng này **không** có trường `workspaceId`.
    *   Thay vào đó, tin tuyển dụng (`Job`) liên kết trực tiếp với cá nhân người tạo thông qua trường `createdById` trỏ đến bảng `User`. Các thực thể khác như `Candidate` hay `Application` cũng đi theo mối quan hệ bắc cầu hoặc liên kết trực tiếp với User.

### Cách thức vận hành hiện tại
1.  **Người dùng cá nhân (Free/Plus)**:
    *   Sử dụng hệ thống như một công cụ cá nhân (Single-user tool).
    *   Họ tự tạo Job, quản lý ứng viên và phỏng vấn dưới danh nghĩa cá nhân. Không cần thiết lập hay liên kết với bất kỳ Workspace nào do dữ liệu được cô lập trực tiếp theo `createdById`.
2.  **Khởi tạo Workspace**:
    *   Hệ thống không tự động khởi tạo Workspace khi người dùng đăng ký tài khoản mới.
    *   Người dùng có global role là `RECRUITER` hoặc `ADMIN` phải gọi API `POST /workspaces` một cách thủ công để tạo Workspace. Người tạo sẽ nhận vai trò `OWNER` trong Workspace đó.
3.  **Mời thành viên (Invite Members)**:
    *   Chỉ các Workspace có cờ `isBusiness = true` (đại diện tạm thời cho gói Business/Enterprise) mới được phép mời thành viên tham gia.
    *   Khi gọi API mời thành viên, hệ thống sẽ tạo một bản ghi trong bảng `WorkspaceMember` với trạng thái `ACTIVE` ngay lập tức mà không qua bước xác nhận lời mời (Invitation Acceptance Flow).
4.  **Cộng tác nội bộ**:
    *   Mặc dù thành viên được thêm vào Workspace thành công, họ vẫn **không thể nhìn thấy** hoặc cùng thao tác trên dữ liệu (ví dụ: các Job) của nhau do API hiển thị danh sách vẫn lọc cứng theo `createdById` của người gửi yêu cầu.

---

## 2. Điểm Khác Biệt So Với Hệ Thống B2B SaaS Tiêu Chuẩn

Hệ thống TalentFlow hiện tại có khoảng cách khá lớn với một mô hình SaaS B2B Smart ATS tiêu chuẩn:

| Tiêu chí | Hệ thống B2B SaaS Tiêu chuẩn | TalentFlow Hiện tại |
| :--- | :--- | :--- |
| **Đơn vị cô lập dữ liệu (Multi-Tenancy)** | **Workspace (Tenant)**.<br>Tất cả tài nguyên (`Job`, `Candidate`, `Application`...) bắt buộc phải có trường `workspaceId`. Dữ liệu được bảo mật và cô lập ở cấp doanh nghiệp. | **User (Cá nhân)**.<br>Dữ liệu gắn liền với `createdById` của từng User riêng lẻ. Không có sự liên kết dữ liệu ở cấp độ tổ chức. |
| **Khả năng cộng tác (Collaboration)** | Các thành viên trong cùng một Workspace có thể chia sẻ, xem, đánh giá và thao tác chung trên các tin tuyển dụng và ứng viên dựa trên phân quyền. | Không có sự chia sẻ tài nguyên. Mỗi Recruiter chỉ quản lý và nhìn thấy dữ liệu do chính mình tạo ra, kể cả khi họ ở chung một Workspace. |
| **Phân quyền ngữ cảnh (RBAC)** | Quyền hạn được xác định linh hoạt theo vai trò của User trong từng Workspace cụ thể (`WorkspaceMemberRole` như OWNER, ADMIN, RECRUITER, VIEWER). | Quyền hạn được kiểm tra ở mức toàn cục (`User.role` như ADMIN, RECRUITER). Vai trò trong Workspace chưa được áp dụng để kiểm soát các API nghiệp vụ tuyển dụng. |
| **Quản lý phiên làm việc (Active Workspace)** | Hỗ trợ chuyển đổi qua lại giữa các Workspace khác nhau (Workspace Switching) thông qua Header hoặc Session JWT để xác định ngữ cảnh thao tác. | Không hỗ trợ cơ chế chuyển đổi ngữ cảnh. JWT chỉ lưu thông tin cá nhân User. |
| **Quy trình onboarding** | Khi đăng ký mới:<br>- User cá nhân: Tự động khởi tạo một Workspace cá nhân mặc định (Personal Workspace).<br>- User doanh nghiệp: Tạo Workspace công ty hoặc tham gia vào một Workspace có sẵn qua link mời. | Đăng ký chỉ tạo bản ghi `User` thuần túy. Hệ thống không tạo sẵn Workspace mặc định. |

---

## 3. Kế Hoạch Refactor Hoàn Thiện Hệ Thống B2B SaaS

Để đưa hệ thống TalentFlow đạt chuẩn B2B SaaS Smart ATS, chúng ta cần triển khai các bước tái cấu trúc dưới đây theo lộ trình từ tầng Cơ sở dữ liệu lên tới tầng Logic nghiệp vụ và Giao diện:

### Bước 1: Cập nhật Database Schema (Multi-Tenancy Migration)
Cần chuyển đổi mô hình lưu trữ từ **User-centric** sang **Workspace-centric**.

1.  **Chỉnh sửa Prisma Schema**:
    *   Thêm trường `workspaceId String` (bắt buộc) và thiết lập quan hệ khóa ngoại trỏ tới `Workspace` trong các bảng: `Job`, `Candidate`, `Application`, `Interview`, `EmailTemplate`, và các tài nguyên dùng chung khác.
    *   Đảm bảo thêm chỉ mục (index) cho cột `workspaceId` trong các bảng trên để tối ưu hóa hiệu năng truy vấn:
        ```prisma
        model Job {
          id          String    @id @default(uuid())
          title       String
          workspaceId String
          workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
          // ... các trường khác
          @@index([workspaceId])
        }
        ```
2.  **Viết Script Migration**:
    *   Tạo bản ghi Workspace cá nhân mặc định cho các User hiện tại.
    *   Ánh xạ và cập nhật giá trị `workspaceId` hợp lệ cho toàn bộ các bản ghi `Job`, `Candidate`... đang có trong hệ thống dựa trên thông tin người tạo.

### Bước 2: Xây dựng Cơ chế Chuyển đổi và Xác định Ngữ cảnh Workspace (Workspace Switching & Context Resolution)
Hệ thống cần cung cấp API chuyển đổi workspace và tự động xác định request gửi lên từ Client đang được thực thi trong ngữ cảnh Workspace nào.

1.  **Cơ sở dữ liệu (Prisma Schema)**:
    *   Thêm trường `activeWorkspaceId String?` vào model `User` để lưu vết Workspace được truy cập gần nhất/hoặc thiết lập làm mặc định của người dùng.
    *   Khi người dùng đăng nhập lại hoặc chuyển đổi tab, hệ thống có thể đọc trường này để khôi phục phiên làm việc trước đó của họ một cách mượt mà.
2.  **API Chuyển đổi Workspace (Workspace Switching API)**:
    *   Xây dựng API `PATCH /users/active-workspace`:
        ```typescript
        // DTO nhận vào
        class SwitchWorkspaceDto {
          @IsUUID()
          workspaceId: string;
        }
        
        // Logic xử lý ở Service:
        async switchActiveWorkspace(userId: string, dto: SwitchWorkspaceDto) {
          // 1. Kiểm tra xem user có thực sự thuộc về workspace đó và trạng thái là ACTIVE không
          const membership = await this.prisma.workspaceMember.findFirst({
            where: {
              userId,
              workspaceId: dto.workspaceId,
              status: WorkspaceMemberStatus.ACTIVE,
            },
          });
          
          if (!membership) {
            throw new ForbiddenException('Bạn không có quyền truy cập vào Workspace này.');
          }
          
          // 2. Cập nhật activeWorkspaceId cho User
          return this.prisma.user.update({
            where: { id: userId },
            data: { activeWorkspaceId: dto.workspaceId },
            select: { id: true, activeWorkspaceId: true }
          });
        }
        ```
3.  **Cơ chế xác định ngữ cảnh (Workspace Context Resolution)**:
    *   Client gửi kèm ID của Workspace đang hoạt động thông qua Custom Header `x-workspace-id` trong mọi request.
    *   **Xây dựng `WorkspaceGuard` / Interceptor** xử lý như sau:
        *   **Trường hợp 1:** Request gửi kèm header `x-workspace-id`: Kiểm tra tính hợp lệ của Membership (User có là thành viên `ACTIVE` trong workspace đó không). Nếu hợp lệ, gắn ID này vào `request.workspaceId`.
        *   **Trường hợp 2 (Fallback):** Request **không** gửi kèm header `x-workspace-id` (hoặc trong phiên làm việc đầu tiên): Hệ thống tự động lấy trường `activeWorkspaceId` được lưu trong bảng `User` làm ngữ cảnh mặc định. Nếu user chưa có `activeWorkspaceId` (ví dụ do lỗi đồng bộ), hệ thống sẽ fallback tiếp tục lấy Workspace đầu tiên tìm thấy trong danh sách Workspace mà User đó đang làm thành viên.
        *   Gắn ID cuối cùng đã xác thực vào `Request` object (ví dụ: `request.workspaceId`) để các Controller/Service sử dụng trực tiếp.

### Bước 3: Áp dụng Bộ lọc Workspace vào tất cả API Nghiệp vụ
Tất cả các truy vấn dữ liệu từ database phải bị giới hạn trong phạm vi Workspace hiện tại.

1.  **Refactor các Service (Jobs, Candidates, Applications, Interviews)**:
    *   Thay đổi các câu lệnh Prisma Client từ lọc theo cá nhân sang lọc theo Workspace:
        *   *Trước đây*: `this.prisma.job.findMany({ where: { createdById: userId } })`
        *   *Sau này*: `this.prisma.job.findMany({ where: { workspaceId: activeWorkspaceId } })`
2.  **Bảo toàn thông tin người tạo**:
    *   Giữ lại trường `createdById` chỉ để phục vụ mục đích ghi log (Audit Logging) hoặc hiển thị thông tin "Người tạo" trên giao diện, không dùng làm ranh giới phân quyền.

### Bước 4: Triển khai Workspace-scoped RBAC (Phân quyền theo ngữ cảnh)
Thay thế kiểm tra quyền toàn cục bằng quyền chi tiết trong Workspace.

1.  **Tích hợp `WorkspaceMemberRole`**:
    *   Khi User thực hiện hành động (ví dụ: Xóa một Job), hệ thống cần kiểm tra vai trò của User đó trong Workspace hiện tại:
        *   `OWNER` / `ADMIN`: Toàn quyền thao tác trên mọi tài nguyên của Workspace.
        *   `RECRUITER`: Được tạo, sửa Job và ứng viên nhưng chỉ được tác động các tài nguyên do mình quản lý hoặc được phân công.
        *   `VIEWER`: Chỉ được gọi các API GET (đọc dữ liệu), bị chặn hoàn toàn các API POST, PATCH, DELETE.

### Bước 5: Hoàn thiện Quy trình Mời thành viên (Invitation Workflow)
Đảm bảo tính bảo mật và đúng quy trình khi thêm người vào Workspace.

1.  **Thay đổi trạng thái mặc định**:
    *   Khi mời một thành viên mới thông qua email, bản ghi `WorkspaceMember` được tạo với trạng thái `INVITED` chứ không phải `ACTIVE`.
2.  **Cơ chế mã xác nhận (Token-based Invitation)**:
    *   Tạo bảng `WorkspaceInvitation` lưu trữ: `email`, `workspaceId`, `token`, `expiresAt`.
    *   Gửi email chứa link dạng: `https://talentflow.ai/invite/accept?token=xyz`.
3.  **API Xác nhận lời mời (`accept-invite`)**:
    *   Khi người dùng nhấn vào link, Client gọi API xác nhận lên Backend.
    *   Backend kiểm tra token hợp lệ -> đổi trạng thái của `WorkspaceMember` tương ứng thành `ACTIVE` -> gán Workspace mới này vào danh sách Workspace của User.

### Bước 6: Tự động hóa Khởi tạo Workspace mặc định khi Đăng ký
Đảm bảo trải nghiệm người dùng cá nhân (Free/Plus) mượt mà mà không làm hỏng cấu trúc dữ liệu đa thuê (Multi-Tenancy).

1.  **Cơ chế tự động khởi tạo Workspace cá nhân (Personal Workspace)**:
    *   **Vì sao cần thiết**: Do tất cả các module cốt lõi (`Job`, `Candidate`, `Application`, `Interview`) sau khi refactor đều bắt buộc phải liên kết qua `workspaceId`, một User nếu không thuộc về bất kỳ Workspace nào sẽ **không thể thực hiện được bất kỳ hành động nào** trên hệ thống.
    *   **Luồng xử lý khi Đăng ký (Signup)**: 
        *   Khi một User mới đăng ký thành công tài khoản (qua `AuthService.signup`), hệ thống sẽ thực hiện một Transaction DB duy nhất:
            1. Tạo bản ghi `User`.
            2. Tạo một bản ghi `Workspace` mặc định đại diện cho chính User đó (ví dụ tên: `[Tên của User] - Personal Workspace`) với cờ `isBusiness = false`.
            3. Tạo một bản ghi `WorkspaceMember` liên kết User này vào Workspace đó với vai trò là `OWNER` và trạng thái `ACTIVE`.
            4. Cập nhật trường `activeWorkspaceId` của `User` vừa tạo trỏ tới ID của Workspace mặc định này.
        *   Điều này giúp User cá nhân (Free/Plus) có ngay một Workspace hoạt động lập tức sau khi đăng nhập và trường `activeWorkspaceId` đã được điền sẵn giá trị hợp lệ đầu tiên. Tất cả các dữ liệu Job, Candidate họ tạo ra sẽ tự động được gán ID của Workspace cá nhân này.

2.  **Cơ chế Ngăn chặn Mời thành viên (Invite Member Blocking)**:
    *   **Nguyên tắc**: Các gói subscription cá nhân (Free/Plus) chỉ cho phép làm việc đơn lẻ (Single-user workspace). Tính năng cộng tác doanh nghiệp (mời thành viên) bị khóa hoàn toàn.
    *   **Cách thức kiểm tra và chặn ở Backend**:
        *   Mọi API liên quan đến thành viên như `POST /workspaces/:id/members` (mời thành viên) hoặc `POST /workspaces/:id/invitations` (gửi email mời) đều phải đi qua bước kiểm tra điều kiện gói dịch vụ của Workspace mục tiêu.
        *   Backend sẽ truy vấn thông tin Workspace theo ID được yêu cầu và gọi hàm validation:
            ```typescript
            // Ví dụ mã kiểm tra trong WorkspacesService
            async addMember(workspaceId: string, dto: AddWorkspaceMemberDto) {
              const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId }
              });
              
              if (!workspace) {
                throw new NotFoundException('Workspace không tồn tại');
              }
              
              // Chặn nếu Workspace không phải gói Business
              if (!workspace.isBusiness) {
                throw new ForbiddenException(
                  'Workspace cá nhân không được phép mời thành viên. Vui lòng nâng cấp lên gói Business.'
                );
              }
              
              // Tiếp tục xử lý logic mời thành viên...
            }
            ```
        *   Phía **Frontend** cũng sẽ ẩn các menu hoặc nút bấm liên quan đến "Mời thành viên" hoặc "Quản lý tổ chức" nếu thuộc tính `isBusiness` của Workspace hiện tại là `false`.

3.  **Nâng cấp lên gói Business**:
    *   Khi User cá nhân quyết định nâng cấp lên gói Business, hệ thống chỉ cần chuyển đổi cờ `isBusiness = true` trên Workspace hiện tại hoặc tạo một Workspace doanh nghiệp mới riêng biệt. Từ thời điểm này, tính năng mời thành viên sẽ được mở khóa trên Workspace đó.

