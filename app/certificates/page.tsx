'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useCourses } from '@/contexts/CoursesContext';
import { useEnrollment } from '@/contexts/EnrollmentContext';

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function CertificateCard({
  courseName,
  studentName,
  completedDate,
  courseId,
}: {
  courseName: string;
  studentName: string;
  completedDate: string;
  courseId: string;
}) {
  const certRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!certRef.current) return;

    // Create a canvas from the certificate div
    const cert = certRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 560;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 800, 560);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 560);

    // Border
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, 760, 520);

    // Inner border
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 30, 740, 500);

    // Title decoration
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WEPOWER EDUCATION', 400, 75);

    // Certificate title
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('CHỨNG NHẬN HOÀN THÀNH', 400, 130);

    // Decorative line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 150);
    ctx.lineTo(600, 150);
    ctx.stroke();

    // "Chứng nhận"
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px sans-serif';
    ctx.fillText('Chứng nhận rằng', 400, 200);

    // Student name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(studentName, 400, 245);

    // "Đã hoàn thành"
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px sans-serif';
    ctx.fillText('đã hoàn thành xuất sắc khóa học', 400, 290);

    // Course name
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px sans-serif';
    // Wrap long course names
    const maxWidth = 600;
    const words = courseName.split(' ');
    let line = '';
    let y = 330;
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, 400, y);
        line = word;
        y += 30;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 400, y);

    // Date
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Ngày hoàn thành: ${formatDate(completedDate)}`, 400, y + 60);

    // Certificate ID
    ctx.fillStyle = '#4b5563';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Mã chứng nhận: CERT-${courseId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`, 400, y + 90);

    // Star decoration
    ctx.fillStyle = '#fbbf24';
    ctx.font = '24px sans-serif';
    ctx.fillText('★', 400, y + 130);

    // Download
    const link = document.createElement('a');
    link.download = `certificate-${courseId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="group">
      {/* Certificate Visual */}
      <div ref={certRef} className="bg-gradient-to-br from-dark to-[#1a1a2e] border-2 border-teal rounded-xl p-8 relative overflow-hidden mb-4">
        {/* Decorative corners */}
        <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-gold/40"></div>
        <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-gold/40"></div>
        <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-gold/40"></div>
        <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-gold/40"></div>

        <div className="text-center">
          <p className="text-gold text-xs font-bold tracking-[0.3em] uppercase mb-3">WEPOWER Education</p>
          <h3 className="text-teal text-lg font-bold mb-1">CHỨNG NHẬN HOÀN THÀNH</h3>
          <div className="w-32 h-0.5 bg-gold/40 mx-auto mb-4"></div>

          <p className="text-gray-400 text-xs mb-1">Chứng nhận rằng</p>
          <p className="text-white text-xl font-bold mb-1">{studentName}</p>
          <p className="text-gray-400 text-xs mb-2">đã hoàn thành xuất sắc khóa học</p>
          <p className="text-gold font-bold mb-3 line-clamp-2">{courseName}</p>

          <p className="text-gray-500 text-[10px]">Ngày hoàn thành: {formatDate(completedDate)}</p>
          <p className="text-gold text-sm mt-2">★</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal/10 border border-teal/20 rounded-lg text-teal text-sm font-semibold hover:bg-teal/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Tải xuống
        </button>
        <Link
          href={`/learn/${courseId}`}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-sm font-semibold hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Học lại
        </Link>
      </div>
    </div>
  );
}

export default function Certificates() {
  const { user, isLoading } = useAuth();
  const { courses } = useCourses();
  const { enrollments } = useEnrollment();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center">
          <svg className="w-10 h-10 animate-spin text-teal mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  const completedEnrollments = enrollments.filter(e => e.progress === 100);
  const completedCourses = completedEnrollments
    .map(enrollment => {
      const course = courses.find(c => c.id === enrollment.courseId);
      if (!course) return null;
      return {
        ...course,
        completedDate: enrollment.lastAccessedAt,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Chứng chỉ của tôi
          </h1>
          <p className="text-gray-400">
            Xem và tải xuống chứng chỉ các khóa học đã hoàn thành
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-teal mb-1">{completedCourses.length}</div>
            <div className="text-sm text-gray-400">Chứng chỉ đã đạt</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-gold mb-1">{enrollments.length}</div>
            <div className="text-sm text-gray-400">Khóa học đã đăng ký</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-white mb-1">
              {enrollments.length > 0 ? Math.round((completedCourses.length / enrollments.length) * 100) : 0}%
            </div>
            <div className="text-sm text-gray-400">Tỷ lệ hoàn thành</div>
          </div>
        </div>

        {/* Certificates Grid */}
        {completedCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedCourses.map((course) => (
              <CertificateCard
                key={course.id}
                courseId={course.id}
                courseName={course.title}
                studentName={user.name}
                completedDate={course.completedDate}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white/5 border border-white/10 rounded-xl">
            <svg className="w-20 h-20 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <h3 className="text-xl font-bold text-white mb-2">Chưa có chứng chỉ nào</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Hoàn thành các khóa học để nhận chứng chỉ. Mỗi khóa học hoàn thành 100% sẽ tự động cấp chứng chỉ cho bạn.
            </p>
            <Link href="/courses">
              <Button variant="primary" size="md">Khám phá khóa học</Button>
            </Link>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
