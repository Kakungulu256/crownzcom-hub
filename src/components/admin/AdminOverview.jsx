import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { databases, DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { formatCurrency } from '../../utils/financial';
import { UsersIcon, BanknotesIcon, CreditCardIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { listAllDocuments } from '../../lib/pagination';

const AdminOverview = () => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalSavings: 0,
    activeLoans: 0,
    totalLoanAmount: 0,
    availableBalance: 0,
    pendingLoans: 0,
    thisMonthRepayments: 0,
    thisMonthRepaymentAmount: 0
  });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch members count
      const [members, savings, loans, repayments] = await Promise.all([
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.MEMBERS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS)
      ]);

      const totalSavings = savings.reduce((sum, saving) => sum + saving.amount, 0);
      const activeLoans = loans.filter(loan => 
        loan.status === 'active'
      );
      const pendingLoans = loans.filter(loan => loan.status === 'pending');
      const totalLoanAmount = activeLoans.reduce((sum, loan) => sum + loan.amount, 0);
      const availableBalance = Math.max(0, totalSavings - totalLoanAmount);

      const now = new Date();
      const last7Days = new Date();
      last7Days.setDate(now.getDate() - 7);

      const thisMonthRepayments = repayments.filter(repayment => {
        const paidAt = new Date(repayment.paidAt);
        return paidAt.getFullYear() === now.getFullYear() && paidAt.getMonth() === now.getMonth();
      });
      const thisMonthRepaymentAmount = thisMonthRepayments.reduce((sum, repayment) => sum + repayment.amount, 0);

      const recentPending = pendingLoans.filter(loan => new Date(loan.createdAt) >= last7Days);
      const notifications = [
        {
          id: 'pending-loans',
          type: 'alert',
          title: 'Pending Loan Approvals',
          message: `${pendingLoans.length} pending loan(s)`,
          link: '/admin/loans'
        },
        {
          id: 'recent-loans',
          type: 'info',
          title: 'New Loan Applications',
          message: `${recentPending.length} submitted in last 7 days`,
          link: '/admin/loans'
        },
        {
          id: 'repayments',
          type: 'success',
          title: 'Repayments This Month',
          message: `${thisMonthRepayments.length} payment(s) recorded`,
          link: '/admin/loans'
        }
      ];

      setStats({
        totalMembers: members.length,
        totalSavings,
        activeLoans: activeLoans.length,
        totalLoanAmount,
        availableBalance,
        pendingLoans: pendingLoans.length,
        thisMonthRepayments: thisMonthRepayments.length,
        thisMonthRepaymentAmount
      });
      setNotifications(notifications);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: 'Total Members',
      value: stats.totalMembers,
      icon: UsersIcon,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Total Savings',
      value: formatCurrency(stats.totalSavings),
      icon: BanknotesIcon,
      color: 'from-emerald-500 to-green-600',
      bgColor: 'bg-emerald-50'
    },
    {
      name: 'Active Loans',
      value: stats.activeLoans,
      icon: CreditCardIcon,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50'
    },
    {
      name: 'Loan Portfolio',
      value: formatCurrency(stats.totalLoanAmount),
      icon: ChartBarIcon,
      color: 'from-indigo-500 to-purple-600',
      bgColor: 'bg-indigo-50'
    },
    {
      name: 'Available Balance',
      value: formatCurrency(stats.availableBalance),
      icon: BanknotesIcon,
      color: 'from-teal-500 to-emerald-600',
      bgColor: 'bg-teal-50'
    }
  ];

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white overflow-hidden shadow rounded-lg h-24"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard Overview</h1>
        <p className="mt-2 text-slate-600">
          Welcome back. Here’s a clean snapshot of key activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
        {statCards.map((stat) => (
          <div key={stat.name} className={`stat-card ${stat.bgColor}`}>
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {stat.name}
                </p>
                <p className="text-2xl font-bold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="card border border-amber-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Attention Needed</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
              <div>
                <div className="text-sm font-semibold text-amber-900">Pending Loan Approvals</div>
                <div className="text-xs text-amber-700">Review and approve new applications</div>
              </div>
              <div className="text-lg font-bold text-amber-900">{stats.pendingLoans}</div>
            </div>
            <Link 
              to="/admin/loans"
              className="w-full text-left p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors block"
            >
              Go to Loans
            </Link>
          </div>
        </div>

        <div className="card border border-emerald-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">This Month</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div>
                <div className="text-sm font-semibold text-emerald-900">Repayments Recorded</div>
                <div className="text-xs text-emerald-700">Payments posted this month</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-emerald-900">{stats.thisMonthRepayments}</div>
                <div className="text-xs text-emerald-700">{formatCurrency(stats.thisMonthRepaymentAmount)}</div>
              </div>
            </div>
            <Link 
              to="/admin/loans"
              className="w-full text-left p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors block"
            >
              View Repayments
            </Link>
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Notifications</h3>
        <div className="space-y-3">
          {notifications.map(note => (
            <Link
              key={note.id}
              to={note.link}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900">{note.title}</div>
                <div className="text-xs text-gray-600">{note.message}</div>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                note.type === 'alert' ? 'bg-amber-100 text-amber-800' :
                note.type === 'success' ? 'bg-emerald-100 text-emerald-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {note.type.toUpperCase()}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h3>
          <div className="space-y-4">
            <Link 
              to="/admin/members"
              className="w-full text-left p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all duration-200 border border-blue-200 block"
            >
              <div className="flex items-center">
                <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4">
                  <UsersIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-blue-900">Manage Members</div>
                  <div className="text-sm text-blue-700">Add and manage SACCO members</div>
                </div>
              </div>
            </Link>
            <Link 
              to="/admin/savings"
              className="w-full text-left p-4 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl transition-all duration-200 border border-green-200 block"
            >
              <div className="flex items-center">
                <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4">
                  <BanknotesIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-green-900">Record Savings</div>
                  <div className="text-sm text-green-700">Enter monthly savings contributions</div>
                </div>
              </div>
            </Link>
            <Link 
              to="/admin/loans"
              className="w-full text-left p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 rounded-xl transition-all duration-200 border border-yellow-200 block"
            >
              <div className="flex items-center">
                <div className="h-10 w-10 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center mr-4">
                  <CreditCardIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-yellow-900">Manage Loans</div>
                  <div className="text-sm text-yellow-700">Review and manage loan applications</div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h3>
          <div className="text-center py-8">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChartBarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-2">No recent activity to display.</p>
            <p className="text-sm text-gray-400">
              Activity will appear here as members interact with the system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
