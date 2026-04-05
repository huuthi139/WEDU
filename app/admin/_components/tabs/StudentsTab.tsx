'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { MemberLevel } from '@/lib/types';
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

interface CourseDetail {
  course_access_id: string;
  course_id: string;
  title: string;
  access_tier: string;
  activated_at: string | null;
  expires_at: string | null;
  status: string;
  source: string;
}

interface StudentsTabProps {
  students: Student[];
  filteredStudents: Student[];
  studentsLoading: boolean;
  studentsError: string | null;
  studentFilter: 'all' | MemberLevel;
  setStudentFilter: (filter: 'all' | MemberLevel) => void;
  expandedStudent: string | null;
  setExpandedStudent: (id: string | null) => void;
  setShowAddCourseModal: (studentId: string | null) => void;
  handleRemoveCourse: (studentId: string, courseId: string) => void;
  onRefresh: () => void;
  LevelBadge: React.ComponentType<{ level: MemberLevel }>;
}

function TierBadge({ tier }: { tier: string }) {
  const t = tier?.toLowerCase();
  if (t === 'vip') return <span className="px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r from-gold/20 to-amber-500/20 text-gold border border-gold/30">VIP</span>;
  if (t === 'premium') return <span className="px-2 py-0.5 rounded text-xs font-bold bg-teal/10 text-teal border border-teal/20">Premium</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-white/5 text-gray-400 border border-white/10">Free</span>;
}

function ExpiryStatus({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Vinh vien</span>;
  const expired = new Date(expiresAt) < new Date();
  if (expired) return <span className="flex items-center gap-1 text-xs text-red-400"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Het han</span>;
  return <span className="flex items-center gap-1 text-xs text-green-400"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Con han</span>;
}

export function StudentsTab({
  students,
  filteredStudents,
  studentsLoading,
  studentsError,
  studentFilter,
  setStudentFilter,
  expandedStudent,
  setExpandedStudent,
  setShowAddCourseModal,
  handleRemoveCourse,
  onRefresh,
  LevelBadge,
}: StudentsTabProps) {
  // Edit modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', member_level: 'Free', status: 'active' });
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm state
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Add member modal state
  const [showAddMember, setShowAddMember] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', password: '', memberLevel: 'Free' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Course details per expanded student
  const [courseDetails, setCourseDetails] = useState<CourseDetail[]>([]);
  const [courseDetailsLoading, setCourseDetailsLoading] = useState(false);

  // Course details for edit modal
  const [editCourseDetails, setEditCourseDetails] = useState<CourseDetail[]>([]);
  const [editCourseDetailsLoading, setEditCourseDetailsLoading] = useState(false);

  // Fetch course details for edit modal
  const fetchEditCourseDetails = useCallback(async (userId: string) => {
    setEditCourseDetailsLoading(true);
    setEditCourseDetails([]);
    try {
      const res = await fetch(`/api/admin/users/${userId}/courses`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.courses)) {
        setEditCourseDetails(data.courses);
      }
    } catch {
      // ignore
    } finally {
      setEditCourseDetailsLoading(false);
    }
  }, []);

  // Fetch course details when expanding a student
  const fetchCourseDetails = useCallback(async (userId: string) => {
    setCourseDetailsLoading(true);
    setCourseDetails([]);
    try {
      const res = await fetch(`/api/admin/users/${userId}/courses`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.courses)) {
        setCourseDetails(data.courses);
      }
    } catch {
      // ignore
    } finally {
      setCourseDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expandedStudent) {
      fetchCourseDetails(expandedStudent);
    } else {
      setCourseDetails([]);
    }
  }, [expandedStudent, fetchCourseDetails]);

  // Edit handlers
  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      phone: student.phone,
      member_level: student.memberLevel,
      status: student.status === 'Active' ? 'active' : 'inactive',
    });
    fetchEditCourseDetails(student.id);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editingStudent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditingStudent(null);
        onRefresh();
      } else {
        alert(`Loi: ${data.error}`);
      }
    } catch {
      alert('Khong the cap nhat. Vui long thu lai.');
    } finally {
      setEditSaving(false);
    }
  };

  // Delete handlers
  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingStudent.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setDeletingStudent(null);
        if (expandedStudent === deletingStudent.id) setExpandedStudent(null);
        onRefresh();
      } else {
        alert(`Loi: ${data.error}`);
      }
    } catch {
      alert('Khong the xoa. Vui long thu lai.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAddMember = async () => {
    setAddError('');
    if (!addForm.name.trim() || addForm.name.trim().length < 2) {
      setAddError('Ten phai co it nhat 2 ky tu');
      return;
    }
    if (!addForm.email.trim()) {
      setAddError('Vui long nhap email');
      return;
    }
    if (!addForm.password || addForm.password.length < 6) {
      setAddError('Mat khau phai co it nhat 6 ky tu');
      return;
    }
    setAddSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: addForm.name.trim(),
          email: addForm.email.trim(),
          phone: addForm.phone.trim(),
          password: addForm.password,
          memberLevel: addForm.memberLevel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddMember(false);
        setAddForm({ name: '', email: '', phone: '', password: '', memberLevel: 'Free' });
        onRefresh();
      } else {
        setAddError(data.error || 'Khong the tao tai khoan');
      }
    } catch {
      setAddError('Loi ket noi. Vui long thu lai.');
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Empty state with import link */}
      {(students.length === 0 && !studentsLoading) && (
        <div className="bg-teal/10 border border-teal/20 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-teal/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-white font-semibold mb-1">Chua co hoc vien nao</h4>
              <p className="text-sm text-gray-400 mb-3">
                Ban co the import danh sach hoc vien tu Google Sheets qua trang Import.
              </p>
              <Link
                href="/admin/import"
                className="px-4 py-2 bg-teal hover:bg-teal/80 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Di den trang Import
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Filter + Refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Loc theo hang tai khoan:</span>
          {(['all', 'Free', 'Premium', 'VIP'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStudentFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                studentFilter === f ? 'bg-teal text-white' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'Tat ca' : f} {f !== 'all' && `(${students.filter(s => s.memberLevel === f).length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal text-white hover:bg-teal/80 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Them thanh vien
          </button>
          <button
            onClick={onRefresh}
            disabled={studentsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${studentsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Lam moi
          </button>
        </div>
      </div>

      {/* Error message */}
      {studentsError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-300">{studentsError}</span>
          </div>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            Thu lai
          </button>
        </div>
      )}

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/[0.06]">
          <h3 className="text-lg font-bold text-white">
            Hoc vien ({filteredStudents.length})
            {studentsLoading && <span className="text-sm text-gray-400 font-normal ml-2 animate-pulse">Dang tai...</span>}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase w-8"></th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Hoc vien</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">SDT</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Hang</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Khoa hoc</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Tham gia</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Trang thai</th>
                <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase w-24">Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 && !studentsLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 text-sm">
                    {studentsError ? 'Khong the tai du lieu hoc vien.' : 'Chua co hoc vien nao.'}
                  </td>
                </tr>
              )}
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
                      <td className="p-4 text-sm text-gray-400">{student.joinDate}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${student.status === 'Active' ? 'bg-green-500' : 'bg-gray-500'}`} />
                          <span className="text-sm text-gray-400">{student.status === 'Active' ? 'Hoat dong' : 'Ngung'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => openEdit(student)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-teal transition-colors"
                            title="Sua hoc vien"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeletingStudent(student)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                            title="Xoa hoc vien"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded row: course details with tier + expiry */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div className="bg-dark/40 border-t border-white/[0.06]/50 px-8 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-xs font-semibold text-gray-400 uppercase">
                                Khoa hoc da dang ky ({courseDetails.length})
                                {courseDetailsLoading && <span className="ml-2 animate-pulse">Dang tai...</span>}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowAddCourseModal(student.id); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal hover:bg-teal/80 text-white text-xs font-semibold rounded-lg transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Them khoa hoc
                              </button>
                            </div>
                            <div className="space-y-2">
                              {courseDetails.map(cd => (
                                <div
                                  key={cd.course_access_id}
                                  className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06]/50 rounded-lg px-4 py-3 group"
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-6 h-6 bg-white/5 rounded flex items-center justify-center flex-shrink-0">
                                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                      </svg>
                                    </div>
                                    <span className="text-sm text-white truncate">{cd.title}</span>
                                    <TierBadge tier={cd.access_tier} />
                                  </div>
                                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                                    <div className="text-xs text-gray-500">
                                      {cd.activated_at ? new Date(cd.activated_at).toLocaleDateString('vi-VN') : '-'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {cd.expires_at ? new Date(cd.expires_at).toLocaleDateString('vi-VN') : 'Vinh vien'}
                                    </div>
                                    <ExpiryStatus expiresAt={cd.expires_at} />
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRemoveCourse(student.id, cd.course_id); }}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold transition-all"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Xoa
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {!courseDetailsLoading && courseDetails.length === 0 && (
                                <div className="text-center py-4 text-sm text-gray-500">
                                  Chua co khoa hoc nao
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

      {/* ===== EDIT STUDENT MODAL ===== */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setEditingStudent(null)} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Chinh sua hoc vien</h3>
                <button onClick={() => setEditingStudent(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                  <input type="text" disabled value={editingStudent.email} className="w-full bg-dark/50 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Ten</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">So dien thoai</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Hang tai khoan</label>
                  <select
                    value={editForm.member_level}
                    onChange={e => setEditForm(prev => ({ ...prev, member_level: e.target.value }))}
                    className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
                  >
                    <option value="Free">Free</option>
                    <option value="Premium">Premium</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Trang thai</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Course management section in edit modal */}
              <div className="mt-6 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">Khoa hoc da dang ky ({editCourseDetails.length})</label>
                  <button
                    onClick={() => setShowAddCourseModal(editingStudent.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-teal/10 hover:bg-teal/20 text-teal text-xs font-semibold rounded-lg transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Them khoa hoc
                  </button>
                </div>
                {editCourseDetailsLoading ? (
                  <div className="text-center py-3">
                    <span className="text-xs text-gray-400 animate-pulse">Dang tai...</span>
                  </div>
                ) : editCourseDetails.length === 0 ? (
                  <div className="text-center py-3">
                    <span className="text-xs text-gray-500">Chua co khoa hoc nao</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {editCourseDetails.map(cd => (
                      <div
                        key={cd.course_access_id}
                        className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span className="text-xs text-white truncate">{cd.title}</span>
                          <TierBadge tier={cd.access_tier} />
                        </div>
                        <button
                          onClick={() => {
                            handleRemoveCourse(editingStudent.id, cd.course_id);
                            // Refresh edit modal courses after a short delay
                            setTimeout(() => fetchEditCourseDetails(editingStudent.id), 500);
                          }}
                          className="flex-shrink-0 ml-2 w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                          title="Xoa khoa hoc"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/[0.06]">
                <button
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 text-sm font-semibold hover:bg-white/5 transition-colors"
                >
                  Huy
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving || !editForm.name.trim()}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editSaving ? 'Dang luu...' : 'Cap nhat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRM MODAL ===== */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => setDeletingStudent(null)} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Xoa hoc vien</h3>
                  <p className="text-sm text-gray-400">Hanh dong nay khong the hoan tac</p>
                </div>
              </div>
              <div className="bg-dark/50 border border-white/[0.06] rounded-lg p-4 mb-4">
                <div className="text-sm text-white font-medium">{deletingStudent.name}</div>
                <div className="text-xs text-gray-500 mt-1">{deletingStudent.email}</div>
              </div>
              <p className="text-sm text-gray-300 mb-6">
                Xoa hoc vien nay? Toan bo quyen truy cap khoa hoc se bi xoa. Don hang (lich su) se duoc giu lai.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeletingStudent(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 text-sm font-semibold hover:bg-white/5 transition-colors"
                >
                  Huy
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleteLoading ? 'Dang xoa...' : 'Xac nhan xoa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD MEMBER MODAL ===== */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={() => { setShowAddMember(false); setAddError(''); }} />
          <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">Them thanh vien moi</h3>
                </div>
                <button onClick={() => { setShowAddMember(false); setAddError(''); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {addError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-red-300">{addError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Ho ten <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nguyen Van A"
                    className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Email <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Mat khau <span className="text-red-400">*</span></label>
                  <input
                    type="password"
                    value={addForm.password}
                    onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="It nhat 6 ky tu"
                    className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">So dien thoai</label>
                  <input
                    type="text"
                    value={addForm.phone}
                    onChange={e => setAddForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0901234567"
                    className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors placeholder:text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Hang tai khoan</label>
                  <select
                    value={addForm.memberLevel}
                    onChange={e => setAddForm(prev => ({ ...prev, memberLevel: e.target.value }))}
                    className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
                  >
                    <option value="Free">Free</option>
                    <option value="Premium">Premium</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/[0.06]">
                <button
                  onClick={() => { setShowAddMember(false); setAddError(''); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 text-sm font-semibold hover:bg-white/5 transition-colors"
                >
                  Huy
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={addSaving || !addForm.name.trim() || !addForm.email.trim() || !addForm.password}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Dang tao...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Them thanh vien
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
