import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { databases, functions, DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { formatCurrency } from '../../utils/financial';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { listAllDocuments } from '../../lib/pagination';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';

const LOAN_FINAL_APPROVAL_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_LOAN_FINAL_APPROVAL_FUNCTION_ID ||
  import.meta.env.VITE_APPWRITE_FINAL_APPROVAL_FUNCTION_ID ||
  'loan-final-approval';

const FINAL_APPROVAL_STATUSES = new Set(['pending', 'pending_admin_approval']);
const INTEREST_CALCULATION_MODES = {
  FLAT: 'flat',
  REDUCING_BALANCE: 'reducing_balance'
};

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
  const [earlyRepaymentRequests, setEarlyRepaymentRequests] = useState([]);
  const [showMemberPaymentsModal, setShowMemberPaymentsModal] = useState(false);
  const [memberPaymentMonth, setMemberPaymentMonth] = useState(1);
  const [memberPaymentsSelection, setMemberPaymentsSelection] = useState({});
  const [loanPaymentsSelection, setLoanPaymentsSelection] = useState({});
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [earlyRepaymentPaidAt, setEarlyRepaymentPaidAt] = useState(new Date().toISOString().split('T')[0]);
  const [loadingAction, setLoadingAction] = useState('');
  const [showEditDatesModal, setShowEditDatesModal] = useState(false);
  const [editLoanDate, setEditLoanDate] = useState('');
  const [editRepaymentDates, setEditRepaymentDates] = useState({});
  const [bulkRepaymentSelection, setBulkRepaymentSelection] = useState({});
  const [showEditLoanModal, setShowEditLoanModal] = useState(false);
  const [editLoanForm, setEditLoanForm] = useState({
    loanId: '',
    amount: '',
    balance: '',
    status: '',
    loanType: 'short_term',
    duration: ''
  });
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const requests = [
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.MEMBERS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_CHARGES),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS),
        fetchFinancialConfig(databases, DATABASE_ID, COLLECTIONS.FINANCIAL_CONFIG),
        COLLECTIONS.LOAN_EARLY_REPAYMENTS
          ? listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_EARLY_REPAYMENTS)
          : Promise.resolve([])
      ];

      const [loans, members, savings, charges, repayments, config, earlyRequests] = await Promise.all(requests);
      
      setLoans(loans);
      setMembers(members);
      setSavings(savings);
      setLoanCharges(charges);
      setLoanRepayments(repayments);
      setFinancialConfig(config);
      setEarlyRepaymentRequests(earlyRequests);
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

  const callLoanFinalApprovalFunction = async (loanId) => {
    try {
      const response = await functions.createExecution(
        LOAN_FINAL_APPROVAL_FUNCTION_ID,
        JSON.stringify({ action: 'finalApproveLoan', loanId })
      );
      if (!response.responseBody) {
        throw new Error('Loan final-approval function returned an empty response. Check function logs for details.');
      }
      const result = JSON.parse(response.responseBody);
      if (!result.success) {
        throw new Error(result.error || 'Loan final approval failed.');
      }
      return result;
    } catch (error) {
      console.error('Final approval function error:', error);
      throw error;
    }
  };

  const openEditLoanModal = (loan) => {
    setEditLoanForm({
      loanId: loan.$id,
      amount: loan.amount ?? '',
      balance: loan.balance ?? loan.amount ?? '',
      status: loan.status || '',
      loanType: loan.loanType || 'short_term',
      duration: loan.selectedMonths ?? loan.duration ?? ''
    });
    setShowEditLoanModal(true);
  };

  const saveLoanEdits = async () => {
    if (!editLoanForm.loanId) return;
    try {
      setLoadingAction(`loan-edit:${editLoanForm.loanId}`);
      await callLoanFunction('updateLoanDetails', {
        loanId: editLoanForm.loanId,
        updates: {
          amount: parseInt(editLoanForm.amount, 10) || 0,
          balance: parseInt(editLoanForm.balance, 10) || 0,
          status: editLoanForm.status,
          loanType: editLoanForm.loanType,
          duration: parseInt(editLoanForm.duration, 10) || 0
        }
      });
      toast.success('Loan updated successfully');
      setShowEditLoanModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update loan');
    } finally {
      setLoadingAction('');
    }
  };

  const deleteLoan = async (loan) => {
    if (!loan?.$id) return;
    if (!confirm('Delete this loan and related records?')) return;
    try {
      setLoadingAction(`loan-delete:${loan.$id}`);
      await callLoanFunction('deleteLoan', { loanId: loan.$id });
      toast.success('Loan deleted');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to delete loan');
    } finally {
      setLoadingAction('');
    }
  };

  const markEarlyRepaymentPaid = async (request) => {
    try {
      setLoadingAction(`early-payoff:${request.$id}`);
      await callLoanFunction('markEarlyRepaymentPaid', {
        requestId: request.$id,
        paidAt: earlyRepaymentPaidAt
      });
      toast.success('Early payoff marked as paid');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to mark early payoff paid');
    } finally {
      setLoadingAction('');
    }
  };

  const canFinalApproveLoan = (loan) => FINAL_APPROVAL_STATUSES.has(loan?.status);

  const approveLoan = async (loan) => {
    try {
      setLoadingAction(`approve:${loan.$id}`);
      await callLoanFinalApprovalFunction(loan.$id);
      toast.success('Loan final-approved successfully');
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
    const maxLoanAmount = totalSavings * ((financialConfig.loanEligibilityPercentage || 80) / 100);
    const activeLoansAmount = loans
      .filter(loan => normalizeMemberId(loan.memberId) === normalizeMemberId(memberId) && loan.status === 'active')
      .reduce((total, loan) => total + (loan.balance || loan.amount), 0);
    return Math.max(0, maxLoanAmount - activeLoansAmount);
  };

  const getMemberTotalLoanPrincipal = (memberId) => {
    const targetId = normalizeMemberId(memberId);
    return loans
      .filter(loan =>
        normalizeMemberId(loan.memberId) === targetId &&
        ['active', 'approved', 'completed'].includes(loan.status)
      )
      .reduce((total, loan) => total + (parseInt(loan.amount, 10) || 0), 0);
  };

  const getMemberOutstandingLoanBalance = (memberId) => {
    const targetId = normalizeMemberId(memberId);
    return loans
      .filter(loan =>
        normalizeMemberId(loan.memberId) === targetId &&
        (loan.status === 'active' || loan.status === 'approved')
      )
      .reduce((total, loan) => total + (parseInt(loan.balance, 10) || parseInt(loan.amount, 10) || 0), 0);
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

  const initEditRepaymentDates = (loan) => {
    if (!loan) return;
    const repaymentMap = {};
    getLoanRepayments(loan.$id).forEach((repayment) => {
      repaymentMap[repayment.$id] = repayment.paidAt ? new Date(repayment.paidAt).toISOString().split('T')[0] : '';
    });
    setEditRepaymentDates(repaymentMap);
  };

  const openEditDatesModal = (loan) => {
    setSelectedLoan(loan);
    setEditLoanDate(loan.createdAt ? new Date(loan.createdAt).toISOString().split('T')[0] : '');
    initEditRepaymentDates(loan);
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
    return loan?.loanType === 'long_term'
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

  const getMemberMonthDueTotal = (memberId, monthNumber) => {
    return getMemberMonthlyDuePayments(memberId, monthNumber)
      .reduce((sum, item) => sum + (parseInt(item.amount, 10) || 0), 0);
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

  const getLoanNextUnpaidInstallment = (loan) => {
    const schedule = getRepaymentSchedule(loan);
    if (schedule.length === 0) return null;

    const paidMonths = new Set(
      getLoanRepayments(loan.$id).map((repayment) => parseInt(repayment.month, 10))
    );
    const nextItem = schedule.find((item) => !paidMonths.has(parseInt(item.month, 10)));
    if (!nextItem) return null;

    const month = parseInt(nextItem.month, 10);
    const payment = parseInt(nextItem.payment ?? nextItem.amount, 10) || 0;
    const hasFirstMonthRepayment = paidMonths.has(1);
    const bankCharge = month === 1 && !hasFirstMonthRepayment ? getLoanChargeTotal(loan.$id) : 0;

    return {
      month,
      payment,
      bankCharge,
      totalAmount: payment + bankCharge
    };
  };

  const toggleBulkLoanSelection = (loanId, checked) => {
    setBulkRepaymentSelection((prev) => ({
      ...prev,
      [loanId]: checked
    }));
  };

  const getEarlyPayoffAmount = (loan, monthNumber) => {
    const principal = parseInt(loan.amount, 10) || 0;
    const remainingBalance = parseInt(loan.balance, 10) || principal;
    let openingBalance = remainingBalance;
    if (loan?.repaymentPlan) {
      try {
        const schedule = JSON.parse(loan.repaymentPlan);
        const previous = schedule.find((item) => parseInt(item.month, 10) === parseInt(monthNumber, 10) - 1);
        if (previous && previous.balance !== undefined && previous.balance !== null) {
          openingBalance = Math.max(0, parseInt(previous.balance, 10) || openingBalance);
        } else if (parseInt(monthNumber, 10) <= 1) {
          openingBalance = principal;
        }
      } catch {
        openingBalance = remainingBalance;
      }
    }
    const principalOutstanding = Math.min(remainingBalance, openingBalance || remainingBalance);
    const monthlyRate = getLoanMonthlyRatePercent(loan) / 100;
    const penaltyRate = (financialConfig.earlyRepaymentPenalty || 1) / 100;
    const mode = getLoanInterestCalculationMode(loan);
    const interestBase = mode === INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      ? principalOutstanding
      : principal;
    const interestAmount = Math.ceil(interestBase * monthlyRate) + Math.ceil(interestBase * penaltyRate);
    const bankCharge = parseInt(monthNumber) === 1 ? getLoanChargeTotal(loan.$id) : 0;
    return Math.ceil(principalOutstanding + interestAmount + bankCharge);
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

  const pendingFinalApprovalLoans = loans.filter(canFinalApproveLoan);
  const pendingGuarantorLoans = loans.filter(loan => loan.status === 'pending_guarantor_approval');
  const activeLoans = loans.filter(loan => loan.status === 'active' || loan.status === 'approved');
  const rejectedLoans = loans.filter(loan => loan.status === 'rejected');
  const completedLoans = loans.filter(loan => loan.status === 'completed');
  const pendingEarlyRepaymentRequests = earlyRepaymentRequests.filter(request => request.status === 'pending');
  const bulkPayableLoans = activeLoans
    .map((loan) => {
      const nextInstallment = getLoanNextUnpaidInstallment(loan);
      if (!nextInstallment) return null;
      const memberId = normalizeMemberId(loan.memberId);
      return {
        loan,
        memberId,
        memberName: getMemberName(memberId),
        nextInstallment
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      (a.memberName || '').localeCompare(b.memberName || '') ||
      a.nextInstallment.month - b.nextInstallment.month
    );
  const allBulkLoansSelected =
    bulkPayableLoans.length > 0 &&
    bulkPayableLoans.every((item) => Boolean(bulkRepaymentSelection[item.loan.$id]));
  const selectedBulkLoans = bulkPayableLoans.filter((item) => Boolean(bulkRepaymentSelection[item.loan.$id]));
  const selectedBulkTotal = selectedBulkLoans.reduce(
    (sum, item) => sum + (parseInt(item.nextInstallment.totalAmount, 10) || 0),
    0
  );

  const toggleSelectAllBulkLoans = (checked) => {
    const next = { ...bulkRepaymentSelection };
    bulkPayableLoans.forEach((item) => {
      next[item.loan.$id] = checked;
    });
    setBulkRepaymentSelection(next);
  };

  const recordBulkNextInstallments = async () => {
    if (selectedBulkLoans.length === 0) {
      toast.error('Select at least one loan to post.');
      return;
    }

    try {
      setLoadingAction('bulk-next-installments');
      const successes = [];
      const failures = [];

      for (const item of selectedBulkLoans) {
        try {
          await callLoanFunction('recordRepayment', {
            loanId: item.loan.$id,
            month: item.nextInstallment.month,
            isEarlyPayment: false,
            paidAt: paymentDate
          });
          successes.push(item);
        } catch (error) {
          failures.push({ item, error });
        }
      }

      if (successes.length > 0) {
        toast.success(`Recorded ${successes.length} repayment(s).`);
      }
      if (failures.length > 0) {
        const first = failures[0];
        toast.error(
          `${failures.length} repayment(s) failed. First: ${first.item.memberName}, loan ${first.item.loan.$id.slice(0, 8)} - ${first.error?.message || 'Unknown error'}`
        );
      }

      setBulkRepaymentSelection({});
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to record bulk repayments');
    } finally {
      setLoadingAction('');
    }
  };

  const selectedMemberId = selectedMember?.$id || null;
  const selectedMemberLoans = selectedMemberId ? getMemberLoans(selectedMemberId) : [];
  const selectedMemberSavings = selectedMemberId ? getMemberSavings(selectedMemberId) : 0;
  const selectedMemberTotalLoanPrincipal = selectedMemberId ? getMemberTotalLoanPrincipal(selectedMemberId) : 0;
  const selectedMemberOutstandingLoanBalance = selectedMemberId ? getMemberOutstandingLoanBalance(selectedMemberId) : 0;
  const selectedMemberNetSavingsAfterLoans = selectedMemberSavings - selectedMemberOutstandingLoanBalance;
  const selectedMemberMonthDuePayments = selectedMemberId
    ? getMemberMonthlyDuePayments(selectedMemberId, memberPaymentMonth)
    : [];
  const selectedMemberMonthDueTotal = selectedMemberId ? getMemberMonthDueTotal(selectedMemberId, memberPaymentMonth) : 0;
  const selectedMemberMonthDueByLoan = new Map(
    selectedMemberMonthDuePayments.map((item) => [item.loan.$id, item.amount])
  );
  const selectedMemberMaxLoanAmount = selectedMemberSavings * ((financialConfig.loanEligibilityPercentage || 80) / 100);
  const selectedMemberAvailableCredit = selectedMemberId ? getMemberAvailableCredit(selectedMemberId) : 0;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const printSelectedMemberSummary = () => {
    if (!selectedMemberId) return;

    const generatedAt = new Date();
    const loanRows = selectedMemberLoans.map((loan) => {
      const monthlyDue = selectedMemberMonthDueByLoan.get(loan.$id) || 0;
      const balance = parseInt(loan.balance, 10) || parseInt(loan.amount, 10) || 0;
      return `
        <tr>
          <td>${escapeHtml(new Date(loan.createdAt).toLocaleDateString())}</td>
          <td>${escapeHtml(formatCurrency(loan.amount))}</td>
          <td>${escapeHtml(formatCurrency(balance))}</td>
          <td>${escapeHtml(loan.status)}</td>
          <td>${escapeHtml(formatCurrency(monthlyDue))}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Member Loan Summary</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1, h2 { margin: 0 0 8px 0; }
            .meta { margin-bottom: 18px; font-size: 13px; color: #4b5563; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 16px 0 20px; }
            .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; }
            .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
            .value { font-size: 15px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 13px; text-align: left; }
            th { background: #f9fafb; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>Member Loan & Savings Summary</h1>
          <div class="meta">
            <div>Generated: ${escapeHtml(generatedAt.toLocaleString())}</div>
            <div>Member: ${escapeHtml(selectedMember?.name || '')}</div>
            <div>Membership Number: ${escapeHtml(selectedMember?.membershipNumber || '')}</div>
            <div>Month Number Reviewed: ${escapeHtml(memberPaymentMonth)}</div>
          </div>

          <div class="grid">
            <div class="card"><div class="label">Total Savings</div><div class="value">${escapeHtml(formatCurrency(selectedMemberSavings))}</div></div>
            <div class="card"><div class="label">Total Loans (Principal)</div><div class="value">${escapeHtml(formatCurrency(selectedMemberTotalLoanPrincipal))}</div></div>
            <div class="card"><div class="label">Outstanding Loans</div><div class="value">${escapeHtml(formatCurrency(selectedMemberOutstandingLoanBalance))}</div></div>
            <div class="card"><div class="label">Savings Less Outstanding Loans</div><div class="value">${escapeHtml(formatCurrency(selectedMemberNetSavingsAfterLoans))}</div></div>
            <div class="card"><div class="label">Month ${escapeHtml(memberPaymentMonth)} Total Due</div><div class="value">${escapeHtml(formatCurrency(selectedMemberMonthDueTotal))}</div></div>
            <div class="card"><div class="label">Available Credit</div><div class="value">${escapeHtml(formatCurrency(selectedMemberAvailableCredit))}</div></div>
          </div>

          <h2>Loans</h2>
          <table>
            <thead>
              <tr>
                <th>Applied</th>
                <th class="right">Amount</th>
                <th class="right">Balance</th>
                <th>Status</th>
                <th class="right">Month ${escapeHtml(memberPaymentMonth)} Due</th>
              </tr>
            </thead>
            <tbody>
              ${loanRows || '<tr><td colspan="5">No loans found for this member.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print this summary.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-6">
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Pending Admin</div>
            <div className="text-2xl font-bold text-yellow-600">{pendingFinalApprovalLoans.length}</div>
          </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Waiting Guarantors</div>
          <div className="text-2xl font-bold text-amber-600">{pendingGuarantorLoans.length}</div>
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
            <div className="text-2xl font-bold text-purple-600 break-words leading-tight">
              {formatCurrency(
                activeLoans.reduce((total, loan) => total + loan.amount, 0)
              )}
            </div>
          </div>
        </div>

        {/* Pending Admin Approval Loans */}
        {pendingFinalApprovalLoans.length > 0 && (
          <div className="card mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Pending Admin Approval</h3>
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
                  {pendingFinalApprovalLoans.map((loan) => {
                    const memberSavings = getMemberSavings(loan.memberId);
                    const maxLoanAmount = memberSavings * ((financialConfig.loanEligibilityPercentage || 80) / 100);
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
                              disabled={loadingAction === `approve:${loan.$id}`}
                              className="text-green-600 hover:text-green-900"
                              title="Approve"
                            >
                              {loadingAction === `approve:${loan.$id}` ? (
                                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                              ) : (
                                <CheckIcon className="h-5 w-5" />
                              )}
                            </button>
                            <button
                              onClick={() => rejectLoan(loan.$id)}
                              disabled={loadingAction === `reject:${loan.$id}`}
                              className="text-red-600 hover:text-red-900"
                              title="Reject"
                            >
                              {loadingAction === `reject:${loan.$id}` ? (
                                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                              ) : (
                                <XMarkIcon className="h-5 w-5" />
                              )}
                            </button>
                            <button
                              onClick={() => openEditLoanModal(loan)}
                              className="text-slate-600 hover:text-slate-900"
                              title="Edit Loan"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteLoan(loan)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete Loan"
                            >
                              Delete
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

        {pendingEarlyRepaymentRequests.length > 0 && (
          <div className="card mb-6 border border-amber-200">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
              <div>
              <h3 className="text-lg font-medium text-gray-900">Early Payoff Requests</h3>
              <p className="text-sm text-gray-600">
                Members requested to close loans early. Mark as paid to post the payoff.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={earlyRepaymentPaidAt}
                onChange={(e) => setEarlyRepaymentPaidAt(e.target.value)}
                className="form-input w-44"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Requested Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Requested Date</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingEarlyRepaymentRequests.map((request) => {
                  const loanId = normalizeLoanId(request.loanId);
                  const loan = loans.find(item => item.$id === loanId);
                  const memberId = normalizeMemberId(request.memberId) || normalizeMemberId(loan?.memberId);
                  const memberName = getMemberName(memberId);
                  const requestedAmount = parseInt(request.amount, 10) ||
                    (loan ? getEarlyPayoffAmount(loan, parseInt(request.month, 10) || getLoanNextUnpaidInstallment(loan)?.month || 1) : 0);
                  const requestedDate = request.requestedForDate || request.requestedAt || request.createdAt;

                  return (
                    <tr key={request.$id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{memberName}</div>
                        <div className="text-xs text-gray-500">{memberId || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{loan ? formatCurrency(loan.amount) : 'Loan'}</div>
                        <div className="text-xs text-gray-500">{loan?.loanType || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(requestedAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        {requestedDate ? new Date(requestedDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          type="button"
                          onClick={() => markEarlyRepaymentPaid(request)}
                          disabled={loadingAction === `early-payoff:${request.$id}`}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          {loadingAction === `early-payoff:${request.$id}` ? 'Posting...' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Bulk Next Installment Posting</h3>
            <p className="text-sm text-gray-600">
              Posts only the next unpaid installment per selected loan.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="form-input w-44"
              />
            </div>
            <button
              type="button"
              onClick={() => toggleSelectAllBulkLoans(!allBulkLoansSelected)}
              className="btn-secondary"
              disabled={bulkPayableLoans.length === 0}
            >
              {allBulkLoansSelected ? 'Clear All' : 'Select All'}
            </button>
            <button
              type="button"
              onClick={recordBulkNextInstallments}
              className="btn-primary"
              disabled={selectedBulkLoans.length === 0 || loadingAction === 'bulk-next-installments'}
            >
              {loadingAction === 'bulk-next-installments'
                ? 'Posting...'
                : `Post Selected (${selectedBulkLoans.length})`}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
          <span className="text-gray-700">
            Eligible loans: <strong>{bulkPayableLoans.length}</strong>
          </span>
          <span className="text-gray-700">
            Selected total: <strong>{formatCurrency(selectedBulkTotal)}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pick</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Next Month</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Installment</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Charge</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bulkPayableLoans.map((item) => (
                <tr key={item.loan.$id}>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <input
                      type="checkbox"
                      checked={Boolean(bulkRepaymentSelection[item.loan.$id])}
                      onChange={(e) => toggleBulkLoanSelection(item.loan.$id, e.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="font-medium">{item.memberName}</div>
                    <div className="text-xs text-gray-500">{item.memberId}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div>{formatCurrency(item.loan.amount)}</div>
                    <div className="text-xs text-gray-500">ID: {item.loan.$id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-900">
                    {item.nextInstallment.month}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {formatCurrency(item.nextInstallment.payment)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">
                    {formatCurrency(item.nextInstallment.bankCharge)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-blue-700">
                    {formatCurrency(item.nextInstallment.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bulkPayableLoans.length === 0 && (
            <div className="text-sm text-gray-500 py-4">No active loans with unpaid installments found.</div>
          )}
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
                setMemberPaymentMonth(getNextUnpaidMonth(memberId));
              } else {
                setSelectedMember(null);
                setMemberPaymentMonth(1);
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
          <div className="mb-6 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month Number</label>
              <input
                type="number"
                min="1"
                value={memberPaymentMonth}
                onChange={(e) => setMemberPaymentMonth(parseInt(e.target.value, 10) || 1)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
            <button
              type="button"
              onClick={printSelectedMemberSummary}
              className="btn-secondary"
            >
              Print Member Summary
            </button>
          </div>
        )}

        {selectedMember && (
          <div>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Member</div>
                  <div className="text-lg font-semibold">{selectedMember.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Total Savings</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(selectedMemberSavings)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Total Loans (Principal)</div>
                  <div className="text-lg font-semibold text-indigo-600">
                    {formatCurrency(selectedMemberTotalLoanPrincipal)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Outstanding Loan Balance</div>
                  <div className="text-lg font-semibold text-amber-600">
                    {formatCurrency(selectedMemberOutstandingLoanBalance)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Savings Less Outstanding Loans</div>
                  <div className={`text-lg font-semibold ${selectedMemberNetSavingsAfterLoans >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(selectedMemberNetSavingsAfterLoans)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Month {memberPaymentMonth} Total Due</div>
                  <div className="text-lg font-semibold text-blue-600">
                    {formatCurrency(selectedMemberMonthDueTotal)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Max Loan Amount</div>
                  <div className="text-lg font-semibold text-cyan-600">
                    {formatCurrency(selectedMemberMaxLoanAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Available Credit</div>
                  <div className="text-lg font-semibold text-purple-600">
                    {formatCurrency(selectedMemberAvailableCredit)}
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month {memberPaymentMonth} Due
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
                  {selectedMemberLoans.map((loan) => {
                    const monthDue = selectedMemberMonthDueByLoan.get(loan.$id) || 0;
                    return (
                    <tr key={loan.$id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{formatCurrency(loan.amount)}</div>
                        <div className="text-[11px] text-gray-500">{getLoanInterestBasisLabel(loan)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(loan.balance || loan.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-blue-600">
                        {formatCurrency(monthDue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          (loan.status === 'pending' || loan.status === 'pending_admin_approval') ? 'bg-yellow-100 text-yellow-800' :
                          loan.status === 'pending_guarantor_approval' ? 'bg-amber-100 text-amber-800' :
                          loan.status === 'active' ? 'bg-blue-100 text-blue-800' :
                          loan.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center space-x-2">
                          {canFinalApproveLoan(loan) && (
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
                          {loan.status === 'pending_guarantor_approval' && (
                            <span className="text-xs text-amber-700">Awaiting guarantor approvals</span>
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
                              <button
                                onClick={() => openEditLoanModal(loan)}
                                className="text-slate-600 hover:text-slate-900"
                                title="Edit Loan"
                              >
                                Edit Loan
                              </button>
                              <button
                                onClick={() => deleteLoan(loan)}
                                className="text-red-600 hover:text-red-800"
                                title="Delete Loan"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>

            {selectedMemberLoans.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No loans found for this member
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending Guarantor Coverage Loans */}
      {pendingGuarantorLoans.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Waiting for Guarantor Approvals</h3>
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
                    Guarantor Gap
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Approved Coverage
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingGuarantorLoans.map((loan) => (
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
                      {formatCurrency(loan.guarantorGapAmount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatCurrency(loan.guarantorApprovedAmount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                        {loan.status}
                      </span>
                    </td>
                  </tr>
                ))}
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
                            initEditRepaymentDates(loan);
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
                        <button
                          onClick={() => openEditLoanModal(loan)}
                          className="text-slate-600 hover:text-slate-900"
                          title="Edit Loan"
                        >
                          Edit Loan
                        </button>
                        <button
                          onClick={() => deleteLoan(loan)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Loan"
                        >
                          Delete
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

      {/* Completed Loans */}
      {completedLoans.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Completed Loans</h3>
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
                {completedLoans.map((loan) => (
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
                      {formatCurrency(loan.balance || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => openEditDatesModal(loan)}
                          className="text-slate-600 hover:text-slate-900"
                          title="Edit Dates"
                        >
                          Edit Dates
                        </button>
                        <button
                          onClick={() => openEditLoanModal(loan)}
                          className="text-slate-600 hover:text-slate-900"
                          title="Edit Loan"
                        >
                          Edit Loan
                        </button>
                        <button
                          onClick={() => deleteLoan(loan)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Loan"
                        >
                          Delete
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

      {showEditLoanModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Loan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
                <input
                  type="number"
                  value={editLoanForm.amount}
                  onChange={(e) => setEditLoanForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Balance (UGX)</label>
                <input
                  type="number"
                  value={editLoanForm.balance}
                  onChange={(e) => setEditLoanForm((prev) => ({ ...prev, balance: e.target.value }))}
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editLoanForm.status}
                  onChange={(e) => setEditLoanForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="form-input"
                >
                  <option value="pending">pending</option>
                  <option value="pending_guarantor_approval">pending_guarantor_approval</option>
                  <option value="pending_admin_approval">pending_admin_approval</option>
                  <option value="approved">approved</option>
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                  <option value="rejected">rejected</option>
                  <option value="cancelled">cancelled</option>
                  <option value="guarantor_coverage_failed">guarantor_coverage_failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
                <select
                  value={editLoanForm.loanType}
                  onChange={(e) => setEditLoanForm((prev) => ({ ...prev, loanType: e.target.value }))}
                  className="form-input"
                >
                  <option value="short_term">short_term</option>
                  <option value="long_term">long_term</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months)</label>
                <input
                  type="number"
                  value={editLoanForm.duration}
                  onChange={(e) => setEditLoanForm((prev) => ({ ...prev, duration: e.target.value }))}
                  className="form-input"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Note: editing amount or duration will regenerate the repayment plan automatically.
            </p>
            <div className="flex justify-end mt-6 space-x-3">
              <button
                type="button"
                onClick={() => setShowEditLoanModal(false)}
                className="btn-secondary"
                disabled={loadingAction.startsWith('loan-edit:')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveLoanEdits}
                className="btn-primary"
                disabled={loadingAction.startsWith('loan-edit:')}
              >
                {loadingAction.startsWith('loan-edit:') ? 'Saving...' : 'Save Changes'}
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
              <div className="text-sm text-gray-600">
                Interest Basis: {getLoanInterestBasisLabel(selectedLoan)}
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
                    .map(item => {
                      const alreadyPaid = !!getLoanRepaymentForMonth(selectedLoan.$id, item.month);
                      return (
                        <div key={item.month} className="border border-gray-200 rounded-md p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Month {item.month}
                              </div>
                              <div className="text-xs text-gray-500">
                                Payment: {formatCurrency(item.payment + (parseInt(item.month) === 1 ? getLoanChargeTotal(selectedLoan.$id) : 0))}
                              </div>
                              {alreadyPaid && (
                                <div className="text-xs text-green-600 mt-1">Paid</div>
                              )}
                            </div>
                            <label className="flex items-center text-sm">
                              <input
                                type="checkbox"
                                className="mr-2"
                                checked={alreadyPaid || !!loanPaymentsSelection[item.month]}
                                onChange={(e) => toggleLoanPaymentSelection(item.month, e.target.checked)}
                                disabled={alreadyPaid}
                              />
                              Mark as paid
                            </label>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Paid So Far (Edit Dates)</h4>
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
              <div className="mb-3 text-sm text-gray-700">
                Total Due For Month {memberPaymentMonth}:{' '}
                <span className="font-semibold text-blue-700">{formatCurrency(selectedMemberMonthDueTotal)}</span>
              </div>
              {selectedMemberMonthDuePayments.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No scheduled payments found for this month.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedMemberMonthDuePayments.map(item => {
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
                            <div className="text-xs text-gray-500">
                              Interest basis: {getLoanInterestBasisLabel(item.loan)}
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
