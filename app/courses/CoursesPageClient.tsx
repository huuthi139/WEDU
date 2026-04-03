'use client';

import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CourseCard } from '@/components/ui/CourseCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { AdvancedFilters, FilterState } from '@/components/ui/AdvancedFilters';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useCourses } from '@/contexts/CoursesContext';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function CoursesPageClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
        <Footer />
      </div>
    }>
      <Courses />
    </Suspense>
  );
}

function Courses() {
  const searchParams = useSearchParams();
  const { courses, categories, isLoading: coursesLoading } = useCourses();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('popular');
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    priceRange: [0, 200000000],
    minRating: 0,
    duration: 'all',
  });

  // Debounced search for performance
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 250);
  }, []);

  // Sync search query from URL
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
      setDebouncedSearch(q);
    }
  }, [searchParams]);

  // Loading state
  useEffect(() => {
    if (coursesLoading) {
      setIsLoading(true);
    } else {
      setIsLoading(true);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [coursesLoading, selectedCategory, debouncedSearch, advancedFilters]);

  // Memoize filtered + sorted courses
  const sortedCourses = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();

    const filtered = courses.filter((course) => {
      if (selectedCategory !== 'all' && course.category !== selectedCategory) return false;
      if (searchLower && !course.title.toLowerCase().includes(searchLower) &&
          !course.instructor.toLowerCase().includes(searchLower)) return false;
      if (course.price < advancedFilters.priceRange[0] || course.price > advancedFilters.priceRange[1]) return false;
      if (course.rating < advancedFilters.minRating) return false;

      if (advancedFilters.duration === 'short' && course.duration >= 18000) return false;
      if (advancedFilters.duration === 'medium' && (course.duration < 18000 || course.duration > 72000)) return false;
      if (advancedFilters.duration === 'long' && course.duration <= 72000) return false;

      return true;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return b.id.localeCompare(a.id);
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'rating': return b.rating - a.rating;
        default: return b.enrollmentsCount - a.enrollmentsCount;
      }
    });
  }, [courses, selectedCategory, debouncedSearch, sortBy, advancedFilters]);

  const handleApplyFilters = (filters: FilterState) => {
    setAdvancedFilters(filters);
  };

  const handleResetFilters = () => {
    setAdvancedFilters({
      priceRange: [0, 200000000],
      minRating: 0,
      duration: 'all',
    });
    setSelectedCategory('all');
    setSearchQuery('');
    setSortBy('popular');
  };

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Khám phá khóa học
            </h1>
            <p className="text-gray-400">
              Tìm khóa học phù hợp với mục tiêu của bạn
            </p>
          </div>
          {user && (
            <Link href="/my-courses">
              <Button variant="primary" size="md">
                📚 Khoá học của tôi
              </Button>
            </Link>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm kiếm khóa học, giảng viên..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full h-12 px-4 pl-12 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-teal transition-colors"
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-sm font-semibold text-white">Danh mục:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.slug)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  selectedCategory === category.slug
                    ? 'bg-teal text-dark shadow-glow-teal'
                    : 'bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                {category.name}
                <span className="ml-2 text-xs opacity-60">({category.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Header with Advanced Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="text-gray-400">
              Hiển thị <span className="text-white font-semibold">{sortedCourses.length}</span> khóa học
            </div>
            <AdvancedFilters
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-teal"
            >
              <option value="popular">Phổ biến nhất</option>
              <option value="newest">Mới nhất</option>
              <option value="price_asc">Giá thấp đến cao</option>
              <option value="price_desc">Giá cao đến thấp</option>
              <option value="rating">Đánh giá cao nhất</option>
            </select>
          </div>
        </div>

        {/* Course Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : sortedCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {sortedCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Không tìm thấy khóa học</h3>
            <p className="text-gray-400 mb-6">
              Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
            </p>
            <Button
              variant="ghost"
              onClick={handleResetFilters}
            >
              Xóa bộ lọc
            </Button>
          </div>
        )}

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-teal/20 via-purple/10 to-gold/20 border border-teal/20 rounded-2xl p-6 md:p-8 text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Không tìm thấy khóa học phù hợp?
          </h2>
          <p className="text-gray-300 mb-5 max-w-2xl mx-auto">
            Đề xuất khóa học mà bạn muốn học. Chúng tôi sẽ làm việc với các chuyên gia để tạo nội dung chất lượng cao.
          </p>
          <Button variant="primary" size="lg">
            Đề xuất khóa học
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
