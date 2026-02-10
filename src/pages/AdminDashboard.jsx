import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { 
  HomeIcon, 
  UsersIcon, 
  BanknotesIcon, 
  CreditCardIcon,
  DocumentChartBarIcon,
  Cog6ToothIcon,
  ReceiptPercentIcon,
  CreditCardIcon as SubscriptionIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import MembersManagement from '../components/admin/MembersManagement';
import SavingsManagement from '../components/admin/SavingsManagement';
import LoansManagement from '../components/admin/LoansManagement';
import ReportsManagement from '../components/admin/ReportsManagement';
import UnitTrustManagement from '../components/admin/UnitTrustManagement';
import ExpensesManagement from '../components/admin/ExpensesManagement';
import SubscriptionsManagement from '../components/admin/SubscriptionsManagement';
import FinancialConfiguration from '../components/admin/FinancialConfiguration';
import AdminOverview from '../components/admin/AdminOverview';

const AdminDashboard = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const pageTitle = () => {
    if (location.pathname.startsWith('/admin/members')) return 'Members';
    if (location.pathname.startsWith('/admin/savings')) return 'Savings';
    if (location.pathname.startsWith('/admin/loans')) return 'Loans';
    if (location.pathname.startsWith('/admin/subscriptions')) return 'Subscriptions';
    if (location.pathname.startsWith('/admin/unit-trust')) return 'Unit Trust';
    if (location.pathname.startsWith('/admin/expenses')) return 'Expenses';
    if (location.pathname.startsWith('/admin/reports')) return 'Reports';
    if (location.pathname.startsWith('/admin/settings')) return 'Settings';
    return 'Overview';
  };

  const navigation = [
    { name: 'Overview', href: '/admin', icon: HomeIcon },
    { name: 'Members', href: '/admin/members', icon: UsersIcon },
    { name: 'Savings', href: '/admin/savings', icon: BanknotesIcon },
    { name: 'Loans', href: '/admin/loans', icon: CreditCardIcon },
    { name: 'Subscriptions', href: '/admin/subscriptions', icon: SubscriptionIcon },
    { name: 'Unit Trust', href: '/admin/unit-trust', icon: BanknotesIcon },
    { name: 'Expenses', href: '/admin/expenses', icon: ReceiptPercentIcon },
    { name: 'Reports', href: '/admin/reports', icon: DocumentChartBarIcon },
    { name: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
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
            <div className="flex items-center justify-between h-20 px-4 bg-gradient-to-r from-blue-600 to-indigo-600">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">IC</span>
                </div>
                {sidebarOpen && <h1 className="text-xl font-bold text-white">Investment Club Admin</h1>}
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
                  (item.href !== '/admin' && location.pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`sidebar-item ${
                      isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'
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
                <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {user?.name?.charAt(0) || 'A'}
                  </span>
                </div>
                {sidebarOpen && (
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-500">Administrator</p>
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
                <div className="app-subtitle">Admin / {pageTitle()}</div>
                <div className="app-title">{pageTitle()}</div>
              </div>
              <Link to="/admin" className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                Back to Overview
              </Link>
            </div>
          </div>
          <main className="p-8">
            <Routes>
              <Route path="/" element={<AdminOverview />} />
              <Route path="/members" element={<MembersManagement />} />
              <Route path="/savings" element={<SavingsManagement />} />
              <Route path="/loans" element={<LoansManagement />} />
              <Route path="/subscriptions" element={<SubscriptionsManagement />} />
              <Route path="/unit-trust" element={<UnitTrustManagement />} />
              <Route path="/expenses" element={<ExpensesManagement />} />
              <Route path="/reports" element={<ReportsManagement />} />
              <Route path="/settings" element={<FinancialConfiguration />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
