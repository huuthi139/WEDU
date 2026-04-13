'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { Course } from '@/lib/types';
import { formatPrice, formatDuration } from '@/lib/utils';

interface EnrolledStudent {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  access_tier: string;
  status: string;
  activated_at: string | null;
}

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
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const searchedCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase();
    return courses.filter(c => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [courses, searchQuery]);

  // Student management modal state
  const [manageCourse, setManageCourse] = useState<Course | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [enrolledLoading, setEnrolledLoading] = useState(false);
  const [addStudentEmail, setAddStudentEmail] = useState('');
  const [addStudentLoading, setAddStudentLoading] = useState(false);
  const [addStudentError, setAddStudentError] = useState('');
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  const fetchEnrolledStudents = useCallback(async (courseId: string) => {
    setEnrolledLoading(true);
    try {
      const res = await fetch(`/api/admin/course-access?course_id=${courseId}&status=active&limit=200`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEnrolledStudents(data.data);
      }
    } catch {
      // ignore
    } finally {
      setEnrolledLoading(false);
    }
  }, []);

  const openManageStudents = (course: Course) => {
    setManageCourse(course);
    setAddStudentEmail('');
    setAddStudentError('');
    fetchEnrolledStudents(course.id);
  };

  const handleAddStudentByCourse = async () => {
    if (!manageCourse || !addStudentEmail.trim()) return;
    setAddStudentLoading(true);
    setAddStudentError('');
    try {
      // First lookup user by email
      const lookupRes = await fetch(`/api/admin/course-access?email=${encodeURIComponent(addStudentEmail.trim())}&limit=1`, {
        credentials: 'include',
      });
      // We need to find the user_id from users table
      const usersRes = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const usersData = await usersRes.json();
      if (!usersData.success || !Array.isArray(usersData.users)) {
        setAddStudentError('Khong the tai danh sach hoc vien');
        return;
      }
      const user = usersData.users.find((u: any) => u.Email?.toLowerCase() === addStudentEmail.trim().toLowerCase());
      if (!user) {
        setAddStudentError('Khong tim thay hoc vien voi email nay');
        return;
      }

      // Grant course access
      const res = await fetch('/api/admin/course-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: user.id, course_id: manageCourse.id }),
      });
      const data = await res.json();
      if (!data.success) {
        setAddStudentError(data.error || 'Khong the them hoc vien');
        return;
      }
      setAddStudentEmail('');
      fetchEnrolledStudents(manageCourse.id);
    } catch {
      setAddStudentError('Loi ket noi');
    } finally {
      setAddStudentLoading(false);
    }
  };

  const handleRemoveStudentFromCourse = async (userId: string, courseId: string) => {
    setRemoveLoading(userId);
    try {
      const res = await fetch('/api/admin/course-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, course_id: courseId, action: 'revoke' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchEnrolledStudents(courseId);
      } else {
        alert(`Loi: ${data.error}`);
      }
    } catch {
      alert('Khong the xoa. Thu lai.');
    } finally {
      setRemoveLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-lg font-bold text-white">Khoa hoc ({searchedCourses.length}{searchQuery ? ` / ${courses.length}` : ''})</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tim kiem..."
                className="h-8 w-48 px-3 pl-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          <button
            onClick={onAddCourse}
            className="flex items-center gap-2 bg-teal hover:bg-teal/80 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Them khoa hoc
          </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">ID</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase w-16">Anh</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Ten khoa hoc</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Gia</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Hoc vien</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Bai hoc</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Thoi luong</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Hanh dong</th>
              </tr>
            </thead>
            <tbody>
              {searchedCourses.map(course => (
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
                  <td className="p-4">
                    <button
                      onClick={() => openManageStudents(course)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-teal/10 text-white hover:text-teal transition-colors text-sm font-semibold group"
                      title="Quan ly hoc vien"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-teal transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                      {course.enrollmentsCount.toLocaleString()}
                    </button>
                  </td>
                  <td className="p-4 text-sm text-gray-400">{course.lessonsCount}</td>
                  <td className="p-4 text-sm text-gray-400">{formatDuration(course.duration)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditCourse(course)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Chinh sua"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteCourse(course)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-teal/20 text-gray-400 hover:text-teal transition-colors"
                        title="Xoa"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        title="Quan ly noi dung"
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

      {/* ===== MANAGE STUDENTS MODAL ===== */}
      {manageCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setManageCourse(null)} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-white/[0.06] flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Quan ly hoc vien</h3>
                  <p className="text-sm text-gray-400 mt-1">{manageCourse.title}</p>
                </div>
                <button onClick={() => setManageCourse(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Add student by email */}
              <div className="mt-4 flex gap-2">
                <input
                  type="email"
                  value={addStudentEmail}
                  onChange={e => { setAddStudentEmail(e.target.value); setAddStudentError(''); }}
                  placeholder="Nhap email hoc vien..."
                  className="flex-1 bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors placeholder:text-gray-600"
                  onKeyDown={e => e.key === 'Enter' && handleAddStudentByCourse()}
                />
                <button
                  onClick={handleAddStudentByCourse}
                  disabled={addStudentLoading || !addStudentEmail.trim()}
                  className="px-4 py-2.5 bg-teal hover:bg-teal/80 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {addStudentLoading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  Them
                </button>
              </div>
              {addStudentError && (
                <p className="text-xs text-red-400 mt-2">{addStudentError}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {enrolledLoading ? (
                <div className="text-center py-8">
                  <svg className="w-6 h-6 text-teal animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm text-gray-400">Dang tai...</p>
                </div>
              ) : enrolledStudents.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
                  </svg>
                  <p className="text-sm text-gray-400">Chua co hoc vien nao</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
                    {enrolledStudents.length} hoc vien da dang ky
                  </div>
                  {enrolledStudents.map(student => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-teal/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-teal text-xs font-bold">
                            {(student.user_name || student.user_email || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate">
                            {student.user_name || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{student.user_email}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${
                          student.access_tier === 'vip'
                            ? 'bg-gradient-to-r from-gold/20 to-amber-500/20 text-gold border border-gold/30'
                            : student.access_tier === 'premium'
                            ? 'bg-teal/10 text-teal border border-teal/20'
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}>
                          {student.access_tier?.toUpperCase() || 'FREE'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <span className="text-xs text-gray-500">
                          {student.activated_at ? new Date(student.activated_at).toLocaleDateString('vi-VN') : '-'}
                        </span>
                        <button
                          onClick={() => handleRemoveStudentFromCourse(student.user_id, manageCourse.id)}
                          disabled={removeLoading === student.user_id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          {removeLoading === student.user_id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                          Xoa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
