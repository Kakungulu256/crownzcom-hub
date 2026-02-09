import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { databases, functions, DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { formatCurrency } from '../../utils/financial';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { listAllDocuments } from '../../lib/pagination';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';

const LoansManagement = () => {
  const [loans, setLoans] = useState([]);
  const [loanCharges, setLoanCharges] = useState([]);
  const [members, setMembers] = useState([]);
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [showRepaymentForm, setShowRepaymentForm] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [editingCharge, setEditingCharge] = useState(null);
  const [financialConfig, setFinancialConfig] = useState({ ...DEFAULT_FINANCIAL_CONFIG });
  const [loanRepayments, setLoanRepayments] = useState([]);
  const [showMemberPaymentsModal, setShowMemberPaymentsModal] = useState(false);
  const [memberPaymentMonth, setMemberPaymentMonth] = useState(1);
  const [memberPaymentsSelection, setMemberPaymentsSelection] = useState({});
  const [loanPaymentsSelection, setLoanPaymentsSelection] = useState({});
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadingAction, setLoadingAction] = useState('');
  const [showEditDatesModal, setShowEditDatesModal] = useState(false);
  const [editLoanDate, setEditLoanDate] = useState('');
  const [editRepaymentDates, setEditRepaymentDates] = useState({});
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [loans, members, savings, charges, repayments, config] = await Promise.all([
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.MEMBERS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_CHARGES),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS),
        fetchFinancialConfig(databases, DATABASE_ID, COLLECTIONS.FINANCIAL_CONFIG)
      ]);
      
      setLoans(loans);
      setMembers(members);
      setSavings(savings);
      setLoanCharges(charges);
      setLoanRepayments(repayments);
      setFinancialConfig(config);
    } catch (error) {
      toast.error('Failed to fetch data');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const normalizeMemberId = (value) => {
    if (!value) return null;
    return typeof value === 'object' && value.$id ? value.$id : value;
  };

  const getMemberSavings = (memberId) => {
    const targetId = normalizeMemberId(memberId);
    return savings
      .filter(saving => normalizeMemberId(saving.memberId) === targetId)
      .reduce((total, saving) => total + saving.amount, 0);
  };

  const getMemberName = (memberId) => {
    const targetId = normalizeMemberId(memberId);
    const member = members.find(m => m.$id === targetId);
    return member ? member.name : 'Unknown';
  };

  const callLoanFunction = async (action, data = {}) => {
    try {
      const functionId = import.meta.env.VITE_APPWRITE_LOAN_FUNCTION_ID || 'loan-management';
      const response = await functions.createExecution(
        functionId,
        JSON.stringify({ action, ...data })
      );
      if (!response.responseBody) {
        throw new Error('Loan function returned an empty response. Check function logs for details.');
      }
      const result = JSON.parse(response.responseBody);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      console.error('Function error:', error);
      throw error;
    }
  };

  const approveLoan = async (loan) => {
    try {
      setLoadingAction(`approve:${loan.$id}`);
      await callLoanFunction('approveLoan', { loanId: loan.$id });
      toast.success('Loan approved successfully');
      setSelectedLoan(loan);
      setEditingCharge(null);
      reset();
      setShowChargeForm(true);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to approve loan');
    } finally {
      setLoadingAction('');
    }
  };

  const rejectLoan = async (loanId) => {
    try {
      setLoadingAction(`reject:${loanId}`);
      await callLoanFunction('rejectLoan', { loanId });
      toast.success('Loan rejected');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to reject loan');
    } finally {
      setLoadingAction('');
    }
  };

  const addOrUpdateCharge = async (data) => {
    try {
      setLoadingAction(editingCharge ? `charge:update:${editingCharge.$id}` : `charge:add:${selectedLoan?.$id}`);
      if (editingCharge) {
        await callLoanFunction('updateLoanCharge', {
          chargeId: editingCharge.$id,
          description: data.description,
          amount: data.amount
        });
      } else {
        await callLoanFunction('addLoanCharge', {
          loanId: selectedLoan.$id,
          description: data.description,
          amount: data.amount
        });
      }
      
      reset();
      setShowChargeForm(false);
      setSelectedLoan(null);
      setEditingCharge(null);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to process charge');
    } finally {
      setLoadingAction('');
    }
  };

  const deleteCharge = async () => {
    if (!editingCharge) return;
    try {
      setLoadingAction(`charge:delete:${editingCharge.$id}`);
      await callLoanFunction('deleteLoanCharge', { chargeId: editingCharge.$id });
      reset();
      setShowChargeForm(false);
      setSelectedLoan(null);
      setEditingCharge(null);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete charge');
    } finally {
      setLoadingAction('');
    }
  };

  const recordMemberMonthPayments = async () => {
    if (!selectedMember) return;
    const selections = Object.entries(memberPaymentsSelection)
      .filter(([, value]) => value?.checked)
      .map(([loanId, value]) => ({
        loanId,
        isEarlyPayment: !!value?.earlyPayoff
      }));

    try {
      if (selections.length === 0) {
        toast.error('Select at least one payment to record');
        return;
      }
      setLoadingAction(`member-payments:${selectedMember.$id}`);
      for (const selection of selections) {
        await callLoanFunction('recordRepayment', {
          loanId: selection.loanId,
          month: memberPaymentMonth,
          isEarlyPayment: selection.isEarlyPayment,
          paidAt: paymentDate
        });
      }
      toast.success('Payments recorded successfully');
      setShowMemberPaymentsModal(false);
      setMemberPaymentsSelection({});
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to record payments');
    } finally {
      setLoadingAction('');
    }
  };

  const toggleLoanPaymentSelection = (month, value) => {
    setLoanPaymentsSelection(prev => ({
      ...prev,
      [month]: value
    }));
  };

  const recordLoanPayments = async () => {
    if (!selectedLoan) return;
    const months = Object.entries(loanPaymentsSelection)
      .filter(([, checked]) => checked)
      .map(([month]) => parseInt(month))
      .filter(Boolean);

    try {
      if (months.length === 0) {
        toast.error('Select at least one payment to record');
        return;
      }
      setLoadingAction(`loan-payments:${selectedLoan.$id}`);
      for (const month of months) {
        await callLoanFunction('recordRepayment', {
          loanId: selectedLoan.$id,
          month,
          isEarlyPayment: false,
          paidAt: paymentDate
        });
      }
      toast.success('Payments recorded successfully');
      setShowRepaymentForm(false);
      setSelectedLoan(null);
      setLoanPaymentsSelection({});
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to record payments');
    } finally {
      setLoadingAction('');
    }
  };

  const getMemberLoans = (memberId) => {
    const targetId = normalizeMemberId(memberId);
    return loans.filter(loan => normalizeMemberId(loan.memberId) === targetId);
  };

  const getMemberAvailableCredit = (memberId) => {
    const totalSavings = getMemberSavings(memberId);
    const maxLoanAmount = totalSavings * 0.8;
    const activeLoansAmount = loans
      .filter(loan => normalizeMemberId(loan.memberId) === normalizeMemberId(memberId) && loan.status === 'active')
      .reduce((total, loan) => total + (loan.balance || loan.amount), 0);
    return Math.max(0, maxLoanAmount - activeLoansAmount);
  };

  const normalizeLoanId = (value) => {
    if (!value) return null;
    return typeof value === 'object' && value.$id ? value.$id : value;
  };

  const getLoanCharge = (loanId) => {
    return loanCharges.find(charge => normalizeLoanId(charge.loanId) === normalizeLoanId(loanId));
  };

  const getLoanChargeTotal = (loanId) => {
    return loanCharges
      .filter(charge => normalizeLoanId(charge.loanId) === normalizeLoanId(loanId))
      .reduce((sum, charge) => sum + (parseInt(charge.amount) || 0), 0);
  };

  const getLoanRepaymentForMonth = (loanId, month) => {
    return loanRepayments.find(
      repayment => normalizeLoanId(repayment.loanId) === normalizeLoanId(loanId) && parseInt(repayment.month) === parseInt(month)
    );
  };

  const getLoanRepayments = (loanId) => {
    return loanRepayments
      .filter(repayment => normalizeLoanId(repayment.loanId) === normalizeLoanId(loanId))
      .sort((a, b) => parseInt(a.month) - parseInt(b.month));
  };

  const openEditDatesModal = (loan) => {
    setSelectedLoan(loan);
    setEditLoanDate(loan.createdAt ? new Date(loan.createdAt).toISOString().split('T')[0] : '');
    const repaymentMap = {};
    getLoanRepayments(loan.$id).forEach((repayment) => {
      repaymentMap[repayment.$id] = repayment.paidAt ? new Date(repayment.paidAt).toISOString().split('T')[0] : '';
    });
    setEditRepaymentDates(repaymentMap);
    setShowEditDatesModal(true);
  };

  const saveLoanDate = async () => {
    if (!selectedLoan) return;
    try {
      setLoadingAction(`loan-date:${selectedLoan.$id}`);
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.LOANS,
        selectedLoan.$id,
        {
          createdAt: editLoanDate ? new Date(editLoanDate).toISOString() : selectedLoan.createdAt
        }
      );
      toast.success('Loan application date updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update loan date');
    } finally {
      setLoadingAction('');
    }
  };

  const saveRepaymentDate = async (repaymentId) => {
    try {
      setLoadingAction(`repayment-date:${repaymentId}`);
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.LOAN_REPAYMENTS,
        repaymentId,
        {
          paidAt: editRepaymentDates[repaymentId]
            ? new Date(editRepaymentDates[repaymentId]).toISOString()
            : new Date().toISOString()
        }
      );
      toast.success('Repayment date updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update repayment date');
    } finally {
      setLoadingAction('');
    }
  };

  const getRepaymentSchedule = (loan) => {
    if (!loan?.repaymentPlan) return [];
    try {
      return JSON.parse(loan.repaymentPlan);
    } catch {
      return [];
    }
  };

  const getMemberMonthlyDuePayments = (memberId, monthNumber) => {
    const month = parseInt(monthNumber);
    const activeMemberLoans = loans.filter(
      loan => normalizeMemberId(loan.memberId) === normalizeMemberId(memberId) && loan.status === 'active'
    );

    return activeMemberLoans
      .map(loan => {
        const schedule = getRepaymentSchedule(loan);
        const scheduleItem = schedule.find(item => parseInt(item.month) === month);
        if (!scheduleItem) return null;
        const alreadyPaid = !!getLoanRepaymentForMonth(loan.$id, month);
        const bankCharge = month === 1 ? getLoanChargeTotal(loan.$id) : 0;
        return {
          loan,
          scheduleItem,
          alreadyPaid,
          amount: scheduleItem.payment + bankCharge
        };
      })
      .filter(item => item && !item.alreadyPaid);
  };

  const getNextUnpaidMonth = (memberId) => {
    const activeMemberLoans = loans.filter(
      loan => normalizeMemberId(loan.memberId) === normalizeMemberId(memberId) && loan.status === 'active'
    );
    const months = [];

    activeMemberLoans.forEach(loan => {
      const schedule = getRepaymentSchedule(loan);
      schedule.forEach(item => {
        const month = parseInt(item.month);
        if (!getLoanRepaymentForMonth(loan.$id, month)) {
          months.push(month);
        }
      });
    });

    if (months.length === 0) {
      return 1;
    }
    return Math.min(...months);
  };

  const getEarlyPayoffAmount = (loan, monthNumber) => {
    const principal = loan.amount;
    const remainingBalance = loan.balance || loan.amount;
    const monthlyRate = (financialConfig.loanInterestRate || 2) / 100;
    const penaltyRate = (financialConfig.earlyRepaymentPenalty || 1) / 100;
    const interestAmount = principal * (monthlyRate + penaltyRate);
    const bankCharge = parseInt(monthNumber) === 1 ? getLoanChargeTotal(loan.$id) : 0;
    return Math.ceil(remainingBalance + interestAmount + bankCharge);
  };

  const toggleMemberPaymentSelection = (loanId, field, value) => {
    setMemberPaymentsSelection(prev => ({
      ...prev,
      [loanId]: {
        ...prev[loanId],
        [field]: value
      }
    }));
  };

  const pendingLoans = loans.filter(loan => loan.status === 'pending');
  const activeLoans = loans.filter(loan => loan.status === 'active' || loan.status === 'approved');
  const rejectedLoans = loans.filter(loan => loan.status === 'rejected');
  const completedLoans = loans.filter(loan => loan.status === 'completed');

  if (loading) {
    return <div className="animate-pulse">Loading loans data...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Loans Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review and manage loan applications and active loans
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{pendingLoans.length}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Active</div>
          <div className="text-2xl font-bold text-blue-600">{activeLoans.length}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Rejected</div>
          <div className="text-2xl font-bold text-red-600">{rejectedLoans.length}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Portfolio</div>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(
              activeLoans.reduce((total, loan) => total + loan.amount, 0)
            )}
          </div>
        </div>
      </div>

      {/* Member Loan Management */}
      <div className="card mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Member Loan Management</h3>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Member
          </label>
          <select 
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => {
              const memberId = e.target.value;
              if (memberId) {
                const member = members.find(m => m.$id === memberId);
                setSelectedMember(member);
              } else {
                setSelectedMember(null);
              }
            }}
          >
            <option value="">Choose a member...</option>
            {members.map(member => (
              <option key={member.$id} value={member.$id}>
                {member.name} - {member.membershipNumber}
              </option>
            ))}
          </select>
        </div>

        {selectedMember && (
          <div className="mb-6">
            <button
              onClick={() => {
                const nextMonth = getNextUnpaidMonth(selectedMember.$id);
                setMemberPaymentMonth(nextMonth);
                setMemberPaymentsSelection({});
                setShowMemberPaymentsModal(true);
              }}
              className="btn-primary"
            >
              Record Monthly Payments
            </button>
          </div>
        )}

        {selectedMember && (
          <div>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Member</div>
                  <div className="text-lg font-semibold">{selectedMember.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Total Savings</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(getMemberSavings(selectedMember.$id))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Max Loan Amount</div>
                  <div className="text-lg font-semibold text-blue-600">
                    {formatCurrency(getMemberSavings(selectedMember.$id) * 0.8)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Available Credit</div>
                  <div className="text-lg font-semibold text-purple-600">
                    {formatCurrency(getMemberAvailableCredit(selectedMember.$id))}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getMemberLoans(selectedMember.$id).map((loan) => (
                    <tr key={loan.$id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(loan.balance || loan.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          loan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          loan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                          loan.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center space-x-2">
                          {loan.status === 'pending' && (
                            <>
                              <button
                                onClick={() => approveLoan(loan)}
                                disabled={loadingAction === `approve:${loan.$id}`}
                                className="text-green-600 hover:text-green-900"
                                title="Approve"
                              >
                                {loadingAction === `approve:${loan.$id}` ? (
                                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                                ) : (
                                  <CheckIcon className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => rejectLoan(loan.$id)}
                                disabled={loadingAction === `reject:${loan.$id}`}
                                className="text-red-600 hover:text-red-900"
                                title="Reject"
                              >
                                {loadingAction === `reject:${loan.$id}` ? (
                                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                ) : (
                                  <XMarkIcon className="h-4 w-4" />
                                )}
                              </button>
                            </>
                          )}
                          {(loan.status === 'active' || loan.status === 'approved') && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedLoan(loan);
                              setShowChargeForm(true);
                              const existingCharge = getLoanCharge(loan.$id);
                              if (existingCharge) {
                                    setEditingCharge(existingCharge);
                                    reset({
                                      description: existingCharge.description,
                                      amount: existingCharge.amount
                                    });
                                  } else {
                                    setEditingCharge(null);
                                    reset();
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="Add/Update Charges"
                          >
                            {loadingAction.startsWith('charge:') ? (
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                            ) : (
                              'Manage Charge'
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setShowRepaymentForm(true);
                              setLoanPaymentsSelection({});
                            }}
                            disabled={loadingAction === `loan-payments:${loan.$id}`}
                                className="text-blue-600 hover:text-blue-900"
                                title="Record Payment"
                              >
                                {loadingAction === `loan-payments:${loan.$id}` ? (
                                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                                ) : (
                                  'Record Payment'
                                )}
                              </button>
                              <button
                                onClick={() => openEditDatesModal(loan)}
                                className="text-slate-600 hover:text-slate-900"
                                title="Edit Dates"
                              >
                                Edit Dates
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {getMemberLoans(selectedMember.$id).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No loans found for this member
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending Loans */}
      {pendingLoans.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Applications</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eligible
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingLoans.map((loan) => {
                  const memberSavings = getMemberSavings(loan.memberId);
                  const maxLoanAmount = memberSavings * 0.8;
                  const isEligible = loan.amount <= maxLoanAmount;
                  
                  return (
                    <tr key={loan.$id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getMemberName(loan.memberId)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Savings: {formatCurrency(memberSavings)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          isEligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {isEligible ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => approveLoan(loan)}
                            disabled={!isEligible}
                            className={`${isEligible ? 'text-green-600 hover:text-green-900' : 'text-gray-400 cursor-not-allowed'}`}
                            title="Approve"
                          >
                            <CheckIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => rejectLoan(loan.$id)}
                            className="text-red-600 hover:text-red-900"
                            title="Reject"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Loans */}
      {activeLoans.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Loans</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeLoans.map((loan) => (
                  <tr key={loan.$id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {getMemberName(loan.memberId)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatCurrency(loan.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatCurrency(loan.balance || loan.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setShowChargeForm(true);
                            const existingCharge = getLoanCharge(loan.$id);
                            if (existingCharge) {
                              setEditingCharge(existingCharge);
                              reset({
                                description: existingCharge.description,
                                amount: existingCharge.amount
                              });
                            } else {
                              setEditingCharge(null);
                              reset();
                            }
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Add/Update Charges"
                        >
                          {loadingAction.startsWith('charge:') ? (
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                          ) : (
                            'Manage Charge'
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setShowRepaymentForm(true);
                            setLoanPaymentsSelection({});
                          }}
                          disabled={loadingAction === `loan-payments:${loan.$id}`}
                          className="text-blue-600 hover:text-blue-900"
                          title="Record Payment"
                        >
                          {loadingAction === `loan-payments:${loan.$id}` ? (
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                          ) : (
                            'Record Payment'
                          )}
                        </button>
                        <button
                          onClick={() => openEditDatesModal(loan)}
                          className="text-slate-600 hover:text-slate-900"
                          title="Edit Dates"
                        >
                          Edit Dates
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEditDatesModal && selectedLoan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit Loan & Repayment Dates
            </h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Loan Application Date</label>
              <div className="flex items-center space-x-3">
                <input
                  type="date"
                  value={editLoanDate}
                  onChange={(e) => setEditLoanDate(e.target.value)}
                  className="form-input max-w-xs"
                />
                <button
                  type="button"
                  onClick={saveLoanDate}
                  disabled={loadingAction === `loan-date:${selectedLoan.$id}`}
                  className="btn-primary"
                >
                  {loadingAction === `loan-date:${selectedLoan.$id}` ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Save Loan Date'
                  )}
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Repayment Dates</h4>
              {getLoanRepayments(selectedLoan.$id).length === 0 ? (
                <div className="text-sm text-gray-500">No repayments recorded for this loan.</div>
              ) : (
                <div className="space-y-3">
                  {getLoanRepayments(selectedLoan.$id).map((repayment) => (
                    <div key={repayment.$id} className="flex items-center justify-between border border-gray-200 rounded-md p-3">
                      <div className="text-sm text-gray-700">
                        Month {repayment.month} · {formatCurrency(repayment.amount)}
                      </div>
                      <div className="flex items-center space-x-3">
                        <input
                          type="date"
                          value={editRepaymentDates[repayment.$id] || ''}
                          onChange={(e) =>
                            setEditRepaymentDates((prev) => ({
                              ...prev,
                              [repayment.$id]: e.target.value
                            }))
                          }
                          className="form-input max-w-xs"
                        />
                        <button
                          type="button"
                          onClick={() => saveRepaymentDate(repayment.$id)}
                          disabled={loadingAction === `repayment-date:${repayment.$id}`}
                          className="btn-secondary"
                        >
                          {loadingAction === `repayment-date:${repayment.$id}` ? (
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-transparent" />
                          ) : (
                            'Save'
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowEditDatesModal(false);
                  setSelectedLoan(null);
                }}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Charge Modal */}
      {showChargeForm && selectedLoan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingCharge ? 'Edit' : 'Add'} Bank Charge
            </h3>
            <form onSubmit={handleSubmit(addOrUpdateCharge)}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  {...register('description', { required: 'Description is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Bank processing fee"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (UGX)
                </label>
                <input
                  type="number"
                  {...register('amount', { required: 'Amount is required', min: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter amount"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
                )}
              </div>
              <div className="flex justify-end space-x-3">
                {editingCharge && (
                  <button
                    type="button"
                    onClick={deleteCharge}
                    disabled={loadingAction === `charge:delete:${editingCharge.$id}`}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                  >
                    {loadingAction === `charge:delete:${editingCharge.$id}` ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                    ) : (
                      'Remove Charge'
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowChargeForm(false);
                    setSelectedLoan(null);
                    setEditingCharge(null);
                    reset();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAction.startsWith('charge:')}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  {loadingAction.startsWith('charge:') ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    `${editingCharge ? 'Update' : 'Add'} Charge`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {showRepaymentForm && selectedLoan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Record Payment - {getMemberName(selectedLoan.memberId)}
            </h3>
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <div className="text-sm text-gray-600">
                Loan Amount: {formatCurrency(selectedLoan.amount)}
              </div>
              <div className="text-sm text-gray-600">
                Current Balance: {formatCurrency(selectedLoan.balance || selectedLoan.amount)}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Use this to backfill older repayments. Later this can be locked to today.</p>
            </div>

            <div className="mb-6">
              {getRepaymentSchedule(selectedLoan).length === 0 ? (
                <div className="text-sm text-gray-500">
                  No repayment schedule found for this loan.
                </div>
              ) : (
                <div className="space-y-3">
                  {getRepaymentSchedule(selectedLoan)
                    .filter(item => !getLoanRepaymentForMonth(selectedLoan.$id, item.month))
                    .map(item => (
                      <div key={item.month} className="border border-gray-200 rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              Month {item.month}
                            </div>
                            <div className="text-xs text-gray-500">
                              Payment: {formatCurrency(item.payment + (parseInt(item.month) === 1 ? getLoanChargeTotal(selectedLoan.$id) : 0))}
                            </div>
                          </div>
                          <label className="flex items-center text-sm">
                            <input
                              type="checkbox"
                              className="mr-2"
                              checked={!!loanPaymentsSelection[item.month]}
                              onChange={(e) => toggleLoanPaymentSelection(item.month, e.target.checked)}
                            />
                            Mark as paid
                          </label>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowRepaymentForm(false);
                  setSelectedLoan(null);
                  setLoanPaymentsSelection({});
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={recordLoanPayments}
                disabled={loadingAction === `loan-payments:${selectedLoan.$id}`}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                {loadingAction === `loan-payments:${selectedLoan.$id}` ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Record Selected Payments'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Monthly Payments Modal */}
      {showMemberPaymentsModal && selectedMember && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Record Monthly Payments - {selectedMember.name}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">Use this to backfill older repayments. Later this can be locked to today.</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Month Number
              </label>
              <input
                type="number"
                min="1"
                value={memberPaymentMonth}
                onChange={(e) => setMemberPaymentMonth(parseInt(e.target.value) || 1)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              {getMemberMonthlyDuePayments(selectedMember.$id, memberPaymentMonth).length === 0 ? (
                <div className="text-sm text-gray-500">
                  No scheduled payments found for this month.
                </div>
              ) : (
                <div className="space-y-3">
                  {getMemberMonthlyDuePayments(selectedMember.$id, memberPaymentMonth).map(item => {
                    const loanId = item.loan.$id;
                    const selection = memberPaymentsSelection[loanId] || {};
                    const earlyAmount = getEarlyPayoffAmount(item.loan, memberPaymentMonth);
                    const displayAmount = selection.earlyPayoff ? earlyAmount : item.amount;

                    return (
                      <div key={loanId} className="border border-gray-200 rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              Loan: {formatCurrency(item.loan.amount)} (Balance: {formatCurrency(item.loan.balance || item.loan.amount)})
                            </div>
                            <div className="text-xs text-gray-500">
                              Scheduled payment: {formatCurrency(item.amount)}
                            </div>
                            {selection.earlyPayoff && (
                              <div className="text-xs text-blue-600">
                                Early payoff amount: {formatCurrency(displayAmount)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <label className="flex items-center text-sm">
                              <input
                                type="checkbox"
                                className="mr-2"
                                checked={!!selection.earlyPayoff}
                                onChange={(e) => toggleMemberPaymentSelection(loanId, 'earlyPayoff', e.target.checked)}
                              />
                              Early payoff
                            </label>
                            <label className="flex items-center text-sm">
                              <input
                                type="checkbox"
                                className="mr-2"
                                checked={!!selection.checked}
                                onChange={(e) => toggleMemberPaymentSelection(loanId, 'checked', e.target.checked)}
                              />
                              Mark as paid
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowMemberPaymentsModal(false);
                  setMemberPaymentsSelection({});
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={recordMemberMonthPayments}
                disabled={loadingAction === `member-payments:${selectedMember.$id}`}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                {loadingAction === `member-payments:${selectedMember.$id}` ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Record Selected Payments'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoansManagement;
