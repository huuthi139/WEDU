# WEDU Import Sheet Template

## Tổng quan

Google Sheet dùng cho import cần có 3 tab: `students`, `courses`, `course_access`.

Sử dụng trang **/admin/import** để chạy import, hoặc gọi API `POST /api/admin/import-sheet`.

> **Quan trọng**: Luôn chạy Dry Run trước để kiểm tra dữ liệu, sau đó mới import thật.

---

## Tab 1: students

| Cột | Bắt buộc | Mô tả | Giá trị hợp lệ |
|-----|----------|-------|----------------|
| email | ✅ | Email học viên | Email hợp lệ |
| full_name | | Họ tên | Text |
| phone | | Số điện thoại | Text |
| system_role | | Vai trò trong hệ thống | `admin`, `instructor`, `student` |
| status | | Trạng thái tài khoản | `active`, `inactive`, `banned` |
| password | | Mật khẩu (tùy chọn) | Text |

**Quy tắc:**
- User không có password → tài khoản bị khóa (locked sentinel), phải dùng "Quên mật khẩu" để kích hoạt
- User có password → hash và lưu ngay, có thể đăng nhập ngay
- Re-import: **không ghi đè** password của user đã active

---

## Tab 2: courses

| Cột | Bắt buộc | Mô tả | Giá trị hợp lệ |
|-----|----------|-------|----------------|
| course_code | ✅ | Mã khóa học (dùng làm ID) | Text, unique |
| title | ✅ | Tên khóa học | Text |
| slug | | URL slug | Text |
| status | | Trạng thái | `draft`, `published`, `archived` |
| short_description | | Mô tả ngắn | Text |
| visibility | | Hiển thị | `public`, `private` |

**Quy tắc:**
- `course_code` hoặc `slug` phải có ít nhất 1 cái
- Nếu course đã tồn tại, chỉ cập nhật các trường non-empty
- Default status: `published`, visibility: `public`

---

## Tab 3: course_access

| Cột | Bắt buộc | Mô tả | Giá trị hợp lệ |
|-----|----------|-------|----------------|
| email | ✅ | Email học viên | Email hợp lệ (phải tồn tại trong tab students hoặc DB) |
| course_code | ✅ | Mã khóa học | Phải tồn tại trong tab courses hoặc DB |
| access_tier | | Hạng truy cập | `free`, `premium`, `vip` |
| status | | Trạng thái | `active`, `expired`, `cancelled` |
| activated_at | | Ngày kích hoạt | ISO date hoặc DD/MM/YYYY |
| expires_at | | Ngày hết hạn | ISO date hoặc DD/MM/YYYY |
| source | | Nguồn | `import`, `manual`, `order`, `gift`, `admin`, `scholarship`, `system` |

**Quy tắc:**
- Cùng email + course_code trùng nhiều dòng → ưu tiên tier cao hơn (vip > premium > free)
- Khi `upgradeOnly = true`: không downgrade tier hiện tại
- Nếu email chưa có trong DB → tự tạo placeholder user (bị khóa, cần Quên mật khẩu)
- Default tier: `premium`, status: `active`, source: `import`

---

## Thứ tự import

1. **courses** (tạo khóa học trước)
2. **students** (tạo user trước)
3. **course_access** (cần cả user_id và course_id)

---

## Cách sử dụng

### Qua UI Admin
1. Mở `/admin/import`
2. Chọn bảng cần import
3. Bật Dry Run
4. Chạy → kiểm tra kết quả
5. Tắt Dry Run → chạy import thật

### Qua API
```bash
# Dry run
curl -X POST /api/admin/import-sheet \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Actual import
curl -X POST /api/admin/import-sheet \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false, "upgradeOnly": true}'

# Import chỉ students
curl -X POST /api/admin/import-sheet \
  -H "Content-Type: application/json" \
  -d '{"tables": ["students"], "dryRun": false}'
```

---

## Cleanup dữ liệu sai

Nếu course_access bị import sai (ví dụ: auto-generated không có mapping thật):

### Qua UI Admin
1. Mở `/admin/course-access`
2. Click "Preview Cleanup"
3. Kiểm tra số records sẽ xóa
4. Gõ `XOA TAT CA` để xác nhận
5. Backup tự động lưu vào audit_logs

### Qua API
```bash
# Preview (xem trước, không xóa)
curl GET /api/admin/course-access/cleanup

# Xóa thật (cần confirm)
curl -X POST /api/admin/course-access/cleanup \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}'
```

**An toàn:**
- Chỉ xóa course_access — KHÔNG xóa users, courses, hoặc audit_logs
- Backup đầy đủ lưu vào audit_logs trước khi xóa
- Sau khi xóa, phải import lại từ Google Sheet có đúng format

---

## QUAN TRỌNG: Không suy luận course_access

**KHÔNG BAO GIỜ** suy luận rằng mọi học viên có quyền truy cập tất cả khóa học.

Tab `course_access` trong Google Sheet **BẮT BUỘC** phải có cột `course_code` với mapping email + course_code thật.

Nếu tab `course_access` không có cột `course_code` hoặc dữ liệu trống → **KHÔNG import**. Yêu cầu admin cung cấp mapping đúng.

---

## Kích hoạt tài khoản imported

Khi admin import học viên **không có password**:
1. User được tạo với sentinel password hash (bị khóa)
2. User **không thể đăng nhập** với tài khoản này
3. Admin thông báo cho user dùng **"Quên mật khẩu"** trên trang login
4. User nhập email → nhận link reset → đặt password mới → đăng nhập được

Khi admin import học viên **có password**:
1. Password được hash và lưu ngay
2. User **có thể đăng nhập** ngay với password đã cho
