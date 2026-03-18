'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useCourses } from '@/contexts/CoursesContext';
import type { Course } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/providers/ToastProvider';
import { useCart } from '@/contexts/CartContext';
import { useEnrollment } from '@/contexts/EnrollmentContext';
import Image from 'next/image';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { clearCart } = useCart();
  const { addOrder } = useEnrollment();
  const { courses: allCourses } = useCourses();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    paymentMethod: 'bank_transfer',
  });
  const [errors, setErrors] = useState<{name?: string; email?: string; phone?: string}>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Get courses from URL params
  const singleCourseId = searchParams.get('course');
  const multipleCoursesIds = searchParams.get('courses');

  let orderCourses: Course[] = [];

  if (singleCourseId) {
    const course = allCourses.find(c => c.id === singleCourseId);
    if (course) orderCourses = [course];
  } else if (multipleCoursesIds) {
    const ids = multipleCoursesIds.split(',');
    orderCourses = allCourses.filter(c => ids.includes(c.id));
  }

  useEffect(() => {
    if (!singleCourseId && !multipleCoursesIds) {
      router.push('/courses');
    }
  }, [singleCourseId, multipleCoursesIds, router]);

  if (orderCourses.length === 0) return null;

  const validate = () => {
    const newErrors: {name?: string; email?: string; phone?: string} = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Vui lòng nhập họ tên';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!/^[0-9]{10}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Số điện thoại không hợp lệ';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsProcessing(true);

    const orderData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      paymentMethod: formData.paymentMethod,
      courses: orderCourses.map(c => ({ id: c.id, title: c.title, price: c.price })),
      total: totalPrice,
      timestamp: new Date().toISOString(),
    };

    try {
      // Send order to Google Sheets via API route
      const { submitOrder } = await import('@/lib/googleSheets');
      await submitOrder(orderData);

      // Save order and auto-enroll courses
      addOrder({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        courses: orderCourses.map(c => ({ id: c.id, title: c.title, price: c.price })),
        total: totalPrice,
        paymentMethod: formData.paymentMethod,
      });

      showToast('Đặt hàng thành công! Chúng tôi sẽ liên hệ bạn sớm.', 'success');

      if (multipleCoursesIds) {
        clearCart();
      }

      router.push('/my-courses');
    } catch (error) {
      console.error('Order error:', error);
      showToast('Có lỗi xảy ra. Vui lòng thử lại sau.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const subtotal = orderCourses.reduce((sum, course) => sum + course.price, 0);
  const totalDiscount = orderCourses.reduce((sum, course) => {
    return sum + (course.originalPrice ? course.originalPrice - course.price : 0);
  }, 0);
  const totalPrice = subtotal;

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Thanh toán
          </h1>
          <p className="text-gray-400">
            Hoàn tất thông tin để đăng ký {orderCourses.length} khóa học
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Payment Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-6">
              <h2 className="text-xl font-bold text-white mb-6">Thông tin khách hàng</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-white mb-2">
                    Họ và tên *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-4 py-3 bg-dark border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                      errors.name ? 'border-teal' : 'border-white/[0.06] focus:border-teal'
                    }`}
                    placeholder="Nguyễn Văn A"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-teal">{errors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-4 py-3 bg-dark border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                      errors.email ? 'border-teal' : 'border-white/[0.06] focus:border-teal'
                    }`}
                    placeholder="example@email.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-teal">{errors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-white mb-2">
                    Số điện thoại *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-4 py-3 bg-dark border rounded-lg text-white placeholder-gray-500 focus:outline-none transition-colors ${
                      errors.phone ? 'border-teal' : 'border-white/[0.06] focus:border-teal'
                    }`}
                    placeholder="0123456789"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-teal">{errors.phone}</p>
                  )}
                </div>
              </form>
            </div>

            {/* Payment Method */}
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-6">
              <h2 className="text-xl font-bold text-white mb-6">Phương thức thanh toán</h2>
              
              <div className="space-y-3">
                {[
                  { id: 'bank_transfer', name: 'Chuyển khoản ngân hàng', icon: '🏦' },
                  { id: 'momo', name: 'Ví MoMo', icon: '💳' },
                  { id: 'vnpay', name: 'VNPay', icon: '💰' },
                ].map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.paymentMethod === method.id
                        ? 'border-teal bg-teal/10'
                        : 'border-white/[0.06] hover:border-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={formData.paymentMethod === method.id}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                      className="w-5 h-5 text-teal focus:ring-teal focus:ring-offset-0"
                    />
                    <span className="text-2xl">{method.icon}</span>
                    <span className="text-white font-semibold">{method.name}</span>
                  </label>
                ))}
              </div>

              {formData.paymentMethod === 'bank_transfer' && (
                <div className="mt-4 p-4 bg-dark rounded-lg border border-white/[0.06]">
                  <p className="text-sm text-gray-400 mb-3">Thông tin chuyển khoản:</p>
                  <div className="space-y-2 text-sm">
                    <p className="text-white"><strong>Ngân hàng:</strong> (Liên hệ admin)</p>
                    <p className="text-white"><strong>Số tài khoản:</strong> (Liên hệ admin)</p>
                    <p className="text-white"><strong>Chủ tài khoản:</strong> WEDU ACADEMY</p>
                    <p className="text-white"><strong>Nội dung:</strong> {formData.phone} WEDU</p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang xử lý...
                </span>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Xác nhận thanh toán
                </>
              )}
            </Button>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-6 sticky top-20">
              <h2 className="text-xl font-bold text-white mb-6">Đơn hàng ({orderCourses.length} khóa học)</h2>

              {/* Course List */}
              <div className="mb-6 space-y-4 max-h-64 overflow-y-auto">
                {orderCourses.map((course) => (
                  <div key={course.id} className="flex gap-3">
                    <div className="relative w-20 h-12 rounded overflow-hidden flex-shrink-0">
                      <Image
                        src={course.thumbnail}
                        alt={course.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white line-clamp-1">{course.title}</h3>
                      <p className="text-xs text-gray-400">{course.instructor}</p>
                      <p className="text-sm font-bold text-gold mt-1">{formatPrice(course.price)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 mb-6 pb-6 border-b border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Tạm tính</span>
                  <span className="text-white">{formatPrice(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Giảm giá</span>
                    <span className="text-teal">-{formatPrice(totalDiscount)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xl font-bold text-white">Tổng cộng</span>
                <span className="text-3xl font-bold text-gold">{formatPrice(totalPrice)}</span>
              </div>

              {/* Guarantee */}
              <div className="bg-dark rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-sm text-gray-300">Hoàn tiền 100% trong 7 ngày</p>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-300">Truy cập trọn đời</p>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-gray-300">Chứng chỉ hoàn thành</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function Checkout() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-white">Đang tải...</div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
