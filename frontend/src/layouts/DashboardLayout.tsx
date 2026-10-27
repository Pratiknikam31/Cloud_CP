import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Activity, 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  Building2, 
  Calendar, 
  BrainCircuit, 
  ListOrdered, 
  FileSpreadsheet, 
  Pill, 
  FlaskConical, 
  BedDouble, 
  Receipt, 
  Bell, 
  Search, 
  LogOut, 
  ChevronLeft, 
  Menu, 
  User, 
  ShieldCheck, 
  FileText,
  Package,
  X,
  CheckCircle2,
  Check,
  HeartPulse
} from 'lucide-react';
import { notificationApi, analyticsApi } from '../api/hospitalApi';
import { Notification } from '../types';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setShowSearchDropdown(false);
  }, [location.pathname]);

  // Click outside listener for search & notifications
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch live notifications
  const fetchNotifications = async () => {
    try {
      const res = await notificationApi.getAll({ limit: 10 });
      if (res.success && res.data?.notifications) {
        setNotifications(res.data.notifications);
      }
    } catch {
      // Fallback fallback notifications if fresh DB
      setNotifications([
        {
          _id: 'n1',
          recipient: user?.id || 'u1',
          title: 'Welcome to CloudCare',
          message: 'Your healthcare platform workspace is ready and connected.',
          type: 'system',
          read: false,
          createdAt: new Date().toISOString()
        }
      ]);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Debounced Global Search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await analyticsApi.search(searchQuery);
        if (res.success) {
          setSearchResults(res.data);
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleMarkAllNotificationsRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? ({ ...n, read: true }) : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    const role = user?.role;

    if (role === 'super_admin' || role === 'hospital_admin' || role === 'admin') {
      return [
        { label: 'Hospital Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
      ];
    } else if (role === 'doctor') {
      return [
        { label: 'Doctor Dashboard', path: '/doctor/dashboard', icon: LayoutDashboard },
        { label: 'Patient Consultations', path: '/doctor/consultations', icon: FileSpreadsheet },
        { label: 'Reports', path: '/doctor/lab-reports', icon: FileText },
      ];
    } else if (role === 'patient') {
      return [
        { label: 'Health Portal', path: '/patient/dashboard', icon: LayoutDashboard },
        { label: 'My Profile', path: '/patient/profile', icon: User },
        { label: 'Book Appointment', path: '/patient/book-appointment', icon: Calendar },
        { label: 'My Appointments', path: '/patient/appointments', icon: Calendar },
        { label: 'Reports', path: '/patient/lab-reports', icon: FileText },
      ];
    } else if (role === 'receptionist') {
      return [
        { label: 'Reception Desk', path: '/reception/dashboard', icon: LayoutDashboard },
        { label: 'Live Queue Counter', path: '/reception/queue', icon: ListOrdered },
        { label: 'Bookings & Check-in', path: '/reception/appointments', icon: Calendar },
        { label: 'Bed Allocation', path: '/reception/beds', icon: BedDouble },
      ];
    } else if (role === 'nurse') {
      return [
        { label: 'Nurse Station', path: '/nurse/dashboard', icon: LayoutDashboard },
        { label: 'Bed & Ward Status', path: '/admin/beds', icon: BedDouble },
        { label: 'Patient Queue', path: '/reception/queue', icon: ListOrdered },
        { label: 'EMR Records', path: '/doctor/consultations', icon: FileSpreadsheet },
      ];
    } else if (role === 'billing_staff') {
      return [
        { label: 'Billing Dashboard', path: '/admin/billing', icon: Receipt },
        { label: 'Patient Ledger', path: '/admin/patients', icon: Users },
      ];
    } else if (role === 'lab_staff' || role === 'lab_technician') {
      return [
        { label: 'Lab Dashboard', path: '/lab/dashboard', icon: LayoutDashboard },
        { label: 'Pending Tests', path: '/lab/tests', icon: FlaskConical },
        { label: 'Completed Reports', path: '/lab/reports', icon: FileText },
      ];
    } else if (role === 'pharmacist') {
      return [
        { label: 'Pharmacy Dashboard', path: '/pharmacy/dashboard', icon: LayoutDashboard },
        { label: 'Medicine Catalog', path: '/pharmacy/inventory', icon: Pill },
        { label: 'Dispense Prescriptions', path: '/pharmacy/dispense', icon: FileSpreadsheet },
        { label: 'Stock Predictions', path: '/pharmacy/alerts', icon: Package },
      ];
    }

    return [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ];
  };

  const navLinks = getNavLinks();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans antialiased selection:bg-brand-500 selection:text-white">
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside 
        className={`hidden md:flex flex-col bg-[#0a0f1d] text-slate-300 border-r border-slate-800/80 transition-all duration-300 z-30 sticky top-0 h-screen select-none shadow-2xl ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-800/80 bg-[#0a0f1d]/50 backdrop-blur-md">
          <Link to="/" className="flex items-center space-x-3 text-white overflow-hidden group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 via-brand-600 to-medical-teal flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30 ring-2 ring-brand-400/20 group-hover:scale-105 group-hover:shadow-brand-500/50 transition-all duration-300">
              <Activity className="w-5 h-5 text-white animate-pulse-subtle" />
            </div>
            {sidebarOpen && (
              <div className="truncate">
                <span className="text-lg font-black tracking-tight text-white flex items-center">
                  Cloud<span className="bg-gradient-to-r from-brand-400 to-medical-teal bg-clip-text text-transparent">Care</span>
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </span>
                <span className="block text-[9px] text-slate-400 font-mono tracking-widest uppercase font-bold">SMART HEALTHCARE</span>
              </div>
            )}
          </Link>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition duration-150"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <ChevronLeft className={`w-4 h-4 transform transition-transform duration-200 ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Role Identity Tag */}
        {sidebarOpen && (
          <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PORTAL</span>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30 uppercase tracking-wider shadow-xs">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          {navLinks.map((item) => {
            const IconComp = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  isActive 
                    ? 'bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25 ring-1 ring-white/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 hover:translate-x-1'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <IconComp className={`w-5 h-5 shrink-0 transition-transform duration-200 ${isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-slate-200'}`} />
                {sidebarOpen && <span className="truncate tracking-tight">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Footer Profile & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/70">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-md">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-medical-teal flex items-center justify-center text-white font-extrabold text-xs shrink-0 shadow-md ring-2 ring-brand-500/20">
                {user?.name?.charAt(0) || 'U'}
              </div>
              {sidebarOpen && (
                <div className="truncate">
                  <p className="text-xs font-bold text-white truncate tracking-tight">{user?.name}</p>
                  <p className="text-[10px] text-slate-400 truncate font-mono">{user?.email}</p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <button 
                onClick={handleLogout} 
                title="Logout"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 rounded-xl transition duration-150"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ================= MOBILE DRAWER & BACKDROP ================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)} 
          />
          <div className="relative w-72 max-w-[80vw] bg-[#0a0f1d] text-slate-300 flex flex-col h-full z-10 shadow-2xl border-r border-slate-800">
            <div className="h-20 flex items-center justify-between px-5 border-b border-slate-800">
              <Link to="/" className="flex items-center space-x-3 text-white">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 via-brand-600 to-medical-teal flex items-center justify-center text-white shadow-md">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="font-extrabold text-white text-base">Cloud<span className="text-brand-400">Care</span></span>
              </Link>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3.5 bg-slate-950/60 border-b border-slate-800/80 text-xs">
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Signed in as</p>
              <p className="font-bold text-white truncate text-sm mt-0.5">{user?.name}</p>
              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md bg-brand-500/15 text-brand-300 font-mono uppercase font-bold border border-brand-500/20">{user?.role?.replace('_', ' ')}</span>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
              {navLinks.map((item) => {
                const IconComp = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition ${
                      isActive 
                        ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25' 
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-bold text-sm transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT CONTAINER ================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Navigation */}
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Interactive Search */}
            <div ref={searchRef} className="relative w-56 sm:w-80 md:w-96 group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-600 transition-colors">
                <Search className={`w-4 h-4 ${isSearching ? 'animate-spin text-brand-600' : ''}`} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => searchResults && setShowSearchDropdown(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Patients, Doctors, Medicines..."
                className="w-full pl-10 pr-14 py-2.5 rounded-2xl border border-slate-200/90 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-slate-50/70 hover:bg-slate-100/70 focus:bg-white shadow-xs transition-all duration-200"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-1.5 pointer-events-none">
                {searchQuery ? (
                  <button 
                    onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                    className="pointer-events-auto p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs">
                    Ctrl K
                  </kbd>
                )}
              </div>

              {/* Instant Search Results Dropdown */}
              {showSearchDropdown && searchResults && (
                <div className="absolute left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 p-3.5 z-50 max-h-96 overflow-y-auto space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Search Results</span>
                    <span className="font-mono text-slate-500">"{searchQuery}"</span>
                  </div>

                  {/* Patients */}
                  {searchResults.patients?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-extrabold text-brand-600 uppercase tracking-wider">Patients</span>
                      <div className="mt-1 space-y-1">
                        {searchResults.patients.map((p: any) => (
                          <div 
                            key={p._id}
                            onClick={() => { setShowSearchDropdown(false); navigate('/admin/patients'); }}
                            className="p-2.5 rounded-xl hover:bg-brand-50/60 cursor-pointer flex items-center justify-between text-xs transition"
                          >
                            <span className="font-bold text-slate-900">{p.name} <span className="text-slate-400 font-normal">({p.patientId})</span></span>
                            <span className="text-slate-500 text-[11px] font-mono">{p.phone}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Doctors */}
                  {searchResults.doctors?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">Doctors</span>
                      <div className="mt-1 space-y-1">
                        {searchResults.doctors.map((d: any) => (
                          <div 
                            key={d._id}
                            onClick={() => { setShowSearchDropdown(false); navigate('/patient/book-appointment'); }}
                            className="p-2.5 rounded-xl hover:bg-emerald-50/60 cursor-pointer flex items-center justify-between text-xs transition"
                          >
                            <span className="font-bold text-slate-900">{d.name}</span>
                            <span className="text-slate-500 text-[11px]">{d.specialization} • Room {d.roomNumber}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medicines */}
                  {searchResults.medicines?.length > 0 && (
                    <div>
                      <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider">Pharmacy Catalog</span>
                      <div className="mt-1 space-y-1">
                        {searchResults.medicines.map((m: any) => (
                          <div 
                            key={m._id}
                            onClick={() => { setShowSearchDropdown(false); navigate('/pharmacy/inventory'); }}
                            className="p-2.5 rounded-xl hover:bg-purple-50/60 cursor-pointer flex items-center justify-between text-xs transition"
                          >
                            <span className="font-bold text-slate-900">{m.name}</span>
                            <span className="text-slate-500 text-[11px] font-mono">{m.quantity} units • ${m.unitPrice}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {(!searchResults.patients?.length && !searchResults.doctors?.length && !searchResults.medicines?.length) && (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No matching records for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Live Cloud Status Indicator */}
            <div className="hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Clinical Sync • 99.9% Uptime</span>
            </div>

            {/* Notification Center */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-2xl bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 relative transition duration-150 shadow-2xs"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-sm animate-pulse-subtle">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 p-4 z-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-sm text-slate-900">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllNotificationsRead}
                        className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n._id} 
                          onClick={() => handleMarkSingleRead(n._id)}
                          className={`p-3 rounded-2xl border text-xs space-y-1 transition cursor-pointer ${
                            n.read 
                              ? 'bg-slate-50/70 border-slate-100 text-slate-600' 
                              : 'bg-brand-50/60 border-brand-200/80 text-slate-900 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="truncate pr-2">{n.title}</span>
                            {!n.read && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Header Tag */}
            <div className="flex items-center space-x-3 border-l border-slate-200/80 pl-3 sm:pl-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-medical-teal text-white font-black flex items-center justify-center shadow-md ring-2 ring-brand-500/20">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">{user?.name}</p>
                <span className="text-[10px] font-bold text-brand-600 tracking-wider uppercase block mt-0.5">
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
