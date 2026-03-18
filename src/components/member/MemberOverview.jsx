import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { databases, functions, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { useAuth } from '../../lib/auth';
import { formatCurrency, calculateAvailableCredit } from '../../utils/financial';
import { BanknotesIcon, CreditCardIcon, ChartBarIcon, CalendarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { fetchMemberRecord } from '../../lib/member';
import { listAllDocuments } from '../../lib/pagination';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';

const GUARANTOR_RESPONSE_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_GUARANTOR_RESPONSE_FUNCTION_ID ||
  import.meta.env.VITE_APPWRITE_LOAN_GUARANTOR_RESPONSE_FUNCTION_ID ||
  'guarantor-response';

const MemberOverview = () => {
  const { user } = useAuth();
  const [memberData, setMemberData] = useState({
    savings: [],
    loans: [],
    repayments: [],
    charges: [],
    totalSavings: 0,
    activeLoans: 0,
    loanEligibility: 0,
    availableCredit: 0
  });
  const [financialConfig, setFinancialConfig] = useState({ ...DEFAULT_FINANCIAL_CONFIG });
  const [loading, setLoading] = useState(true);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [showLoansModal, setShowLoansModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [guarantorRequests, setGuarantorRequests] = useState([]);
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const [responseComments, setResponseComments] = useState({});

  const normalizeId = (value) => {
    if (!value) return null;
    return typeof value === 'object' && value.$id ? value.$id : value;
  };

  const toTitleCase = (value) => {
    if (!value) return '';
    return String(value)
      .trim()
      .split(/\s+/)
      .map((word) => {
        if (!word) return '';
        const lower = word.toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(' ');
  };

  const getGuarantorStatusBadgeClass = (status) => {
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (status === 'approved') return 'bg-green-100 text-green-800';
    if (status === 'declined') return 'bg-red-100 text-red-800';
    if (status === 'released') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const handleGuarantorActionClick = async (request, action) => {
    try {
      setRespondingRequestId(request.$id);
      const comment = (responseComments[request.$id] || '').trim();
      const response = await functions.createExecution(
        GUARANTOR_RESPONSE_FUNCTION_ID,
        JSON.stringify({
          action: 'respondGuarantorRequest',
          requestId: request.$id,
          response: action,
          comment
        })
      );

      const result = JSON.parse(response?.responseBody || '{}');
      if (!result.success) {
        throw new Error(result.error || 'Failed to update guarantor request.');
      }

      toast.success(action === 'approve' ? 'Guarantor request approved.' : 'Guarantor request declined.');
      setResponseComments((prev) => ({
        ...prev,
        [request.$id]: ''
      }));
      await fetchMemberData();
    } catch (err) {
      toast.error(err.message || 'Failed to process guarantor response.');
    } finally {
      setRespondingRequestId(null);
    }
  };

  const fetchGuarantorRequests = async (memberId) => {
    if (!COLLECTIONS.LOAN_GUARANTORS) {
      return [];
    }

    const requests = await listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_GUARANTORS, [
      Query.equal('guarantorId', memberId)
    ]);

    if (requests.length === 0) {
      return [];
    }

    const loanIds = [...new Set(requests.map((request) => normalizeId(request.loanId)).filter(Boolean))];
    const loanResults = await Promise.all(
      loanIds.map(async (loanId) => {
        try {
          const loan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId);
          return [loanId, loan];
        } catch {
          return [loanId, null];
        }
      })
    );
    const loanMap = new Map(loanResults);

    const borrowerIds = [
      ...new Set(
        requests
          .map((request) => normalizeId(request.borrowerId) || normalizeId(loanMap.get(normalizeId(request.loanId))?.memberId))
          .filter(Boolean)
      )
    ];
    const borrowerResults = await Promise.all(
      borrowerIds.map(async (borrowerId) => {
        try {
          const borrower = await databases.getDocument(DATABASE_ID, COLLECTIONS.MEMBERS, borrowerId);
          return [borrowerId, borrower];
        } catch {
          return [borrowerId, null];
        }
      })
    );
    const borrowerMap = new Map(borrowerResults);

    return requests
      .map((request) => {
        const loanId = normalizeId(request.loanId);
        const loan = loanMap.get(loanId);
        const borrowerId = normalizeId(request.borrowerId) || normalizeId(loan?.memberId);
        const borrower = borrowerMap.get(borrowerId);
        const guaranteedAmount = parseInt(request.guaranteedAmount, 10) || 0;
        const guaranteedPercent = Number(request.guaranteedPercent) || 0;

        return {
          ...request,
          loanId,
          borrowerId,
          borrowerName: borrower?.name || 'Unknown member',
          loanAmount: parseInt(loan?.amount, 10) || 0,
          loanType: loan?.loanType || 'short_term',
          selectedMonths: parseInt(loan?.selectedMonths || loan?.duration, 10) || 0,
          guaranteedAmount,
          guaranteedPercent,
          requestedAt: request.requestedAt || request.createdAt || request.$createdAt
        };
      })
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  };

  useEffect(() => {
    if (user) {
      fetchMemberData();
    }
  }, [user]);

  const fetchMemberData = async () => {
    try {
      // Get member record (prefer authUserId mapping)
      const member = await fetchMemberRecord({ databases, DATABASE_ID, COLLECTIONS, user });
      if (!member) {
        console.error('Member record not found');
        return;
      }
      const memberId = member.$id;
      
      // Fetch member's savings and loans
      const [savings, loans, repayments, charges, config, memberGuarantorRequests] = await Promise.all([
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS, [
          Query.equal('memberId', memberId)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS, [
          Query.equal('memberId', memberId)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_CHARGES),
        fetchFinancialConfig(databases, DATABASE_ID, COLLECTIONS.FINANCIAL_CONFIG),
        fetchGuarantorRequests(memberId)
      ]);
      setFinancialConfig(config);
      setGuarantorRequests(memberGuarantorRequests);
      
      const totalSavings = savings.reduce((sum, saving) => sum + saving.amount, 0);
      const activeLoans = loans.filter(loan => loan.status === 'active' || loan.status === 'approved').length;
      const eligibilityPercent = (config.loanEligibilityPercentage || 80) / 100;
      const loanEligibility = Math.floor(totalSavings * eligibilityPercent);
      const activeLoanAmount = loans
        .filter(loan => loan.status === 'active' || loan.status === 'approved')
        .reduce((sum, loan) => sum + (loan.balance || loan.amount), 0);
      const availableCredit = calculateAvailableCredit(totalSavings, activeLoanAmount, eligibilityPercent);
      const availableBalance = Math.max(0, totalSavings - activeLoanAmount);
      
      const loanIds = new Set(loans.map(l => l.$id));
      const memberRepayments = repayments.filter(r => loanIds.has(r.loanId?.$id || r.loanId));
      const memberCharges = charges.filter(c => loanIds.has(c.loanId?.$id || c.loanId));

      setMemberData({
        savings,
        loans,
        repayments: memberRepayments,
        charges: memberCharges,
        totalSavings,
        activeLoans,
        loanEligibility,
        availableCredit,
        availableBalance
      });

      const now = new Date();
      const last7Days = new Date();
      last7Days.setDate(now.getDate() - 7);

      const recentApprovals = loans.filter(loan => loan.approvedAt && new Date(loan.approvedAt) >= last7Days);
      const recentRejections = loans.filter(loan => loan.rejectedAt && new Date(loan.rejectedAt) >= last7Days);
      const recentCharges = memberCharges.filter(c => c.createdAt && new Date(c.createdAt) >= last7Days);
      const recentPayments = memberRepayments.filter(r => r.paidAt && new Date(r.paidAt) >= last7Days);
      const pendingGuarantorRequests = memberGuarantorRequests.filter(request => request.status === 'pending');

      setNotifications([
        {
          id: 'guarantor-requests',
          type: pendingGuarantorRequests.length > 0 ? 'alert' : 'info',
          title: 'Guarantor Requests',
          message: `${pendingGuarantorRequests.length} pending response(s)`
        },
        {
          id: 'approvals',
          type: 'success',
          title: 'Loan Approvals',
          message: `${recentApprovals.length} approved in last 7 days`
        },
        {
          id: 'rejections',
          type: 'alert',
          title: 'Loan Rejections',
          message: `${recentRejections.length} rejected in last 7 days`
        },
        {
          id: 'charges',
          type: 'info',
          title: 'Bank Charges',
          message: `${recentCharges.length} charge(s) added recently`
        },
        {
          id: 'payments',
          type: 'success',
          title: 'Payments Recorded',
          message: `${recentPayments.length} payment(s) recorded`
        }
      ]);
    } catch (error) {
      console.error('Error fetching member data:', error);
    } finally {
      setLoading(false);
    }
  };

  const recentSavings = memberData.savings
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const recentLoans = memberData.loans
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  const monthlySavingsData = () => {
    const monthly = {};
    memberData.savings.forEach(saving => {
      const monthKey = saving.month;
      if (!monthly[monthKey]) monthly[monthKey] = 0;
      monthly[monthKey] += saving.amount;
    });
    return Object.entries(monthly)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(b.month) - new Date(a.month));
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white overflow-hidden shadow rounded-lg h-24"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome back, {toTitleCase(user?.name)}!
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Here’s a clean snapshot of your account.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-2xl border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-xl bg-emerald-500">
                  <BanknotesIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 leading-tight">
                    Total Savings
                  </dt>
                  <dd className="text-base font-semibold text-gray-900 break-words leading-tight">
                    {formatCurrency(memberData.totalSavings)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-2xl border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-xl bg-blue-500">
                  <ChartBarIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 leading-tight">
                    Loan Eligibility
                  </dt>
                  <dd className="text-base font-semibold text-gray-900 break-words leading-tight">
                    {formatCurrency(memberData.loanEligibility)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-2xl border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-xl bg-indigo-500">
                  <CreditCardIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 leading-tight">
                    Available Credit
                  </dt>
                  <dd className="text-base font-semibold text-gray-900 break-words leading-tight">
                    {formatCurrency(memberData.availableCredit)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-2xl border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-xl bg-teal-500">
                  <BanknotesIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 leading-tight">
                    Available Balance
                  </dt>
                  <dd className="text-base font-semibold text-gray-900 break-words leading-tight">
                    {formatCurrency(memberData.availableBalance || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-2xl border border-slate-100">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-xl bg-amber-500">
                  <CreditCardIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 leading-tight">
                    Active Loans
                  </dt>
                  <dd className="text-base font-semibold text-gray-900 break-words leading-tight">
                    {memberData.activeLoans}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Savings */}
        <div className="bg-white shadow rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Savings</h3>
            <CalendarIcon className="h-5 w-5 text-gray-400" />
          </div>
          
          {recentSavings.length > 0 ? (
            <div className="space-y-3">
              {recentSavings.map((saving) => (
                <div key={saving.$id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(saving.month).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long' 
                      })}
                    </div>
                    <div className="text-xs text-gray-500">
                      Recorded: {new Date(saving.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-600">
                    {formatCurrency(saving.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">No savings recorded yet</p>
            </div>
          )}
        </div>

        {/* Recent Loans */}
        <div className="bg-white shadow rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Loan History</h3>
            <CreditCardIcon className="h-5 w-5 text-gray-400" />
          </div>
          
          {recentLoans.length > 0 ? (
            <div className="space-y-3">
              {recentLoans.map((loan) => (
                <div key={loan.$id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(loan.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Applied: {new Date(loan.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      loan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      loan.status === 'approved' ? 'bg-green-100 text-green-800' :
                      loan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {loan.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">No loans applied for yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white shadow rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Guarantor Requests</h3>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">
            {guarantorRequests.filter(request => request.status === 'pending').length} pending
          </span>
        </div>

        {guarantorRequests.length === 0 ? (
          <div className="text-sm text-gray-500">
            No guarantor requests assigned to you yet.
          </div>
        ) : (
          <div className="space-y-3">
            {guarantorRequests.map((request) => (
              <div
                key={request.$id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-900">
                      Borrower: {request.borrowerName}
                    </div>
                    <div className="text-xs text-slate-600">
                      Loan: {formatCurrency(request.loanAmount)} | Type: {request.loanType === 'long_term' ? 'Long-Term' : 'Short-Term'} | Term: {request.selectedMonths || '-'} months
                    </div>
                    <div className="text-xs text-slate-600">
                      Your guarantee:{' '}
                      {request.guaranteeType === 'percent'
                        ? `${request.guaranteedPercent}% (~${formatCurrency(request.guaranteedAmount)})`
                        : formatCurrency(request.guaranteedAmount)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Requested:{' '}
                      {request.requestedAt
                        ? new Date(request.requestedAt).toLocaleDateString()
                        : '-'}
                    </div>
                    {request.comment ? (
                      <div className="text-xs text-slate-500">
                        Comment: {request.comment}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGuarantorStatusBadgeClass(request.status)}`}>
                      {request.status}
                    </span>
                    {request.status === 'pending' ? (
                      <div className="w-full md:w-72 space-y-2">
                        <textarea
                          value={responseComments[request.$id] || ''}
                          onChange={(event) => {
                            const value = event.target.value;
                            setResponseComments((prev) => ({
                              ...prev,
                              [request.$id]: value
                            }));
                          }}
                          rows={2}
                          maxLength={500}
                          placeholder="Optional comment for your response"
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleGuarantorActionClick(request, 'approve')}
                            disabled={respondingRequestId === request.$id}
                            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded-md hover:bg-green-200 disabled:opacity-50"
                          >
                            {respondingRequestId === request.$id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGuarantorActionClick(request, 'decline')}
                            disabled={respondingRequestId === request.$id}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 disabled:opacity-50"
                          >
                            {respondingRequestId === request.$id ? 'Processing...' : 'Decline'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        This request has already been responded to.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 bg-white shadow rounded-2xl border border-slate-100 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notifications</h3>
        <div className="space-y-3">
          {notifications.map(note => (
            <div key={note.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
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
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-white shadow rounded-2xl border border-slate-100 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setShowSavingsModal(true)}
            className="text-left p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-xl transition-all duration-200 border border-emerald-200"
          >
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mr-4">
                <BanknotesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-emerald-900">Monthly Savings</div>
                <div className="text-sm text-emerald-700">Tap to view savings by month</div>
              </div>
            </div>
          </button>
          <button
            onClick={() => setShowLoansModal(true)}
            className="text-left p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 rounded-xl transition-all duration-200 border border-indigo-200"
          >
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center mr-4">
                <CreditCardIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-indigo-900">Loan Details</div>
                <div className="text-sm text-indigo-700">Tap to view loan status</div>
              </div>
            </div>
          </button>
          <Link to="/member/loans" className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all duration-200 border border-blue-200 block">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4">
                <CreditCardIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-blue-900">Apply for Loan</div>
                <div className="text-sm text-blue-700">Submit a new loan application</div>
              </div>
            </div>
          </Link>
          
          <Link to="/member/savings" className="p-4 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-xl transition-all duration-200 border border-green-200 block">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4">
                <BanknotesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-green-900">View Savings</div>
                <div className="text-sm text-green-700">Check your savings history</div>
              </div>
            </div>
          </Link>
          
          <Link to="/member/reports" className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all duration-200 border border-purple-200 block">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
                <ChartBarIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-purple-900">Download Reports</div>
                <div className="text-sm text-purple-700">Get your financial statements</div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Monthly Savings Modal */}
      {showSavingsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Savings by Month</h3>
            {monthlySavingsData().length === 0 ? (
              <div className="text-sm text-gray-500">No savings recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {monthlySavingsData().map((item) => (
                      <tr key={item.month}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {new Date(item.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-4 space-x-3">
              <Link
                to="/member/savings"
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
              >
                View Full Savings
              </Link>
              <button
                onClick={() => setShowSavingsModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Details Modal */}
      {showLoansModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Details</h3>
            {memberData.loans.length === 0 ? (
              <div className="text-sm text-gray-500">No loans found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Applied</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {memberData.loans
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .map(loan => (
                        <tr key={loan.$id}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {formatCurrency(loan.amount)}
                          </td>
                          <td className="px-4 py-2 text-center text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              loan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                              loan.status === 'approved' ? 'bg-green-100 text-green-800' :
                              loan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {loan.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center text-sm text-gray-500">
                            {new Date(loan.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-4 space-x-3">
              <Link
                to="/member/loans"
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
              >
                View Full Loans
              </Link>
              <button
                onClick={() => setShowLoansModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberOverview;
