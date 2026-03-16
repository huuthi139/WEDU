/** Email templates for WEDU platform */

const brandColor = '#2563eb';
const bgColor = '#f8fafc';

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${bgColor};font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="text-align:center;padding:24px 0;">
      <h1 style="margin:0;color:${brandColor};font-size:28px;font-weight:700;">📚 WEDU</h1>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Nền tảng học tập trực tuyến</p>
    </div>
    <div style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      ${content}
    </div>
    <div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} WEDU. All rights reserved.</p>
      <p style="margin:4px 0 0;">Email này được gửi từ huuthi.com</p>
    </div>
  </div>
</body>
</html>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Chào mừng bạn đến với WEDU! 🎉',
    html: layout(`
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:22px;">Xin chào ${name}! 👋</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Chào mừng bạn đã gia nhập <strong>WEDU</strong> – nền tảng học tập trực tuyến hàng đầu!
      </p>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Tại đây, bạn có thể:
      </p>
      <ul style="color:#475569;line-height:1.8;margin:0 0 24px;padding-left:20px;">
        <li>📚 Truy cập hàng trăm khóa học chất lượng cao</li>
        <li>🎯 Học theo lộ trình được thiết kế chuyên nghiệp</li>
        <li>📜 Nhận chứng chỉ khi hoàn thành khóa học</li>
        <li>👥 Kết nối với cộng đồng học viên năng động</li>
      </ul>
      <div style="text-align:center;margin:24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://wedu.vn'}/courses"
           style="display:inline-block;background:${brandColor};color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          Khám phá khóa học ngay
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;text-align:center;">
        Nếu bạn có bất kỳ câu hỏi nào, hãy liên hệ với chúng tôi!
      </p>
    `),
  };
}

export function passwordResetEmail(name: string, resetLink: string): { subject: string; html: string } {
  return {
    subject: 'Khôi phục mật khẩu WEDU',
    html: layout(`
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:22px;">Khôi phục mật khẩu 🔐</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Xin chào <strong>${name}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.
        Nhấn vào nút bên dưới để đặt lại mật khẩu:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetLink}"
           style="display:inline-block;background:${brandColor};color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          Đặt lại mật khẩu
        </a>
      </div>
      <p style="color:#475569;line-height:1.6;margin:0 0 8px;">
        Hoặc sao chép đường link sau vào trình duyệt:
      </p>
      <p style="background:#f1f5f9;padding:12px;border-radius:6px;word-break:break-all;color:${brandColor};font-size:13px;margin:0 0 16px;">
        ${resetLink}
      </p>
      <p style="color:#ef4444;font-size:13px;margin:0 0 8px;">
        ⚠️ Link này sẽ hết hạn sau <strong>1 giờ</strong>.
      </p>
      <p style="color:#94a3b8;font-size:13px;margin:16px 0 0;">
        Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Tài khoản của bạn vẫn an toàn.
      </p>
    `),
  };
}

export function courseCompletionEmail(
  name: string,
  courseName: string,
  certificateLink?: string
): { subject: string; html: string } {
  return {
    subject: `Chúc mừng! Bạn đã hoàn thành khóa học "${courseName}" 🎓`,
    html: layout(`
      <div style="text-align:center;margin:0 0 24px;">
        <div style="font-size:64px;margin-bottom:8px;">🎓</div>
        <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Chúc mừng ${name}!</h2>
        <p style="color:#16a34a;font-weight:600;font-size:16px;margin:0;">Bạn đã hoàn thành xuất sắc!</p>
      </div>
      <div style="background:#f0fdf4;border-radius:8px;padding:20px;margin:0 0 24px;border-left:4px solid #16a34a;">
        <p style="color:#475569;margin:0 0 4px;font-size:13px;">Khóa học đã hoàn thành:</p>
        <p style="color:#1e293b;margin:0;font-size:18px;font-weight:600;">${courseName}</p>
      </div>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Thật tuyệt vời! Bạn đã hoàn thành <strong>100%</strong> nội dung khóa học.
        Kiến thức và kỹ năng mới sẽ giúp bạn tiến xa hơn trên con đường sự nghiệp.
      </p>
      ${certificateLink ? `
      <div style="text-align:center;margin:24px 0;">
        <a href="${certificateLink}"
           style="display:inline-block;background:#16a34a;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          📜 Xem chứng chỉ của bạn
        </a>
      </div>
      ` : ''}
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Hãy tiếp tục hành trình học tập với các khóa học khác tại WEDU!
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://wedu.vn'}/courses"
           style="display:inline-block;background:${brandColor};color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          Khám phá thêm khóa học
        </a>
      </div>
    `),
  };
}
