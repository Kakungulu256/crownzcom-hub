import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { databases, DATABASE_ID, COLLECTIONS, Query, functions } from '../../lib/appwrite';
import { useAuth } from '../../lib/auth';
import { formatCurrency, validateLoanApplication, calculateAvailableCredit } from '../../utils/financial';
import { PlusIcon, EyeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { fetchMemberRecord } from '../../lib/member';
import { listAllDocuments } from '../../lib/pagination';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';

const LOAN_TYPES = {
  SHORT_TERM: 'short_term',
  LONG_TERM: 'long_term'
};
const INTEREST_CALCULATION_MODES = {
  FLAT: 'flat',
  REDUCING_BALANCE: 'reducing_balance'
};

const emptyGuarantorEntry = () => ({
  guarantorId: '',
  guaranteeType: 'amount',
  guaranteedValue: ''
});

const LOAN_SUBMIT_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_LONGTERM_LOAN_SUBMIT_FUNCTION_ID ||
  import.meta.env.VITE_APPWRITE_LOAN_SUBMIT_FUNCTION_ID ||
  'longterm-loan-submit';

const MemberLoans = () => {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [loanCharges, setLoanCharges] = useState([]);
  const [loanRepayments, setLoanRepayments] = useState([]);
  const [loanGuarantorRequests, setLoanGuarantorRequests] = useState([]);
  const [memberData, setMemberData] = useState({ totalSavings: 0, memberId: null });
  const [loading, setLoading] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [repaymentType, setRepaymentType] = useState('equal');
  const [customPayments, setCustomPayments] = useState([]);
  const [financialConfig, setFinancialConfig] = useState({ ...DEFAULT_FINANCIAL_CONFIG });
  const [applicationDate, setApplicationDate] = useState(new Date().toISOString().split('T')[0]);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [guarantorEntries, setGuarantorEntries] = useState([emptyGuarantorEntry()]);
  const [earlyPayoffDate, setEarlyPayoffDate] = useState(new Date().toISOString().split('T')[0]);
  const [earlyPayoffLoading, setEarlyPayoffLoading] = useState(false);
  
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      loanType: LOAN_TYPES.SHORT_TERM,
      duration: '',
      termsAccepted: false
    }
  });
  const watchedAmount = watch('amount', 0);
  const watchedDuration = watch('duration', '');
  const watchedLoanType = watch('loanType', LOAN_TYPES.SHORT_TERM);
  const watchedTermsAccepted = watch('termsAccepted', false);
  const parsedWatchedAmount = parseInt(watchedAmount, 10) || 0;
  const parsedWatchedDuration = parseInt(watchedDuration, 10) || 0;
  const isLongTermSelected = watchedLoanType === LOAN_TYPES.LONG_TERM;
  const activeMaxDuration = isLongTermSelected
    ? parseInt(financialConfig.longTermMaxRepaymentMonths, 10) || 24
    : parseInt(financialConfig.maxLoanDuration, 10) || 6;
  const activeMonthlyInterestPercent = isLongTermSelected
    ? parseFloat(financialConfig.longTermInterestRate || 1.5)
    : parseFloat(financialConfig.loanInterestRate || 2);
  const activeMonthlyRate = activeMonthlyInterestPercent / 100;
  const activeInterestCalculationMode =
    String(financialConfig.interestCalculationMode || '').trim().toLowerCase() === INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      ? INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      : INTEREST_CALCULATION_MODES.FLAT;

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

  useEffect(() => {
    if (!showApplicationForm) return;
    const currentDuration = parseInt(watchedDuration, 10) || 0;
    if (currentDuration > activeMaxDuration) {
      setValue('duration', '');
      setCustomPayments([]);
    }
  }, [watchedLoanType, watchedDuration, activeMaxDuration, setValue, showApplicationForm]);

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
      let membersList = [];
      try {
        membersList = await listAllDocuments(databases, DATABASE_ID, COLLECTIONS.MEMBERS);
      } catch (membersError) {
        console.warn('Unable to load members for guarantor list:', membersError);
      }
      
      const totalSavings = savings.reduce((sum, saving) => sum + saving.amount, 0);
      
      setMemberData({ totalSavings, memberId });
      setLoans(loans);
      setMembers(membersList.filter((m) => m.$id !== memberId));
      const loanIds = new Set(loans.map(loan => loan.$id));
      setLoanCharges(charges.filter(charge =>
        loanIds.has(normalizeLoanId(charge.loanId))
      ));
      setLoanRepayments(repayments.filter(repayment =>
        loanIds.has(normalizeLoanId(repayment.loanId))
      ));
      let guarantorRequests = [];
      if (COLLECTIONS.LOAN_GUARANTORS) {
        try {
          guarantorRequests = await listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_GUARANTORS, [
            Query.equal('borrowerId', memberId)
          ]);
        } catch (guarantorError) {
          console.warn('Unable to load borrower guarantor requests:', guarantorError);
        }
      }
      setLoanGuarantorRequests(guarantorRequests.filter((request) =>
        loanIds.has(normalizeLoanId(request.loanId))
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
      const amount = parseInt(data.amount, 10);
      const duration = parseInt(data.duration, 10);
      const loanType = data.loanType || LOAN_TYPES.SHORT_TERM;
      const termsAccepted = Boolean(data.termsAccepted);
      const isLongTermLoan = loanType === LOAN_TYPES.LONG_TERM;
      const maxDuration = isLongTermLoan
        ? parseInt(financialConfig.longTermMaxRepaymentMonths, 10) || 24
        : parseInt(financialConfig.maxLoanDuration, 10) || 6;
      
      // Validate loan eligibility
      const existingLoanAmount = loans
        .filter(loan => loan.status === 'active' || loan.status === 'approved')
        .reduce((sum, loan) => sum + (loan.balance || loan.amount), 0);
      
      const eligibilityPercent = (financialConfig.loanEligibilityPercentage || 80) / 100;
      const minLoanAmount = parseInt(financialConfig.minLoanAmount, 10) || 1000;
      const maxLoanAmount = parseInt(financialConfig.maxLoanAmount, 10) || 5000000;
      const availableCredit = calculateAvailableCredit(
        memberData.totalSavings,
        existingLoanAmount,
        eligibilityPercent
      );
      const borrowerCoverage = Math.max(0, Math.min(amount, availableCredit));
      const guarantorGapAmount = Math.max(0, amount - borrowerCoverage);
      const guarantorRequired = isLongTermLoan && guarantorGapAmount > 0;

      if (!termsAccepted) {
        toast.error('You must accept the Loan Terms & Conditions before submitting.');
        return;
      }

      if (!amount || amount < minLoanAmount) {
        toast.error(`Minimum loan amount is ${formatCurrency(minLoanAmount)}.`);
        return;
      }

      if (amount > maxLoanAmount) {
        toast.error(`Maximum loan amount is ${formatCurrency(maxLoanAmount)}.`);
        return;
      }

      if (!duration || duration < 1 || duration > maxDuration) {
        toast.error(`Select a valid repayment period between 1 and ${maxDuration} months.`);
        return;
      }

      const validation = validateLoanApplication(
        amount,
        memberData.totalSavings,
        existingLoanAmount,
        eligibilityPercent
      );

      if (!isLongTermLoan && !validation.isValid) {
        toast.error(`Loan amount exceeds eligibility. Maximum available: ${formatCurrency(validation.maxEligible - validation.currentExposure)}`);
        return;
      }

      const normalizedGuarantors = guarantorEntries
        .map((entry) => {
          const rawValue = parseFloat(entry.guaranteedValue);
          const safeValue = Number.isFinite(rawValue) ? rawValue : 0;
          const guaranteedAmount = entry.guaranteeType === 'percent'
            ? Math.round((amount * safeValue) / 100)
            : Math.round(safeValue);

          return {
            guarantorId: entry.guarantorId,
            guaranteeType: entry.guaranteeType,
            guaranteedPercent: entry.guaranteeType === 'percent' ? safeValue : 0,
            guaranteedAmount
          };
        })
        .filter((entry) => entry.guarantorId || entry.guaranteedAmount > 0);

      const duplicateGuarantorIds = new Set();
      for (const entry of normalizedGuarantors) {
        if (!entry.guarantorId) {
          toast.error('Each guarantor row must have a selected member.');
          return;
        }
        if (entry.guarantorId === memberData.memberId) {
          toast.error('You cannot select yourself as a guarantor.');
          return;
        }
        if (duplicateGuarantorIds.has(entry.guarantorId)) {
          toast.error('Duplicate guarantor rows are not allowed.');
          return;
        }
        duplicateGuarantorIds.add(entry.guarantorId);
        if (entry.guaranteedAmount <= 0) {
          toast.error('Each guarantor must provide a guaranteed amount greater than zero.');
          return;
        }
        if (entry.guaranteeType === 'percent' && (entry.guaranteedPercent <= 0 || entry.guaranteedPercent > 100)) {
          toast.error('Guarantor percentage must be between 0 and 100.');
          return;
        }
      }

      const guarantorRequestedAmount = normalizedGuarantors.reduce(
        (sum, entry) => sum + entry.guaranteedAmount,
        0
      );

      if (guarantorRequired) {
        if (normalizedGuarantors.length === 0) {
          toast.error('This long-term loan requires guarantors to cover the credit gap.');
          return;
        }
        if (guarantorRequestedAmount < guarantorGapAmount) {
          toast.error(
            `Guarantor coverage is insufficient. Required: ${formatCurrency(guarantorGapAmount)}, provided: ${formatCurrency(guarantorRequestedAmount)}.`
          );
          return;
        }
      }
      
      const loanSubmitPayload = {
        action: 'submitLongTermLoan',
        memberId: memberData.memberId,
        amount,
        selectedMonths: duration,
        loanType,
        termsAccepted,
        purpose: data.purpose || '',
        repaymentType,
        customPayments: repaymentType === 'custom' ? customPayments : undefined,
        guarantors: guarantorRequired ? normalizedGuarantors : [],
        applicationDate
      };

      const response = await functions.createExecution(
        LOAN_SUBMIT_FUNCTION_ID,
        JSON.stringify(loanSubmitPayload)
      );

      const result = JSON.parse(response?.responseBody || '{}');
      if (!result.success) {
        throw new Error(result.error || 'Loan submission failed.');
      }

      const successMessage = result.status === 'pending_guarantor_approval'
        ? 'Loan submitted. Waiting for guarantor approvals.'
        : 'Loan submitted and sent for admin review.';
      toast.success(successMessage);
      
      reset({
        loanType: LOAN_TYPES.SHORT_TERM,
        duration: '',
        termsAccepted: false
      });
      setShowApplicationForm(false);
      setCustomPayments([]);
      setGuarantorEntries([emptyGuarantorEntry()]);
      setRepaymentType('equal');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to submit loan application');
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
      const totalInterest = principal * activeMonthlyRate * parseInt(watchedDuration, 10);
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

  const handleGuarantorChange = (index, field, value) => {
    setGuarantorEntries((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value
      };
      if (field === 'guaranteeType') {
        copy[index].guaranteedValue = '';
      }
      return copy;
    });
  };

  const addGuarantorEntry = () => {
    setGuarantorEntries((prev) => [...prev, emptyGuarantorEntry()]);
  };

  const removeGuarantorEntry = (index) => {
    setGuarantorEntries((prev) => {
      if (prev.length <= 1) return [emptyGuarantorEntry()];
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const getMemberDisplayName = (member) => {
    if (!member) return 'Member';
    if (member.name) return member.name;
    const combined = `${member.firstName || ''} ${member.lastName || ''}`.trim();
    if (combined) return combined;
    return member.email || member.membershipNumber || 'Member';
  };

  const getMemberNameById = (memberId) => {
    const match = members.find((member) => member.$id === normalizeLoanId(memberId));
    return getMemberDisplayName(match);
  };

  const getLoanGuarantorRequests = (loanId) => {
    const targetId = normalizeLoanId(loanId);
    return loanGuarantorRequests.filter((request) => normalizeLoanId(request.loanId) === targetId);
  };

  const getLoanGuarantorSummary = (loan) => {
    const requests = getLoanGuarantorRequests(loan.$id);
    const requiredGap = parseInt(loan.guarantorGapAmount, 10) || 0;
    const requestedTotal = requests.reduce(
      (sum, request) => sum + (parseInt(request.guaranteedAmount, 10) || 0),
      0
    ) || (parseInt(loan.guarantorRequestedAmount, 10) || 0);
    const approvedTotal = requests
      .filter((request) => request.status === 'approved')
      .reduce(
        (sum, request) => sum + (parseInt(request.approvedAmount, 10) || parseInt(request.guaranteedAmount, 10) || 0),
        0
      ) || (parseInt(loan.guarantorApprovedAmount, 10) || 0);
    const pendingCount = requests.filter((request) => request.status === 'pending').length;
    const approvedCount = requests.filter((request) => request.status === 'approved').length;
    const declinedCount = requests.filter((request) => request.status === 'declined').length;
    const releasedCount = requests.filter((request) => request.status === 'released').length;
    const remainingCoverage = Math.max(0, requiredGap - approvedTotal);
    const coveragePercent = requiredGap > 0
      ? Math.min(100, Math.round((approvedTotal / requiredGap) * 100))
      : 100;

    return {
      requests,
      requiredGap,
      requestedTotal,
      approvedTotal,
      pendingCount,
      approvedCount,
      declinedCount,
      releasedCount,
      remainingCoverage,
      coveragePercent,
      coverageMet: requiredGap === 0 || approvedTotal >= requiredGap
    };
  };

  const getGuarantorCoverageAmount = (entry, amount) => {
    const numericValue = parseFloat(entry.guaranteedValue);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
    if (entry.guaranteeType === 'percent') {
      return Math.round((amount * numericValue) / 100);
    }
    return Math.round(numericValue);
  };

  const existingLoanExposure = loans
    .filter(loan => loan.status === 'active' || loan.status === 'approved')
    .reduce((sum, loan) => sum + (loan.balance || loan.amount), 0);
  const availableCredit = calculateAvailableCredit(
    memberData.totalSavings,
    existingLoanExposure,
    (financialConfig.loanEligibilityPercentage || 80) / 100
  );
  const borrowerCoveragePreview = Math.max(0, Math.min(parsedWatchedAmount, availableCredit));
  const guarantorGapPreview = Math.max(0, parsedWatchedAmount - borrowerCoveragePreview);
  const guarantorCoveragePreview = guarantorEntries.reduce(
    (sum, entry) => sum + getGuarantorCoverageAmount(entry, parsedWatchedAmount),
    0
  );
  const guarantorCoverageShortfall = Math.max(0, guarantorGapPreview - guarantorCoveragePreview);
  const guarantorRequiredPreview = isLongTermSelected && guarantorGapPreview > 0;

  const validation = validateLoanApplication(
    parsedWatchedAmount,
    memberData.totalSavings,
    existingLoanExposure,
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

  const normalizeInterestCalculationMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      ? INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      : INTEREST_CALCULATION_MODES.FLAT;
  };

  const getLoanInterestCalculationMode = (loan) => normalizeInterestCalculationMode(
    loan?.interestCalculationModeApplied || financialConfig.interestCalculationMode
  );

  const getLoanMonthlyRatePercent = (loan) => {
    const storedRate = Number(loan?.monthlyInterestRateApplied);
    if (Number.isFinite(storedRate) && storedRate >= 0) return storedRate;
    return loan?.loanType === LOAN_TYPES.LONG_TERM
      ? Number(financialConfig.longTermInterestRate || 1.5)
      : Number(financialConfig.loanInterestRate || 2);
  };

  const getLoanInterestBasisLabel = (loan) => {
    const mode = getLoanInterestCalculationMode(loan);
    const modeLabel = mode === INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      ? 'Reducing Balance'
      : 'Flat Principal';
    return `${modeLabel} @ ${getLoanMonthlyRatePercent(loan)}%`;
  };

  const getApplicationInterestBasisLabel = () => (
    activeInterestCalculationMode === INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      ? `Reducing Balance @ ${activeMonthlyInterestPercent}%`
      : `Flat Principal @ ${activeMonthlyInterestPercent}%`
  );

  const getReducingPreview = (principal, duration, monthlyRate) => {
    if (!principal || !duration || duration <= 0) {
      return { totalInterest: 0, totalRepayment: 0, firstPayment: 0, lastPayment: 0 };
    }

    const basePrincipal = Math.floor(principal / duration);
    let principalRemainder = principal - (basePrincipal * duration);
    let remainingBalance = principal;
    let totalInterest = 0;
    let firstPayment = 0;
    let lastPayment = 0;

    for (let month = 1; month <= duration; month += 1) {
      const extraPrincipal = principalRemainder > 0 ? 1 : 0;
      principalRemainder = Math.max(0, principalRemainder - extraPrincipal);
      const principalPart = Math.min(remainingBalance, basePrincipal + extraPrincipal);
      const interestPart = Math.floor(remainingBalance * monthlyRate);
      const payment = principalPart + interestPart;

      if (month === 1) firstPayment = payment;
      if (month === duration) lastPayment = payment;

      totalInterest += interestPart;
      remainingBalance = Math.max(0, remainingBalance - principalPart);
    }

    return {
      totalInterest,
      totalRepayment: principal + totalInterest,
      firstPayment,
      lastPayment
    };
  };

  const getEarlyPayoffAmount = (loan, monthNumber) => {
    const principal = parseInt(loan?.amount, 10) || 0;
    const currentBalance = parseInt(loan?.balance, 10) || principal;
    const monthlyRate = getLoanMonthlyRatePercent(loan) / 100;
    const mode = getLoanInterestCalculationMode(loan);
    const interestBase = mode === INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      ? currentBalance
      : principal;
    const penaltyRate = (financialConfig.earlyRepaymentPenalty || 0) / 100;
    const interestAmount = (interestBase * monthlyRate) + (interestBase * penaltyRate);
    const hasFirstMonthRepayment = loanRepayments.some(
      repayment => normalizeLoanId(repayment.loanId) === normalizeLoanId(loan.$id) && parseInt(repayment.month) === 1
    );
    const chargeAmount = monthNumber === 1 && !hasFirstMonthRepayment ? getLoanChargeTotal(loan.$id) : 0;
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

  const getStatusBadgeClass = (status) => {
    if (status === 'active') return 'bg-blue-100 text-blue-800';
    if (status === 'approved') return 'bg-green-100 text-green-800';
    if (status === 'pending' || status === 'pending_guarantor_approval' || status === 'pending_admin_approval') {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (status === 'completed') return 'bg-emerald-100 text-emerald-800';
    return 'bg-red-100 text-red-800';
  };

  const getGuarantorRequestBadgeClass = (status) => {
    if (status === 'approved') return 'bg-green-100 text-green-800';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (status === 'declined') return 'bg-red-100 text-red-800';
    if (status === 'released') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
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
            onClick={() => {
              reset({
                loanType: LOAN_TYPES.SHORT_TERM,
                duration: '',
                termsAccepted: false
              });
              setRepaymentType('equal');
              setCustomPayments([]);
              setGuarantorEntries([emptyGuarantorEntry()]);
              setShowApplicationForm(true);
            }}
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
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(memberData.totalSavings * ((financialConfig.loanEligibilityPercentage || 80) / 100))}
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Available Credit</div>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(availableCredit)}
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
                  Loan Type
                </label>
                <select
                  {...register('loanType', {
                    required: 'Loan type is required',
                    onChange: (e) => {
                      if (e.target.value === LOAN_TYPES.SHORT_TERM) {
                        setGuarantorEntries([emptyGuarantorEntry()]);
                      }
                    }
                  })}
                  className="form-input"
                >
                  <option value={LOAN_TYPES.SHORT_TERM}>Short-Term Loan</option>
                  <option value={LOAN_TYPES.LONG_TERM}>Long-Term Loan</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {isLongTermSelected
                    ? `Long-term settings: ${activeMonthlyInterestPercent}% monthly interest (${activeInterestCalculationMode === INTEREST_CALCULATION_MODES.REDUCING_BALANCE ? 'reducing balance' : 'flat principal'}), up to ${activeMaxDuration} months.`
                    : `Short-term settings: ${activeMonthlyInterestPercent}% monthly interest (${activeInterestCalculationMode === INTEREST_CALCULATION_MODES.REDUCING_BALANCE ? 'reducing balance' : 'flat principal'}), up to ${activeMaxDuration} months.`}
                </p>
              </div>

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
                {parsedWatchedAmount > 0 && (
                  <p className={`mt-1 text-sm ${
                    isLongTermSelected
                      ? (guarantorRequiredPreview ? 'text-amber-700' : 'text-green-600')
                      : (validation.isValid ? 'text-green-600' : 'text-red-600')
                  }`}>
                    {isLongTermSelected
                      ? (guarantorRequiredPreview
                        ? `Requires guarantor support of ${formatCurrency(guarantorGapPreview)} beyond your available credit.`
                        : `Covered by your available credit (${formatCurrency(borrowerCoveragePreview)}).`)
                      : (validation.isValid
                        ? `Eligible for ${formatCurrency(parsedWatchedAmount)}`
                        : `Exceeds eligibility by ${formatCurrency(validation.totalExposure - validation.maxEligible)}`)}
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
                  {...register('duration', {
                    required: 'Duration is required',
                    onChange: (e) => {
                      if (repaymentType === 'custom' && parseInt(e.target.value, 10) > 0) {
                        initializeCustomPayments(parseInt(e.target.value, 10));
                      }
                    }
                  })}
                  className="form-input"
                >
                  <option value="">Select duration</option>
                  {Array.from({ length: activeMaxDuration }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>{month} month{month > 1 ? 's' : ''}</option>
                  ))}
                </select>
                {errors.duration && (
                  <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Maximum for this loan type: {activeMaxDuration} months
                </p>
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

            {isLongTermSelected && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-indigo-900">Guarantor Coverage</h4>
                  <button
                    type="button"
                    onClick={addGuarantorEntry}
                    className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                  >
                    + Add Guarantor
                  </button>
                </div>
                <div className="text-xs text-indigo-800 mb-3">
                  Borrower coverage: {formatCurrency(borrowerCoveragePreview)} | Required guarantor gap: {formatCurrency(guarantorGapPreview)}
                </div>
                <div className="space-y-3">
                  {guarantorEntries.map((entry, index) => (
                    <div key={`guarantor-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                      <div className="md:col-span-5">
                        <label className="block text-xs font-medium text-indigo-800 mb-1">Guarantor Member</label>
                        {members.length > 0 ? (
                          <select
                            value={entry.guarantorId}
                            onChange={(e) => handleGuarantorChange(index, 'guarantorId', e.target.value)}
                            className="form-input text-sm"
                          >
                            <option value="">Select member</option>
                            {members.map((member) => (
                              <option key={member.$id} value={member.$id}>
                                {getMemberDisplayName(member)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={entry.guarantorId}
                            onChange={(e) => handleGuarantorChange(index, 'guarantorId', e.target.value)}
                            className="form-input text-sm"
                            placeholder="Enter guarantor member ID"
                          />
                        )}
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-indigo-800 mb-1">Guarantee Type</label>
                        <select
                          value={entry.guaranteeType}
                          onChange={(e) => handleGuarantorChange(index, 'guaranteeType', e.target.value)}
                          className="form-input text-sm"
                        >
                          <option value="amount">Amount</option>
                          <option value="percent">Percent</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-indigo-800 mb-1">
                          {entry.guaranteeType === 'percent' ? 'Percent (%)' : 'Amount (UGX)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step={entry.guaranteeType === 'percent' ? '0.1' : '1000'}
                          value={entry.guaranteedValue}
                          onChange={(e) => handleGuarantorChange(index, 'guaranteedValue', e.target.value)}
                          className="form-input text-sm"
                          placeholder="0"
                        />
                        <p className="mt-1 text-[11px] text-indigo-700">
                          Coverage: {formatCurrency(getGuarantorCoverageAmount(entry, parsedWatchedAmount))}
                        </p>
                      </div>
                      <div className="md:col-span-1">
                        <button
                          type="button"
                          onClick={() => removeGuarantorEntry(index)}
                          className="w-full rounded-md border border-red-300 px-2 py-2 text-xs text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs">
                  <span className="font-medium text-indigo-900">Total guarantor coverage:</span>{' '}
                  <span className={guarantorCoverageShortfall > 0 ? 'text-red-700' : 'text-green-700'}>
                    {formatCurrency(guarantorCoveragePreview)}
                  </span>
                  {guarantorRequiredPreview && (
                    <span className="ml-2 text-red-700">
                      {guarantorCoverageShortfall > 0
                        ? `Shortfall: ${formatCurrency(guarantorCoverageShortfall)}`
                        : 'Coverage requirement met'}
                    </span>
                  )}
                </div>
                {members.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    Member list is unavailable. Guarantor checks will still run server-side in the next workflow step.
                  </p>
                )}
              </div>
            )}

            {repaymentType === 'custom' && parsedWatchedDuration > 0 && (
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
                          title={index === customPayments.length - 1 ? 'Auto-calculated final payment' : ''}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h4 className="text-sm font-semibold text-yellow-900 mb-2">Loan Terms & Conditions</h4>
              <div className="text-sm text-yellow-900 space-y-2 max-h-56 overflow-y-auto pr-2">
                <p><strong>Acknowledgements:</strong> I confirm all loan details are accurate and authorize the SACCO to process this application.</p>
                <p>
                  <strong>Interest Basis:</strong> {getApplicationInterestBasisLabel()} applies to this application.
                </p>
                <p>
                  <strong>Installment formula:</strong> {
                    activeInterestCalculationMode === INTEREST_CALCULATION_MODES.REDUCING_BALANCE
                      ? 'Each month interest is computed on the outstanding balance, so installments may decline over time.'
                      : '(Principal + (Principal x monthly rate x months)) / months.'
                  }
                </p>
                <p><strong>Processing fees:</strong> Actual transfer charges are added to the first installment only.</p>
                <p><strong>Early settlement:</strong> Principal + one month interest + admin fee (as configured).</p>
                <p><strong>Guarantor rule:</strong> For long-term loans above borrower coverage, guarantor commitments must cover the gap before final approval.</p>
                <p><strong>Repayment:</strong> Monthly deductions start from the first scheduled payment date.</p>
              </div>
              <label className="mt-3 flex items-start">
                <input
                  type="checkbox"
                  {...register('termsAccepted', {
                    validate: (value) => value || 'You must accept the loan terms and conditions.'
                  })}
                  className="mt-1 mr-2"
                />
                <span className="text-sm text-yellow-900">
                  I have read and accept the Loan Terms & Conditions.
                </span>
              </label>
              {errors.termsAccepted && (
                <p className="mt-1 text-sm text-red-600">{errors.termsAccepted.message}</p>
              )}
            </div>

            {parsedWatchedAmount > 0 && parsedWatchedDuration > 0 && (isLongTermSelected || validation.isValid) && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Repayment Preview</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Loan Type: {isLongTermSelected ? 'Long-Term' : 'Short-Term'}</div>
                  <div>Principal: {formatCurrency(parsedWatchedAmount)}</div>
                  <div>Interest Basis: {getApplicationInterestBasisLabel()}</div>
                  {activeInterestCalculationMode === INTEREST_CALCULATION_MODES.REDUCING_BALANCE ? (
                    (() => {
                      const preview = getReducingPreview(
                        parsedWatchedAmount,
                        parsedWatchedDuration,
                        activeMonthlyRate
                      );
                      return (
                        <>
                          <div>First Installment (est.): {formatCurrency(preview.firstPayment)}</div>
                          <div>Final Installment (est.): {formatCurrency(preview.lastPayment)}</div>
                          <div>Total Interest (est.): {formatCurrency(preview.totalInterest)}</div>
                          <div className="font-medium">
                            Total Repayment (est.): {formatCurrency(preview.totalRepayment)}
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <div>Monthly Interest ({activeMonthlyInterestPercent}%): {formatCurrency(parsedWatchedAmount * activeMonthlyRate)}</div>
                      <div>Total Interest: {formatCurrency(parsedWatchedAmount * activeMonthlyRate * parsedWatchedDuration)}</div>
                      <div className="font-medium">
                        Total Repayment: {formatCurrency(parsedWatchedAmount + (parsedWatchedAmount * activeMonthlyRate * parsedWatchedDuration))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  reset({
                    loanType: LOAN_TYPES.SHORT_TERM,
                    duration: '',
                    termsAccepted: false
                  });
                  setShowApplicationForm(false);
                  setCustomPayments([]);
                  setGuarantorEntries([emptyGuarantorEntry()]);
                  setRepaymentType('equal');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={
                  loanSubmitting ||
                  !parsedWatchedAmount ||
                  !parsedWatchedDuration ||
                  !watchedTermsAccepted ||
                  (!isLongTermSelected && !validation.isValid) ||
                  (guarantorRequiredPreview && guarantorCoverageShortfall > 0)
                }
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
                    Type
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interest Basis
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
                        {loan.loanType === LOAN_TYPES.LONG_TERM ? 'Long-Term' : 'Short-Term'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {loan.duration} month{loan.duration > 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {getLoanInterestBasisLabel(loan)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate">{loan.purpose || 'No purpose specified'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="space-y-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(loan.status)}`}>
                            {loan.status}
                          </span>
                          {loan.loanType === LOAN_TYPES.LONG_TERM && loan.guarantorRequired ? (
                            <div className="text-[11px] text-gray-500">
                              Coverage: {(() => {
                                const summary = getLoanGuarantorSummary(loan);
                                return `${formatCurrency(summary.approvedTotal)} / ${formatCurrency(summary.requiredGap)}`;
                              })()}
                            </div>
                          ) : null}
                        </div>
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
                    <label className="block text-sm font-medium text-gray-500">Type</label>
                    <p className="text-sm text-gray-900">
                      {selectedLoan.loanType === LOAN_TYPES.LONG_TERM ? 'Long-Term' : 'Short-Term'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Duration</label>
                    <p className="text-sm text-gray-900">{selectedLoan.duration} months</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(selectedLoan.status)}`}>
                      {selectedLoan.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Applied</label>
                    <p className="text-sm text-gray-900">{new Date(selectedLoan.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Interest Basis</label>
                    <p className="text-sm text-gray-900">{getLoanInterestBasisLabel(selectedLoan)}</p>
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

                {selectedLoan.loanType === LOAN_TYPES.LONG_TERM && selectedLoan.guarantorRequired ? (
                  (() => {
                    const summary = getLoanGuarantorSummary(selectedLoan);
                    return (
                      <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-sm font-medium text-indigo-900">Guarantor Coverage Tracking</label>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                            {selectedLoan.guarantorApprovalStatus || 'pending'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div>
                            <div className="text-xs text-indigo-700">Required Gap</div>
                            <div className="text-sm font-semibold text-indigo-900">{formatCurrency(summary.requiredGap)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-indigo-700">Requested Coverage</div>
                            <div className="text-sm font-semibold text-indigo-900">{formatCurrency(summary.requestedTotal)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-indigo-700">Approved Coverage</div>
                            <div className="text-sm font-semibold text-indigo-900">{formatCurrency(summary.approvedTotal)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-indigo-700">Remaining</div>
                            <div className="text-sm font-semibold text-indigo-900">{formatCurrency(summary.remainingCoverage)}</div>
                          </div>
                        </div>

                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-indigo-700 mb-1">
                            <span>Approval progress</span>
                            <span>{summary.coveragePercent}%</span>
                          </div>
                          <div className="w-full bg-indigo-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${summary.coverageMet ? 'bg-green-500' : 'bg-indigo-500'}`}
                              style={{ width: `${summary.coveragePercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-xs text-indigo-700 mb-3">
                          Approved: {summary.approvedCount} | Pending: {summary.pendingCount} | Declined: {summary.declinedCount} | Released: {summary.releasedCount}
                        </div>

                        {summary.requests.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-indigo-200">
                              <thead className="bg-indigo-100/70">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-indigo-800 uppercase">Guarantor</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-indigo-800 uppercase">Requested</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-indigo-800 uppercase">Approved</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-indigo-800 uppercase">Status</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-indigo-800 uppercase">Responded</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-indigo-100">
                                {summary.requests.map((request) => {
                                  const requestedAmount = parseInt(request.guaranteedAmount, 10) || 0;
                                  const approvedAmount = parseInt(request.approvedAmount, 10) || 0;
                                  const respondedAt =
                                    request.respondedAt || request.approvedAt || request.declinedAt || null;
                                  return (
                                    <tr key={request.$id}>
                                      <td className="px-3 py-2 text-sm text-gray-900">
                                        {getMemberNameById(request.guarantorId)}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                        {formatCurrency(requestedAmount)}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                        {formatCurrency(approvedAmount)}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGuarantorRequestBadgeClass(request.status)}`}>
                                          {request.status}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-center text-xs text-gray-500">
                                        {respondedAt ? new Date(respondedAt).toLocaleDateString() : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-indigo-700">
                            No guarantor request records found yet for this loan.
                          </p>
                        )}
                      </div>
                    );
                  })()
                ) : null}
                
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
                    <div className="text-xs text-gray-500 mb-3">
                      Basis used: {getLoanInterestBasisLabel(selectedLoan)}
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
                    <p className="text-xs text-gray-500 mb-2">
                      Calculated using {getLoanInterestBasisLabel(selectedLoan)}.
                    </p>
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

