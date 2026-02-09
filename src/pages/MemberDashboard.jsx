import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { 
  HomeIcon, 
  BanknotesIcon, 
  CreditCardIcon,
  DocumentChartBarIcon,
  CreditCardIcon as SubscriptionIcon,
  UserIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import MemberOverview from '../components/member/MemberOverview';
import MemberSavings from '../components/member/MemberSavings';
import MemberLoans from '../components/member/MemberLoans';
import MemberReports from '../components/member/MemberReports';
import MemberSubscriptions from '../components/member/MemberSubscriptions';
import MemberProfile from '../components/member/MemberProfile';

const MemberDashboard = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const pageTitle = () => {
    if (location.pathname.startsWith('/member/savings')) return 'My Savings';
    if (location.pathname.startsWith('/member/loans')) return 'My Loans';
    if (location.pathname.startsWith('/member/subscriptions')) return 'Subscriptions';
    if (location.pathname.startsWith('/member/reports')) return 'Reports';
    if (location.pathname.startsWith('/member/profile')) return 'Profile';
    return 'Overview';
  };

  const navigation = [
    { name: 'Overview', href: '/member', icon: HomeIcon },
    { name: 'My Savings', href: '/member/savings', icon: BanknotesIcon },
    { name: 'My Loans', href: '/member/loans', icon: CreditCardIcon },
    { name: 'Subscriptions', href: '/member/subscriptions', icon: SubscriptionIcon },
    { name: 'Reports', href: '/member/reports', icon: DocumentChartBarIcon },
    { name: 'Profile', href: '/member/profile', icon: UserIcon },
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="app-shell">
      <div className="flex">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-72' : 'w-20'} bg-white shadow-xl border-r border-gray-100 transition-all duration-200`}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between h-20 px-4 bg-gradient-to-r from-green-600 to-emerald-600">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                {sidebarOpen && <h1 className="text-xl font-bold text-white">SACCO Member</h1>}
              </div>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-white hover:text-gray-200"
                title="Toggle Sidebar"
              >
                {sidebarOpen ? '⟨' : '⟩'}
              </button>
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || 
                  (item.href !== '/member' && location.pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`sidebar-item ${
                      isActive 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                        : 'sidebar-item-inactive'
                    }`}
                    title={item.name}
                  >
                    <item.icon className={`h-5 w-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                    {sidebarOpen && item.name}
                  </Link>
                );
              })}
            </nav>
            
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center mb-4 p-3 bg-gray-50 rounded-xl">
                <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {user?.name?.charAt(0) || 'M'}
                  </span>
                </div>
                {sidebarOpen && (
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500">Member</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <ArrowRightOnRectangleIcon className={`${sidebarOpen ? 'mr-3' : 'mx-auto'} h-5 w-5`} />
                {sidebarOpen && 'Sign out'}
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto">
          <div className="px-8 pt-6">
            <div className="app-header">
              <div>
                <div className="app-subtitle">Member / {pageTitle()}</div>
                <div className="app-title">{pageTitle()}</div>
              </div>
              <Link to="/member" className="text-sm font-semibold text-emerald-600 hover:text-emerald-800">
                Back to Overview
              </Link>
            </div>
          </div>
          <main className="p-8">
            <Routes>
              <Route path="/" element={<MemberOverview />} />
              <Route path="/savings" element={<MemberSavings />} />
              <Route path="/loans" element={<MemberLoans />} />
              <Route path="/subscriptions" element={<MemberSubscriptions />} />
              <Route path="/reports" element={<MemberReports />} />
              <Route path="/profile" element={<MemberProfile />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

export default MemberDashboard;
