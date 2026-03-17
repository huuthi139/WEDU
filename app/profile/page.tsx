'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/providers/ToastProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useEnrollment } from '@/contexts/EnrollmentContext';

export default function Profile() {
  const { showToast } = useToast();
  const { user, isLoading, updateUser } = useAuth();
  const { enrollments, completedCoursesCount, totalHoursLearned } = useEnrollment();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    location: '',
    occupation: '',
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Load profile from auth user (server-sourced)
  useEffect(() => {
    if (user) {
      // Extra fields (bio, location, occupation) stored in localStorage as draft/ephemeral data
      const extras = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('wedu-profile-extras') || '{}')
        : {};
      setProfileData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        bio: extras.bio || 'Yêu thích học tập và phát triển bản thân thông qua các khóa học trực tuyến.',
        location: extras.location || '',
        occupation: extras.occupation || '',
      });
    }
  }, [user]);

  const [saveLoading, setSaveLoading] = useState(false);

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

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      // Save core profile fields to server (source of truth)
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileData.name, phone: profileData.phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error?.message || 'Lưu hồ sơ thất bại', 'error');
        return;
      }
      // Save extra fields (bio, location, occupation) to localStorage (ephemeral)
      localStorage.setItem('wedu-profile-extras', JSON.stringify({
        bio: profileData.bio,
        location: profileData.location,
        occupation: profileData.occupation,
      }));
      // Update client auth state with canonical data from server
      updateUser({ name: data.data.profile.name, phone: data.data.profile.phone });
      showToast('Đã cập nhật hồ sơ thành công!', 'success');
      setIsEditing(false);
    } catch {
      showToast('Lỗi kết nối, thử lại sau', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!passwords.current) {
      showToast('Vui lòng nhập mật khẩu hiện tại', 'error');
      return;
    }
    if (passwords.newPassword.length < 8) {
      showToast('Mật khẩu mới phải có ít nhất 8 ký tự', 'error');
      return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      showToast('Mật khẩu xác nhận không khớp', 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Đổi mật khẩu thất bại', 'error');
        return;
      }
      showToast('Đổi mật khẩu thành công!', 'success');
      setPasswords({ current: '', newPassword: '', confirm: '' });
      setShowPasswordChange(false);
    } catch {
      showToast('Lỗi kết nối, thử lại sau', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const memberLevelLabel = user.memberLevel === 'VIP' ? 'Member cấp Vàng'
    : user.memberLevel === 'Premium' ? 'Member cấp Bạc'
    : 'Thành viên';

  const stats = [
    { label: 'Khóa học đã học', value: String(enrollments.length), color: 'text-teal' },
    { label: 'Hoàn thành', value: String(completedCoursesCount), color: 'text-gold' },
    { label: 'Giờ đã học', value: String(totalHoursLearned), color: 'text-white' },
    { label: 'Đang học', value: String(enrollments.length - completedCoursesCount), color: 'text-teal' },
  ];

  // Recent enrollment activities
  const recentActivities = enrollments
    .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())
    .slice(0, 5)
    .map(e => {
      const timeDiff = Date.now() - new Date(e.lastAccessedAt).getTime();
      const hours = Math.floor(timeDiff / 3600000);
      const days = Math.floor(timeDiff / 86400000);
      const timeStr = days > 0 ? `${days} ngày trước` : hours > 0 ? `${hours} giờ trước` : 'Vừa xong';
      return {
        action: e.progress === 100 ? 'Hoàn thành khóa học' : e.progress > 0 ? 'Đang học' : 'Bắt đầu học',
        courseId: e.courseId,
        time: timeStr,
        progress: e.progress,
      };
    });

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Hồ sơ của tôi
          </h1>
          <p className="text-gray-400">
            Quản lý thông tin cá nhân và theo dõi tiến độ học tập
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Avatar & Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Avatar Card */}
            <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.06]">
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-teal">
                    <div className="w-full h-full bg-gradient-to-br from-teal to-gold flex items-center justify-center text-white text-4xl font-bold">
                      {profileData.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mt-4">{profileData.name}</h2>
                {profileData.occupation && (
                  <p className="text-gray-400 text-sm">{profileData.occupation}</p>
                )}
                <div className={`flex items-center gap-1 mt-2 ${
                  user.memberLevel === 'VIP' ? 'text-gold' : user.memberLevel === 'Premium' ? 'text-teal' : 'text-gray-400'
                }`}>
                  {user.memberLevel !== 'Free' && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                  <span className="text-sm font-semibold">{memberLevelLabel}</span>
                </div>
                {user.memberLevel === 'Free' && (
                  <Link href="/pricing" className="text-teal text-xs hover:underline mt-1">
                    Nâng cấp tài khoản
                  </Link>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] text-center">
                  <div className={`text-2xl font-bold mb-1 ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Quick Links */}
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.06] space-y-2">
              <Link href="/my-courses" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="text-white text-sm font-medium">Khóa học của tôi</span>
              </Link>
              <Link href="/certificates" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <span className="text-white text-sm font-medium">Chứng chỉ</span>
              </Link>
              <Link href="/dashboard" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="text-white text-sm font-medium">Dashboard</span>
              </Link>
              <Link href="/community" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-white text-sm font-medium">Cộng đồng</span>
              </Link>
            </div>
          </div>

          {/* Right Column - Profile Info */}
          <div className="lg:col-span-2">
            <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Thông tin cá nhân</h3>
                {!isEditing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Chỉnh sửa
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      Hủy
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSave}
                      disabled={saveLoading}
                    >
                      {saveLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Họ và tên</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-4 py-2 bg-dark border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-teal"
                    />
                  ) : (
                    <p className="text-gray-400">{profileData.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Email</label>
                  <p className="text-gray-400">{profileData.email}</p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Số điện thoại</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full px-4 py-2 bg-dark border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-teal"
                      placeholder="Nhập số điện thoại"
                    />
                  ) : (
                    <p className="text-gray-400">{profileData.phone || 'Chưa cập nhật'}</p>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Địa chỉ</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={profileData.location}
                      onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                      className="w-full px-4 py-2 bg-dark border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-teal"
                      placeholder="Nhập địa chỉ"
                    />
                  ) : (
                    <p className="text-gray-400">{profileData.location || 'Chưa cập nhật'}</p>
                  )}
                </div>

                {/* Occupation */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Nghề nghiệp</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={profileData.occupation}
                      onChange={(e) => setProfileData({ ...profileData, occupation: e.target.value })}
                      className="w-full px-4 py-2 bg-dark border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-teal"
                      placeholder="Nhập nghề nghiệp"
                    />
                  ) : (
                    <p className="text-gray-400">{profileData.occupation || 'Chưa cập nhật'}</p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Giới thiệu</label>
                  {isEditing ? (
                    <textarea
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 bg-dark border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-teal resize-none"
                    />
                  ) : (
                    <p className="text-gray-400">{profileData.bio}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Password Change Section */}
            <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.06] mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Bảo mật</h3>
                {!showPasswordChange && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPasswordChange(true)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Đổi mật khẩu
                  </Button>
                )}
              </div>

              {showPasswordChange ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      className="w-full px-4 py-2 bg-dark border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-teal"
                      placeholder="Nhập mật khẩu hiện tại"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Mật khẩu mới</label>
                    <input
                      type="password"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                      className="w-full px-4 py-2 bg-dark border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-teal"
                      placeholder="Nhập mật khẩu mới (ít nhất 8 ký tự)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="w-full px-4 py-2 bg-dark border border-white/[0.06] rounded-lg text-white focus:outline-none focus:border-teal"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPasswordChange(false);
                        setPasswords({ current: '', newPassword: '', confirm: '' });
                      }}
                    >
                      Hủy
                    </Button>
                    <Button variant="primary" size="sm" onClick={handlePasswordChange} disabled={passwordLoading}>
                      {passwordLoading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-dark rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">Mật khẩu đã được thiết lập</p>
                    <p className="text-gray-500 text-xs">Nhấn &ldquo;Đổi mật khẩu&rdquo; để thay đổi</p>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.06] mt-6">
              <h3 className="text-xl font-bold text-white mb-4">Hoạt động gần đây</h3>
              {recentActivities.length > 0 ? (
                <div className="space-y-4">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-start gap-4 p-3 bg-dark rounded-lg">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        activity.progress === 100 ? 'bg-teal/20 text-teal' :
                        activity.progress > 0 ? 'bg-gold/20 text-gold' : 'bg-white/10 text-gray-400'
                      }`}>
                        {activity.progress === 100 ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold">{activity.action}</p>
                        <p className="text-gray-400 text-sm">{activity.courseId}</p>
                      </div>
                      <p className="text-gray-500 text-xs">{activity.time}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Chưa có hoạt động nào</p>
                  <Link href="/courses" className="text-teal text-sm hover:underline mt-2 inline-block">
                    Bắt đầu học ngay
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
