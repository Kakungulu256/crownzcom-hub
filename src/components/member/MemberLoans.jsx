import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { databases, DATABASE_ID, COLLECTIONS, Query, functions } from '../../lib/appwrite';
import { useAuth } from '../../lib/auth';
import { formatCurrency, validateLoanApplication, generateRepaymentSchedule, calculateAvailableCredit } from '../../utils/financial';
import { PlusIcon, EyeIcon } from '@heroicons/react/24/outline';
import { ID } from 'appwrite';
import toast from 'react-hot-toast';
import { fetchMemberRecord } from '../../lib/member';
import { listAllDocuments } from '../../lib/pagination';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';

const MemberLoans = () => {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loanCharges, setLoanCharges] = useState([]);
  const [loanRepayments, setLoanRepayments] = useState([]);
  const [memberData, setMemberData] = useState({ totalSavings: 0, memberId: null });
  const [loading, setLoading] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [repaymentType, setRepaymentType] = useState('equal');
  const [customPayments, setCustomPayments] = useState([]);
  const [financialConfig, setFinancialConfig] = useState({ ...DEFAULT_FINANCIAL_CONFIG });
  const [applicationDate, setApplicationDate] = useState(new Date().toISOString().split('T')[0]);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [earlyPayoffDate, setEarlyPayoffDate] = useState(new Date().toISOString().split('T')[0]);
  const [earlyPayoffLoading, setEarlyPayoffLoading] = useState(false);
  
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const watchedAmount = watch('amount', 0);
  const watchedDuration = watch('duration', 1);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (repaymentType === 'custom' && watchedDuration && parseInt(watchedDuration) > 0) {
      initializeCustomPayments(parseInt(watchedDuration));
    }
  }, [repaymentType, watchedDuration]);

  const normalizeLoanId = (value) => {
    if (!value) return null;
    return typeof value === 'object' && value.$id ? value.$id : value;
  };

  const getLoanLabelMap = (loanList) => {
    return loanList
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .reduce((acc, loan, index) => {
        acc[loan.$id] = `Loan_${index + 1}`;
        return acc;
      }, {});
  };

  const fetchData = async () => {
    try {
      // Get member record (prefer authUserId mapping)
      const member = await fetchMemberRecord({ databases, DATABASE_ID, COLLECTIONS, user });
      if (!member) {
        console.error('Member record not found');
        return;
      }
      const memberId = member.$id;
      
      // Fetch member's savings and loans
      const [savings, loans, charges, repayments, config] = await Promise.all([
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS, [
          Query.equal('memberId', memberId)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS, [
          Query.equal('memberId', memberId)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_CHARGES),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS),
        fetchFinancialConfig(databases, DATABASE_ID, COLLECTIONS.FINANCIAL_CONFIG)
      ]);
      
      const totalSavings = savings.reduce((sum, saving) => sum + saving.amount, 0);
      
      setMemberData({ totalSavings, memberId });
      setLoans(loans);
      const loanIds = new Set(loans.map(loan => loan.$id));
      setLoanCharges(charges.filter(charge =>
        loanIds.has(normalizeLoanId(charge.loanId))
      ));
      setLoanRepayments(repayments.filter(repayment =>
        loanIds.has(normalizeLoanId(repayment.loanId))
      ));
      setFinancialConfig(config);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      setLoanSubmitting(true);
      const amount = parseInt(data.amount);
      const duration = parseInt(data.duration);
      
      // Validate loan eligibility
      const existingLoanAmount = loans
        .filter(loan => loan.status === 'active' || loan.status === 'approved')
        .reduce((sum, loan) => sum + (loan.balance || loan.amount), 0);
      
      const eligibilityPercent = (financialConfig.loanEligibilityPercentage || 80) / 100;
      const monthlyRate = (financialConfig.loanInterestRate || 2) / 100;
      const validation = validateLoanApplication(
        amount,
        memberData.totalSavings,
        existingLoanAmount,
        eligibilityPercent
      );
      
      if (!validation.isValid) {
        toast.error(`Loan amount exceeds eligibility. Maximum available: ${formatCurrency(validation.maxEligible - validation.currentExposure)}`);
        return;
      }
      
      // Generate repayment schedule
      let repaymentPlan;
      if (repaymentType === 'custom' && customPayments.length > 0) {
        repaymentPlan = generateRepaymentSchedule(amount, duration, customPayments, monthlyRate);
      } else {
        repaymentPlan = generateRepaymentSchedule(amount, duration, null, monthlyRate);
      }
      
      const loanData = {
        memberId: memberData.memberId,
        amount,
        duration,
        purpose: data.purpose || '',
        repaymentType,
        repaymentPlan: JSON.stringify(repaymentPlan),
        status: 'pending',
        createdAt: applicationDate ? new Date(applicationDate).toISOString() : new Date().toISOString()
      };
      
      await databases.createDocument(DATABASE_ID, COLLECTIONS.LOANS, ID.unique(), loanData);
      toast.success('Loan application submitted successfully');
      
      reset();
      setShowApplicationForm(false);
      setCustomPayments([]);
      fetchData();
    } catch (error) {
      toast.error('Failed to submit loan application');
      console.error('Error submitting loan:', error);
    } finally {
      setLoanSubmitting(false);
    }
  };

  const handleCustomPaymentChange = (index, value) => {
    const newPayments = [...customPayments];
    
    // Don't allow editing the last month (auto-calculated)
    if (index === newPayments.length - 1) return;
    
    newPayments[index] = parseInt(value) || 0;
    
    // Auto-calculate last month payment
    if (watchedAmount && watchedDuration) {
      const principal = parseInt(watchedAmount);
      const totalInterest = principal * 0.02 * parseInt(watchedDuration);
      const totalRequired = principal + totalInterest;
      const paidSoFar = newPayments.slice(0, -1).reduce((sum, payment) => sum + payment, 0);
      newPayments[newPayments.length - 1] = Math.max(0, totalRequired - paidSoFar);
    }
    
    setCustomPayments(newPayments);
  };

  const initializeCustomPayments = (duration) => {
    const payments = new Array(duration).fill(0);
    setCustomPayments(payments);
  };

  const validation = validateLoanApplication(
    parseInt(watchedAmount) || 0, 
    memberData.totalSavings,
    loans.filter(loan => loan.status === 'active' || loan.status === 'approved').reduce((sum, loan) => sum + (loan.balance || loan.amount), 0),
    (financialConfig.loanEligibilityPercentage || 80) / 100
  );

  if (loading) {
    return <div className="animate-pulse">Loading loans data...</div>;
  }

  const loanLabelMap = getLoanLabelMap(loans);
  const getLoanLabel = (loanId) => loanLabelMap[normalizeLoanId(loanId)] || 'Loan';

  const getLoanChargeTotal = (loanId) => {
    const targetId = normalizeLoanId(loanId);
    return loanCharges
      .filter(charge => normalizeLoanId(charge.loanId) === targetId)
      .reduce((sum, charge) => sum + (parseInt(charge.amount) || 0), 0);
  };

  const getLoanPaidAmount = (loanId) => {
    const targetId = normalizeLoanId(loanId);
    return loanRepayments
      .filter(repayment => normalizeLoanId(repayment.loanId) === targetId)
      .reduce((sum, repayment) => sum + (parseInt(repayment.amount) || 0), 0);
  };

  const getNextUnpaidMonth = (loan) => {
    if (!loan?.repaymentPlan) return 1;
    try {
      const schedule = JSON.parse(loan.repaymentPlan);
      const paidMonths = new Set(
        loanRepayments
          .filter(repayment => normalizeLoanId(repayment.loanId) === normalizeLoanId(loan.$id))
          .map(repayment => parseInt(repayment.month))
      );
      const next = schedule.find(item => !paidMonths.has(parseInt(item.month)));
      return next ? parseInt(next.month) : schedule.length;
    } catch {
      return 1;
    }
  };

  const getEarlyPayoffAmount = (loan, monthNumber) => {
    const interestRate = ((financialConfig.loanInterestRate || 0) + (financialConfig.earlyRepaymentPenalty || 0)) / 100;
    const interestAmount = (loan.amount || 0) * interestRate;
    const hasFirstMonthRepayment = loanRepayments.some(
      repayment => normalizeLoanId(repayment.loanId) === normalizeLoanId(loan.$id) && parseInt(repayment.month) === 1
    );
    const chargeAmount = monthNumber === 1 && !hasFirstMonthRepayment ? getLoanChargeTotal(loan.$id) : 0;
    const currentBalance = loan.balance || loan.amount || 0;
    return Math.ceil(currentBalance + interestAmount + chargeAmount);
  };

  const requestEarlyPayoff = async () => {
    if (!selectedLoan) return;
    try {
      setEarlyPayoffLoading(true);
      const monthNumber = getNextUnpaidMonth(selectedLoan);
      const response = await functions.createExecution(
        import.meta.env.VITE_APPWRITE_LOAN_FUNCTION_ID,
        JSON.stringify({
          action: 'recordRepayment',
          loanId: selectedLoan.$id,
          month: monthNumber,
          isEarlyPayment: true,
          paidAt: earlyPayoffDate
        })
      );
      const result = JSON.parse(response.responseBody || '{}');
      if (!result.success) {
        throw new Error(result.error || 'Early payoff failed');
      }
      toast.success('Early payoff recorded');
      setSelectedLoan(null);
      await fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to record early payoff');
    } finally {
      setEarlyPayoffLoading(false);
    }
  };

  const getLoanOutstandingBalance = (loan) => {
    return loan.balance || loan.amount;
  };

  const getTotalInterest = (loan) => {
    if (!loan?.repaymentPlan) return 0;
    try {
      const schedule = JSON.parse(loan.repaymentPlan);
      return schedule.reduce((sum, item) => sum + (parseInt(item.interest) || 0), 0);
    } catch {
      return 0;
    }
  };

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Loans</h1>
          <p className="mt-1 text-sm text-gray-600">
            Apply for loans and track your repayments
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowApplicationForm(true)}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Apply for Loan
          </button>
        </div>
      </div>

      {/* Loan Eligibility Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Total Savings</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(memberData.totalSavings)}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Loan Eligibility</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(memberData.totalSavings * 0.8)}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Available Credit</div>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(calculateAvailableCredit(
              memberData.totalSavings, 
              loans.filter(loan => loan.status === 'active' || loan.status === 'approved').reduce((sum, loan) => sum + (loan.balance || loan.amount), 0),
              (financialConfig.loanEligibilityPercentage || 80) / 100
            ))}
          </div>
        </div>
      </div>

      {/* Loan Application Form */}
      {showApplicationForm && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Apply for Loan</h3>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loan Amount (UGX)
                </label>
                <input
                  {...register('amount', { 
                    required: 'Amount is required',
                    min: { value: 1000, message: 'Minimum loan amount is UGX 1,000' }
                  })}
                  type="number"
                  className="form-input"
                  placeholder="Enter loan amount"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
                )}
                {watchedAmount > 0 && (
                  <p className={`mt-1 text-sm ${validation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {validation.isValid 
                      ? `✓ Eligible for ${formatCurrency(watchedAmount)}`
                      : `✗ Exceeds eligibility by ${formatCurrency(validation.totalExposure - validation.maxEligible)}`
                    }
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Application Date
                </label>
                <input
                  type="date"
                  value={applicationDate}
                  onChange={(e) => setApplicationDate(e.target.value)}
                  className="form-input"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use this only for backfilling old applications. Later this will be locked to today.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (Months)
                </label>
                <select
                  {...register('duration', { required: 'Duration is required' })}
                  className="form-input"
                  onChange={(e) => {
                    if (repaymentType === 'custom') {
                      initializeCustomPayments(parseInt(e.target.value));
                    }
                  }}
                >
                  <option value="">Select duration</option>
                  {Array.from({ length: financialConfig.maxLoanDuration || 6 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>{month} month{month > 1 ? 's' : ''}</option>
                  ))}
                </select>
                {errors.duration && (
                  <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purpose of Loan
              </label>
              <textarea
                {...register('purpose')}
                rows={3}
                className="form-input"
                placeholder="Describe the purpose of this loan"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Repayment Plan
              </label>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="equal"
                    checked={repaymentType === 'equal'}
                    onChange={(e) => setRepaymentType(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm">Equal monthly installments</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={repaymentType === 'custom'}
                    onChange={(e) => setRepaymentType(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm">Custom monthly payments</span>
                </label>
              </div>
            </div>
            
            {repaymentType === 'custom' && watchedDuration > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Payment Amounts
                </label>
                {customPayments.length === 0 && (
                  <p className="text-sm text-gray-500 mb-2">Select a duration first to set custom payments</p>
                )}
                {customPayments.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {customPayments.map((payment, index) => (
                      <div key={index}>
                        <label className="block text-xs text-gray-500 mb-1">
                          Month {index + 1}
                        </label>
                        <input
                          type="number"
                          value={payment}
                          onChange={(e) => handleCustomPaymentChange(index, e.target.value)}
                          className="form-input text-sm"
                          placeholder="0"
                          readOnly={index === customPayments.length - 1}
                          title={index === customPayments.length - 1 ? "Auto-calculated final payment" : ""}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Repayment Preview */}
            {watchedAmount > 0 && watchedDuration > 0 && validation.isValid && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Repayment Preview</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Principal: {formatCurrency(parseInt(watchedAmount))}</div>
                  <div>Monthly Interest ({financialConfig.loanInterestRate || 2}%): {formatCurrency(parseInt(watchedAmount) * ((financialConfig.loanInterestRate || 2) / 100))}</div>
                  <div>Total Interest: {formatCurrency(parseInt(watchedAmount) * ((financialConfig.loanInterestRate || 2) / 100) * parseInt(watchedDuration))}</div>
                  <div className="font-medium">Total Repayment: {formatCurrency(parseInt(watchedAmount) + (parseInt(watchedAmount) * ((financialConfig.loanInterestRate || 2) / 100) * parseInt(watchedDuration)))}</div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  reset();
                  setShowApplicationForm(false);
                  setCustomPayments([]);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={!validation.isValid || loanSubmitting}
              >
                {loanSubmitting ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loans List */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">My Loan Applications</h3>
        
        {loans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applied
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loans
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((loan) => (
                    <tr key={loan.$id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {loan.duration} month{loan.duration > 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate">{loan.purpose || 'No purpose specified'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          loan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                          loan.status === 'approved' ? 'bg-green-100 text-green-800' :
                          loan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                        {new Date(loan.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button
                          onClick={() => setSelectedLoan(loan)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No loan applications yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Click "Apply for Loan" to submit your first application.
            </p>
          </div>
        )}
      </div>

      {/* Loan Details Modal */}
      {selectedLoan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Loan Details
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Amount</label>
                    <p className="text-sm text-gray-900">{formatCurrency(selectedLoan.amount)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Duration</label>
                    <p className="text-sm text-gray-900">{selectedLoan.duration} months</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedLoan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      selectedLoan.status === 'approved' ? 'bg-green-100 text-green-800' :
                      selectedLoan.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {selectedLoan.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Applied</label>
                    <p className="text-sm text-gray-900">{new Date(selectedLoan.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Paid So Far</label>
                    <p className="text-sm text-gray-900">
                      {formatCurrency(getLoanPaidAmount(selectedLoan.$id))}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Outstanding Balance</label>
                    <p className="text-sm text-gray-900">
                      {formatCurrency(getLoanOutstandingBalance(selectedLoan))}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Bank Charges</label>
                    <p className="text-sm text-gray-900">
                      {getLoanChargeTotal(selectedLoan.$id) > 0
                        ? formatCurrency(getLoanChargeTotal(selectedLoan.$id))
                        : 'None'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Total Interest</label>
                    <p className="text-sm text-gray-900">
                      {formatCurrency(getTotalInterest(selectedLoan))}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500">Purpose</label>
                  <p className="text-sm text-gray-900">{selectedLoan.purpose || 'No purpose specified'}</p>
                </div>
                
                {/* Bank Charges */}
                {loanCharges.find(charge => normalizeLoanId(charge.loanId) === normalizeLoanId(selectedLoan.$id)) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Bank Charges</label>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      {(() => {
                        const charge = loanCharges.find(charge => normalizeLoanId(charge.loanId) === normalizeLoanId(selectedLoan.$id));
                        return (
                          <div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-yellow-800">
                                {getLoanLabel(selectedLoan.$id)}{charge.description ? ` - ${charge.description}` : ''}
                              </span>
                              <span className="text-sm font-medium text-yellow-900">{formatCurrency(charge.amount)}</span>
                            </div>
                            <p className="text-xs text-yellow-700 mt-2">
                              This charge will be added to your first payment
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {selectedLoan.status === 'active' && (
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <label className="block text-sm font-medium text-gray-500 mb-2">Early Payoff</label>
                    <div className="text-sm text-gray-700 mb-3">
                      Select a date to pay off your remaining balance in full (includes the early repayment penalty).
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Payoff Date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={earlyPayoffDate}
                          onChange={(e) => setEarlyPayoffDate(e.target.value)}
                        />
                      </div>
                      <div className="text-sm text-gray-700">
                        <div className="text-xs text-gray-500">Estimated Payoff</div>
                        <div className="font-semibold">
                          {formatCurrency(getEarlyPayoffAmount(selectedLoan, getNextUnpaidMonth(selectedLoan)))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={requestEarlyPayoff}
                        disabled={earlyPayoffLoading}
                        className="btn-primary flex items-center justify-center"
                      >
                        {earlyPayoffLoading && (
                          <span className="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                        )}
                        Pay Off Early
                      </button>
                    </div>
                  </div>
                )}

                {getLoanChargeTotal(selectedLoan.$id) > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Total Bank Charges</label>
                    <div className="text-sm font-medium text-yellow-900">
                      {formatCurrency(getLoanChargeTotal(selectedLoan.$id))}
                    </div>
                  </div>
                )}
                
                {selectedLoan.repaymentPlan && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Repayment Schedule</label>
                    {(() => {
                      const chargeTotal = getLoanChargeTotal(selectedLoan.$id);
                      return chargeTotal > 0 ? (
                        <p className="text-xs text-yellow-600 mb-2">
                          * First payment includes bank charges of {formatCurrency(chargeTotal)}
                        </p>
                      ) : null;
                    })()}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Payment</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Principal</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Interest</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {JSON.parse(selectedLoan.repaymentPlan).map((payment, index) => {
                            const bankCharges = index === 0 ? getLoanChargeTotal(selectedLoan.$id) : 0;
                            
                            return (
                              <tr key={index} className={index === 0 && bankCharges > 0 ? 'bg-yellow-50' : ''}>
                                <td className="px-3 py-2 text-sm text-gray-900">{payment.month}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                  {formatCurrency(payment.payment + bankCharges)}
                                  {bankCharges > 0 && (
                                    <div className="text-xs text-yellow-600">
                                      (includes {formatCurrency(bankCharges)} charges)
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatCurrency(payment.principal)}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatCurrency(payment.interest)}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatCurrency(payment.balance)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setSelectedLoan(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberLoans;
