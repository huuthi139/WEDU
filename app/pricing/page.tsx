import { Button } from '@/components/ui/Button';
import { Header } from '@/components/layout/Header';

export default function PricingPage() {
  const plans = [
    {
      id: 1,
      name: 'Basic',
      price: 0,
      period: 'Miễn phí',
      description: 'Hoàn hảo cho người mới bắt đầu',
      features: [
        '3 khóa học miễn phí',
        'Xem video cơ bản',
        'Tài liệu học tập',
        'Community support',
      ],
      cta: 'Bắt đầu miễn phí',
      variant: 'secondary' as const,
    },
    {
      id: 2,
      name: 'Pro',
      price: 299000,
      period: '/tháng',
      description: 'Dành cho học viên nghiêm túc',
      popular: true,
      features: [
        'Truy cập TẤT CẢ khóa học',
        'Video HD không giới hạn',
        'Tải tài liệu về máy',
        'Chứng chỉ hoàn thành',
        'Priority support 24/7',
        'Live Q&A với giảng viên',
      ],
      cta: 'Đăng ký ngay',
      variant: 'primary' as const,
    },
    {
      id: 3,
      name: 'Enterprise',
      price: null,
      period: 'Liên hệ',
      description: 'Giải pháp cho doanh nghiệp',
      features: [
        'Mọi tính năng Pro',
        'Training cho team (10+ người)',
        'Custom learning paths',
        'Dedicated account manager',
        'API access',
        'Advanced analytics',
      ],
      cta: 'Liên hệ tư vấn',
      variant: 'accent' as const,
    },
  ];

  const faqs = [
    {
      q: 'Tôi có thể hủy subscription bất cứ lúc nào không?',
      a: 'Có, bạn có thể hủy subscription bất cứ lúc nào. Không có phí hủy bỏ.',
    },
    {
      q: 'Có chính sách hoàn tiền không?',
      a: 'Chúng tôi có chính sách hoàn tiền 100% trong vòng 30 ngày đầu tiên nếu bạn không hài lòng.',
    },
    {
      q: 'Tôi có thể thay đổi gói sau khi đã đăng ký?',
      a: 'Có, bạn có thể nâng cấp hoặc hạ cấp gói bất cứ lúc nào. Phí sẽ được tính theo tỷ lệ.',
    },
    {
      q: 'Chứng chỉ có được công nhận không?',
      a: 'Chứng chỉ của WEDU được công nhận bởi nhiều doanh nghiệp và tổ chức trong ngành.',
    },
  ];

  return (
    <div className="min-h-screen bg-dark">
      <Header />

      {/* Hero Section */}
      <section className="py-20 bg-dark">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Chọn gói phù hợp với bạn
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Đầu tư vào kiến thức là đầu tư tốt nhất. Bắt đầu học ngay hôm nay.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 bg-dark">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-dark border-2 rounded-xl p-8 ${
                  plan.popular
                    ? 'border-teal shadow-glow-teal scale-105'
                    : 'border-white/10 hover:border-white/30'
                } transition-all`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-teal text-white px-4 py-1 rounded-full text-sm font-bold">
                    PHỔ BIẾN NHẤT
                  </div>
                )}

                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-white/60 mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  {plan.price !== null ? (
                    <div>
                      <span className="text-4xl font-bold text-white">
                        {plan.price === 0 ? 'Miễn phí' : `${plan.price.toLocaleString()}₫`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-white/60">{plan.period}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-4xl font-bold text-white">{plan.period}</span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white/70">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button variant={plan.variant} size="lg" className="w-full">
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-dark border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-12 text-center">
              Câu hỏi thường gặp
            </h2>

            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <details key={i} className="bg-dark border border-white/10 rounded-lg group">
                  <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-white/5">
                    <span className="font-bold text-white pr-8">{faq.q}</span>
                    <svg className="w-5 h-5 text-gold flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-6 text-white/70">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-dark border-t border-white/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Vẫn còn câu hỏi?
          </h2>
          <p className="text-white/60 mb-8 max-w-2xl mx-auto">
            Liên hệ với team support của chúng tôi. Chúng tôi sẵn sàng hỗ trợ 24/7.
          </p>
          <Button variant="primary" size="xl">
            Liên hệ ngay
          </Button>
        </div>
      </section>
    </div>
  );
}
