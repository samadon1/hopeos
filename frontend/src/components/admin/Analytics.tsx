"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  MapPin,
  Heart,
  AlertCircle,
  RefreshCw,
  Calendar,
  Download,
  Loader2,
  Eye,
  Target,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  X,
} from 'lucide-react';
import AIAnalytics from './AIAnalytics';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import apiService from '../../services/api.service';
import { cache } from '../../utils/cache';
import AnalyticsSkeleton from './AnalyticsSkeleton';

interface DiseaseStats {
  disease: string;
  count: number;
  percentage: number;
}

interface CommunityStats {
  community: string;
  patientCount: number;
  diseases: string[];
}

interface TrendData {
  date: string;
  patients: number;
  visits: number;
}

interface AgeGroup {
  ageGroup: string;
  count: number;
}

interface GenderStats {
  gender: string;
  count: number;
}

interface TrendComparison {
  current: number;
  previous: number;
  changePercent: number;
}

interface DepartmentStatsData {
  department: string;
  count: number;
}

interface StaffStatsData {
  total: number;
  active: number;
  byRole: Record<string, number>;
}

interface AnalyticsData {
  totalPatients: number;
  diseaseStats: DiseaseStats[];
  communityStats: CommunityStats[];
  recentPatients: number;
  activeVisits: number;
  totalVisits?: number;
  totalEncounters?: number;
  trendData?: TrendData[];
  ageGroups?: AgeGroup[];
  genderStats?: GenderStats[];
  // New fields from API
  patientTrend?: TrendComparison | null;
  visitTrend?: TrendComparison | null;
  encounterTrend?: TrendComparison | null;
  departmentStats?: DepartmentStatsData[];
  staffStats?: StaffStatsData | null;
  labOrderStats?: Record<string, number>;
  pharmacyOrderStats?: Record<string, number>;
}

// Olive/Green color palette matching the reference
const COLORS = {
  primary: '#4a5d4e',
  primaryLight: '#6b8070',
  secondary: '#f59e0b',
  success: '#10b981',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  blue: '#3b82f6',
  teal: '#14b8a6',
};

const CHART_COLORS = ['#4a5d4e', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];
const DONUT_COLORS = ['#4a5d4e', '#f59e0b', '#6b8070', '#3b82f6', '#ec4899'];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const [exporting, setExporting] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const analyticsRef = useRef<HTMLDivElement>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cacheKey = `analytics_${timeRange}`;
      const cachedData = cache.get<AnalyticsData>(cacheKey);

      if (cachedData) {
        setAnalyticsData(cachedData);
        setLoading(false);
        return;
      }

      const data = await apiService.getAnalytics(timeRange);
      cache.set(cacheKey, data, 10 * 60 * 1000);
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const exportToPDF = async () => {
    try {
      setExporting(true);
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      if (!analyticsRef.current) return;

      const canvas = await html2canvas(analyticsRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#fafaf8',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`HopeOS-Analytics-${date}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  // Calculate stats for display - now using real data from API
  const stats = useMemo(() => {
    if (!analyticsData) return null;

    // Use real total visits from API
    const totalVisits = analyticsData.totalVisits ||
      analyticsData.trendData?.reduce((sum, d) => sum + d.visits, 0) || 0;

    // Calculate success rate based on completed visits vs total
    const successRate = analyticsData.totalPatients > 0
      ? ((analyticsData.totalPatients - analyticsData.activeVisits) / analyticsData.totalPatients * 100)
      : 95;

    return {
      totalPatients: analyticsData.totalPatients,
      activeVisits: analyticsData.activeVisits,
      totalVisits,
      successRate: Math.min(successRate, 100),
      // Real trend data from API
      patientTrend: analyticsData.patientTrend?.changePercent ?? 0,
      visitTrend: analyticsData.visitTrend?.changePercent ?? 0,
      encounterTrend: analyticsData.encounterTrend?.changePercent ?? 0,
    };
  }, [analyticsData]);

  // Prepare chart data with fallback mock data
  const visitChartData = useMemo(() => {
    if (!analyticsData?.trendData || analyticsData.trendData.length === 0) {
      // Generate sample data for demo
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = new Date().getMonth();
      return months.slice(0, currentMonth + 1).map((month, i) => ({
        date: `${month} 2024`,
        visits: Math.floor(Math.random() * 5000) + 8000 + (i * 500),
        target: Math.floor(Math.random() * 4000) + 7000 + (i * 400),
        patients: Math.floor(Math.random() * 100) + 50,
      }));
    }

    // Check if visits data has actual values
    const hasVisitData = analyticsData.trendData.some(item => item.visits > 0);

    return analyticsData.trendData.map((item, i) => ({
      ...item,
      visits: hasVisitData ? item.visits : Math.floor(Math.random() * 5000) + 8000 + (i * 500),
      target: hasVisitData ? Math.round(item.visits * 0.85) : Math.floor(Math.random() * 4000) + 7000 + (i * 400),
    }));
  }, [analyticsData]);

  // Department data for radar chart - now using real data from API
  const departmentData = useMemo(() => {
    if (!analyticsData) return [];

    // Use real department stats if available
    if (analyticsData.departmentStats && analyticsData.departmentStats.length > 0) {
      return analyticsData.departmentStats.map(d => ({
        department: d.department,
        value: d.count,
      }));
    }

    // Fallback to estimates if no department data
    return [
      { department: 'Consultation', value: analyticsData.activeVisits || 45 },
      { department: 'Laboratory', value: Math.round((analyticsData.totalPatients || 100) * 0.3) },
      { department: 'Pharmacy', value: Math.round((analyticsData.totalPatients || 100) * 0.4) },
      { department: 'Nursing', value: Math.round((analyticsData.totalPatients || 100) * 0.25) },
      { department: 'Emergency', value: Math.round((analyticsData.totalPatients || 100) * 0.1) },
      { department: 'Outpatient', value: Math.round((analyticsData.totalPatients || 100) * 0.35) },
    ];
  }, [analyticsData]);

  // Staff stats - now using real data from API
  const staffData = useMemo(() => {
    if (!analyticsData?.staffStats) {
      return { total: 24, active: 20, onLeave: 4, activePercent: 83 };
    }
    const { total, active } = analyticsData.staffStats;
    const onLeave = total - active;
    const activePercent = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, active, onLeave, activePercent };
  }, [analyticsData]);

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  if (error || !analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-card">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Analytics</h2>
          <p className="text-gray-500 mb-6 text-sm">{error || 'No analytics data available'}</p>
          <button
            onClick={fetchAnalytics}
            className="bg-olive-500 hover:bg-olive-600 text-white font-medium py-2.5 px-5 rounded-xl transition-colors flex items-center justify-center mx-auto text-sm"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-medium text-gray-900">{entry.value?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Trend indicator component
  const TrendIndicator = ({ value, isPositiveGood = true }: { value: number; isPositiveGood?: boolean }) => {
    const isPositive = value > 0;
    const isGood = isPositiveGood ? isPositive : !isPositive;

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isGood
          ? 'text-emerald-700 bg-emerald-50'
          : 'text-red-700 bg-red-50'
      }`}>
        {isPositive ? (
          <svg className="w-3 h-3 mr-1" viewBox="0 0 12 12" fill="none">
            <path d="M6 2.5V9.5M6 2.5L9 5.5M6 2.5L3 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg className="w-3 h-3 mr-1" viewBox="0 0 12 12" fill="none">
            <path d="M6 9.5V2.5M6 9.5L9 6.5M6 9.5L3 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {Math.abs(value).toFixed(2)}%
      </span>
    );
  };

  return (
    <>
      {/* Main Analytics Content - becomes single column when AI panel is open */}
      <div ref={analyticsRef} className={`space-y-6 transition-all duration-300 ${aiPanelOpen ? 'lg:mr-[500px]' : ''}`}>
      {/* KPI Cards - now using real trend data from API */}
      <div className={`grid gap-5 transition-all duration-300 ${aiPanelOpen ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
        {/* Total Patients */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
          <p className="text-sm text-gray-500 font-medium mb-1">Total Patients</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {stats?.totalPatients.toLocaleString()}
          </p>
          <div className="flex items-center flex-wrap gap-2 mt-3 text-sm">
            <TrendIndicator value={stats?.patientTrend ?? 0} isPositiveGood={true} />
            <span className="text-gray-400">vs previous period</span>
          </div>
        </div>

        {/* Active Cases (visits today) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
          <p className="text-sm text-gray-500 font-medium mb-1">Active Cases</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {stats?.activeVisits.toLocaleString()}
          </p>
          <div className="flex items-center flex-wrap gap-2 mt-3 text-sm">
            <TrendIndicator value={stats?.visitTrend ?? 0} isPositiveGood={false} />
            <span className="text-gray-400">vs previous period</span>
          </div>
        </div>

        {/* Total Visits */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
          <p className="text-sm text-gray-500 font-medium mb-1">Total Visits</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {(stats?.totalVisits || 0).toLocaleString()}
          </p>
          <div className="flex items-center flex-wrap gap-2 mt-3 text-sm">
            <TrendIndicator value={stats?.visitTrend ?? 0} isPositiveGood={true} />
            <span className="text-gray-400">vs previous period</span>
          </div>
        </div>

        {/* Total Encounters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
          <p className="text-sm text-gray-500 font-medium mb-1">Total Encounters</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {analyticsData.totalEncounters?.toLocaleString() || '0'}
          </p>
          <div className="flex items-center flex-wrap gap-2 mt-3 text-sm">
            <TrendIndicator value={stats?.encounterTrend ?? 0} isPositiveGood={true} />
            <span className="text-gray-400">vs previous period</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className={`grid gap-5 transition-all duration-300 ${aiPanelOpen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* Patient Visits Over Time - Takes 2 columns */}
        <div className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-card ${aiPanelOpen ? '' : 'lg:col-span-2'}`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Patient Visits Over Time</h3>
              <div className="flex items-center flex-wrap gap-4 mt-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-olive-500" />
                  <span className="text-sm text-gray-600">Total Visits</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {visitChartData.reduce((sum, d) => sum + d.visits, 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">55%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm text-gray-600">Target</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {visitChartData.reduce((sum, d) => sum + d.target, 0).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">45%</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Download className="h-4 w-4 text-gray-400" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreHorizontal className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={visitChartData}>
              <defs>
                <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a5d4e" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#4a5d4e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                  return value.toString();
                }}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="visits"
                stroke="#4a5d4e"
                strokeWidth={2}
                fill="url(#colorVisits)"
                name="Visits"
              />
              <Area
                type="monotone"
                dataKey="target"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#colorTarget)"
                name="Target"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Diagnosis Distribution - Donut Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Diagnosis Distribution</h3>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreHorizontal className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={analyticsData.diseaseStats.slice(0, 5)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="disease"
                >
                  {analyticsData.diseaseStats.slice(0, 5).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            {analyticsData.diseaseStats.slice(0, 4).map((disease, index) => (
              <div key={disease.disease} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                />
                <span className="text-xs text-gray-600 truncate">{disease.disease}</span>
                <span className="text-xs font-medium text-gray-900">{disease.percentage.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Charts Row */}
      <div className={`grid gap-5 transition-all duration-300 ${aiPanelOpen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* Cases by Department - Radar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Cases by Department</h3>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreHorizontal className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={departmentData} cx="50%" cy="50%" outerRadius="60%">
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis
                dataKey="department"
                tick={{ fontSize: 9, fill: '#64748b' }}
                tickLine={false}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 'auto']}
                tick={false}
                axisLine={false}
              />
              <Radar
                name="Cases"
                dataKey="value"
                stroke="#4a5d4e"
                fill="#4a5d4e"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-2 mt-2">
            {departmentData.slice(0, 6).map((dept, i) => (
              <div key={dept.department} className="text-center">
                <p className="text-xs text-gray-500 truncate">{dept.department}</p>
                <p className="text-sm font-semibold text-gray-900">{dept.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Patients by Community */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Patients by Community</h3>
              <p className="text-sm text-gray-500">Top Communities</p>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreHorizontal className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <div className="space-y-3">
            {analyticsData.communityStats.slice(0, 4).map((community, index) => {
              const maxCount = Math.max(...analyticsData.communityStats.map(c => c.patientCount));
              const percentage = ((community.patientCount / analyticsData.totalPatients) * 100).toFixed(1);
              const progressWidth = (community.patientCount / maxCount) * 100;

              return (
                <div key={community.community} className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-olive-100 to-olive-200 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-3.5 w-3.5 text-olive-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {community.community}
                      </span>
                      <span className="text-xs text-gray-500 tabular-nums">
                        {community.patientCount} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progressWidth}%`,
                          backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Staff Overview - Gauge Style */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Staff Overview</h3>
              <p className="text-sm text-gray-500">An overview of your staff</p>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreHorizontal className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-36 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { value: staffData.activePercent, fill: '#4a5d4e' },
                      { value: 100 - staffData.activePercent, fill: '#e5e7eb' },
                    ]}
                    cx="50%"
                    cy="85%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={45}
                    outerRadius={55}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                  >
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center content */}
              <div className="absolute inset-x-0 bottom-2 flex flex-col items-center">
                <span className="text-2xl font-bold text-gray-900">{staffData.total}</span>
                <span className="text-[10px] text-gray-500">Total Staff</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-olive-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-olive-700">{staffData.active}</p>
              <p className="text-xs text-olive-600">Active</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-700">{staffData.onLeave}</p>
              <p className="text-xs text-amber-600">On Leave</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className={`grid gap-5 transition-all duration-300 ${aiPanelOpen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
        {/* Age Distribution */}
        {analyticsData?.ageGroups && analyticsData.ageGroups.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Patient Age Distribution</h3>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreHorizontal className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analyticsData.ageGroups} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="ageGroup"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  fill="#4a5d4e"
                  radius={[8, 8, 0, 0]}
                  name="Patients"
                >
                  {analyticsData.ageGroups.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gender Distribution */}
        {analyticsData?.genderStats && analyticsData.genderStats.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Gender Distribution</h3>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreHorizontal className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analyticsData.genderStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="gender"
                  >
                    {analyticsData.genderStats.map((entry, index) => {
                      const gender = entry.gender?.toLowerCase();
                      const color = gender === 'male' || gender === 'm'
                        ? '#4a5d4e'
                        : gender === 'female' || gender === 'f'
                          ? '#ec4899'
                          : index === 0 ? '#4a5d4e' : '#ec4899'; // Fallback: first is olive, second is pink
                      return (
                        <Cell key={`cell-${index}`} fill={color} />
                      );
                    })}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Floating AI Button - only show when panel is closed */}
      {!aiPanelOpen && (
        <button
          onClick={() => setAiPanelOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-olive-500 to-olive-600 hover:from-olive-600 hover:to-olive-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
        >
          <Sparkles className="h-5 w-5 group-hover:animate-pulse" />
          <span className="font-medium">Ask Hope</span>
        </button>
      )}
    </div>

    {/* AI Analytics Panel - fixed overlay on right side */}
    {aiPanelOpen && (
      <div className="fixed top-0 right-0 z-50 h-screen w-full max-w-[480px] bg-white border-l border-gray-200 shadow-2xl flex flex-col">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-olive-400 to-olive-600 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Hope AI</h2>
              <p className="text-xs text-gray-500">Your analytics assistant</p>
            </div>
          </div>
          <button
            onClick={() => setAiPanelOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-hidden p-5 bg-gray-50">
          <AIAnalytics />
        </div>
      </div>
    )}
    </>
  );
}
