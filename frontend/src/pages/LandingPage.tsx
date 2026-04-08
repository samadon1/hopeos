import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Play } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 lg:px-16 py-5 border-b border-slate-100">
        <div className="flex items-center gap-12">
          <span
            className="text-[22px] text-[#2a4f42] font-medium"
            style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
          >
            HopeOS
          </span>
          <div className="hidden lg:flex items-center gap-8">
            <a href="#" className="text-[14px] text-slate-900 font-medium border-b-2 border-[#2a4f42] pb-1">Home</a>
            <a href="#products" className="text-[14px] text-slate-500 hover:text-slate-900 transition-colors">Products</a>
            <a href="#features" className="text-[14px] text-slate-500 hover:text-slate-900 transition-colors">Features</a>
            <a href="#" className="text-[14px] text-slate-500 hover:text-slate-900 transition-colors">Pricing</a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/login')}
            className="text-[14px] text-slate-700 hover:text-slate-900 font-medium px-5 py-2.5 rounded-full border border-slate-200 hover:border-slate-300 transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/admin/login')}
            className="text-[14px] bg-[#2a4f42] hover:bg-[#1e3a30] text-white font-medium px-5 py-2.5 rounded-full transition-colors"
          >
            Sign up
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 lg:pt-24 pb-20 px-6 lg:px-16">
        <div className="max-w-6xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 bg-[#2a4f42] text-white px-5 py-2 rounded-full text-[13px] font-medium">
              <Sparkles className="w-4 h-4" />
              AI-Powered Healthcare
            </div>
          </div>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto mb-6">
            <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-bold text-slate-900 leading-[1.15] tracking-tight">
              Your Pathway to{' '}
              <span className="text-[#2a4f42]" style={{ fontStyle: 'italic' }}>Complete</span>
              <br />
              Clinical Intelligence
            </h1>
          </div>

          {/* Subtitle */}
          <p className="text-center text-[18px] text-slate-500 max-w-2xl mx-auto mb-16 leading-relaxed">
            Our platform delivers AI-native clinical decision support, trusted medical insights,
            and seamless care coordination — powered by Google's Gemma 4.
          </p>

          {/* Image Grid - GE Healthcare style */}
          <div className="flex flex-col md:flex-row gap-5 max-w-5xl mx-auto items-stretch">
            {/* Left image */}
            <div className="flex-1 md:flex-[0.85]">
              <div className="h-[320px] md:h-[420px] rounded-[28px] overflow-hidden shadow-lg shadow-slate-200/80">
                <img
                  src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&h=800&fit=crop"
                  alt="Doctor consultation"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Center image - taller */}
            <div className="flex-1 md:flex-[1.1]">
              <div className="h-[320px] md:h-[420px] rounded-[28px] overflow-hidden shadow-lg shadow-slate-200/80">
                <img
                  src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=700&h=900&fit=crop"
                  alt="Medical team"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Right column */}
            <div className="flex-1 md:flex-[0.75] flex flex-col gap-5">
              {/* Top image */}
              <div className="h-[180px] md:h-[195px] rounded-[28px] overflow-hidden shadow-lg shadow-slate-200/80">
                <img
                  src="https://images.unsplash.com/photo-1551190822-a9333d879b1f?w=500&h=400&fit=crop"
                  alt="Surgery team"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Bottom CTA card */}
              <div className="flex-1 min-h-[180px] md:min-h-0 bg-[#2a4f42] rounded-[28px] p-6 flex flex-col justify-between shadow-lg shadow-[#2a4f42]/30">
                <div>
                  <h3 className="text-white font-bold text-[18px] mb-2">Explore Platform</h3>
                  <p className="text-white/80 text-[14px] leading-relaxed">
                    Your complete clinical AI solution
                  </p>
                </div>
                <button
                  onClick={() => navigate('/admin/login')}
                  className="self-start bg-white text-[#2a4f42] px-5 py-2.5 rounded-full text-[13px] font-semibold hover:bg-[#f0f5f3] transition-colors mt-4"
                >
                  Try Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-6 lg:px-16 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-1.5 rounded-full text-[12px] font-semibold mb-6 uppercase tracking-wider">
                The Problem
              </div>
              <h2 className="text-[32px] lg:text-[42px] font-bold text-white leading-[1.15] tracking-tight mb-6">
                4.1 million Africans die annually from NCDs
              </h2>
              <p className="text-[17px] text-slate-400 leading-relaxed mb-6">
                Most lack continuity of care. Paper records get lost. Clinics have no internet.
                Doctors make decisions without complete patient history.
              </p>
              <div className="space-y-4">
                {[
                  'No reliable connectivity in rural clinics',
                  'Paper records are fragmented and incomplete',
                  'No clinical decision support at point of care',
                  'Expensive infrastructure requirements',
                ].map((problem, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    </div>
                    <p className="text-slate-300 text-[15px]">{problem}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-[24px] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=600&fit=crop"
                  alt="Healthcare challenge"
                  className="w-full h-full object-cover grayscale opacity-60"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent rounded-[24px]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-32 lg:py-40 px-6 lg:px-16 bg-[#f8faf9]">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="lg:order-2">
              <div className="inline-flex items-center gap-2 bg-[#2a4f42] text-white px-4 py-1.5 rounded-full text-[12px] font-semibold mb-8 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                The Solution
              </div>
              <h2 className="text-[36px] lg:text-[48px] font-bold text-slate-900 leading-[1.1] tracking-tight mb-8">
                AI-native EHR that works
                <span className="text-[#2a4f42]" style={{ fontStyle: 'italic' }}> anywhere</span>
              </h2>
              <p className="text-[18px] text-slate-500 leading-relaxed mb-10">
                HopeOS brings clinical intelligence to the point of care — with or without internet.
                Powered by Google's Gemma 4 running directly on a $50 device.
              </p>
              <div className="space-y-5">
                {[
                  { problem: 'No connectivity', solution: 'Full offline-first operation' },
                  { problem: 'Paper records', solution: 'Digital records with 256K context AI' },
                  { problem: 'No decision support', solution: 'On-device clinical AI assistance' },
                  { problem: 'Expensive infrastructure', solution: 'Runs on $50 Raspberry Pi' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-[#2a4f42] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-slate-700 text-[16px]">
                      <span className="text-slate-400 line-through mr-2">{item.problem}</span>
                      <span className="font-semibold">{item.solution}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:order-1 relative">
              <div className="aspect-[3/4] lg:aspect-[4/5] rounded-[28px] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&h=1000&fit=crop"
                  alt="Modern healthcare"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section - Alternating Cards */}
      <section id="products" className="py-28 px-6 lg:px-16 bg-white">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-[#e8f0ed] text-[#2a4f42] px-4 py-1.5 rounded-full text-[12px] font-semibold mb-6 uppercase tracking-wider">
              Platforms
            </div>
            <h2 className="text-[32px] lg:text-[44px] font-bold text-slate-900 leading-[1.1] tracking-tight mb-5">
              Deploy
              <span className="text-[#2a4f42]" style={{ fontStyle: 'italic' }}> Anywhere</span>
            </h2>
            <p className="text-[17px] text-slate-500 leading-relaxed">
              From enterprise cloud to edge devices, HopeOS adapts to your infrastructure.
            </p>
          </div>

          {/* Alternating Product Cards */}
          <div className="space-y-24">
            {/* Cloud Platform - Image Left */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="relative">
                <div className="aspect-[4/3] rounded-[28px] overflow-hidden bg-gradient-to-br from-[#3d6b5a] to-[#2a4f42] p-8 flex items-center justify-center">
                  <div className="w-full max-w-[320px]">
                    {/* Dashboard mockup */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-white/90 text-[12px] font-medium">Live Dashboard</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <div className="h-16 flex-1 bg-white/20 rounded-lg"></div>
                          <div className="h-16 flex-1 bg-white/15 rounded-lg"></div>
                          <div className="h-16 flex-1 bg-white/10 rounded-lg"></div>
                        </div>
                        <div className="h-24 bg-white/15 rounded-lg"></div>
                        <div className="flex gap-3">
                          <div className="h-3 flex-1 bg-white/30 rounded"></div>
                          <div className="h-3 w-20 bg-white/20 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-[28px] lg:text-[36px] font-bold text-slate-900 leading-[1.15] mb-4">
                  Cloud Platform
                </h3>
                <p className="text-[17px] text-slate-500 leading-relaxed mb-6">
                  Enterprise-grade EHR with real-time synchronization, multi-user collaboration,
                  role-based access control, and full AI capabilities powered by Gemma 4.
                </p>
                <ul className="space-y-3 mb-8">
                  {['Real-time multi-clinic sync', 'Role-based dashboards', 'HIPAA & SOC 2 compliant', 'Full API access'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[15px] text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-[#e8f0ed] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#2a4f42]"></div>
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/admin/login')}
                  className="inline-flex items-center gap-2 bg-[#2a4f42] hover:bg-[#1e3a30] text-white px-6 py-3 rounded-full text-[15px] font-semibold transition-colors"
                >
                  Try Demo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Raspberry Pi - Image Right */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="lg:order-2 relative">
                <div className="aspect-[4/3] rounded-[28px] overflow-hidden bg-gradient-to-br from-[#4a7c6a] to-[#2a4f42] p-8 flex items-center justify-center relative">
                  <img
                    src="https://images.theengineeringprojects.com/image/main/2023/10/introduction-to-raspberry-pi-5-6.png"
                    alt="Raspberry Pi"
                    className="h-[200px] w-auto drop-shadow-2xl"
                  />
                  <div className="absolute top-6 right-6 bg-white text-[#2a4f42] px-4 py-2 rounded-full text-[13px] font-bold shadow-lg">
                    From $50
                  </div>
                </div>
              </div>
              <div className="lg:order-1">
                <h3 className="text-[28px] lg:text-[36px] font-bold text-slate-900 leading-[1.15] mb-4">
                  Raspberry Pi Edition
                </h3>
                <p className="text-[17px] text-slate-500 leading-relaxed mb-6">
                  Run the complete HopeOS platform on a $50 Raspberry Pi. Full AI capabilities
                  with Gemma 4's edge model, zero internet dependency, instant responses.
                </p>
                <ul className="space-y-3 mb-8">
                  {['Complete offline operation', 'On-device Gemma 4 AI', 'Automatic cloud sync', 'Perfect for remote clinics'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[15px] text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-[#e8f0ed] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#2a4f42]"></div>
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://github.com"
                  className="inline-flex items-center gap-2 bg-[#2a4f42] hover:bg-[#1e3a30] text-white px-6 py-3 rounded-full text-[15px] font-semibold transition-colors"
                >
                  Download <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Mobile App - Image Left */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="relative">
                <div className="aspect-[4/3] rounded-[28px] overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 p-8 flex items-center justify-center">
                  {/* Phone mockup */}
                  <div className="relative w-[140px] bg-slate-800 rounded-[28px] p-1.5 shadow-2xl">
                    <div className="bg-white rounded-[22px] h-[240px] p-4 relative overflow-hidden">
                      <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-4 mx-auto"></div>
                      <div className="space-y-3">
                        <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                        <div className="h-12 bg-[#e8f0ed] rounded-xl mt-4"></div>
                        <div className="h-12 bg-slate-50 rounded-xl border border-slate-100"></div>
                        <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-6 right-6 bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-[13px] font-bold">
                    Coming Soon
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-[28px] lg:text-[36px] font-bold text-slate-900 leading-[1.15] mb-4">
                  Mobile App
                </h3>
                <p className="text-[17px] text-slate-500 leading-relaxed mb-6">
                  Native iOS and Android applications with on-device AI, voice documentation,
                  biometric authentication, and seamless offline support.
                </p>
                <ul className="space-y-3 mb-8">
                  {['On-device AI processing', 'Voice-to-documentation', 'Biometric security', 'Works completely offline'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[15px] text-slate-400">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  disabled
                  className="inline-flex items-center gap-2 bg-slate-200 text-slate-500 px-6 py-3 rounded-full text-[15px] font-semibold cursor-not-allowed"
                >
                  Join Waitlist <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial/Trust Section */}
      <section className="py-28 px-6 lg:px-16 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <svg key={i} className="w-5 h-5 text-amber-400 fill-current" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
          <blockquote className="text-[22px] lg:text-[28px] font-medium text-slate-800 leading-[1.5] mb-10 max-w-3xl mx-auto">
            "HopeOS transformed how we deliver care in rural clinics. The offline AI capabilities
            mean our doctors have clinical decision support even without internet."
          </blockquote>
          <div className="flex items-center justify-center gap-4">
            <img
              src="https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=100&h=100&fit=crop&crop=face"
              alt="Dr. Sarah Kimani"
              className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
            />
            <div className="text-left">
              <p className="font-bold text-slate-900">Dr. Sarah Kimani</p>
              <p className="text-slate-500 text-[14px]">Medical Director, Kenya Health Initiative</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-16 bg-[#2a4f42] relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-[36px] lg:text-[48px] font-bold text-white leading-[1.1] tracking-tight mb-6">
            Ready to Transform Your Clinical Workflow?
          </h2>
          <p className="text-[18px] text-white/80 mb-10 max-w-xl mx-auto">
            Join healthcare organizations worldwide using AI-native tools to deliver better patient care.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/admin/login')}
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#f0f5f3] text-[#2a4f42] px-8 py-4 rounded-full text-[15px] font-bold transition-colors"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.open('https://github.com', '_blank')}
              className="inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white/40 hover:border-white text-white px-8 py-4 rounded-full text-[15px] font-semibold transition-colors"
            >
              <Play className="w-4 h-4" />
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-16 px-6 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <span
                className="text-[22px] text-white font-medium"
                style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
              >
                HopeOS
              </span>
              <p className="text-slate-400 text-[14px] mt-4 leading-relaxed">
                AI-native healthcare records for modern clinical care.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-3 text-[14px]">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-3 text-[14px]">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-3 text-[14px]">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors">HIPAA</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-[13px]">© {new Date().getFullYear()} HopeOS. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
