"use client"

import { useState } from 'react';
import {
  BarChart3,
  Users,
  UserPlus,
  LogOut,
  X,
  Menu,
  User,
  FlaskConical,
  Pill,
  Stethoscope,
  UserCog,
  Search,
  Download,
  Settings,
  ChevronDown,
  Filter,
  Share2,
  LayoutGrid,
  ToggleLeft,
  HelpCircle,
  MessageCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Analytics from '../components/admin/Analytics';
import PatientSearch from '../components/admin/PatientSearch';
import PatientRegistration from '../components/admin/PatientRegistration';
import UserManagement from '../components/admin/UserManagement';
import LabDashboard from './LabDashboard';
import PharmacyDashboard from './PharmacyDashboard';
import NurseDashboard from './NurseDashboard';

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // Get admin user info
  const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  const menuItems = [
    { id: 'analytics', label: 'Overview', icon: LayoutGrid, type: 'tab' },
    { id: 'patients', label: 'Patients', icon: Users, type: 'tab' },
    { id: 'registration', label: 'Registration', icon: UserPlus, type: 'tab' },
    { id: 'usermanagement', label: 'Staff', icon: UserCog, type: 'tab' },
    { id: 'divider1', type: 'divider' },
    { id: 'lab', label: 'Laboratory', icon: FlaskConical, type: 'tab' },
    { id: 'pharmacy', label: 'Pharmacy', icon: Pill, type: 'tab' },
    { id: 'nurse', label: 'Nurse Station', icon: Stethoscope, type: 'tab' },
  ];

  const bottomMenuItems = [
    { id: 'demo', label: 'Demo Mode', icon: ToggleLeft, type: 'toggle' },
    { id: 'feedback', label: 'Feedback', icon: MessageCircle, type: 'link' },
    { id: 'help', label: 'Help and docs', icon: HelpCircle, type: 'link' },
  ];

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 bg-olive-500 rounded-xl flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-gray-900">HopeOS</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main Menu Label */}
            <div className="px-5 pt-6 pb-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Main Menu</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 space-y-1">
              {menuItems.map((item) => {
                if (item.type === 'divider') {
                  return <div key={item.id} className="my-3 border-t border-gray-100" />;
                }

                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-olive-500 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Bottom Menu */}
            <div className="flex-shrink-0 px-3 py-4 border-t border-gray-100">
              {bottomMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-colors"
                  >
                    <Icon className="mr-3 h-5 w-5 text-gray-400" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Promo Card */}
            <div className="flex-shrink-0 p-4">
              <div className="relative bg-olive-500 rounded-2xl p-4 text-white overflow-hidden">
                {/* Decorative curves */}
                <svg className="absolute right-0 top-0 h-full w-24 opacity-20" viewBox="0 0 100 150" fill="none">
                  <circle cx="120" cy="75" r="80" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <circle cx="140" cy="75" r="60" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>

                {/* Orange sphere */}
                <div className="relative mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-lg" />
                </div>

                {/* Text */}
                <p className="text-sm font-medium leading-relaxed mb-4">
                  Get detailed analytics to help you, generate a report
                </p>

                {/* Button */}
                <button className="w-full bg-white text-olive-700 font-medium text-sm py-2 px-4 rounded-lg hover:bg-white/90 transition-colors">
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen md:ml-64">
          {/* Header */}
          <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Left: Mobile menu + Search */}
                <div className="flex items-center space-x-4 flex-1">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Menu className="h-5 w-5" />
                  </button>

                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search anything here..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-olive-500/20 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Right: Actions + Avatar */}
                <div className="flex items-center space-x-2">
                  <button className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <Download className="h-5 w-5" />
                  </button>
                  <button className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <Settings className="h-5 w-5" />
                  </button>
                  <button className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <BarChart3 className="h-5 w-5" />
                  </button>

                  {/* User Avatar with Dropdown */}
                  <div className="relative ml-2">
                    <button
                      onClick={() => setAvatarDropdownOpen(!avatarDropdownOpen)}
                      className="flex items-center space-x-2 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <div className="h-9 w-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center ring-2 ring-white">
                        <span className="text-sm font-medium text-white">
                          {adminUser.displayName?.charAt(0) || 'A'}
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${avatarDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {avatarDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setAvatarDropdownOpen(false)}
                        />
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                          {/* User Info */}
                          <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-sm font-medium text-gray-900">{adminUser.displayName || 'Administrator'}</p>
                            <p className="text-xs text-gray-500">{adminUser.email || 'admin@hopeos.com'}</p>
                          </div>

                          {/* Menu Items */}
                          <div className="py-1">
                            <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <User className="mr-3 h-4 w-4 text-gray-400" />
                              Profile Settings
                            </button>
                            <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <Settings className="mr-3 h-4 w-4 text-gray-400" />
                              Preferences
                            </button>
                            <button className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                              <HelpCircle className="mr-3 h-4 w-4 text-gray-400" />
                              Help & Support
                            </button>
                          </div>

                          {/* Logout */}
                          <div className="border-t border-gray-100 pt-1">
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <LogOut className="mr-3 h-4 w-4" />
                              Sign Out
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">
                {menuItems.find(item => item.id === activeTab)?.label || 'Overview'}
              </h1>

              {activeTab === 'analytics' && (
                <div className="flex items-center space-x-3">
                  <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                    <LayoutGrid className="h-4 w-4" />
                    <span>Customize Widget</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                  </button>
                  <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                    <Share2 className="h-4 w-4" />
                    <span>Share</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-6 pb-8">
            {activeTab === 'analytics' && <Analytics />}
            {activeTab === 'patients' && <PatientSearch />}
            {activeTab === 'registration' && <PatientRegistration />}
            {activeTab === 'usermanagement' && <UserManagement />}
            {activeTab === 'lab' && <LabDashboard />}
            {activeTab === 'pharmacy' && <PharmacyDashboard />}
            {activeTab === 'nurse' && <NurseDashboard />}
          </div>
        </main>
      </div>
    </div>
  );
}
