'use client';

import { useState, useEffect, Fragment, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCourses } from '@/contexts/CoursesContext';
import { useEnrollment, type Order } from '@/contexts/EnrollmentContext';
import type { Course } from '@/lib/mockData';
import type { MemberLevel } from '@/lib/mockData';
import { formatPrice, formatDuration } from '@/lib/utils';
import { OverviewTab } from './_components/tabs/OverviewTab';
import { CoursesTab } from './_components/tabs/CoursesTab';
import { StudentsTab } from './_components/tabs/StudentsTab';
import { OrdersTab } from './_components/tabs/OrdersTab';
import { StaffTab } from './_components/tabs/StaffTab';

type Tab = 'overview' | 'courses' | 'students' | 'orders' | 'staff';

/* ============================================================
   STUDENT INTERFACES & MOCK DATA
   ============================================================ */

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

// Google Sheets user row from API
interface SheetUser {
  Email: string;
  Role: string;
  'Tên': string;
  Level: string;
  Phone: string;
}

/* ============================================================
   ORDERS DATA
   ============================================================ */

// Orders are now loaded from EnrollmentContext

/* ============================================================
   INLINE COMPONENTS
   ============================================================ */

function LevelBadge({ level }: { level: MemberLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
      level === 'VIP' ? 'bg-gradient-to-r from-gold/20 to-amber-500/20 text-gold border border-gold/30' :
      level === 'Premium' ? 'bg-teal/10 text-teal border border-teal/20' :
      'bg-white/5 text-gray-400 border border-white/10'
    }`}>
      {level === 'VIP' && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      {level === 'Premium' && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      )}
      {level}
    </span>
  );
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white/[0.03] border border-white/[0.06] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   COURSE FORM TYPES
   ============================================================ */

interface CourseFormData {
  title: string;
  instructor: string;
  category: string;
  price: number;
  lessonsCount: number;
  thumbnail: string;
}

const emptyCourseForm: CourseFormData = {
  title: '',
  instructor: 'WEDU',
  category: '',
  price: 0,
  lessonsCount: 0,
  thumbnail: '',
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ------- Course CRUD state -------
  const { courses: sheetCourses } = useCourses();
  const { orders: enrollmentOrders, updateOrderStatus } = useEnrollment();

  // Map enrollment orders for admin display
  const recentOrders = enrollmentOrders.map(o => ({
    id: o.id,
    name: o.name,
    email: o.email,
    course: o.courses.map(c => c.title).join(', '),
    amount: o.total,
    status: o.status,
    date: new Date(o.date).toLocaleDateString('vi-VN'),
    method: o.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : o.paymentMethod === 'momo' ? 'MoMo' : 'VNPay',
  }));
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState<CourseFormData>(emptyCourseForm);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // ------- Students state -------
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentFilter, setStudentFilter] = useState<'all' | MemberLevel>('all');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [showAddCourseModal, setShowAddCourseModal] = useState<string | null>(null); // studentId

  /** Map raw user rows to Student objects */
  const mapUsersToStudents = useCallback((users: SheetUser[]): Student[] => {
    return users.map((u: SheetUser, i: number) => ({
      id: `user-${i + 1}`,
      name: u['Tên'] || u.Email?.split('@')[0] || 'N/A',
      email: u.Email || '',
      phone: u.Phone || '',
      memberLevel: (['Free', 'Premium', 'VIP'].includes(u.Level) ? u.Level : 'Free') as MemberLevel,
      enrolledCourses: [],
      totalSpent: 0,
      joinDate: '-',
      status: 'Active' as const,
      lastActive: '-',
    }));
  }, []);

  /** Fetch students from API with fallback to direct GAS */
  const fetchStudents = useCallback(async () => {
    setStudentsLoading(true);
    setStudentsError(null);
    const errors: string[] = [];

    try {
      // Try server API first (with admin role header as fallback auth)
      const savedUser = localStorage.getItem('wedu-user');
      const userRole = savedUser ? (JSON.parse(savedUser).role || 'user') : 'user';

      // Try POST first (more reliable for sending auth headers), then GET as fallback
      let data: { success?: boolean; users?: SheetUser[]; error?: string } | null = null;

      try {
        const res = await fetch('/api/auth/users', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': userRole,
          },
        });
        data = await res.json();
      } catch {
        // POST failed, try GET
        try {
          const res = await fetch('/api/auth/users', {
            cache: 'no-store',
            headers: { 'x-user-role': userRole },
          });
          data = await res.json();
        } catch (getErr) {
          errors.push(`API: ${getErr instanceof Error ? getErr.message : 'network error'}`);
        }
      }

      if (data?.success && Array.isArray(data.users) && data.users.length > 0) {
        setStudents(mapUsersToStudents(data.users));
        return;
      }

      if (data?.error) {
        errors.push(`API: ${data.error}`);
      }

      // If API returned 403, empty, or error, try direct Google Apps Script as last resort
      const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
      if (scriptUrl) {
        try {
          const gasRes = await fetch(`${scriptUrl}?action=getUsers`, {
            redirect: 'follow',
            cache: 'no-store',
          });
          const gasText = await gasRes.text();
          let gasData: { success?: boolean; users?: SheetUser[] } | null = null;
          try {
            gasData = JSON.parse(gasText);
          } catch {
            errors.push('GAS: invalid JSON response');
          }

          if (gasData?.success && Array.isArray(gasData.users) && gasData.users.length > 0) {
            setStudents(mapUsersToStudents(gasData.users));
            return;
          }
          errors.push('GAS: 0 users returned');
        } catch (gasErr) {
          errors.push(`GAS: ${gasErr instanceof Error ? gasErr.message : 'network error'}`);
        }
      }

      // If we got here, no data from any source
      if (errors.length > 0) {
        setStudentsError(`Không tải được danh sách học viên: ${errors.join('; ')}`);
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
      setStudentsError(`Lỗi tải học viên: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setStudentsLoading(false);
    }
  }, [mapUsersToStudents]);

  // Fetch students on mount
  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Save a single course to Supabase via API
  const saveCourseToAPI = useCallback(async (course: Course) => {
    try {
      const savedUser = localStorage.getItem('wedu-user');
      const userRole = savedUser ? (JSON.parse(savedUser).role || 'user') : 'user';
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': userRole },
        body: JSON.stringify({
          id: course.id,
          title: course.title,
          description: course.description || '',
          thumbnail: course.thumbnail || '',
          instructor: course.instructor,
          category: course.category,
          price: course.price,
          originalPrice: course.originalPrice,
          rating: course.rating,
          reviewsCount: course.reviewsCount,
          enrollmentsCount: course.enrollmentsCount,
          duration: course.duration,
          lessonsCount: course.lessonsCount,
          badge: course.badge,
          memberLevel: course.memberLevel,
        }),
      });
      const data = await res.json();
      return data.success;
    } catch {
      return false;
    }
  }, []);

  // Delete a course via API
  const deleteCourseFromAPI = useCallback(async (courseId: string) => {
    try {
      const savedUser = localStorage.getItem('wedu-user');
      const userRole = savedUser ? (JSON.parse(savedUser).role || 'user') : 'user';
      const res = await fetch(`/api/admin/courses?id=${courseId}`, {
        method: 'DELETE',
        headers: { 'x-user-role': userRole },
      });
      const data = await res.json();
      return data.success;
    } catch {
      return false;
    }
  }, []);

  // Update courses state
  const updateCourses = useCallback((updater: (prev: Course[]) => Course[]) => {
    setCourses(prev => updater(prev));
  }, []);

  // Manual save - sync all courses to Supabase
  const handleManualSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const results = await Promise.all(courses.map(c => saveCourseToAPI(c)));
      const allOk = results.every(Boolean);
      setSaveStatus(allOk ? 'saved' : 'error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  }, [courses, saveCourseToAPI]);

  // Load courses from context (which reads from API → Supabase/Google Sheets)
  useEffect(() => {
    if (sheetCourses.length === 0) return;
    setCourses(sheetCourses);
  }, [sheetCourses]);

  // ------- Computed values -------
  const totalRevenue = recentOrders.filter(o => o.status === 'Hoàn thành').reduce((sum, o) => sum + o.amount, 0);

  // Total registered accounts (all users from API)
  const registeredCount = students.length;

  // Học viên = users who have enrolled in at least one course or appear in orders
  const orderEmails = new Set(enrollmentOrders.map(o => o.email.toLowerCase()));
  const actualStudentsCount = students.filter(
    s => s.enrolledCourses.length > 0 || orderEmails.has(s.email.toLowerCase())
  ).length;

  // Count by membership level
  const freeCount = students.filter(s => s.memberLevel === 'Free').length;
  const premiumCount = students.filter(s => s.memberLevel === 'Premium').length;
  const vipCount = students.filter(s => s.memberLevel === 'VIP').length;

  // Filtered students by account level
  const filteredStudents = studentFilter === 'all'
    ? students
    : students.filter(s => s.memberLevel === studentFilter);

  /* ------- Student course management ------- */
  const handleRemoveCourse = (studentId: string, courseId: string) => {
    setStudents(prev => prev.map(s =>
      s.id === studentId
        ? { ...s, enrolledCourses: s.enrolledCourses.filter(ec => ec.courseId !== courseId) }
        : s
    ));
  };

  const handleAddCourseToStudent = (studentId: string, courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    setStudents(prev => prev.map(s =>
      s.id === studentId
        ? {
            ...s,
            enrolledCourses: [...s.enrolledCourses, { courseId, courseName: course.title, progress: 0 }],
          }
        : s
    ));
    setShowAddCourseModal(null);
  };

  /* ------- Course CRUD handlers ------- */

  const openAddCourse = () => {
    setEditingCourse(null);
    setCourseForm(emptyCourseForm);
    setThumbnailError(null);
    setShowCourseModal(true);
  };

  const handleThumbnailUpload = async (file: File) => {
    setThumbnailError(null);

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setThumbnailError('Chi chap nhan JPG, PNG hoac WebP');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setThumbnailError('Anh qua lon. Toi da 5MB');
      return;
    }

    // Validate dimensions client-side
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      // Warn if not 16:9 ratio or too small
      const ratio = img.width / img.height;
      if (ratio < 1.5 || ratio > 1.9) {
        setThumbnailError(`Kich thuoc ${img.width}x${img.height} - Nen dung ty le 16:9 (1280x720)`);
      }
      if (img.width < 640) {
        setThumbnailError('Anh qua nho. Nen dung toi thieu 1280x720');
      }

      // Upload
      setThumbnailUploading(true);
      try {
        const formData = new FormData();
        formData.append('thumbnail', file);

        const res = await fetch('/api/upload/thumbnail', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (data.success) {
          setCourseForm(prev => ({ ...prev, thumbnail: data.url }));
          setThumbnailError(null);
        } else {
          setThumbnailError(data.error || 'Upload that bai');
        }
      } catch {
        setThumbnailError('Loi ket noi - khong the tai anh len');
      } finally {
        setThumbnailUploading(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setThumbnailError('Khong the doc file anh');
    };
  };

  const openEditCourse = (course: Course) => {
    setEditingCourse(course);
    setThumbnailError(null);
    setCourseForm({
      title: course.title,
      instructor: course.instructor,
      category: course.category,
      price: course.price,
      lessonsCount: course.lessonsCount,
      thumbnail: course.thumbnail || '',
    });
    setShowCourseModal(true);
  };

  const handleSaveCourse = async () => {
    if (!courseForm.title.trim() || !courseForm.category.trim()) return;

    setSaveStatus('saving');

    if (editingCourse) {
      // Update existing course
      const updatedCourse: Course = {
        ...editingCourse,
        title: courseForm.title,
        instructor: courseForm.instructor,
        category: courseForm.category,
        price: courseForm.price,
        lessonsCount: courseForm.lessonsCount,
        isFree: courseForm.price === 0,
        thumbnail: courseForm.thumbnail || editingCourse.thumbnail,
      };
      updateCourses(prev => prev.map(c => c.id === editingCourse.id ? updatedCourse : c));
      const ok = await saveCourseToAPI(updatedCourse);
      setSaveStatus(ok ? 'saved' : 'error');
    } else {
      // Add new course
      const newId = String(Math.max(...courses.map(c => parseInt(c.id) || 0), 0) + 1);
      const newCourse: Course = {
        id: newId,
        thumbnail: courseForm.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=450&fit=crop',
        title: courseForm.title,
        description: '',
        instructor: courseForm.instructor,
        category: courseForm.category,
        price: courseForm.price,
        originalPrice: undefined,
        rating: 0,
        reviewsCount: 0,
        enrollmentsCount: 0,
        duration: 0,
        lessonsCount: courseForm.lessonsCount,
        isFree: courseForm.price === 0,
        memberLevel: 'Free',
      };
      updateCourses(prev => [...prev, newCourse]);
      const ok = await saveCourseToAPI(newCourse);
      setSaveStatus(ok ? 'saved' : 'error');
    }

    setTimeout(() => setSaveStatus('idle'), 2500);
    setShowCourseModal(false);
    setEditingCourse(null);
    setCourseForm(emptyCourseForm);
  };

  const openDeleteCourse = (course: Course) => {
    setDeletingCourse(course);
    setShowDeleteModal(true);
  };

  const handleDeleteCourse = async () => {
    if (!deletingCourse) return;
    updateCourses(prev => prev.filter(c => c.id !== deletingCourse.id));
    await deleteCourseFromAPI(deletingCourse.id);
    setShowDeleteModal(false);
    setDeletingCourse(null);
  };

  /* ------- Tabs config ------- */

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'overview', label: 'Tổng quan',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    },
    {
      key: 'courses', label: 'Khóa học',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    },
    {
      key: 'students', label: 'Học viên',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
      key: 'orders', label: 'Đơn hàng',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    },
    {
      key: 'staff', label: 'Nhân sự',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    },
  ];

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-teal rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Quản trị Admin</h1>
                <p className="text-sm text-gray-400">Quản lý học viên, khóa học và đơn hàng</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualSave}
              disabled={saveStatus === 'saving'}
              className={`inline-flex items-center gap-2 h-10 px-5 rounded-lg font-bold text-sm transition-all duration-200 ${
                saveStatus === 'saved'
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : saveStatus === 'error'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                  : saveStatus === 'saving'
                  ? 'bg-teal/50 text-white cursor-wait'
                  : 'bg-teal text-white hover:bg-teal/80 shadow-lg shadow-teal/20'
              }`}
            >
              {saveStatus === 'saved' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Đã lưu
                </>
              ) : saveStatus === 'saving' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang lưu...
                </>
              ) : saveStatus === 'error' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                  </svg>
                  Lỗi lưu
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Lưu
                </>
              )}
            </button>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Dashboard học viên
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/10 mb-8">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold transition-colors relative whitespace-nowrap ${
                  activeTab === tab.key ? 'text-teal' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal" />}
              </button>
            ))}
          </div>
        </div>

        {/* ============ OVERVIEW TAB ============ */}
        {activeTab === 'overview' && (
          <OverviewTab
            totalRevenue={totalRevenue}
            registeredCount={registeredCount}
            studentsCount={actualStudentsCount}
            coursesCount={courses.length}
            ordersCount={recentOrders.length}
            vipCount={vipCount}
            premiumCount={premiumCount}
            freeCount={freeCount}
            recentOrders={recentOrders}
            onViewAllOrders={() => setActiveTab('orders')}
            LevelBadge={LevelBadge}
          />
        )}

        {/* ============ COURSES TAB (CRUD) ============ */}
        {activeTab === 'courses' && (
          <CoursesTab
            courses={courses}
            onAddCourse={openAddCourse}
            onEditCourse={openEditCourse}
            onDeleteCourse={openDeleteCourse}
          />
        )}

        {/* ============ STUDENTS TAB (per-course level) ============ */}
        {activeTab === 'students' && (
          <StudentsTab
            students={students}
            filteredStudents={filteredStudents}
            studentsLoading={studentsLoading}
            studentsError={studentsError}
            studentFilter={studentFilter}
            setStudentFilter={setStudentFilter}
            expandedStudent={expandedStudent}
            setExpandedStudent={setExpandedStudent}
            setShowAddCourseModal={setShowAddCourseModal}
            handleRemoveCourse={handleRemoveCourse}
            onRefresh={fetchStudents}
            LevelBadge={LevelBadge}
          />
        )}

        {/* ============ ORDERS TAB ============ */}
        {activeTab === 'orders' && (
          <OrdersTab
            recentOrders={recentOrders}
            updateOrderStatus={updateOrderStatus}
          />
        )}

        {/* ============ STAFF TAB ============ */}
        {activeTab === 'staff' && (
          <StaffTab isMainAdmin={true} />
        )}
      </div>

      {/* ============ ADD/EDIT COURSE MODAL ============ */}
      <Modal open={showCourseModal} onClose={() => { setShowCourseModal(false); setEditingCourse(null); }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">
              {editingCourse ? 'Chỉnh sửa khóa học' : 'Thêm khóa học mới'}
            </h3>
            <button
              onClick={() => { setShowCourseModal(false); setEditingCourse(null); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Thumbnail Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Thumbnail khoa hoc
                <span className="text-xs text-gray-500 ml-2">Kich thuoc chuan: 1280x720 (16:9)</span>
              </label>

              {/* Preview */}
              {courseForm.thumbnail && (
                <div className="relative mb-3 rounded-lg overflow-hidden border border-white/[0.06] group">
                  <img
                    src={courseForm.thumbnail}
                    alt="Course thumbnail"
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute inset-0 bg-dark/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      className="px-3 py-1.5 bg-teal rounded-lg text-white text-xs font-semibold hover:bg-teal/80 transition-colors"
                    >
                      Thay doi
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseForm(prev => ({ ...prev, thumbnail: '' }))}
                      className="px-3 py-1.5 bg-red-500/80 rounded-lg text-white text-xs font-semibold hover:bg-red-500 transition-colors"
                    >
                      Xoa
                    </button>
                  </div>
                </div>
              )}

              {/* Upload area */}
              {!courseForm.thumbnail && (
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    thumbnailUploading
                      ? 'border-teal/50 bg-teal/5'
                      : 'border-gray-700 hover:border-teal/50 hover:bg-white/[0.02]'
                  }`}
                  onClick={() => !thumbnailUploading && thumbnailInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file) handleThumbnailUpload(file);
                  }}
                >
                  {thumbnailUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-teal animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm text-teal">Dang tai len...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <span className="text-sm text-teal font-medium">Click de chon anh</span>
                        <span className="text-sm text-gray-500"> hoac keo tha vao day</span>
                      </div>
                      <span className="text-xs text-gray-600">JPG, PNG, WebP - Toi da 5MB - Nen 1280x720</span>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleThumbnailUpload(file);
                  e.target.value = '';
                }}
              />

              {/* URL input alternative */}
              <div className="mt-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span>hoac dan link anh</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <input
                  type="url"
                  value={courseForm.thumbnail}
                  onChange={e => setCourseForm(prev => ({ ...prev, thumbnail: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-dark border border-gray-700 rounded-lg px-3 py-2 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
                />
              </div>

              {/* Error message */}
              {thumbnailError && (
                <p className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  {thumbnailError}
                </p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Ten khoa hoc</label>
              <input
                type="text"
                value={courseForm.title}
                onChange={e => setCourseForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Nhap ten khoa hoc..."
                className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
              />
            </div>

            {/* Instructor */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Giảng viên</label>
              <input
                type="text"
                value={courseForm.instructor}
                onChange={e => setCourseForm(prev => ({ ...prev, instructor: e.target.value }))}
                placeholder="Nhập tên giảng viên..."
                className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Danh mục</label>
              <input
                type="text"
                value={courseForm.category}
                onChange={e => setCourseForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="VD: AI, Business, Marketing..."
                className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Giá (VND)</label>
              <input
                type="number"
                value={courseForm.price}
                onChange={e => setCourseForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                placeholder="0"
                min={0}
                className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
              />
            </div>

            {/* Lessons Count */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Số bài học</label>
              <input
                type="number"
                value={courseForm.lessonsCount}
                onChange={e => setCourseForm(prev => ({ ...prev, lessonsCount: Number(e.target.value) }))}
                placeholder="0"
                min={0}
                className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => { setShowCourseModal(false); setEditingCourse(null); }}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 text-sm font-semibold hover:bg-white/5 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSaveCourse}
              disabled={!courseForm.title.trim() || !courseForm.category.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingCourse ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ============ DELETE CONFIRMATION MODAL ============ */}
      <Modal open={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeletingCourse(null); }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-teal/20 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Xác nhận xóa</h3>
              <p className="text-sm text-gray-400">Hành động này không thể hoàn tác</p>
            </div>
          </div>

          {deletingCourse && (
            <div className="bg-dark/50 border border-white/[0.06] rounded-lg p-4 mb-6">
              <div className="text-sm text-white font-medium">{deletingCourse.title}</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-500">{deletingCourse.enrollmentsCount.toLocaleString()} học viên</span>
                <span className="text-xs text-gold">{formatPrice(deletingCourse.price)}</span>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-300 mb-6">
            Bạn có chắc chắn muốn xóa khóa học <span className="text-white font-semibold">&quot;{deletingCourse?.title}&quot;</span>? Tất cả dữ liệu liên quan sẽ bị mất vĩnh viễn.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowDeleteModal(false); setDeletingCourse(null); }}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 text-sm font-semibold hover:bg-white/5 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleDeleteCourse}
              className="flex-1 px-4 py-2.5 rounded-lg bg-teal text-white text-sm font-semibold hover:bg-teal/80 transition-colors"
            >
              Xóa khóa học
            </button>
          </div>
        </div>
      </Modal>

      {/* ============ ADD COURSE TO STUDENT MODAL ============ */}
      {showAddCourseModal && (() => {
        const student = students.find(s => s.id === showAddCourseModal);
        if (!student) return null;
        const enrolledIds = new Set(student.enrolledCourses.map(ec => ec.courseId));
        const availableCourses = courses.filter(c => !enrolledIds.has(c.id));
        return (
          <Modal open onClose={() => setShowAddCourseModal(null)}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Thêm khóa học</h3>
                  <p className="text-sm text-gray-400 mt-1">Cho học viên: {student.name}</p>
                </div>
                <button onClick={() => setShowAddCourseModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {availableCourses.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Học viên đã đăng ký tất cả khóa học</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableCourses.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleAddCourseToStudent(student.id, c.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-lg hover:border-teal/50 hover:bg-teal/5 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate">{c.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{c.category} &middot; {formatPrice(c.price)}</div>
                      </div>
                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      <Footer />
    </div>
  );
}
