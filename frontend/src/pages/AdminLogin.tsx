import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import apiService from '../services/api.service';

// Slideshow content configuration
const slides = [
  {
    id: 1,
    topText: 'Enter',
    middleText: 'the Future',
    bottomText: ['of Healthcare,', 'today'],
    subtext: '4.1 million Africans die annually from NCDs. Most lack continuity of care.',
    hasImage: false,
  },
  {
    id: 2,
    topText: 'Offline-first,',
    middleText: 'AI native',
    bottomText: ['EHR for NCDs'],
    subtext: 'Clinical decision support that works without internet. Because care can\'t wait for connectivity.',
    hasImage: false,
  },
  {
    id: 3,
    topText: 'EHR',
    middleText: 'on the edge',
    bottomText: [],
    subtext: 'Runs on a $50 device. No servers. No cloud dependency. Healthcare anywhere.',
    hasImage: true,
    imageUrl: 'https://images.theengineeringprojects.com/image/main/2023/10/introduction-to-raspberry-pi-5-6.png',
    imageAlt: 'Raspberry Pi 5',
  },
];

export default function AdminLogin() {
  // Commented out for demo - keep for future use
  // const [username, setUsername] = useState('');
  // const [password, setPassword] = useState('');
  // const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();

  const nextSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning]);

  const prevSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning]);

  const goToSlide = (index: number) => {
    if (isTransitioning || index === currentSlide) return;
    setIsTransitioning(true);
    setCurrentSlide(index);
    setTimeout(() => setIsTransitioning(false), 500);
  };

  useEffect(() => {
    setInitializing(false);
  }, []);

  // Auto-advance slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  // Demo auto-login with admin credentials
  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // Use demo admin credentials
      const user = await apiService.login('admin', 'Admin123!');

      if (user) {
        const adminAuth = { authenticated: true, timestamp: new Date().toISOString() };
        const adminUser = { username: user.username, role: user.role, displayName: user.display_name || user.username };

        localStorage.setItem('admin_auth', JSON.stringify(adminAuth));
        localStorage.setItem('admin_user', JSON.stringify(adminUser));

        navigate('/admin', { replace: true });
      } else {
        setError('Demo login failed. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      setError('Login failed: ' + (err.message || 'Unable to connect'));
      setLoading(false);
    }
  };

  /* Original form login - commented for demo
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await apiService.login(username, password);

      if (user) {
        const adminAuth = { authenticated: true, timestamp: new Date().toISOString() };
        const adminUser = { username: user.username, role: user.role, displayName: user.display_name || user.username };

        localStorage.setItem('admin_auth', JSON.stringify(adminAuth));
        localStorage.setItem('admin_user', JSON.stringify(adminUser));

        const roleRoutes: Record<string, string> = {
          admin: '/admin', doctor: '/admin/doctor', nurse: '/admin/nurse',
          registrar: '/admin/registrar', pharmacy: '/admin/pharmacy', lab: '/admin/lab',
        };

        navigate(roleRoutes[user.role] || '/admin', { replace: true });
      } else {
        setError('Invalid username or password. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      setError('Login failed: ' + (err.message || 'Invalid credentials'));
      setLoading(false);
    }
  };
  */

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#7d8580] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#7d8580] p-3">
      <div className="h-[calc(100vh-24px)] bg-white rounded-[20px] overflow-hidden flex">
        {/* Left Side - Form */}
        <div className="w-full lg:w-[50%] flex flex-col py-8 px-10 lg:px-16 xl:px-20">
          {/* Brand Name */}
          <p
            className="text-[#3d6b5a] text-[26px] tracking-tight"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
          >
            HopeOS
          </p>

          {/* Form Container - Centered */}
          <div className="flex-1 flex flex-col justify-center max-w-[420px] mx-auto">
            {/* Bold Heading */}
            <div className="mb-12">
              <h1 className="text-[48px] xl:text-[56px] font-bold text-slate-900 leading-[1.1] tracking-tight">
                Welcome
              </h1>
              <h1 className="text-[48px] xl:text-[56px] font-bold text-slate-300 leading-[1.1] tracking-tight">
                back
              </h1>
              <p className="text-slate-500 text-[15px] mt-4 leading-relaxed">
                AI-powered clinical decisions. Intelligent patient insights. Smarter care.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[14px] text-red-600">{error}</p>
              </div>
            )}

            {/* Demo Buttons */}
            <div className="space-y-4">
              <button
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full bg-[#2a4f42] hover:bg-[#1e3a30] text-white font-semibold py-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 text-[15px] hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  'Go to dashboard'
                )}
              </button>

              {/* Get the app button - hidden for now */}
            </div>

          </div>
        </div>

        {/* Right Side - Slideshow */}
        <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden rounded-l-[20px]">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#2d4a40] via-[#243d34] to-[#1a2d26]" />

          {/* Slideshow Content */}
          <div className="relative z-10 flex flex-col w-full h-full">
            {/* Slides Container */}
            <div className="flex-1 flex items-center justify-center px-12 xl:px-16">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-out ${
                    index === currentSlide
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-95'
                  }`}
                >
                  {/* Text Content */}
                  <div className="text-center">
                    <p
                      className="text-[38px] xl:text-[46px] text-white/40 leading-[1.1]"
                      style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontWeight: 400 }}
                    >
                      {slide.topText}
                    </p>
                    <p
                      className="text-[38px] xl:text-[46px] text-white/40 leading-[1.1]"
                      style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontWeight: 400 }}
                    >
                      {slide.middleText}
                    </p>
                    {slide.bottomText.map((text, i) => (
                      <p
                        key={i}
                        className="text-[38px] xl:text-[46px] text-white font-light leading-[1.15] mt-1"
                      >
                        {text}
                      </p>
                    ))}
                  </div>

                  {/* Image - clean, no container */}
                  {slide.hasImage && slide.imageUrl && (
                    <img
                      src={slide.imageUrl}
                      alt={slide.imageAlt}
                      className="mt-8 w-[240px] xl:w-[300px] h-auto"
                    />
                  )}

                  {/* Subtext */}
                  {slide.subtext && (
                    <p className="mt-8 text-white/50 text-[15px] text-center max-w-[360px] leading-relaxed">
                      {slide.subtext}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom bar with indicators */}
            <div className="px-12 pb-8 flex items-center justify-between">
              {/* Navigation Arrows */}
              <button
                onClick={prevSlide}
                className="p-2.5 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-5 h-5 text-white/70" />
              </button>

              {/* Slide Indicators */}
              <div className="flex items-center gap-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={`transition-all duration-300 rounded-full ${
                      index === currentSlide
                        ? 'w-8 h-2 bg-white'
                        : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={nextSlide}
                className="p-2.5 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="w-5 h-5 text-white/70" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
