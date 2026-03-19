import { useState, useEffect } from 'react';
import { databases, storage, DATABASE_ID, COLLECTIONS, DOCUMENTS_BUCKET_ID, BRANDING_BUCKET_ID } from '../../lib/appwrite';
import { formatCurrency } from '../../utils/financial';
import { DocumentArrowDownIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { listAllDocuments } from '../../lib/pagination';
import { createPdfDoc, addSectionTitle, addKeyValueRows, addSimpleTable, savePdf } from '../../lib/pdf';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';
import { createLedgerEntry } from '../../lib/ledger';

const INTEREST_CALCULATION_MODES = {
  FLAT: 'flat',
  REDUCING_BALANCE: 'reducing_balance'
};

const ReportsManagement = () => {
  const [reportData, setReportData] = useState({
    members: [],
    loans: [],
    loanGuarantors: [],
    savings: [],
    loanRepayments: [],
    loanCharges: [],
    subscriptions: [],
    unitTrust: [],
    expenses: [],
    interestMonthly: [],
    ledger: []
  });
  const [loading, setLoading] = useState(true);
  const [ledgerReady, setLedgerReady] = useState(true);
  const [cashEntryLoading, setCashEntryLoading] = useState(false);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [portfolioMemberId, setPortfolioMemberId] = useState('');
  const [portfolioMonthNumber, setPortfolioMonthNumber] = useState(1);
  const [watermarkLogoData, setWatermarkLogoData] = useState('');
  const [financialConfig, setFinancialConfig] = useState({ ...DEFAULT_FINANCIAL_CONFIG });
  const [cashEntryForm, setCashEntryForm] = useState({
    amount: '',
    description: '',
    direction: 'credit',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReportData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      const size = 640;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) return;

      const targetSize = size * 0.62;
      const scale = Math.min(targetSize / image.width, targetSize / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (size - width) / 2;
      const y = (size - height) / 2;

      context.clearRect(0, 0, size, size);
      context.globalAlpha = 0.08;
      context.drawImage(image, x, y, width, height);
      setWatermarkLogoData(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      if (!cancelled) setWatermarkLogoData('');
    };

    const logoUrl = financialConfig.logoFileId
      ? storage.getFilePreview(
          financialConfig.logoBucketId || BRANDING_BUCKET_ID || DOCUMENTS_BUCKET_ID,
          financialConfig.logoFileId
        )
      : '/logo.png';

    image.src = logoUrl;

    return () => {
      cancelled = true;
    };
  }, [financialConfig.logoFileId, financialConfig.logoBucketId]);

  const fetchReportData = async () => {
    try {
      const requests = [
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.MEMBERS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS),
        COLLECTIONS.LOAN_GUARANTORS
          ? listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_GUARANTORS)
          : Promise.resolve([]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_CHARGES),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SUBSCRIPTIONS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.UNIT_TRUST),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.EXPENSES),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.INTEREST_MONTHLY),
        fetchFinancialConfig(databases, DATABASE_ID, COLLECTIONS.FINANCIAL_CONFIG)
      ];

      if (COLLECTIONS.LEDGER_ENTRIES) {
        requests.push(listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LEDGER_ENTRIES));
      } else {
        setLedgerReady(false);
      }

      const [
        members,
        loans,
        loanGuarantors,
        savings,
        loanRepayments,
        loanCharges,
        subscriptions,
        unitTrust,
        expenses,
        interestMonthly,
        config,
        ledger = []
      ] = await Promise.all(requests);

      setReportData({
        members,
        loans,
        loanGuarantors,
        savings,
        loanRepayments,
        loanCharges,
        subscriptions,
        unitTrust,
        expenses,
        interestMonthly,
        ledger
      });
      setFinancialConfig(config || { ...DEFAULT_FINANCIAL_CONFIG });
    } catch (error) {
      toast.error('Failed to fetch report data');
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const normalizeMemberId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value.$id) return value.$id;
    if (Array.isArray(value)) {
      const first = value.find((entry) => entry?.$id);
      return first ? first.$id : '';
    }
    return '';
  };

  const normalizeLoanId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value.$id) return value.$id;
    if (Array.isArray(value)) {
      const first = value.find((entry) => entry?.$id);
      return first ? first.$id : '';
    }
    return '';
  };

  const toDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const isWithinRange = (value) => {
    if (!reportStartDate && !reportEndDate) return true;
    const target = toDate(value);
    if (!target) return false;
    if (reportStartDate) {
      const start = new Date(reportStartDate);
      start.setHours(0, 0, 0, 0);
      if (target < start) return false;
    }
    if (reportEndDate) {
      const end = new Date(reportEndDate);
      end.setHours(23, 59, 59, 999);
      if (target > end) return false;
    }
    return true;
  };

  const filterByDate = (items, dateKey = 'createdAt') => (
    items.filter(item => isWithinRange(item?.[dateKey]))
  );

  const filteredLedger = filterByDate(reportData.ledger, 'createdAt');
  const filteredSavings = filterByDate(reportData.savings, 'createdAt');
  const filteredLoans = filterByDate(reportData.loans, 'createdAt');
  const filteredLoanGuarantors = filterByDate(reportData.loanGuarantors, 'createdAt');
  const filteredLoanRepayments = filterByDate(reportData.loanRepayments, 'paidAt');
  const filteredSubscriptions = filterByDate(reportData.subscriptions, 'createdAt');
  const filteredUnitTrust = filterByDate(reportData.unitTrust, 'date');
  const filteredExpenses = filterByDate(reportData.expenses, 'createdAt');
  const filteredLoanCharges = filterByDate(reportData.loanCharges, 'createdAt');
  const filteredInterestMonthly = filterByDate(reportData.interestMonthly, 'createdAt');

  const getReportReferenceDate = () => {
    if (reportEndDate) {
      const end = new Date(reportEndDate);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    if (reportStartDate) {
      const start = new Date(reportStartDate);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    return new Date();
  };

  const getSnapshotDate = () => {
    if (reportEndDate) {
      const end = new Date(reportEndDate);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    return new Date();
  };

  const isBeforeStart = (value) => {
    if (!reportStartDate) return false;
    const target = toDate(value);
    if (!target) return false;
    const start = new Date(reportStartDate);
    start.setHours(0, 0, 0, 0);
    return target < start;
  };

  const isOnOrBeforeSnapshot = (value) => {
    const target = toDate(value);
    if (!target) return false;
    return target <= getSnapshotDate();
  };

  const sumLedgerByTypes = (types) => {
    return filteredLedger
      .filter(entry => types.includes(entry.type))
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);
  };

  const sumMemberLedger = (memberId, types) => {
    return filteredLedger
      .filter(entry => normalizeMemberId(entry.memberId) === memberId && types.includes(entry.type))
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);
  };

  const sumMemberSavings = (memberId) => {
    return filteredSavings
      .filter(saving => normalizeMemberId(saving.memberId) === memberId)
      .reduce((sum, saving) => sum + (saving.amount || 0), 0);
  };

  const hasLedgerData = ledgerReady && reportData.ledger.length > 0;

  const getLedgerRows = (type) => filteredLedger.filter(entry => entry.type === type);

  const parseRepaymentPlan = (loan) => {
    if (!loan?.repaymentPlan) return [];
    try {
      return JSON.parse(loan.repaymentPlan);
    } catch {
      return [];
    }
  };

  const toInteger = (value, fallback = 0) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const clampNonNegative = (value) => Math.max(0, toInteger(value, 0));

  const getUnitTrustAmount = (record) => (
    toNumber(record?.amountFloat ?? record?.amount, 0)
  );

  const normalizeUnitTrustType = (value) => {
    const type = String(value || '').trim().toLowerCase();
    if (type === 'withdrawal' || type === 'withdraw') return 'withdrawal';
    if (type === 'interest') return 'interest';
    return 'purchase';
  };

  const sumUnitTrustByType = (items) => (
    items.reduce((acc, record) => {
      const type = normalizeUnitTrustType(record?.type);
      const amount = getUnitTrustAmount(record);
      acc[type] += amount;
      return acc;
    }, { purchase: 0, withdrawal: 0, interest: 0 })
  );

  const normalizeInterestCalculationMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      ? INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      : INTEREST_CALCULATION_MODES.FLAT;
  };

  const getLoanInterestCalculationMode = (loan) => normalizeInterestCalculationMode(
    loan?.interestCalculationModeApplied || financialConfig.interestCalculationMode
  );

  const getLoanInterestModeLabel = (loan) => (
    getLoanInterestCalculationMode(loan) === INTEREST_CALCULATION_MODES.REDUCING_BALANCE
      ? 'Reducing Balance'
      : 'Flat Principal'
  );

  const getLoanMonthlyRatePercent = (loan) => {
    const storedRate = Number(loan?.monthlyInterestRateApplied);
    if (Number.isFinite(storedRate) && storedRate >= 0) return storedRate;
    return loan?.loanType === 'long_term'
      ? Number(financialConfig.longTermInterestRate || 1.5)
      : Number(financialConfig.loanInterestRate || 2);
  };

  const getLoanInterestBasisLabel = (loan) => (
    `${getLoanInterestModeLabel(loan)} @ ${getLoanMonthlyRatePercent(loan)}%`
  );

  const getLoanGuarantorRequests = (loanId) => {
    const target = normalizeLoanId(loanId);
    return filteredLoanGuarantors.filter((request) => normalizeLoanId(request.loanId) === target);
  };

  const getLoanGuarantorSettlement = (loan) => {
    const requests = getLoanGuarantorRequests(loan.$id);
    const approvedRequests = requests.filter((request) => request.status === 'approved');

    const fallbackSecuredOriginal = approvedRequests.reduce(
      (sum, request) => sum + clampNonNegative(request.approvedAmount ?? request.guaranteedAmount),
      0
    );
    const securedOriginal = clampNonNegative(
      loan.securedOriginalTotal ?? loan.guarantorApprovedAmount ?? fallbackSecuredOriginal
    );

    const fallbackSecuredOutstanding = approvedRequests.reduce(
      (sum, request) => sum + clampNonNegative(request.securedOutstanding ?? request.approvedAmount ?? request.guaranteedAmount),
      0
    );
    const securedOutstanding = clampNonNegative(
      loan.securedOutstandingTotal ?? fallbackSecuredOutstanding
    );
    const normalizedOutstanding = Math.min(securedOriginal || securedOutstanding, securedOutstanding);

    const recoveredFallback = Math.max(0, securedOriginal - normalizedOutstanding);
    const guarantorRecovered = clampNonNegative(
      loan.guarantorPrincipalRecoveredTotal ?? recoveredFallback
    );
    const guaranteedExposureExists = securedOriginal > 0;
    const settlementPercent = guaranteedExposureExists
      ? Math.max(0, Math.min(100, Math.round((guarantorRecovered / securedOriginal) * 100)))
      : 0;
    const allocationStatus = loan.repaymentAllocationStatus || (guaranteedExposureExists ? 'guarantor_priority' : 'not_required');

    let settlementStage = 'N/A';
    if (guaranteedExposureExists) {
      if (normalizedOutstanding === 0) settlementStage = 'Settled';
      else if (guarantorRecovered > 0) settlementStage = 'In Progress';
      else if (allocationStatus === 'pending_guarantor') settlementStage = 'Pending';
      else settlementStage = 'Not Started';
    }

    return {
      requestCount: requests.length,
      approvedCount: approvedRequests.length,
      securedOriginal,
      securedOutstanding: normalizedOutstanding,
      guarantorRecovered,
      settlementPercent,
      allocationStatus,
      settlementStage,
      settlementCompletedAt: loan.guarantorSettlementCompletedAt || null
    };
  };

  const getLoanChargeTotal = (loanId) => {
    const target = normalizeLoanId(loanId);
    return filteredLoanCharges
      .filter(charge => normalizeLoanId(charge.loanId) === target)
      .reduce((sum, charge) => sum + (parseInt(charge.amount, 10) || 0), 0);
  };

  const getLoanRepaymentsForLoan = (loanId) => {
    const target = normalizeLoanId(loanId);
    return filteredLoanRepayments
      .filter(repayment => normalizeLoanId(repayment.loanId) === target)
      .sort((a, b) => {
        const aDate = new Date(a.paidAt || a.createdAt || a.$createdAt || 0).getTime();
        const bDate = new Date(b.paidAt || b.createdAt || b.$createdAt || 0).getTime();
        return aDate - bDate;
      });
  };

  const getRepaymentForLoanMonth = (loanId, monthNumber) => {
    return getLoanRepaymentsForLoan(loanId).find(
      repayment => parseInt(repayment.month, 10) === parseInt(monthNumber, 10)
    );
  };

  const getLoanMonthDueAmount = (loan, monthNumber) => {
    const month = parseInt(monthNumber, 10);
    const schedule = parseRepaymentPlan(loan);
    const item = schedule.find(entry => parseInt(entry.month, 10) === month);
    if (!item) return 0;
    const hasFirstMonthRepayment = !!getRepaymentForLoanMonth(loan.$id, 1);
    const chargeAmount = month === 1 && !hasFirstMonthRepayment ? getLoanChargeTotal(loan.$id) : 0;
    return (parseInt(item.payment, 10) || 0) + chargeAmount;
  };

  const getLoanNextDue = (loan) => {
    const schedule = parseRepaymentPlan(loan);
    if (schedule.length === 0) return null;

    const paidMonths = new Set(
      getLoanRepaymentsForLoan(loan.$id).map(repayment => parseInt(repayment.month, 10))
    );
    const next = schedule.find(item => !paidMonths.has(parseInt(item.month, 10)));
    if (!next) return null;
    const month = parseInt(next.month, 10);
    return {
      month,
      amount: getLoanMonthDueAmount(loan, month)
    };
  };

  const getMemberSavingsTotal = (memberId) => (
    hasLedgerData
      ? sumMemberLedger(memberId, ['Savings'])
      : sumMemberSavings(memberId)
  );

  const getLoanStartDate = (loan) => (
    toDate(loan?.disbursedAt || loan?.createdAt || loan?.$createdAt)
  );

  const getLoanInstallmentDate = (loan, monthNumber) => {
    const startDate = getLoanStartDate(loan);
    const installment = parseInt(monthNumber, 10);
    if (!startDate || !Number.isFinite(installment) || installment < 1) return null;
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + (installment - 1));
    return dueDate;
  };

  const getExpectedInstallmentMonth = (loan, referenceDate = new Date()) => {
    const scheduleLength = parseRepaymentPlan(loan).length || 1;
    const startDate = getLoanStartDate(loan);
    if (!startDate) return 1;

    const monthsElapsed =
      ((referenceDate.getFullYear() - startDate.getFullYear()) * 12) +
      (referenceDate.getMonth() - startDate.getMonth());
    const expected = monthsElapsed + 1;
    return Math.max(1, Math.min(scheduleLength, expected));
  };

  const getLoanDueState = (loan, nextDue) => {
    if (loan.status === 'completed' || !nextDue) return 'Completed';
    const expectedMonth = getExpectedInstallmentMonth(loan, getReportReferenceDate());
    if (nextDue.month < expectedMonth) return 'Overdue';
    if (nextDue.month === expectedMonth) return 'Due This Month';
    return 'Current';
  };

  const getLoanOverdueAmount = (loan, nextDue) => {
    if (!nextDue) return 0;
    const expectedMonth = getExpectedInstallmentMonth(loan, getReportReferenceDate());
    if (nextDue.month >= expectedMonth) return 0;

    let overdueAmount = 0;
    for (let month = nextDue.month; month < expectedMonth; month += 1) {
      overdueAmount += getLoanMonthDueAmount(loan, month);
    }
    return overdueAmount;
  };

  const getLoanNextThreeMonthsDue = (loan, nextDue) => {
    if (!nextDue) return 0;
    const schedule = parseRepaymentPlan(loan);
    if (schedule.length === 0) return 0;
    const paidMonths = new Set(
      getLoanRepaymentsForLoan(loan.$id).map(repayment => parseInt(repayment.month, 10))
    );

    let total = 0;
    for (let month = nextDue.month; month < nextDue.month + 3; month += 1) {
      const inSchedule = schedule.some(item => parseInt(item.month, 10) === month);
      if (inSchedule && !paidMonths.has(month)) {
        total += getLoanMonthDueAmount(loan, month);
      }
    }
    return total;
  };

  const getMemberLoansForPortfolio = (memberId) => {
    return filteredLoans.filter(loan =>
      normalizeMemberId(loan.memberId) === memberId &&
      ['active', 'approved', 'completed'].includes(loan.status)
    );
  };

  const getMemberRepaymentTimeline = (memberId) => {
    const memberLoanIds = new Set(getMemberLoansForPortfolio(memberId).map(loan => loan.$id));
    return filteredLoanRepayments
      .filter(repayment => memberLoanIds.has(normalizeLoanId(repayment.loanId)))
      .map((repayment) => {
        const loanId = normalizeLoanId(repayment.loanId);
        const paidDate = repayment.paidAt || repayment.createdAt || repayment.$createdAt || null;
        return {
          loanId,
          month: parseInt(repayment.month, 10) || 0,
          amount: parseInt(repayment.amount, 10) || 0,
          paidAt: paidDate,
          isEarlyPayment: !!repayment.isEarlyPayment
        };
      })
      .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));
  };

  const getMemberNextDueMonthNumber = (memberId) => {
    const activeMemberLoans = filteredLoans.filter(loan =>
      normalizeMemberId(loan.memberId) === memberId &&
      (loan.status === 'active' || loan.status === 'approved')
    );
    const nextMonths = activeMemberLoans
      .map(loan => getLoanNextDue(loan)?.month)
      .filter(Boolean);
    return nextMonths.length > 0 ? Math.min(...nextMonths) : 1;
  };

  const getMemberLoanPortfolioRows = (memberId, monthNumber) => {
    const month = parseInt(monthNumber, 10);
    return getMemberLoansForPortfolio(memberId).map((loan) => {
      const schedule = parseRepaymentPlan(loan);
      const repayments = getLoanRepaymentsForLoan(loan.$id);
      const paidMonths = new Set(repayments.map(repayment => parseInt(repayment.month, 10)));
      const installmentsCleared = paidMonths.size;
      const installmentCount = schedule.length;
      const clearancePercent = installmentCount > 0
        ? Math.round((installmentsCleared / installmentCount) * 100)
        : 0;
      const paidTotal = repayments.reduce((sum, repayment) => sum + (parseInt(repayment.amount, 10) || 0), 0);
      const dueForMonth = (loan.status === 'active' || loan.status === 'approved')
        ? getLoanMonthDueAmount(loan, month)
        : 0;
      const repaymentForMonth = getRepaymentForLoanMonth(loan.$id, month);
      const monthCleared = parseInt(repaymentForMonth?.amount, 10) || 0;
      const monthClearedAt = repaymentForMonth
        ? (repaymentForMonth.paidAt || repaymentForMonth.createdAt || repaymentForMonth.$createdAt || null)
        : null;
      const nextDue = (loan.status === 'active' || loan.status === 'approved') ? getLoanNextDue(loan) : null;
      const nextDueDate = nextDue ? getLoanInstallmentDate(loan, nextDue.month) : null;
      const dueState = getLoanDueState(loan, nextDue);
      const overdueAmount = getLoanOverdueAmount(loan, nextDue);
      const nextThreeMonthsDue = getLoanNextThreeMonthsDue(loan, nextDue);
      const outstanding = loan.status === 'completed'
        ? 0
        : (parseInt(loan.balance, 10) || parseInt(loan.amount, 10) || 0);
      const lastRepayment = repayments.length ? repayments[repayments.length - 1] : null;
      const lastClearedAt = lastRepayment
        ? (lastRepayment.paidAt || lastRepayment.createdAt || lastRepayment.$createdAt || null)
        : null;
      const guarantorSettlement = getLoanGuarantorSettlement(loan);
      const interestMode = getLoanInterestModeLabel(loan);
      const monthlyRateApplied = getLoanMonthlyRatePercent(loan);
      const interestBasis = getLoanInterestBasisLabel(loan);

      return {
        loan,
        amount: parseInt(loan.amount, 10) || 0,
        outstanding,
        paidTotal,
        dueForMonth,
        monthCleared,
        monthClearedAt,
        nextDue,
        nextDueDate,
        dueState,
        overdueAmount,
        nextThreeMonthsDue,
        installmentCount,
        installmentsCleared,
        clearancePercent,
        lastClearedAt,
        guarantorSettlement,
        interestMode,
        monthlyRateApplied,
        interestBasis
      };
    });
  };

  const getMemberLoanPortfolioSummary = (memberId, monthNumber) => {
    const rows = getMemberLoanPortfolioRows(memberId, monthNumber);
    const timeline = getMemberRepaymentTimeline(memberId);
    const nextDueMonths = rows
      .map(row => row.nextDue?.month)
      .filter(Boolean)
      .map(value => parseInt(value, 10));
    const earliestNextDueMonth = nextDueMonths.length ? Math.min(...nextDueMonths) : null;

    const totalOutstandingPrincipal = rows.reduce((sum, row) => sum + row.outstanding, 0);
    const totalPrincipalCleared = rows.reduce(
      (sum, row) => sum + Math.max(0, (parseInt(row.amount, 10) || 0) - (parseInt(row.outstanding, 10) || 0)),
      0
    );
    const totalCashCleared = rows.reduce((sum, row) => sum + row.paidTotal, 0);
    const totalNextPayment = rows.reduce(
      (sum, row) => sum + (parseInt(row.nextDue?.amount, 10) || 0),
      0
    );
    const totalNext3Months = rows.reduce((sum, row) => sum + (row.nextThreeMonthsDue || 0), 0);
    const totalOverdueAmount = rows.reduce((sum, row) => sum + (row.overdueAmount || 0), 0);
    const totalGuarantorSecuredOriginal = rows.reduce(
      (sum, row) => sum + (row.guarantorSettlement?.securedOriginal || 0),
      0
    );
    const totalGuarantorRecovered = rows.reduce(
      (sum, row) => sum + (row.guarantorSettlement?.guarantorRecovered || 0),
      0
    );
    const totalGuarantorOutstanding = rows.reduce(
      (sum, row) => sum + (row.guarantorSettlement?.securedOutstanding || 0),
      0
    );
    const loansWithGuarantorCoverage = rows.filter(
      (row) => (row.guarantorSettlement?.securedOriginal || 0) > 0
    ).length;
    const guarantorSettlementCompletedLoans = rows.filter(
      (row) => (row.guarantorSettlement?.securedOriginal || 0) > 0 && (row.guarantorSettlement?.securedOutstanding || 0) === 0
    ).length;
    const overdueRows = rows.filter(row => row.dueState === 'Overdue' && row.nextDueDate);
    const oldestOverdueDate = overdueRows.length
      ? overdueRows.reduce((oldest, row) => {
          if (!oldest) return row.nextDueDate;
          return row.nextDueDate < oldest ? row.nextDueDate : oldest;
        }, null)
      : null;
    const memberSavings = getMemberSavingsTotal(memberId);

    return {
      totalDisbursed: rows.reduce((sum, row) => sum + row.amount, 0),
      totalOwed: totalOutstandingPrincipal,
      totalOutstandingPrincipal,
      totalPrincipalCleared,
      totalCashCleared,
      monthDueTotal: rows.reduce((sum, row) => sum + row.dueForMonth, 0),
      monthClearedTotal: rows.reduce((sum, row) => sum + row.monthCleared, 0),
      totalNextPayment,
      totalNext3Months,
      totalOverdueAmount,
      totalGuarantorSecuredOriginal,
      totalGuarantorRecovered,
      totalGuarantorOutstanding,
      guarantorSettlementPercent: totalGuarantorSecuredOriginal > 0
        ? Math.round((totalGuarantorRecovered / totalGuarantorSecuredOriginal) * 100)
        : 0,
      loansWithGuarantorCoverage,
      guarantorSettlementCompletedLoans,
      overdueLoanCount: rows.filter(row => row.dueState === 'Overdue').length,
      oldestOverdueDate,
      earliestNextDueMonth,
      memberSavings,
      netMemberPosition: memberSavings - totalOutstandingPrincipal,
      latestClearedAt: timeline[0]?.paidAt || null
    };
  };

  const getMemberPortfolioOverview = (memberId) => {
    const rows = getMemberLoanPortfolioRows(memberId, getMemberNextDueMonthNumber(memberId));
    const timeline = getMemberRepaymentTimeline(memberId);
    const nextDueMonth = getMemberNextDueMonthNumber(memberId);
    const nextPaymentTotal = rows.reduce(
      (sum, row) => sum + (parseInt(row.nextDue?.amount, 10) || 0),
      0
    );
    const totalOutstandingPrincipal = rows.reduce((sum, row) => sum + row.outstanding, 0);
    const totalPrincipalCleared = rows.reduce(
      (sum, row) => sum + Math.max(0, (parseInt(row.amount, 10) || 0) - (parseInt(row.outstanding, 10) || 0)),
      0
    );
    const totalCashCleared = rows.reduce((sum, row) => sum + row.paidTotal, 0);
    const totalNext3Months = rows.reduce((sum, row) => sum + (row.nextThreeMonthsDue || 0), 0);
    const totalOverdueAmount = rows.reduce((sum, row) => sum + (row.overdueAmount || 0), 0);
    const totalGuarantorSecuredOriginal = rows.reduce(
      (sum, row) => sum + (row.guarantorSettlement?.securedOriginal || 0),
      0
    );
    const totalGuarantorRecovered = rows.reduce(
      (sum, row) => sum + (row.guarantorSettlement?.guarantorRecovered || 0),
      0
    );
    const totalGuarantorOutstanding = rows.reduce(
      (sum, row) => sum + (row.guarantorSettlement?.securedOutstanding || 0),
      0
    );
    const loansWithGuarantorCoverage = rows.filter(
      (row) => (row.guarantorSettlement?.securedOriginal || 0) > 0
    ).length;
    const guarantorSettlementCompletedLoans = rows.filter(
      (row) => (row.guarantorSettlement?.securedOriginal || 0) > 0 && (row.guarantorSettlement?.securedOutstanding || 0) === 0
    ).length;
    const overdueRows = rows.filter(row => row.dueState === 'Overdue' && row.nextDueDate);
    const oldestOverdueDate = overdueRows.length
      ? overdueRows.reduce((oldest, row) => {
          if (!oldest) return row.nextDueDate;
          return row.nextDueDate < oldest ? row.nextDueDate : oldest;
        }, null)
      : null;
    const memberSavings = getMemberSavingsTotal(memberId);

    return {
      memberId,
      activeLoanCount: rows.filter(row => row.loan.status === 'active' || row.loan.status === 'approved').length,
      totalDisbursed: rows.reduce((sum, row) => sum + row.amount, 0),
      totalOwed: totalOutstandingPrincipal,
      totalOutstandingPrincipal,
      totalPrincipalCleared,
      totalCashCleared,
      totalSavings: memberSavings,
      netMemberPosition: memberSavings - totalOutstandingPrincipal,
      nextDueMonth,
      nextPaymentTotal,
      next3MonthsTotal: totalNext3Months,
      totalOverdueAmount,
      totalGuarantorSecuredOriginal,
      totalGuarantorRecovered,
      totalGuarantorOutstanding,
      guarantorSettlementPercent: totalGuarantorSecuredOriginal > 0
        ? Math.round((totalGuarantorRecovered / totalGuarantorSecuredOriginal) * 100)
        : 0,
      loansWithGuarantorCoverage,
      guarantorSettlementCompletedLoans,
      overdueLoanCount: rows.filter(row => row.dueState === 'Overdue').length,
      dueThisMonthLoanCount: rows.filter(row => row.dueState === 'Due This Month').length,
      currentLoanCount: rows.filter(row => row.dueState === 'Current').length,
      oldestOverdueDate,
      lastClearedAt: timeline[0]?.paidAt || null
    };
  };

  useEffect(() => {
    if (!portfolioMemberId) {
      setPortfolioMonthNumber(1);
      return;
    }
    setPortfolioMonthNumber(getMemberNextDueMonthNumber(portfolioMemberId));
  }, [
    portfolioMemberId,
    reportStartDate,
    reportEndDate,
    reportData.loans,
    reportData.loanRepayments,
    reportData.loanCharges
  ]);

  const getLoanInterestBreakdown = (loans, repayments) => {
    const repaymentsByLoan = repayments.reduce((acc, repayment) => {
      const loanId = repayment.loanId?.$id || repayment.loanId;
      if (!loanId) return acc;
      acc[loanId] = acc[loanId] || [];
      acc[loanId].push(repayment);
      return acc;
    }, {});

    let interestPaid = 0;
    let interestAccrued = 0;

    loans.forEach((loan) => {
      const schedule = parseRepaymentPlan(loan);
      const repayments = repaymentsByLoan[loan.$id] || [];
      const paidMonths = new Set(repayments.map(r => parseInt(r.month)));

      schedule.forEach((item) => {
        const month = parseInt(item.month);
        const interestAmount = parseInt(item.interest) || 0;
        if (paidMonths.has(month)) {
          interestPaid += interestAmount;
        } else {
          interestAccrued += interestAmount;
        }
      });
    });

    return { interestPaid, interestAccrued };
  };

  const generateMemberReport = () => {
    const eligibilityPercent = (Number(financialConfig.loanEligibilityPercentage) || 80) / 100;
    const memberReport = reportData.members.map(member => {
      const memberSavings = hasLedgerData
        ? sumMemberLedger(member.$id, ['Savings'])
        : sumMemberSavings(member.$id);
      const memberLoans = filteredLoans.filter(loan => normalizeMemberId(loan.memberId) === member.$id);
      const activeLoans = memberLoans.filter(loan => loan.status === 'active');
      const activeBalance = activeLoans.reduce((total, loan) => total + (loan.balance || loan.amount), 0);

      return {
        name: member.name,
        membershipNumber: member.membershipNumber,
        email: member.email,
        phone: member.phone,
        joinDate: member.joinDate,
        totalSavings: memberSavings,
        loanEligibility: memberSavings * eligibilityPercent,
        activeLoans: activeLoans.length,
        totalLoanAmount: activeBalance,
        availableCredit: Math.max(0, (memberSavings * eligibilityPercent) - activeBalance)
      };
    });

    return memberReport;
  };

  const generateFinancialSummary = () => {
    const totalSavings = hasLedgerData
      ? sumLedgerByTypes(['Savings'])
      : filteredSavings.reduce((sum, saving) => sum + (saving.amount || 0), 0);
    const totalLoansDisbursed = hasLedgerData
      ? sumLedgerByTypes(['LoanDisbursement'])
      : filteredLoans
          .filter(loan => ['active', 'approved', 'completed'].includes(loan.status))
          .reduce((sum, loan) => sum + (loan.amount || 0), 0);
    const totalLoanRepayments = hasLedgerData
      ? sumLedgerByTypes(['LoanRepayment'])
      : filteredLoanRepayments.reduce((sum, repayment) => sum + (repayment.amount || 0), 0);
    const totalSubscriptions = hasLedgerData
      ? sumLedgerByTypes(['Subscription'])
      : filteredSubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);
    const totalUnitTrust = hasLedgerData
      ? sumLedgerByTypes(['UnitTrust'])
      : filteredUnitTrust.reduce((sum, record) => sum + (record.amount || 0), 0);
    const totalExpenses = hasLedgerData
      ? sumLedgerByTypes(['Expense'])
      : filteredExpenses.reduce((sum, record) => sum + (record.amount || 0), 0);
    const totalTransferCharges = hasLedgerData
      ? sumLedgerByTypes(['TransferCharge'])
      : filteredLoanCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
    const totalInterestPayouts = sumLedgerByTypes(['InterestPayout']);
    const trustInterestEarned = filteredInterestMonthly.reduce(
      (sum, record) => sum + (record.trustInterestTotal || 0),
      0
    );
    const { interestPaid, interestAccrued } = getLoanInterestBreakdown(filteredLoans, filteredLoanRepayments);

    const cashAtBank = sumLedgerByTypes(['CashAtBank']);

    const totalLoansActive = filteredLoans
      .filter(loan => loan.status === 'active')
      .reduce((sum, loan) => sum + (loan.balance || loan.amount), 0);

    return {
      totalMembers: reportData.members.length,
      totalSavings,
      totalLoansDisbursed,
      totalLoanRepayments,
      totalSubscriptions,
      totalUnitTrust,
      totalExpenses,
      totalTransferCharges,
      totalInterestPayouts,
      trustInterestEarned,
      loanInterestPaid: interestPaid,
      loanInterestAccrued: interestAccrued,
      cashAtBank,
      portfolioValue: totalLoansActive,
      savingsToLoanRatio: totalSavings > 0 ? (totalLoansActive / totalSavings * 100).toFixed(2) : 0
    };
  };

  const getPortfolioGuarantorSettlementTotals = () => {
    const portfolioLoans = filteredLoans.filter((loan) =>
      ['active', 'approved', 'completed'].includes(loan.status)
    );
    const settlements = portfolioLoans.map((loan) => getLoanGuarantorSettlement(loan));
    const totalSecuredOriginal = settlements.reduce((sum, item) => sum + (item.securedOriginal || 0), 0);
    const totalRecovered = settlements.reduce((sum, item) => sum + (item.guarantorRecovered || 0), 0);
    const totalOutstanding = settlements.reduce((sum, item) => sum + (item.securedOutstanding || 0), 0);
    const loanCountWithGuarantors = settlements.filter((item) => (item.securedOriginal || 0) > 0).length;

    return {
      totalSecuredOriginal,
      totalRecovered,
      totalOutstanding,
      loanCountWithGuarantors,
      settlementPercent: totalSecuredOriginal > 0
        ? Math.round((totalRecovered / totalSecuredOriginal) * 100)
        : 0
    };
  };

  const reportRangeLabel = () => {
    if (!reportStartDate && !reportEndDate) return 'All dates';
    const start = reportStartDate ? new Date(reportStartDate).toLocaleDateString() : 'Any';
    const end = reportEndDate ? new Date(reportEndDate).toLocaleDateString() : 'Any';
    return `${start} - ${end}`;
  };

  const exportToCSV = (data, filename) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${filename} exported successfully`);
  };

  const memberReport = generateMemberReport();
  const financialSummary = generateFinancialSummary();
  const guarantorSettlementTotals = getPortfolioGuarantorSettlementTotals();
  const cashEntries = getLedgerRows('CashAtBank').sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const loanLabelMap = filteredLoans
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .reduce((acc, loan, index) => {
      acc[loan.$id] = `Loan_${index + 1}`;
      return acc;
    }, {});
  const memberNameById = reportData.members.reduce((acc, member) => {
    acc[member.$id] = member.name;
    return acc;
  }, {});
  const getLoanLabel = (loanId) => loanLabelMap[loanId?.$id || loanId] || 'Loan';
  const selectedPortfolioMember = reportData.members.find(member => member.$id === portfolioMemberId) || null;
  const selectedPortfolioRows = portfolioMemberId
    ? getMemberLoanPortfolioRows(portfolioMemberId, portfolioMonthNumber)
    : [];
  const selectedPortfolioSummary = portfolioMemberId
    ? getMemberLoanPortfolioSummary(portfolioMemberId, portfolioMonthNumber)
    : {
        totalDisbursed: 0,
        totalOwed: 0,
        totalOutstandingPrincipal: 0,
        totalPrincipalCleared: 0,
        totalCashCleared: 0,
        totalSavings: 0,
        netMemberPosition: 0,
        monthDueTotal: 0,
        monthClearedTotal: 0,
        totalNextPayment: 0,
        totalNext3Months: 0,
        totalOverdueAmount: 0,
        totalGuarantorSecuredOriginal: 0,
        totalGuarantorRecovered: 0,
        totalGuarantorOutstanding: 0,
        guarantorSettlementPercent: 0,
        loansWithGuarantorCoverage: 0,
        guarantorSettlementCompletedLoans: 0,
        overdueLoanCount: 0,
        oldestOverdueDate: null,
        earliestNextDueMonth: null,
        latestClearedAt: null
      };
  const selectedPortfolioTimeline = portfolioMemberId
    ? getMemberRepaymentTimeline(portfolioMemberId)
    : [];
  const allMembersPortfolioOverview = reportData.members
    .map((member) => ({
      member,
      overview: getMemberPortfolioOverview(member.$id)
    }))
    .filter((item) => item.overview.totalDisbursed > 0)
    .sort((a, b) => b.overview.totalOutstandingPrincipal - a.overview.totalOutstandingPrincipal);
  const portfolioHealthSummary = allMembersPortfolioOverview.reduce((summary, item) => {
    const { overview } = item;
    if (overview.overdueLoanCount > 0) {
      summary.membersWithOverdue += 1;
    }
    summary.totalOverdueAmount += overview.totalOverdueAmount || 0;
    if (overview.oldestOverdueDate) {
      const target = new Date(overview.oldestOverdueDate);
      if (!summary.oldestOverdueDate || target < summary.oldestOverdueDate) {
        summary.oldestOverdueDate = target;
      }
    }
    summary.next3MonthsForecast += overview.next3MonthsTotal || 0;
    summary.membersWithActiveGuarantorExposure += (overview.totalGuarantorOutstanding || 0) > 0 ? 1 : 0;
    summary.totalGuarantorOutstanding += overview.totalGuarantorOutstanding || 0;
    summary.totalGuarantorRecovered += overview.totalGuarantorRecovered || 0;
    summary.totalGuarantorSecuredOriginal += overview.totalGuarantorSecuredOriginal || 0;
    return summary;
  }, {
    membersWithOverdue: 0,
    totalOverdueAmount: 0,
    oldestOverdueDate: null,
    next3MonthsForecast: 0,
    membersWithActiveGuarantorExposure: 0,
    totalGuarantorOutstanding: 0,
    totalGuarantorRecovered: 0,
    totalGuarantorSecuredOriginal: 0
  });

  const exportNextRepaymentTotalsPdf = () => {
    if (allMembersPortfolioOverview.length === 0) {
      toast.error('No next repayment totals available to export.');
      return;
    }

    const rows = allMembersPortfolioOverview.map(({ member, overview }) => ([
      member.name || '',
      member.membershipNumber || member.$id || '',
      overview.nextDueMonth || '-',
      formatCurrency(overview.nextPaymentTotal || 0),
      formatCurrency(overview.totalOverdueAmount || 0)
    ]));

    const grandTotal = allMembersPortfolioOverview.reduce(
      (sum, { overview }) => sum + (overview.nextPaymentTotal || 0),
      0
    );
    const totalOverdue = allMembersPortfolioOverview.reduce(
      (sum, { overview }) => sum + (overview.totalOverdueAmount || 0),
      0
    );

    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Next Repayment Totals by Member',
      subtitle: 'Combined next unpaid installment totals',
      meta: [
        `Generated: ${new Date().toLocaleString()}`,
        `Report Range: ${reportRangeLabel()}`,
        `Members: ${allMembersPortfolioOverview.length}`,
        `Grand Next Repayment Total: ${formatCurrency(grandTotal)}`,
        `Total Overdue Amount: ${formatCurrency(totalOverdue)}`
      ],
      watermark: pdfWatermark
    });

    let cursorY = startY;
    cursorY = addSectionTitle(doc, cursorY, 'Summary', pdfMeta, 4);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Members Included', value: allMembersPortfolioOverview.length },
      { label: 'Grand Next Repayment Total', value: formatCurrency(grandTotal) },
      { label: 'Total Overdue Amount', value: formatCurrency(totalOverdue) }
    ], pdfMeta);

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Member Totals', pdfMeta, 6);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Member', 'Membership #', 'Next Due Installment', 'Next Repayment Total', 'Overdue Amount'],
      rows,
      pdfMeta
    );

    savePdf(doc, `next-repayment-totals-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const getDueStateBadgeClass = (state) => {
    switch (state) {
      case 'Overdue':
        return 'bg-red-100 text-red-700';
      case 'Due This Month':
        return 'bg-amber-100 text-amber-700';
      case 'Current':
        return 'bg-blue-100 text-blue-700';
      case 'Completed':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPortfolioMemberHealth = (overview) => {
    if ((overview.overdueLoanCount || 0) > 0) return 'Overdue';
    if ((overview.dueThisMonthLoanCount || 0) > 0) return 'Due This Month';
    if ((overview.currentLoanCount || 0) > 0) return 'Current';
    return 'Completed';
  };

  const getGuarantorSettlementBadgeClass = (stage) => {
    switch (stage) {
      case 'Settled':
        return 'bg-emerald-100 text-emerald-700';
      case 'In Progress':
        return 'bg-blue-100 text-blue-700';
      case 'Pending':
        return 'bg-amber-100 text-amber-700';
      case 'Not Started':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatAllocationStatus = (status) => {
    switch (status) {
      case 'guarantor_priority':
        return 'Guarantor First';
      case 'borrower_priority':
        return 'Borrower Principal';
      case 'pending_guarantor':
        return 'Pending Guarantor';
      case 'not_required':
        return 'Not Required';
      default:
        return status || 'N/A';
    }
  };

  const pdfWatermark = {
    text: '',
    textSize: 42,
    imageData: watermarkLogoData
  };
  const disbursementLedgerCount = getLedgerRows('LoanDisbursement').length;
  const repaymentLedgerCount = getLedgerRows('LoanRepayment').length;
  const chargeLedgerCount = getLedgerRows('TransferCharge').length;

  const exportGuarantorSettlementCsv = () => {
    const rows = filteredLoans
      .filter((loan) => ['active', 'approved', 'completed'].includes(loan.status))
      .map((loan) => {
        const settlement = getLoanGuarantorSettlement(loan);
        return {
          loan: getLoanLabel(loan.$id),
          member: memberNameById[normalizeMemberId(loan.memberId)] || '',
          loanType: loan.loanType || 'short_term',
          loanStatus: loan.status,
          allocationMode: formatAllocationStatus(settlement.allocationStatus),
          settlementStage: settlement.settlementStage,
          securedTotal: settlement.securedOriginal || 0,
          recovered: settlement.guarantorRecovered || 0,
          outstanding: settlement.securedOutstanding || 0,
          settlementPercent: `${settlement.settlementPercent || 0}%`,
          settlementDate: settlement.settlementCompletedAt
            ? new Date(settlement.settlementCompletedAt).toLocaleDateString()
            : '',
          lastAllocationAt: loan.lastRepaymentAllocationAt
            ? new Date(loan.lastRepaymentAllocationAt).toLocaleDateString()
            : ''
        };
      })
      .filter((row) => row.securedTotal > 0);

    exportToCSV(rows, 'guarantor-settlement-progress');
  };

  const exportMemberLoanPortfolioCsv = () => {
    if (!portfolioMemberId) {
      toast.error('Select a member first');
      return;
    }

    const rows = selectedPortfolioRows.map((row) => ({
      loanType: row.loan.loanType || 'short_term',
      loan: getLoanLabel(row.loan.$id),
      interestMode: row.interestMode,
      monthlyRateAppliedPercent: row.monthlyRateApplied,
      interestBasis: row.interestBasis,
      loanStatus: row.loan.status,
      health: row.dueState,
      disbursedAmount: row.amount,
      outstandingPrincipal: row.outstanding,
      cashPaid: row.paidTotal,
      installmentsCleared: `${row.installmentsCleared}/${row.installmentCount || 0}`,
      clearancePercent: `${row.clearancePercent}%`,
      nextDueInstallment: row.nextDue?.month || '',
      nextDueDate: row.nextDueDate ? new Date(row.nextDueDate).toLocaleDateString() : '',
      nextPayment: row.nextDue?.amount || 0,
      overdueAmount: row.overdueAmount || 0,
      next3MonthsForecast: row.nextThreeMonthsDue || 0,
      guarantorSettlementStage: row.guarantorSettlement?.settlementStage || 'N/A',
      guarantorSettlementPercent: `${row.guarantorSettlement?.settlementPercent || 0}%`,
      guarantorSecuredOriginal: row.guarantorSettlement?.securedOriginal || 0,
      guarantorRecovered: row.guarantorSettlement?.guarantorRecovered || 0,
      guarantorOutstanding: row.guarantorSettlement?.securedOutstanding || 0,
      repaymentAllocationStatus: formatAllocationStatus(row.guarantorSettlement?.allocationStatus),
      lastCleared: row.lastClearedAt ? new Date(row.lastClearedAt).toLocaleDateString() : '',
      [`dueMonth${portfolioMonthNumber}`]: row.dueForMonth,
      [`clearedMonth${portfolioMonthNumber}`]: row.monthCleared,
      clearedAt: row.monthClearedAt ? new Date(row.monthClearedAt).toLocaleDateString() : ''
    }));

    exportToCSV(
      rows,
      `loan-portfolio-${selectedPortfolioMember?.membershipNumber || selectedPortfolioMember?.$id || 'member'}`
    );
  };

  const printMemberLoanPortfolio = () => {
    if (!portfolioMemberId) {
      toast.error('Select a member first');
      return;
    }

    const memberName = selectedPortfolioMember?.name || '';
    const membershipNumber = selectedPortfolioMember?.membershipNumber || '';
    const generatedAt = new Date().toLocaleString();
    const monthNumber = portfolioMonthNumber;

    const loanRows = selectedPortfolioRows.map((row) => `
      <tr>
        <td>
          <div class="loan-main">${getLoanLabel(row.loan.$id)}</div>
          ${row.guarantorSettlement?.securedOriginal > 0
            ? `<div class="loan-sub">
                G-settlement: ${formatCurrency(row.guarantorSettlement.guarantorRecovered)} / ${formatCurrency(row.guarantorSettlement.securedOriginal)}
                (${row.guarantorSettlement.settlementPercent}%)
               </div>`
            : '<div class="loan-sub">No guarantor coverage</div>'}
        </td>
        <td>${row.loan.status}</td>
        <td>${row.interestBasis}</td>
        <td>
          <span class="badge ${
            row.dueState === 'Overdue'
              ? 'overdue'
              : row.dueState === 'Due This Month'
                ? 'due'
                : row.dueState === 'Current'
                  ? 'current'
                  : 'completed'
          }">${row.dueState}</span>
        </td>
        <td style="text-align:right">${formatCurrency(row.outstanding)}</td>
        <td style="text-align:right">${formatCurrency(row.paidTotal)}</td>
        <td style="text-align:center">${row.installmentsCleared}/${row.installmentCount || 0} (${row.clearancePercent}%)</td>
        <td style="text-align:center">${row.nextDue ? row.nextDue.month : '-'}</td>
        <td style="text-align:right">${formatCurrency(row.nextDue?.amount || 0)}</td>
        <td style="text-align:right">${formatCurrency(row.overdueAmount || 0)}</td>
        <td>${row.lastClearedAt ? new Date(row.lastClearedAt).toLocaleDateString() : '-'}</td>
      </tr>
    `).join('');

    const timelineRows = selectedPortfolioTimeline.slice(0, 30).map((entry) => `
      <tr>
        <td>${entry.paidAt ? new Date(entry.paidAt).toLocaleDateString() : ''}</td>
        <td>${getLoanLabel(entry.loanId)}</td>
        <td style="text-align:center">${entry.month || ''}</td>
        <td style="text-align:right">${formatCurrency(entry.amount || 0)}</td>
        <td style="text-align:center">${entry.isEarlyPayment ? 'Yes' : 'No'}</td>
      </tr>
    `).join('');

    const guarantorRows = selectedPortfolioRows
      .filter((row) => (row.guarantorSettlement?.securedOriginal || 0) > 0)
      .map((row) => `
        <tr>
          <td>${getLoanLabel(row.loan.$id)}</td>
          <td>${formatAllocationStatus(row.guarantorSettlement?.allocationStatus)}</td>
          <td>${row.guarantorSettlement?.settlementStage || 'N/A'}</td>
          <td style="text-align:right">${formatCurrency(row.guarantorSettlement?.securedOriginal || 0)}</td>
          <td style="text-align:right">${formatCurrency(row.guarantorSettlement?.guarantorRecovered || 0)} (${row.guarantorSettlement?.settlementPercent || 0}%)</td>
          <td style="text-align:right">${formatCurrency(row.guarantorSettlement?.securedOutstanding || 0)}</td>
          <td>${row.guarantorSettlement?.settlementCompletedAt ? new Date(row.guarantorSettlement?.settlementCompletedAt).toLocaleDateString() : '-'}</td>
        </tr>
      `).join('');

    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) {
      toast.error('Allow pop-ups to print this report.');
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Member Loan Portfolio Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; position: relative; }
            body::before {
              content: '';
              position: fixed;
              inset: 0;
              background-image: url('${watermarkLogoData || '/logo.png'}');
              background-repeat: no-repeat;
              background-position: center;
              background-size: 360px;
              opacity: 0.08;
              z-index: 0;
              pointer-events: none;
            }
            body > * { position: relative; z-index: 1; }
            h1, h2 { margin: 0 0 10px 0; }
            .meta { margin-bottom: 14px; color: #4b5563; font-size: 13px; }
            .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 12px 0 18px; }
            .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
            .label { font-size: 11px; color: #6b7280; }
            .value { font-size: 15px; font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 16px; table-layout: fixed; }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 7px;
              font-size: 12px;
              white-space: normal;
              word-break: break-word;
              overflow-wrap: anywhere;
              vertical-align: top;
            }
            th { background: #f9fafb; text-align: left; }
            .badge { border-radius: 999px; font-size: 10px; font-weight: 700; padding: 2px 6px; display: inline-block; }
            .badge.overdue { background: #fee2e2; color: #b91c1c; }
            .badge.due { background: #fef3c7; color: #92400e; }
            .badge.current { background: #dbeafe; color: #1d4ed8; }
            .badge.completed { background: #d1fae5; color: #047857; }
            .loan-main { font-weight: 600; }
            .loan-sub { font-size: 10px; color: #64748b; margin-top: 4px; line-height: 1.3; }
          </style>
        </head>
        <body>
          <h1>Member Loan Portfolio Report</h1>
          <div class="meta">
            <div>Generated: ${generatedAt}</div>
            <div>Member: ${memberName}</div>
            <div>Membership Number: ${membershipNumber}</div>
            <div>Schedule Month Analysed: ${monthNumber}</div>
            <div>Date Range: ${reportRangeLabel()}</div>
          </div>

          <div class="grid">
            <div class="card"><div class="label">Total Disbursed</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalDisbursed)}</div></div>
            <div class="card"><div class="label">Outstanding Principal</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalOutstandingPrincipal)}</div></div>
            <div class="card"><div class="label">Principal Cleared</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalPrincipalCleared)}</div></div>
            <div class="card"><div class="label">Cash Cleared (Incl. Interest/Charges)</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalCashCleared)}</div></div>
            <div class="card"><div class="label">Member Savings</div><div class="value">${formatCurrency(selectedPortfolioSummary.memberSavings)}</div></div>
            <div class="card"><div class="label">Net Member Position (Savings - Loans)</div><div class="value">${formatCurrency(selectedPortfolioSummary.netMemberPosition)}</div></div>
            <div class="card"><div class="label">Total Next Payment</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalNextPayment)}</div></div>
            <div class="card"><div class="label">Next 3 Months Forecast</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalNext3Months)}</div></div>
            <div class="card"><div class="label">Overdue Amount</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalOverdueAmount)}</div></div>
            <div class="card"><div class="label">Earliest Next Due Installment</div><div class="value">${selectedPortfolioSummary.earliestNextDueMonth || 'N/A'}</div></div>
            <div class="card"><div class="label">Month ${monthNumber} Total Due</div><div class="value">${formatCurrency(selectedPortfolioSummary.monthDueTotal)}</div></div>
            <div class="card"><div class="label">Month ${monthNumber} Cleared</div><div class="value">${formatCurrency(selectedPortfolioSummary.monthClearedTotal)}</div></div>
            <div class="card"><div class="label">Overdue Loans</div><div class="value">${selectedPortfolioSummary.overdueLoanCount}</div></div>
            <div class="card"><div class="label">Latest Cleared Date</div><div class="value">${selectedPortfolioSummary.latestClearedAt ? new Date(selectedPortfolioSummary.latestClearedAt).toLocaleDateString() : 'N/A'}</div></div>
            <div class="card"><div class="label">Guarantor Secured Total</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalGuarantorSecuredOriginal || 0)}</div></div>
            <div class="card"><div class="label">Guarantor Recovered</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalGuarantorRecovered || 0)}</div></div>
            <div class="card"><div class="label">Guarantor Outstanding</div><div class="value">${formatCurrency(selectedPortfolioSummary.totalGuarantorOutstanding || 0)}</div></div>
            <div class="card"><div class="label">Guarantor Settlement Progress</div><div class="value">${selectedPortfolioSummary.guarantorSettlementPercent || 0}%</div></div>
          </div>

          <h2>Loans Overview</h2>
          <table>
            <thead>
              <tr>
                <th>Loan</th>
                <th>Loan Status</th>
                <th>Interest Basis</th>
                <th>Health</th>
                <th>Outstanding Principal</th>
                <th>Cash Paid</th>
                <th>Cleared Progress</th>
                <th>Next Due Installment</th>
                <th>Next Payment</th>
                <th>Overdue</th>
                <th>Last Cleared</th>
              </tr>
            </thead>
            <tbody>
              ${loanRows || '<tr><td colspan="11">No loans found for this member.</td></tr>'}
            </tbody>
          </table>

          <h2>Recent Cleared Payments</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Loan</th>
                <th>Schedule Month</th>
                <th>Amount</th>
                <th>Early Payment</th>
              </tr>
            </thead>
            <tbody>
              ${timelineRows || '<tr><td colspan="5">No repayments recorded.</td></tr>'}
            </tbody>
          </table>

          <h2>Guarantor Settlement Progress (Derived)</h2>
          <table>
            <thead>
              <tr>
                <th>Loan</th>
                <th>Allocation</th>
                <th>Stage</th>
                <th>Secured Total</th>
                <th>Recovered</th>
                <th>Outstanding</th>
                <th>Settlement Date</th>
              </tr>
            </thead>
            <tbody>
              ${guarantorRows || '<tr><td colspan="7">No guarantor-backed loans.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const exportAgmSummaryPdf = () => {
    const formatAgmAmount = (value) => new Intl.NumberFormat('en-UG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
    const snapshotDate = getSnapshotDate();
    const unitTrustBeforeStart = reportData.unitTrust.filter((record) => isBeforeStart(record?.date));
    const unitTrustRangeTotals = sumUnitTrustByType(filteredUnitTrust);
    const unitTrustBeforeTotals = sumUnitTrustByType(unitTrustBeforeStart);

    const openingTrustBalance =
      unitTrustBeforeTotals.purchase +
      unitTrustBeforeTotals.interest -
      unitTrustBeforeTotals.withdrawal;
    const closingTrustBalance =
      openingTrustBalance +
      unitTrustRangeTotals.purchase +
      unitTrustRangeTotals.interest -
      unitTrustRangeTotals.withdrawal;

    const totalSavingsToDate = hasLedgerData
      ? reportData.ledger
          .filter((entry) => entry.type === 'Savings' && isOnOrBeforeSnapshot(entry.createdAt))
          .reduce((sum, entry) => sum + (entry.amount || 0), 0)
      : reportData.savings
          .filter((saving) => isOnOrBeforeSnapshot(saving.createdAt))
          .reduce((sum, saving) => sum + (saving.amount || 0), 0);

    const totalSavingsInRange = hasLedgerData
      ? sumLedgerByTypes(['Savings'])
      : filteredSavings.reduce((sum, saving) => sum + (saving.amount || 0), 0);
    const totalSubscriptionsInRange = hasLedgerData
      ? sumLedgerByTypes(['Subscription'])
      : filteredSubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);
    const totalExpensesInRange = hasLedgerData
      ? sumLedgerByTypes(['Expense'])
      : filteredExpenses.reduce((sum, record) => sum + (record.amount || 0), 0);
    const totalTransferChargesInRange = hasLedgerData
      ? sumLedgerByTypes(['TransferCharge'])
      : filteredLoanCharges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
    const totalLoanRepaymentsInRange = hasLedgerData
      ? sumLedgerByTypes(['LoanRepayment'])
      : filteredLoanRepayments.reduce((sum, repayment) => sum + (repayment.amount || 0), 0);
    const totalLoansDisbursedInRange = hasLedgerData
      ? sumLedgerByTypes(['LoanDisbursement'])
      : filteredLoans
          .filter((loan) => ['active', 'approved', 'completed'].includes(loan.status))
          .reduce((sum, loan) => sum + (loan.amount || 0), 0);

    const { interestPaid: loanInterestPaid } = getLoanInterestBreakdown(reportData.loans, filteredLoanRepayments);
    const totalInterestPayoutsInRange = sumLedgerByTypes(['InterestPayout']);

    const loansReceivable = reportData.loans
      .filter((loan) => isOnOrBeforeSnapshot(loan?.createdAt || loan?.$createdAt))
      .filter((loan) => ['active', 'approved'].includes(loan.status))
      .reduce((sum, loan) => sum + (parseInt(loan.balance, 10) || parseInt(loan.amount, 10) || 0), 0);

    const cashAtBankSnapshot = hasLedgerData
      ? reportData.ledger
          .filter((entry) => entry.type === 'CashAtBank' && isOnOrBeforeSnapshot(entry.createdAt))
          .reduce((sum, entry) => sum + (entry.amount || 0), 0)
      : 0;

    const totalAssets = closingTrustBalance + loansReceivable + cashAtBankSnapshot;
    const totalLiabilities = totalSavingsToDate;
    const netPosition = totalAssets - totalLiabilities;

    const totalIncome =
      totalSubscriptionsInRange +
      loanInterestPaid +
      unitTrustRangeTotals.interest +
      totalTransferChargesInRange;
    const totalExpenses = totalExpensesInRange + totalInterestPayoutsInRange;
    const netIncome = totalIncome - totalExpenses;

    const toMonthKey = (value) => {
      if (!value) return null;
      if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) {
        return value;
      }
      const dateValue = toDate(value);
      return dateValue ? dateValue.toISOString().slice(0, 7) : null;
    };

    const isMonthInRange = (monthKey) => {
      if (!monthKey) return false;
      return isWithinRange(`${monthKey}-01T00:00:00`);
    };

    const addMonthly = (map, key, amount) => {
      if (!key) return;
      map[key] = (map[key] || 0) + (amount || 0);
    };

    const trustInterestByMonth = {};
    const trustInvestedByMonth = {};
    reportData.unitTrust.forEach((record) => {
      const type = String(record.type || '').toLowerCase();
      const recordDate = record.date || record.createdAt || record.$createdAt;
      if (!isWithinRange(recordDate)) return;
      const monthKey = toMonthKey(recordDate);
      const amountValue = getUnitTrustAmount(record);
      if (type === 'interest') {
        addMonthly(trustInterestByMonth, monthKey, amountValue);
      }
      if (type === 'purchase') {
        addMonthly(trustInvestedByMonth, monthKey, amountValue);
      }
    });

    const savingsByMonth = {};
    const savingsSource = hasLedgerData ? getLedgerRows('Savings') : reportData.savings;
    savingsSource.forEach((saving) => {
      const monthKey = toMonthKey(saving.month || saving.createdAt || saving.$createdAt);
      if (!isMonthInRange(monthKey)) return;
      addMonthly(savingsByMonth, monthKey, saving.amount || 0);
    });

    const loanInterestByMonth = {};
    const loanSchedulesById = new Map(
      reportData.loans.map((loan) => [loan.$id, parseRepaymentPlan(loan)])
    );
    reportData.loanRepayments.forEach((repayment) => {
      const paidAt = repayment.paidAt || repayment.createdAt || repayment.$createdAt;
      if (!isWithinRange(paidAt)) return;
      const loanId = repayment.loanId?.$id || repayment.loanId;
      if (!loanId) return;
      const schedule = loanSchedulesById.get(loanId);
      if (!schedule) return;
      const monthNumber = parseInt(repayment.month, 10);
      if (!Number.isFinite(monthNumber)) return;
      const scheduleItem = schedule.find((item) => parseInt(item.month, 10) === monthNumber);
      if (!scheduleItem) return;
      const interestAmount = parseInt(scheduleItem.interest, 10) || 0;
      const monthKey = toMonthKey(paidAt);
      addMonthly(loanInterestByMonth, monthKey, interestAmount);
    });

    const loanPrincipalPaidByMonth = {};
    const firstMonthChargeApplied = new Set();
    reportData.loanRepayments.forEach((repayment) => {
      const paidAt = repayment.paidAt || repayment.createdAt || repayment.$createdAt;
      if (!isWithinRange(paidAt)) return;
      const loanId = repayment.loanId?.$id || repayment.loanId;
      if (!loanId) return;
      const schedule = loanSchedulesById.get(loanId);
      if (!schedule) return;
      const monthNumber = parseInt(repayment.month, 10);
      if (!Number.isFinite(monthNumber)) return;
      const scheduleItem = schedule.find((item) => parseInt(item.month, 10) === monthNumber);
      if (!scheduleItem) return;
      const interestAmount = parseInt(scheduleItem.interest, 10) || 0;
      const scheduledPrincipal = parseInt(scheduleItem.principal, 10) || 0;
      const chargeAmount = monthNumber === 1 && !firstMonthChargeApplied.has(loanId)
        ? getLoanChargeTotal(loanId)
        : 0;
      if (monthNumber === 1) {
        firstMonthChargeApplied.add(loanId);
      }
      const totalPaid = Number(repayment.amount) || 0;
      let principalPaid = Math.max(0, totalPaid - interestAmount - chargeAmount);
      if (!repayment.isEarlyPayment && scheduledPrincipal > 0) {
        principalPaid = Math.min(principalPaid, scheduledPrincipal);
      }
      const monthKey = toMonthKey(paidAt);
      addMonthly(loanPrincipalPaidByMonth, monthKey, principalPaid);
    });

    const loansDisbursedByMonth = {};
    reportData.loans
      .filter((loan) => ['active', 'approved', 'completed'].includes(loan.status))
      .forEach((loan) => {
        const loanDate = loan.createdAt || loan.$createdAt;
        if (!isWithinRange(loanDate)) return;
        addMonthly(loansDisbursedByMonth, toMonthKey(loanDate), loan.amount || 0);
      });

    const monthlyKeys = Array.from(new Set([
      ...Object.keys(trustInterestByMonth),
      ...Object.keys(loanInterestByMonth),
      ...Object.keys(loanPrincipalPaidByMonth),
      ...Object.keys(trustInvestedByMonth),
      ...Object.keys(loansDisbursedByMonth),
      ...Object.keys(savingsByMonth)
    ])).sort();

    const formatMonthLabel = (key) => {
      if (!key) return '';
      const dateValue = toDate(`${key}-01T00:00:00`);
      return dateValue
        ? dateValue.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
        : key;
    };

    const monthlyDetailRowsRaw = monthlyKeys.map((key) => ({
      key,
      trustInvested: trustInvestedByMonth[key] || 0,
      trustInterest: trustInterestByMonth[key] || 0,
      loanInterest: loanInterestByMonth[key] || 0,
      loanPrincipalPaid: loanPrincipalPaidByMonth[key] || 0,
      loansDisbursed: loansDisbursedByMonth[key] || 0,
      savings: savingsByMonth[key] || 0
    }));

    const monthlyDetailRowsFiltered = monthlyDetailRowsRaw.filter((row) => (
      Math.abs(row.trustInvested) > 0 ||
      Math.abs(row.trustInterest) > 0 ||
      Math.abs(row.loanInterest) > 0 ||
      Math.abs(row.loanPrincipalPaid) > 0 ||
      Math.abs(row.loansDisbursed) > 0 ||
      Math.abs(row.savings) > 0
    ));

    const monthlyTotals = monthlyDetailRowsFiltered.reduce(
      (acc, row) => {
        acc.trustInvested += row.trustInvested || 0;
        acc.trustInterest += row.trustInterest || 0;
        acc.loanInterest += row.loanInterest || 0;
        acc.loanPrincipalPaid += row.loanPrincipalPaid || 0;
        acc.loansDisbursed += row.loansDisbursed || 0;
        acc.savings += row.savings || 0;
        return acc;
      },
      {
        trustInvested: 0,
        trustInterest: 0,
        loanInterest: 0,
        loanPrincipalPaid: 0,
        loansDisbursed: 0,
        savings: 0
      }
    );

    const monthlyDetailRows = monthlyDetailRowsFiltered.length
      ? [
          ...monthlyDetailRowsFiltered.map((row) => ([
            formatMonthLabel(row.key),
            formatAgmAmount(row.savings),
            '',
            formatAgmAmount(row.trustInvested),
            formatAgmAmount(row.trustInterest),
            formatAgmAmount(row.loanPrincipalPaid),
            formatAgmAmount(row.loanInterest),
            formatAgmAmount(row.loansDisbursed)
          ])),
          [
            'Total',
            formatAgmAmount(monthlyTotals.savings),
            '',
            formatAgmAmount(monthlyTotals.trustInvested),
            formatAgmAmount(monthlyTotals.trustInterest),
            formatAgmAmount(monthlyTotals.loanPrincipalPaid),
            formatAgmAmount(monthlyTotals.loanInterest),
            formatAgmAmount(monthlyTotals.loansDisbursed)
          ]
        ]
      : [['No monthly activity found in range', '', '', '', '', '', '', '']];

    const meta = [
      `Generated: ${new Date().toLocaleString()}`,
      `Total Members: ${reportData.members.length}`,
      `Report Range: ${reportRangeLabel()}`
    ];
    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Financial Summary for Crownzcom Investment Club',
      subtitle: '',
      meta,
      watermark: pdfWatermark,
      showTitleOnNewPages: false
    });

    let cursorY = startY;
    const SECTION_GAP = 5;
    cursorY = addSectionTitle(doc, cursorY, 'Statement of Financial Position', pdfMeta);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Assets - Trust Balance (Invested Funds)', value: formatAgmAmount(closingTrustBalance) },
      { label: 'Assets - Loans Receivable (Outstanding Principal)', value: formatAgmAmount(loansReceivable) },
      { label: 'Assets - Cash at Bank', value: formatAgmAmount(cashAtBankSnapshot) },
      { label: 'Total Assets', value: formatAgmAmount(totalAssets) },
      { label: 'Liabilities - Member Savings / Deposits', value: formatAgmAmount(totalLiabilities) },
      { label: 'Total Liabilities', value: formatAgmAmount(totalLiabilities) },
      { label: 'Net Position (Assets - Liabilities)', value: formatAgmAmount(netPosition) }
    ], pdfMeta);

    cursorY += SECTION_GAP;
    cursorY = addSectionTitle(doc, cursorY, 'Unit Trust Activity (Rollforward)', pdfMeta);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Opening Trust Balance', value: formatAgmAmount(openingTrustBalance) },
      { label: 'Total Invested to Trust', value: formatAgmAmount(unitTrustRangeTotals.purchase) },
      { label: 'Trust Interest Earned', value: formatAgmAmount(unitTrustRangeTotals.interest) },
      { label: 'Total Withdrawals from Trust', value: formatAgmAmount(unitTrustRangeTotals.withdrawal) },
      { label: 'Closing Trust Balance', value: formatAgmAmount(closingTrustBalance) }
    ], pdfMeta);

    cursorY += SECTION_GAP;
    cursorY = addSectionTitle(doc, cursorY, 'Loan Portfolio Summary', pdfMeta);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Loans Disbursed', value: formatAgmAmount(totalLoansDisbursedInRange) },
      { label: 'Total Loan Repayments (Cash In)', value: formatAgmAmount(totalLoanRepaymentsInRange) },
      { label: 'Loan Interest Earned', value: formatAgmAmount(loanInterestPaid) },
      { label: 'Bank/Transfer Charges Earned', value: formatAgmAmount(totalTransferChargesInRange) },
      { label: 'Outstanding Loan Balance (Principal)', value: formatAgmAmount(loansReceivable) }
    ], pdfMeta);

    cursorY += SECTION_GAP;
    cursorY = addSectionTitle(doc, cursorY, 'Monthly Activity Details', pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      [
        'Month',
        'Savings',
        '',
        'Invested In Trust',
        'Trust Interest Earned',
        'Loan Principal Paid',
        'Loan Interest Earned',
        'Loans Disbursed'
      ],
      monthlyDetailRows,
      pdfMeta
    );


    cursorY += SECTION_GAP + 2;
    cursorY = addSectionTitle(doc, cursorY, 'Member Contributions & Club Expenses', pdfMeta, 6);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Member Savings', value: formatAgmAmount(totalSavingsInRange) },
      { label: 'Total Subscriptions', value: formatAgmAmount(totalSubscriptionsInRange) },
      { label: 'Total Interest Paid to Members', value: formatAgmAmount(totalInterestPayoutsInRange) },
      { label: 'Total Club Expenses', value: formatAgmAmount(totalExpensesInRange) }
    ], pdfMeta);

    cursorY += SECTION_GAP;
    cursorY = addSectionTitle(doc, cursorY, 'Income Statement (Operational Performance)', pdfMeta, 12);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Category', 'Amount'],
      [
        ['Income - Loan Interest', formatAgmAmount(loanInterestPaid)],
        ['Income - Transfer / Bank Charges', formatAgmAmount(totalTransferChargesInRange)],
        ['Income - Trust Interest', formatAgmAmount(unitTrustRangeTotals.interest)],
        ['Income - Subscriptions', formatAgmAmount(totalSubscriptionsInRange)],
        ['Total Income', formatAgmAmount(totalIncome)],
        ['Expense - Club Expenses', formatAgmAmount(totalExpensesInRange)],
        ['Expense - Interest Paid to Members', formatAgmAmount(totalInterestPayoutsInRange)],
        ['Total Expenses', formatAgmAmount(totalExpenses)],
        ['Net Income', formatAgmAmount(netIncome)]
      ],
      pdfMeta
    );

    cursorY += SECTION_GAP;
    cursorY = addSectionTitle(doc, cursorY, 'Accruals (Unpaid Earnings)', pdfMeta, 3);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Loan Interest Accrued (Unpaid)', value: formatAgmAmount(getLoanInterestBreakdown(filteredLoans, filteredLoanRepayments).interestAccrued) }
    ], pdfMeta);

    savePdf(doc, `agm-financial-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportCashAtBankPdf = () => {
    const sortedEntries = [...cashEntries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let runningBalance = 0;
    const tableRows = sortedEntries.map(entry => {
      runningBalance += entry.amount || 0;
      return [
        entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '',
        entry.amount >= 0 ? 'Credit' : 'Debit',
        formatCurrency(Math.abs(entry.amount || 0)),
        formatCurrency(runningBalance),
        entry.notes || ''
      ];
    });

    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Cash at Bank Statement',
      subtitle: 'Manual Entries',
      meta: [
        `Generated: ${new Date().toLocaleString()}`,
        `Report Range: ${reportRangeLabel()}`
      ],
      watermark: pdfWatermark
    });

    let cursorY = startY;
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Date', 'Type', 'Amount', 'Running Balance', 'Description'],
      tableRows,
      pdfMeta
    );

    savePdf(doc, `cash-at-bank-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportLoanPortfolioPdf = () => {
    const membersWithLoans = reportData.members
      .map((member) => {
        const overview = getMemberPortfolioOverview(member.$id);
        return { member, overview };
      })
      .filter(({ overview }) => overview.totalDisbursed > 0);

    const totalCashCleared = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.totalCashCleared || 0),
      0
    );
    const totalOutstandingPrincipal = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.totalOutstandingPrincipal || 0),
      0
    );
    const totalPrincipalCleared = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.totalPrincipalCleared || 0),
      0
    );
    const totalNetMemberPosition = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.netMemberPosition || 0),
      0
    );
    const totalNextPayment = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.nextPaymentTotal || 0),
      0
    );
    const totalNext3Months = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.next3MonthsTotal || 0),
      0
    );
    const totalOverdueAmount = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.totalOverdueAmount || 0),
      0
    );
    const totalGuarantorSecuredOriginal = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.totalGuarantorSecuredOriginal || 0),
      0
    );
    const totalGuarantorRecovered = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.totalGuarantorRecovered || 0),
      0
    );
    const totalGuarantorOutstanding = membersWithLoans.reduce(
      (sum, item) => sum + (item.overview.totalGuarantorOutstanding || 0),
      0
    );

    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Loan Portfolio Summary',
      subtitle: 'Grouped by Member',
      meta: [`Generated: ${new Date().toLocaleString()}`],
      watermark: pdfWatermark
    });

    let cursorY = startY;
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Disbursed', value: formatCurrency(financialSummary.totalLoansDisbursed) },
      { label: 'Outstanding Principal', value: formatCurrency(totalOutstandingPrincipal) },
      { label: 'Principal Cleared', value: formatCurrency(totalPrincipalCleared) },
      { label: 'Cash Cleared (Incl. Interest/Charges)', value: formatCurrency(totalCashCleared) },
      { label: 'Total Next Payment', value: formatCurrency(totalNextPayment) },
      { label: 'Next 3 Months Forecast', value: formatCurrency(totalNext3Months) },
      { label: 'Overdue Amount', value: formatCurrency(totalOverdueAmount) },
      { label: 'Guarantor Secured Total', value: formatCurrency(totalGuarantorSecuredOriginal) },
      { label: 'Guarantor Recovered', value: formatCurrency(totalGuarantorRecovered) },
      { label: 'Guarantor Outstanding', value: formatCurrency(totalGuarantorOutstanding) },
      { label: 'Net Member Position (Savings - Loans)', value: formatCurrency(totalNetMemberPosition) },
      { label: 'Members With Loans', value: membersWithLoans.length }
    ], pdfMeta);

    membersWithLoans.forEach(({ member, overview }) => {
      const memberRows = getMemberLoanPortfolioRows(member.$id, overview.nextDueMonth)
        .map((row) => {
          const settlement = row.guarantorSettlement || {};
          const settlementLabel = settlement.securedOriginal > 0
            ? `${settlement.settlementStage} (${settlement.settlementPercent}%)`
            : 'N/A';
          return [
            getLoanLabel(row.loan.$id),
            row.loan.status,
            row.interestBasis,
            formatCurrency(row.outstanding),
            formatCurrency(row.paidTotal),
            row.nextDue ? `${row.nextDue.month}` : '-',
            formatCurrency(row.nextDue?.amount || 0),
            settlementLabel,
            formatCurrency(settlement.securedOutstanding || 0),
            formatCurrency(row.overdueAmount || 0),
            row.lastClearedAt ? new Date(row.lastClearedAt).toLocaleDateString() : '-'
          ];
        });
      const memberTotalsRow = [
        'Member Totals',
        '',
        '',
        formatCurrency(overview.totalOutstandingPrincipal || 0),
        formatCurrency(overview.totalCashCleared || 0),
        overview.nextDueMonth || '-',
        formatCurrency(overview.nextPaymentTotal || 0),
        `${overview.guarantorSettlementPercent || 0}%`,
        formatCurrency(overview.totalGuarantorOutstanding || 0),
        formatCurrency(overview.totalOverdueAmount || 0),
        overview.lastClearedAt ? new Date(overview.lastClearedAt).toLocaleDateString() : '-'
      ];

      cursorY += 4;
      cursorY = addSectionTitle(
        doc,
        cursorY,
        `${member.name} (${member.membershipNumber || member.$id})`,
        pdfMeta
      );
      cursorY = addKeyValueRows(doc, cursorY, [
        { label: 'Outstanding Principal', value: formatCurrency(overview.totalOutstandingPrincipal) },
        { label: 'Member Savings', value: formatCurrency(overview.totalSavings || 0) },
        { label: 'Net Member Position (Savings - Loans)', value: formatCurrency(overview.netMemberPosition || 0) },
        { label: 'Principal Cleared', value: formatCurrency(overview.totalPrincipalCleared) },
        { label: 'Cash Cleared (Incl. Interest/Charges)', value: formatCurrency(overview.totalCashCleared) },
        { label: 'Earliest Next Due Installment', value: overview.nextDueMonth || '-' },
        { label: 'Total Next Payment', value: formatCurrency(overview.nextPaymentTotal || 0) },
        { label: 'Next 3 Months Forecast', value: formatCurrency(overview.next3MonthsTotal || 0) },
        { label: 'Overdue Amount', value: formatCurrency(overview.totalOverdueAmount || 0) },
        { label: 'Guarantor Secured Total', value: formatCurrency(overview.totalGuarantorSecuredOriginal || 0) },
        { label: 'Guarantor Recovered', value: formatCurrency(overview.totalGuarantorRecovered || 0) },
        { label: 'Guarantor Outstanding', value: formatCurrency(overview.totalGuarantorOutstanding || 0) }
      ], pdfMeta);
      cursorY = addSimpleTable(
        doc,
        cursorY,
        ['Loan', 'Status', 'Interest Basis', 'Owed', 'Cash Paid', 'Next Install.', 'Next Payment', 'G-Settle', 'G-Outstanding', 'Overdue', 'Last Cleared'],
        memberRows.length ? [...memberRows, memberTotalsRow] : [['No loans', '', '', '', '', '', '', '', '', '', '']],
        pdfMeta
      );
    });

    savePdf(doc, `loan-portfolio-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportMemberSavingsPdf = () => {
    const rows = memberReport.map(member => ([
      member.name,
      member.membershipNumber,
      formatCurrency(member.totalSavings)
    ]));

    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Member Savings Summary',
      subtitle: 'Totals by Member',
      meta: [
        `Generated: ${new Date().toLocaleString()}`,
        `Report Range: ${reportRangeLabel()}`,
        `Total Savings: ${formatCurrency(financialSummary.totalSavings)}`
      ],
      watermark: pdfWatermark
    });

    let cursorY = startY;
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Member', 'Membership #', 'Total Savings'],
      rows,
      pdfMeta
    );

    savePdf(doc, `member-savings-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportInterestDistributionPdf = () => {
    const interestAccruals = getLedgerRows('LoanInterestAccrual')
      .concat(getLedgerRows('TrustInterestAccrual'));

    const payoutRows = getLedgerRows('InterestPayout').map(entry => ([
      entry.memberId || '',
      formatCurrency(entry.amount || 0),
      entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ''
    ]));

    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Interest Distribution Statement',
      subtitle: 'Loan + Trust Interest',
      meta: [
        `Generated: ${new Date().toLocaleString()}`,
        `Report Range: ${reportRangeLabel()}`,
        `Total Accrual Entries: ${interestAccruals.length}`,
        `Total Payouts: ${formatCurrency(sumLedgerByTypes(['InterestPayout']))}`
      ],
      watermark: pdfWatermark
    });

    let cursorY = startY;
    cursorY = addSectionTitle(doc, cursorY, 'Payout Summary', pdfMeta);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Interest Payouts', value: formatCurrency(sumLedgerByTypes(['InterestPayout'])) }
    ], pdfMeta);

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Payouts by Member', pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Member ID', 'Amount', 'Date'],
      payoutRows,
      pdfMeta
    );

    savePdf(doc, `interest-distribution-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportMemberStatementPdf = () => {
    if (!selectedMemberId) {
      toast.error('Select a member first');
      return;
    }
    const member = reportData.members.find(m => m.$id === selectedMemberId);
    if (!member) {
      toast.error('Member not found');
      return;
    }
    const resolveEntryDate = (entry) => {
      if (entry.createdAt) return new Date(entry.createdAt);
      if (entry.month) return new Date(`${entry.month}-01T00:00:00`);
      if (entry.year) return new Date(`${entry.year}-01-01T00:00:00`);
      return null;
    };

    const memberLedger = filteredLedger
      .filter(entry => normalizeMemberId(entry.memberId) === selectedMemberId)
      .filter(entry => {
        const entryDate = resolveEntryDate(entry);
        if (!entryDate) return false;
        return isWithinRange(entryDate.toISOString());
      });
    const sortedLedger = memberLedger
      .slice()
      .sort((a, b) => resolveEntryDate(a) - resolveEntryDate(b));

    const savingsEntries = sortedLedger.filter(entry => entry.type === 'Savings');
    const repaymentEntries = sortedLedger.filter(entry => entry.type === 'LoanRepayment');
    const transferChargeEntries = sortedLedger.filter(entry => entry.type === 'TransferCharge');
    const interestPayoutEntries = sortedLedger.filter(entry => entry.type === 'InterestPayout');

    const activeLoans = filteredLoans.filter(loan => loan.status === 'active' && normalizeMemberId(loan.memberId) === selectedMemberId);
    const completedLoans = filteredLoans.filter(loan => loan.status === 'completed' && normalizeMemberId(loan.memberId) === selectedMemberId);

    const savingsRows = savingsEntries.map(entry => ([
      resolveEntryDate(entry) ? resolveEntryDate(entry).toLocaleDateString() : '',
      entry.notes || 'Savings',
      formatCurrency(entry.amount || 0)
    ]));

    const repaymentRows = repaymentEntries.map(entry => ([
      resolveEntryDate(entry) ? resolveEntryDate(entry).toLocaleDateString() : '',
      entry.loanId ? getLoanLabel(entry.loanId) : 'Loan',
      formatCurrency(entry.amount || 0)
    ]));

    const chargeRows = transferChargeEntries.map(entry => ([
      resolveEntryDate(entry) ? resolveEntryDate(entry).toLocaleDateString() : '',
      entry.loanId ? getLoanLabel(entry.loanId) : 'Loan',
      formatCurrency(entry.amount || 0),
      entry.notes || ''
    ]));

    const interestRows = interestPayoutEntries.map(entry => ([
      resolveEntryDate(entry) ? resolveEntryDate(entry).toLocaleDateString() : '',
      formatCurrency(entry.amount || 0),
      entry.notes || ''
    ]));

    const periodLabel = reportRangeLabel();

    const totalAmount = memberLedger.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const memberOverview = getMemberPortfolioOverview(selectedMemberId);

    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Member Statement of Account',
      subtitle: member.name,
      meta: [
        `Generated: ${new Date().toLocaleString()}`,
        `Report Range: ${reportRangeLabel()}`,
        `Membership #: ${member.membershipNumber}`,
        `Period: ${periodLabel}`
      ],
      watermark: pdfWatermark
    });

    let cursorY = startY;
    cursorY = addSectionTitle(doc, cursorY, 'Totals', pdfMeta, 4);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Entries', value: memberLedger.length },
      { label: 'Net Amount', value: formatCurrency(totalAmount) },
      { label: 'Member Savings', value: formatCurrency(memberOverview.totalSavings || 0) },
      { label: 'Outstanding Principal', value: formatCurrency(memberOverview.totalOutstandingPrincipal || 0) },
      { label: 'Net Member Position (Savings - Loans)', value: formatCurrency(memberOverview.netMemberPosition || 0) },
      { label: 'Total Next Payment', value: formatCurrency(memberOverview.nextPaymentTotal || 0) },
      { label: 'Next 3 Months Forecast', value: formatCurrency(memberOverview.next3MonthsTotal || 0) },
      { label: 'Overdue Amount', value: formatCurrency(memberOverview.totalOverdueAmount || 0) },
      { label: 'Guarantor Secured Total', value: formatCurrency(memberOverview.totalGuarantorSecuredOriginal || 0) },
      { label: 'Guarantor Recovered', value: formatCurrency(memberOverview.totalGuarantorRecovered || 0) },
      { label: 'Guarantor Outstanding', value: formatCurrency(memberOverview.totalGuarantorOutstanding || 0) }
    ], pdfMeta);
    cursorY += 4;

    cursorY = addSectionTitle(doc, cursorY, 'Savings', pdfMeta, 5);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Savings', value: formatCurrency(savingsEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0)) }
    ], pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Date', 'Description', 'Amount'],
      savingsRows.length ? savingsRows : [['No savings entries', '', '']],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Loans - Active', pdfMeta, 5);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Active Loans', value: activeLoans.length },
      { label: 'Active Balance', value: formatCurrency(activeLoans.reduce((sum, loan) => sum + (loan.balance || loan.amount || 0), 0)) }
    ], pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Loan', 'Amount', 'Balance', 'G-Settle', 'G-Outstanding', 'Applied'],
      activeLoans.length
        ? activeLoans.map((loan) => {
            const settlement = getLoanGuarantorSettlement(loan);
            return [
              getLoanLabel(loan.$id),
              formatCurrency(loan.amount || 0),
              formatCurrency(loan.balance || loan.amount || 0),
              settlement.securedOriginal > 0 ? `${settlement.settlementStage} (${settlement.settlementPercent}%)` : 'N/A',
              formatCurrency(settlement.securedOutstanding || 0),
              loan.createdAt ? new Date(loan.createdAt).toLocaleDateString() : ''
            ];
          })
        : [['No active loans', '', '', '', '', '']],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Loans - Completed', pdfMeta, 5);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Completed Loans', value: completedLoans.length },
      { label: 'Total Completed Amount', value: formatCurrency(completedLoans.reduce((sum, loan) => sum + (loan.amount || 0), 0)) }
    ], pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Loan', 'Amount', 'Completed'],
      completedLoans.length
        ? completedLoans.map(loan => ([
            getLoanLabel(loan.$id),
            formatCurrency(loan.amount || 0),
            loan.updatedAt ? new Date(loan.updatedAt).toLocaleDateString() : ''
          ]))
        : [['No completed loans', '', '']],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Loan Repayments', pdfMeta, 4);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Repayments', value: formatCurrency(repaymentEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0)) }
    ], pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Date', 'Loan', 'Amount'],
      repaymentRows.length ? repaymentRows : [['No repayments', '', '']],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Transfer Charges', pdfMeta, 4);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Charges', value: formatCurrency(transferChargeEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0)) }
    ], pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Date', 'Loan', 'Amount', 'Description'],
      chargeRows.length ? chargeRows : [['No transfer charges', '', '', '']],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Interest Payouts', pdfMeta, 4);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Interest Paid', value: formatCurrency(interestPayoutEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0)) }
    ], pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Date', 'Amount', 'Notes'],
      interestRows.length ? interestRows : [['No interest payouts', '', '']],
      pdfMeta
    );

    savePdf(doc, `member-statement-${member.membershipNumber || member.$id}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const saveCashAtBankEntry = async (event) => {
    event.preventDefault();
    if (!COLLECTIONS.LEDGER_ENTRIES) {
      toast.error('Ledger collection is not configured.');
      return;
    }
    try {
      setCashEntryLoading(true);
      const amountValue = parseInt(cashEntryForm.amount || 0, 10);
      const signedAmount = cashEntryForm.direction === 'credit' ? amountValue : -amountValue;
      const entryDate = cashEntryForm.date
        ? new Date(cashEntryForm.date).toISOString()
        : new Date().toISOString();

      await createLedgerEntry({
        databases,
        DATABASE_ID,
        COLLECTIONS,
        entry: {
          type: 'CashAtBank',
          amount: signedAmount,
          month: entryDate.slice(0, 7),
          year: parseInt(entryDate.slice(0, 4), 10),
          createdAt: entryDate,
          notes: cashEntryForm.description
            ? `${cashEntryForm.direction}: ${cashEntryForm.description}`
            : `${cashEntryForm.direction}`
        }
      });
      toast.success('Cash at Bank entry recorded');
      setCashEntryForm({
        amount: '',
        description: '',
        direction: 'credit',
        date: new Date().toISOString().split('T')[0]
      });
      fetchReportData();
    } catch (error) {
      toast.error('Failed to record Cash at Bank entry');
    } finally {
      setCashEntryLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Loading reports data...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Reports Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Generate AGM-ready reports from ledger entries
        </p>
        {!ledgerReady && (
          <p className="mt-3 text-sm text-red-600">
            Ledger collection is not configured. Set `VITE_APPWRITE_LEDGER_COLLECTION_ID` to enable AGM reports.
          </p>
        )}
        {ledgerReady && filteredLoans.length > 0 && disbursementLedgerCount === 0 && (
          <p className="mt-3 text-sm text-amber-700">
            No LoanDisbursement ledger entries found. Check that `LEDGER_ENTRIES_COLLECTION_ID` is set in the loan-management
            function environment or backfill existing loans.
          </p>
        )}
      </div>

      <section className="card">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Report Date Range</h2>
            <p className="text-xs text-slate-500 max-w-md">
              Applies to summaries and exports. Due/overdue uses the end date when set.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Start date</label>
              <input
                type="date"
                className="form-input"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">End date</label>
              <input
                type="date"
                className="form-input"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-secondary h-11 md:mt-0"
              onClick={() => {
                setReportStartDate('');
                setReportEndDate('');
              }}
            >
              Clear Range
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Snapshot</h2>
          <p className="text-sm text-slate-500">High-level position from the ledger.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Total Members</div>
            <div className="text-xl font-bold text-blue-600 break-words leading-tight">{financialSummary.totalMembers}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Total Savings (Ledger)</div>
            <div className="text-xl font-bold text-green-600 break-words leading-tight">{formatCurrency(financialSummary.totalSavings)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Active Loans (Balance)</div>
            <div className="text-xl font-bold text-yellow-600 break-words leading-tight">{formatCurrency(financialSummary.portfolioValue)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Cash at Bank (Net)</div>
            <div className="text-xl font-bold text-purple-600 break-words leading-tight">{formatCurrency(financialSummary.cashAtBank)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Guarantor Secured Outstanding</div>
            <div className="text-xl font-bold text-blue-600 break-words leading-tight">{formatCurrency(guarantorSettlementTotals.totalOutstanding || 0)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Guarantor Settlement Progress</div>
            <div className="text-xl font-bold text-blue-600 break-words leading-tight">{guarantorSettlementTotals.settlementPercent || 0}%</div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Income, Charges & Activity</h2>
          <p className="text-sm text-slate-500">Core inflows and expenses tracked through the ledger.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Loan Disbursements</div>
            <div className="text-xl font-bold text-gray-900 break-words leading-tight">{formatCurrency(financialSummary.totalLoansDisbursed)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Loan Repayments</div>
            <div className="text-xl font-bold text-gray-900 break-words leading-tight">{formatCurrency(financialSummary.totalLoanRepayments)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Subscriptions</div>
            <div className="text-xl font-bold text-gray-900 break-words leading-tight">{formatCurrency(financialSummary.totalSubscriptions)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Unit Trust</div>
            <div className="text-xl font-bold text-gray-900 break-words leading-tight">{formatCurrency(financialSummary.totalUnitTrust)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Expenses</div>
            <div className="text-xl font-bold text-gray-900 break-words leading-tight">{formatCurrency(financialSummary.totalExpenses)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Transfer Charges</div>
            <div className="text-xl font-bold text-gray-900 break-words leading-tight">{formatCurrency(financialSummary.totalTransferCharges)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Interest Paid (Loans)</div>
            <div className="text-xl font-bold text-gray-900 break-words leading-tight">{formatCurrency(financialSummary.loanInterestPaid)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Accrued Interest (Loans)</div>
            <div className="text-xl font-bold text-gray-900 break-words leading-tight">{formatCurrency(financialSummary.loanInterestAccrued)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Trust Interest Earned</div>
            <div className="text-xl font-bold text-gray-900 break-words leading-tight">{formatCurrency(financialSummary.trustInterestEarned)}</div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Exports</h2>
          <p className="text-sm text-slate-500">Generate PDFs and CSVs for AGM reporting and auditing.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">AGM Exports (Ledger)</h3>
          <div className="space-y-4">
            <button
              onClick={exportAgmSummaryPdf}
              className="w-full flex items-center justify-center h-11 px-4 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export AGM Summary (PDF)
            </button>
            <button
              onClick={exportCashAtBankPdf}
              className="w-full flex items-center justify-center h-11 px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Cash at Bank (PDF)
            </button>
            <button
              onClick={exportLoanPortfolioPdf}
              className="w-full flex items-center justify-center h-11 px-4 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Loan Portfolio (PDF)
            </button>
            <button
              onClick={exportMemberSavingsPdf}
              className="w-full flex items-center justify-center h-11 px-4 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Member Savings (PDF)
            </button>
            <button
              onClick={exportInterestDistributionPdf}
              className="w-full flex items-center justify-center h-11 px-4 bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Interest Distribution (PDF)
            </button>
            <button
              onClick={() => exportToCSV(memberReport, 'member-report')}
              className="w-full flex items-center justify-center h-11 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Member Report (CSV)
            </button>
            <button
              onClick={() => exportToCSV(filteredLedger, 'ledger-entries')}
              className="w-full flex items-center justify-center h-11 px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Ledger Entries (CSV)
            </button>
          </div>
        </div>

          <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Ledger Type Exports</h3>
          <div className="space-y-4">
            <button
              onClick={() => exportToCSV(getLedgerRows('Savings'), 'savings-ledger')}
              className="w-full flex items-center justify-center h-11 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Savings (CSV)
            </button>
            <button
              onClick={() => exportToCSV(
                (hasLedgerData
                  ? getLedgerRows('LoanDisbursement')
                  : filteredLoans
                      .filter(loan => ['active', 'approved', 'completed'].includes(loan.status))
                      .map(loan => ({
                        loan: loan.$id,
                        memberId: normalizeMemberId(loan.memberId),
                        amount: loan.amount,
                        createdAt: loan.createdAt
                      }))
                ),
                'loans-disbursed'
              )}
              className="w-full flex items-center justify-center h-11 px-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Loan Disbursements (CSV)
            </button>
            <button
              onClick={exportGuarantorSettlementCsv}
              className="w-full flex items-center justify-center h-11 px-4 bg-sky-700 text-white rounded-lg hover:bg-sky-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Guarantor Settlement (CSV)
            </button>
            <button
              onClick={() => exportToCSV(
                getLedgerRows('TransferCharge').map(entry => ({
                  date: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '',
                  loan: getLoanLabel(entry.loanId),
                  member: memberNameById[normalizeMemberId(entry.memberId)] || '',
                  amount: entry.amount || 0,
                  description: entry.notes || ''
                })),
                'transfer-charges'
              )}
              className="w-full flex items-center justify-center h-11 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Transfer Charges (CSV)
            </button>
            <button
              onClick={() => exportToCSV(
                getLedgerRows('CashAtBank').map(entry => ({
                  date: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '',
                  direction: entry.amount >= 0 ? 'credit' : 'debit',
                  amount: Math.abs(entry.amount || 0),
                  description: entry.notes || ''
                })),
                'cash-at-bank'
              )}
              className="w-full flex items-center justify-center h-11 px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Cash at Bank (CSV)
            </button>
            <button
              onClick={() => exportToCSV(getLedgerRows('Expense'), 'expenses-ledger')}
              className="w-full flex items-center justify-center h-11 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Expenses (CSV)
            </button>
          </div>
          </div>
        </div>
      </section>

      <div className="card mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Member Statement of Account</h3>
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="form-input"
            >
              <option value="">Select member</option>
              {reportData.members.map(member => (
                <option key={member.$id} value={member.$id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
            <input
              type="date"
              className="form-input"
              value={reportStartDate}
              onChange={(e) => setReportStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
            <input
              type="date"
              className="form-input"
              value={reportEndDate}
              onChange={(e) => setReportEndDate(e.target.value)}
            />
          </div>
          <button
            onClick={exportMemberStatementPdf}
            className="btn-primary"
          >
            Export Member Statement (PDF)
          </button>
        </div>
      </div>

      <div className="card mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h3 className="text-lg font-medium text-gray-900">All Members Next Payment Summary</h3>
          <button
            type="button"
            onClick={exportNextRepaymentTotalsPdf}
            className="btn-secondary"
            disabled={allMembersPortfolioOverview.length === 0}
          >
            Export Next Repayment Totals (PDF)
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-5">
          <div className="card">
            <div className="text-xs font-medium text-gray-500">Members With Overdue Loans</div>
            <div className="text-xl font-bold text-red-700">{portfolioHealthSummary.membersWithOverdue}</div>
          </div>
          <div className="card">
            <div className="text-xs font-medium text-gray-500">Total Overdue Amount</div>
            <div className="text-xl font-bold text-red-700">{formatCurrency(portfolioHealthSummary.totalOverdueAmount)}</div>
          </div>
          <div className="card">
            <div className="text-xs font-medium text-gray-500">Oldest Overdue Date</div>
            <div className="text-xl font-bold text-gray-900">
              {portfolioHealthSummary.oldestOverdueDate
                ? new Date(portfolioHealthSummary.oldestOverdueDate).toLocaleDateString()
                : 'N/A'}
            </div>
          </div>
          <div className="card">
            <div className="text-xs font-medium text-gray-500">Next 3 Months Forecast</div>
            <div className="text-xl font-bold text-violet-700">{formatCurrency(portfolioHealthSummary.next3MonthsForecast)}</div>
          </div>
          <div className="card">
            <div className="text-xs font-medium text-gray-500">Members with Active Guarantor Exposure</div>
            <div className="text-xl font-bold text-blue-700">{portfolioHealthSummary.membersWithActiveGuarantorExposure}</div>
          </div>
          <div className="card">
            <div className="text-xs font-medium text-gray-500">Total Guarantor Outstanding</div>
            <div className="text-xl font-bold text-blue-700">{formatCurrency(portfolioHealthSummary.totalGuarantorOutstanding || 0)}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding Principal</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Guarantor Outstanding</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Next Due Installment</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Next Payment Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Overdue Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Cleared</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allMembersPortfolioOverview.map(({ member, overview }) => (
                <tr key={member.$id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="font-medium">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.membershipNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDueStateBadgeClass(getPortfolioMemberHealth(overview))}`}>
                      {getPortfolioMemberHealth(overview)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-amber-700">
                    {formatCurrency(overview.totalOutstandingPrincipal)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-blue-700">
                    {formatCurrency(overview.totalGuarantorOutstanding || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    {overview.nextDueMonth || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-700">
                    {formatCurrency(overview.nextPaymentTotal)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700">
                    {formatCurrency(overview.totalOverdueAmount || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {overview.lastClearedAt ? new Date(overview.lastClearedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <button
                      type="button"
                      onClick={() => setPortfolioMemberId(member.$id)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allMembersPortfolioOverview.length === 0 && (
            <div className="text-sm text-gray-500 py-4">No member loan portfolio records available for this range.</div>
          )}
        </div>
      </div>

      <div className="card mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Member Loan Portfolio Detail</h3>
        <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
            <select
              value={portfolioMemberId}
              onChange={(e) => {
                const memberId = e.target.value;
                setPortfolioMemberId(memberId);
              }}
              className="form-input"
            >
              <option value="">Select member</option>
              {reportData.members.map(member => (
                <option key={member.$id} value={member.$id}>
                  {member.name} ({member.membershipNumber})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Installment (Auto)</label>
            <div className="form-input w-48 bg-gray-50">
              {portfolioMemberId ? `Month ${portfolioMonthNumber}` : 'Select member'}
            </div>
          </div>
          <button
            type="button"
            onClick={exportMemberLoanPortfolioCsv}
            className="btn-secondary"
            disabled={!portfolioMemberId}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={printMemberLoanPortfolio}
            className="btn-primary"
            disabled={!portfolioMemberId}
          >
            Print Portfolio
          </button>
        </div>

        {portfolioMemberId ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Total Disbursed</div>
                <div className="text-lg font-bold text-indigo-700">{formatCurrency(selectedPortfolioSummary.totalDisbursed)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Member Savings</div>
                <div className="text-lg font-bold text-green-700">{formatCurrency(selectedPortfolioSummary.memberSavings)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Outstanding Principal</div>
                <div className="text-lg font-bold text-amber-700">{formatCurrency(selectedPortfolioSummary.totalOutstandingPrincipal)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Net Member Position</div>
                <div className={`text-lg font-bold ${selectedPortfolioSummary.netMemberPosition >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatCurrency(selectedPortfolioSummary.netMemberPosition)}
                </div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Principal Cleared</div>
                <div className="text-lg font-bold text-cyan-700">{formatCurrency(selectedPortfolioSummary.totalPrincipalCleared)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Cash Cleared</div>
                <div className="text-lg font-bold text-emerald-700">{formatCurrency(selectedPortfolioSummary.totalCashCleared)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Total Next Payment</div>
                <div className="text-lg font-bold text-violet-700">{formatCurrency(selectedPortfolioSummary.totalNextPayment)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Next 3 Months Forecast</div>
                <div className="text-lg font-bold text-violet-700">{formatCurrency(selectedPortfolioSummary.totalNext3Months || 0)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Earliest Next Due Installment</div>
                <div className="text-lg font-bold text-slate-700">{selectedPortfolioSummary.earliestNextDueMonth || 'N/A'}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Overdue Amount</div>
                <div className="text-lg font-bold text-red-700">{formatCurrency(selectedPortfolioSummary.totalOverdueAmount || 0)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Overdue Loans</div>
                <div className="text-lg font-bold text-red-700">{selectedPortfolioSummary.overdueLoanCount || 0}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Month {portfolioMonthNumber} Due</div>
                <div className="text-lg font-bold text-blue-700">{formatCurrency(selectedPortfolioSummary.monthDueTotal)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Month {portfolioMonthNumber} Cleared</div>
                <div className="text-lg font-bold text-green-700">{formatCurrency(selectedPortfolioSummary.monthClearedTotal)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Last Cleared</div>
                <div className="text-lg font-bold text-gray-900">
                  {selectedPortfolioSummary.latestClearedAt
                    ? new Date(selectedPortfolioSummary.latestClearedAt).toLocaleDateString()
                    : 'N/A'}
                </div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Guarantor Secured Total</div>
                <div className="text-lg font-bold text-blue-700">{formatCurrency(selectedPortfolioSummary.totalGuarantorSecuredOriginal || 0)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Guarantor Recovered</div>
                <div className="text-lg font-bold text-blue-700">{formatCurrency(selectedPortfolioSummary.totalGuarantorRecovered || 0)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Guarantor Outstanding</div>
                <div className="text-lg font-bold text-blue-700">{formatCurrency(selectedPortfolioSummary.totalGuarantorOutstanding || 0)}</div>
              </div>
              <div className="card">
                <div className="text-xs font-medium text-gray-500">Guarantor Settlement Progress</div>
                <div className="text-lg font-bold text-blue-700">{selectedPortfolioSummary.guarantorSettlementPercent || 0}%</div>
              </div>
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-normal break-words leading-tight min-w-[140px]">Interest Basis</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding Principal</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cash Paid</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-normal break-words leading-tight min-w-[110px]">Cleared Progress</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-normal break-words leading-tight min-w-[110px]">Next Due Installment</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-normal break-words leading-tight min-w-[95px]">Next Payment</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-normal break-words leading-tight min-w-[90px]">Overdue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-normal break-words leading-tight min-w-[105px]">Last Cleared</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedPortfolioRows.map((row) => (
                    <tr key={row.loan.$id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{getLoanLabel(row.loan.$id)}</div>
                        {(row.guarantorSettlement?.securedOriginal || 0) > 0 ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {row.guarantorSettlement.settlementStage} | {row.guarantorSettlement.settlementPercent}% | {formatCurrency(row.guarantorSettlement.guarantorRecovered || 0)} / {formatCurrency(row.guarantorSettlement.securedOriginal || 0)}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-slate-400">No guarantor coverage</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.loan.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.interestBasis}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDueStateBadgeClass(row.dueState)}`}>
                          {row.dueState}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-amber-700">{formatCurrency(row.outstanding)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-emerald-700">{formatCurrency(row.paidTotal)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {row.installmentsCleared}/{row.installmentCount || 0} ({row.clearancePercent}%)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                        {row.nextDue ? row.nextDue.month : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-700">
                        {formatCurrency(row.nextDue?.amount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700">
                        {formatCurrency(row.overdueAmount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.lastClearedAt ? new Date(row.lastClearedAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                  {selectedPortfolioRows.length > 0 && (
                    <tr className="bg-gray-50">
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900">Member Totals</td>
                      <td className="px-6 py-3" />
                      <td className="px-6 py-3" />
                      <td className="px-6 py-3" />
                      <td className="px-6 py-3 text-sm text-right font-semibold text-amber-700">
                        {formatCurrency(selectedPortfolioSummary.totalOutstandingPrincipal)}
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-emerald-700">
                        {formatCurrency(selectedPortfolioSummary.totalCashCleared)}
                      </td>
                      <td className="px-6 py-3" />
                      <td className="px-6 py-3 text-sm text-center font-semibold text-gray-900">
                        {selectedPortfolioSummary.earliestNextDueMonth || '-'}
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-blue-700">
                        {formatCurrency(selectedPortfolioSummary.totalNextPayment)}
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-red-700">
                        {formatCurrency(selectedPortfolioSummary.totalOverdueAmount || 0)}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-900">
                        {selectedPortfolioSummary.latestClearedAt
                          ? new Date(selectedPortfolioSummary.latestClearedAt).toLocaleDateString()
                          : '-'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {selectedPortfolioRows.length === 0 && (
                <div className="text-sm text-gray-500 py-4">No disbursed loans for this member in selected range.</div>
              )}
            </div>

            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-2">Cleared Payments Timeline</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule Month</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Cleared</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Early Payment</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedPortfolioTimeline.slice(0, 25).map((entry, index) => (
                      <tr key={`${entry.loanId}-${entry.month}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {entry.paidAt ? new Date(entry.paidAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getLoanLabel(entry.loanId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                          {entry.month || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-emerald-700">
                          {formatCurrency(entry.amount || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                          {entry.isEarlyPayment ? 'Yes' : 'No'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedPortfolioTimeline.length === 0 && (
                  <div className="text-sm text-gray-500 py-4">No repayment entries found for this member in selected range.</div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-md font-semibold text-gray-900 mb-2">Guarantor Settlement Progress (Derived)</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocation Mode</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Settlement Stage</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Secured Total</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Recovered</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Settlement Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedPortfolioRows
                      .filter((row) => (row.guarantorSettlement?.securedOriginal || 0) > 0)
                      .map((row) => (
                        <tr key={`guarantor-${row.loan.$id}`}>
                          <td className="px-6 py-4 text-sm text-gray-900">{getLoanLabel(row.loan.$id)}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{formatAllocationStatus(row.guarantorSettlement?.allocationStatus)}</td>
                          <td className="px-6 py-4 text-sm text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getGuarantorSettlementBadgeClass(row.guarantorSettlement?.settlementStage)}`}>
                              {row.guarantorSettlement?.settlementStage || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900">{formatCurrency(row.guarantorSettlement?.securedOriginal || 0)}</td>
                          <td className="px-6 py-4 text-sm text-right text-blue-700">
                            {formatCurrency(row.guarantorSettlement?.guarantorRecovered || 0)} ({row.guarantorSettlement?.settlementPercent || 0}%)
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-red-700">{formatCurrency(row.guarantorSettlement?.securedOutstanding || 0)}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {row.guarantorSettlement?.settlementCompletedAt
                              ? new Date(row.guarantorSettlement.settlementCompletedAt).toLocaleDateString()
                              : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {selectedPortfolioRows.filter((row) => (row.guarantorSettlement?.securedOriginal || 0) > 0).length === 0 && (
                  <div className="text-sm text-gray-500 py-4">No guarantor-backed loans for this member in selected range.</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Select a member to view owed totals, monthly dues, and cleared payments with dates.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Cash at Bank (Manual)</h3>
          <form onSubmit={saveCashAtBankEntry} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
              <input
                type="number"
                value={cashEntryForm.amount}
                onChange={(e) => setCashEntryForm(prev => ({ ...prev, amount: e.target.value }))}
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
              <select
                value={cashEntryForm.direction}
                onChange={(e) => setCashEntryForm(prev => ({ ...prev, direction: e.target.value }))}
                className="form-input"
                required
              >
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={cashEntryForm.date}
                onChange={(e) => setCashEntryForm(prev => ({ ...prev, date: e.target.value }))}
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={cashEntryForm.description}
                onChange={(e) => setCashEntryForm(prev => ({ ...prev, description: e.target.value }))}
                className="form-input"
                placeholder="Optional description"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={cashEntryLoading}
            >
              {cashEntryLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Record Cash Entry'
              )}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Cash at Bank Entries</h3>
          {cashEntries.length === 0 ? (
            <div className="text-sm text-gray-500">No cash at bank entries recorded.</div>
          ) : (
            <div className="space-y-3">
              {cashEntries.slice(0, 6).map(entry => (
                <div key={entry.$id} className="border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900">
                      {entry.notes || 'Cash entry'}
                    </span>
                    <span className={entry.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                      {formatCurrency(Math.abs(entry.amount || 0))}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Member Summary</h3>
          <ChartBarIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Savings
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loan Eligibility
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active Loans
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Available Credit
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {memberReport.map((member, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-500">{member.membershipNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                    {formatCurrency(member.totalSavings)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-600">
                    {formatCurrency(member.loanEligibility)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {member.activeLoans}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-purple-600">
                    {formatCurrency(member.availableCredit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsManagement;
