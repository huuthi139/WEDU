'use client';

import { Fragment } from 'react';
import type { MemberLevel } from '@/lib/mockData';
import { formatPrice } from '@/lib/utils';

interface StudentEnrollment {
  courseId: string;
  courseName: string;
  progress: number;
}

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  memberLevel: MemberLevel;
  enrolledCourses: StudentEnrollment[];
  totalSpent: number;
  joinDate: string;
  status: 'Active' | 'Inactive';
  lastActive: string;
}

interface StudentsTabProps {
  students: Student[];
  filteredStudents: Student[];
  studentsLoading: boolean;
  studentFilter: 'all' | MemberLevel;
  setStudentFilter: (filter: 'all' | MemberLevel) => void;
  expandedStudent: string | null;
  setExpandedStudent: (id: string | null) => void;
  setShowAddCourseModal: (studentId: string | null) => void;
  handleRemoveCourse: (studentId: string, courseId: string) => void;
  LevelBadge: React.ComponentType<{ level: MemberLevel }>;
}

export function StudentsTab({
  students,
  filteredStudents,
  studentsLoading,
  studentFilter,
  setStudentFilter,
  expandedStudent,
  setExpandedStudent,
  setShowAddCourseModal,
  handleRemoveCourse,
  LevelBadge,
}: StudentsTabProps) {
  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Lọc theo hạng tài khoản:</span>
        {(['all', 'Free', 'Premium', 'VIP'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStudentFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              studentFilter === f ? 'bg-teal text-white' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'Tất cả' : f} {f !== 'all' && `(${students.filter(s => s.memberLevel === f).length})`}
          </button>
        ))}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/[0.06]">
          <h3 className="text-lg font-bold text-white">
            Học viên ({filteredStudents.length})
            {studentsLoading && <span className="text-sm text-gray-400 font-normal ml-2 animate-pulse">Đang tải...</span>}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase w-8"></th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">ID</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Học viên</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">SĐT</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Hạng</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Khóa học</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Chi tiêu</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Tham gia</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => {
                const isExpanded = expandedStudent === student.id;

                return (
                  <Fragment key={student.id}>
                    <tr
                      className="border-b border-white/[0.06]/50 hover:bg-white/[0.02] cursor-pointer"
                      onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                    >
                      <td className="p-4 text-center">
                        <svg
                          className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                      <td className="p-4 text-sm text-gray-400 font-mono">{student.id}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            student.memberLevel === 'VIP' ? 'bg-gradient-to-br from-gold to-amber-500' :
                            student.memberLevel === 'Premium' ? 'bg-teal' : 'bg-gray-600'
                          }`}>
                            <span className="text-white text-xs font-bold">{student.name.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="text-sm text-white font-medium">{student.name}</div>
                            <div className="text-xs text-gray-500">{student.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-400">{student.phone}</td>
                      <td className="p-4"><LevelBadge level={student.memberLevel} /></td>
                      <td className="p-4 text-sm text-white font-semibold">{student.enrolledCourses.length}</td>
                      <td className="p-4 text-sm text-gold font-semibold">
                        {student.totalSpent === 0 ? '-' : formatPrice(student.totalSpent)}
                      </td>
                      <td className="p-4 text-sm text-gray-400">{student.joinDate}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${student.status === 'Active' ? 'bg-green-500' : 'bg-gray-500'}`} />
                          <span className="text-sm text-gray-400">{student.status === 'Active' ? 'Hoạt động' : 'Ngưng'}</span>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded row: enrolled courses */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <div className="bg-dark/40 border-t border-white/[0.06]/50 px-8 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-xs font-semibold text-gray-400 uppercase">
                                Khóa học đã đăng ký ({student.enrolledCourses.length})
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowAddCourseModal(student.id); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal hover:bg-teal/80 text-white text-xs font-semibold rounded-lg transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Thêm khóa học
                              </button>
                            </div>
                            <div className="space-y-2">
                              {student.enrolledCourses.map(ec => (
                                <div
                                  key={ec.courseId}
                                  className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06]/50 rounded-lg px-4 py-3 group"
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-6 h-6 bg-white/5 rounded flex items-center justify-center flex-shrink-0">
                                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                      </svg>
                                    </div>
                                    <span className="text-sm text-white truncate">{ec.courseName}</span>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            ec.progress === 100 ? 'bg-green-500' :
                                            ec.progress >= 50 ? 'bg-gold' : 'bg-teal'
                                          }`}
                                          style={{ width: `${ec.progress}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-400 w-8 text-right">{ec.progress}%</span>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRemoveCourse(student.id, ec.courseId); }}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-teal bg-teal/10 hover:bg-teal/20 text-xs font-semibold transition-all"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Xóa
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {student.enrolledCourses.length === 0 && (
                                <div className="text-center py-4 text-sm text-gray-500">
                                  Chưa có khóa học nào
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
