'use client';

import Link from 'next/link';
import type { Course } from '@/lib/mockData';
import { formatPrice, formatDuration } from '@/lib/utils';

interface CoursesTabProps {
  courses: Course[];
  onAddCourse: () => void;
  onEditCourse: (course: Course) => void;
  onDeleteCourse: (course: Course) => void;
}

export function CoursesTab({
  courses,
  onAddCourse,
  onEditCourse,
  onDeleteCourse,
}: CoursesTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Tất cả khóa học ({courses.length})</h3>
          <button
            onClick={onAddCourse}
            className="flex items-center gap-2 bg-teal hover:bg-teal/80 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Thêm khóa học
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">ID</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase w-16">Anh</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Tên khóa học</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Giá</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Học viên</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Bài học</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Thời lượng</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(course => (
                <tr key={course.id} className="border-b border-white/[0.06]/50 hover:bg-white/[0.02]">
                  <td className="p-4 text-sm text-gray-400 font-mono">#{course.id}</td>
                  <td className="p-4">
                    {course.thumbnail ? (
                      <img
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-14 h-8 rounded object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-14 h-8 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <Link href={`/admin/courses/${course.id}`} className="text-sm text-white font-medium hover:text-teal transition-colors">
                      {course.title}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">{course.category}</div>
                  </td>
                  <td className="p-4 text-sm text-gold font-semibold">{formatPrice(course.price)}</td>
                  <td className="p-4 text-sm text-white">{course.enrollmentsCount.toLocaleString()}</td>
                  <td className="p-4 text-sm text-gray-400">{course.lessonsCount}</td>
                  <td className="p-4 text-sm text-gray-400">{formatDuration(course.duration)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {/* Edit button */}
                      <button
                        onClick={() => onEditCourse(course)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Chỉnh sửa"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={() => onDeleteCourse(course)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-teal/20 text-gray-400 hover:text-teal transition-colors"
                        title="Xóa"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      {/* Manage content link */}
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Quản lý nội dung"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
