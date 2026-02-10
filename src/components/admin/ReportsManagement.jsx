import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { formatCurrency } from '../../utils/financial';
import { DocumentArrowDownIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { listAllDocuments } from '../../lib/pagination';
import { createPdfDoc, addSectionTitle, addKeyValueRows, addSimpleTable, savePdf } from '../../lib/pdf';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';
import { createLedgerEntry } from '../../lib/ledger';

const ReportsManagement = () => {
  const [reportData, setReportData] = useState({
    members: [],
    loans: [],
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

  const fetchReportData = async () => {
    try {
      const requests = [
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.MEMBERS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS),
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
    if (Array.isArray(value) && value[0]?.$id) return value[0].$id;
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
  const filteredLoanRepayments = filterByDate(reportData.loanRepayments, 'createdAt');
  const filteredSubscriptions = filterByDate(reportData.subscriptions, 'createdAt');
  const filteredUnitTrust = filterByDate(reportData.unitTrust, 'createdAt');
  const filteredExpenses = filterByDate(reportData.expenses, 'createdAt');
  const filteredLoanCharges = filterByDate(reportData.loanCharges, 'createdAt');
  const filteredInterestMonthly = filterByDate(reportData.interestMonthly, 'createdAt');

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

  const getLoanInterestBreakdown = () => {
    const repaymentsByLoan = filteredLoanRepayments.reduce((acc, repayment) => {
      const loanId = repayment.loanId?.$id || repayment.loanId;
      if (!loanId) return acc;
      acc[loanId] = acc[loanId] || [];
      acc[loanId].push(repayment);
      return acc;
    }, {});

    let interestPaid = 0;
    let interestAccrued = 0;

    filteredLoans.forEach((loan) => {
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
        loanEligibility: memberSavings * 0.8,
        activeLoans: activeLoans.length,
        totalLoanAmount: activeBalance,
        availableCredit: Math.max(0, (memberSavings * 0.8) - activeBalance)
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
    const { interestPaid, interestAccrued } = getLoanInterestBreakdown();

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
  const disbursementLedgerCount = getLedgerRows('LoanDisbursement').length;
  const repaymentLedgerCount = getLedgerRows('LoanRepayment').length;
  const chargeLedgerCount = getLedgerRows('TransferCharge').length;

  const exportAgmSummaryPdf = () => {
    const meta = [
      `Generated: ${new Date().toLocaleString()}`,
      `Total Members: ${financialSummary.totalMembers}`,
      `Report Range: ${reportRangeLabel()}`
    ];
    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'AGM Financial Summary',
      subtitle: 'Crownzcom Investment Club',
      meta
    });

    let cursorY = startY;
    const totalAssets =
      financialSummary.cashAtBank +
      financialSummary.portfolioValue +
      financialSummary.loanInterestAccrued;
    const totalLiabilities = financialSummary.totalSavings;
    const totalEquity = totalAssets - totalLiabilities;

    cursorY = addSectionTitle(doc, cursorY, 'Balance Sheet (Statement of Financial Position)', pdfMeta);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Assets - Cash at Bank (Manual)', value: formatCurrency(financialSummary.cashAtBank) },
      { label: 'Assets - Loans Receivable', value: formatCurrency(financialSummary.portfolioValue) },
      { label: 'Assets - Accrued Interest (Loans)', value: formatCurrency(financialSummary.loanInterestAccrued) },
      { label: 'Total Assets', value: formatCurrency(totalAssets) },
      { label: 'Liabilities - Member Savings/Deposits', value: formatCurrency(totalLiabilities) },
      { label: 'Total Liabilities', value: formatCurrency(totalLiabilities) },
      { label: 'Equity - Retained Earnings / Unreconciled Difference', value: formatCurrency(totalEquity) },
      { label: 'Total Equity', value: formatCurrency(totalEquity) }
    ], pdfMeta);

    const totalIncome =
      financialSummary.totalSubscriptions +
      financialSummary.loanInterestPaid +
      financialSummary.trustInterestEarned +
      financialSummary.totalTransferCharges;
    const totalExpenses =
      financialSummary.totalUnitTrust +
      financialSummary.totalExpenses +
      financialSummary.totalInterestPayouts;
    const netIncome = totalIncome - totalExpenses;

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Income Statement (Statement of Income & Expenditure)', pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Category', 'Amount'],
      [
        ['Income - Subscriptions', formatCurrency(financialSummary.totalSubscriptions)],
        ['Income - Loan Interest Paid', formatCurrency(financialSummary.loanInterestPaid)],
        ['Income - Trust Interest Earned', formatCurrency(financialSummary.trustInterestEarned)],
        ['Income - Transfer Charges', formatCurrency(financialSummary.totalTransferCharges)],
        ['Total Income', formatCurrency(totalIncome)],
        ['Expense - Unit Trust', formatCurrency(financialSummary.totalUnitTrust)],
        ['Expense - Other Expenses', formatCurrency(financialSummary.totalExpenses)],
        ['Expense - Interest Payouts', formatCurrency(financialSummary.totalInterestPayouts)],
        ['Total Expenses', formatCurrency(totalExpenses)],
        ['Net Income', formatCurrency(netIncome)]
      ],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Notes & Schedules - Loan Portfolio Summary', pdfMeta);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Disbursed', value: formatCurrency(financialSummary.totalLoansDisbursed) },
      { label: 'Total Repaid', value: formatCurrency(financialSummary.totalLoanRepayments) },
      { label: 'Outstanding Balance', value: formatCurrency(financialSummary.portfolioValue) },
      { label: 'Accrued Interest (Loans)', value: formatCurrency(financialSummary.loanInterestAccrued) }
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
      ]
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
    const activeLoans = filteredLoans.filter(loan => loan.status === 'active');
    const tableRows = activeLoans.map(loan => ([
      loanLabelMap[loan.$id] || loan.$id,
      memberNameById[normalizeMemberId(loan.memberId)] || 'Unknown',
      formatCurrency(loan.amount),
      formatCurrency(loan.balance || loan.amount),
      loan.status
    ]));

    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Loan Portfolio Summary',
      subtitle: 'Active Loans',
      meta: [`Generated: ${new Date().toLocaleString()}`]
    });

    let cursorY = startY;
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Disbursed', value: formatCurrency(financialSummary.totalLoansDisbursed) },
      { label: 'Outstanding Balance', value: formatCurrency(financialSummary.portfolioValue) },
      { label: 'Active Loans', value: activeLoans.length }
    ], pdfMeta);
    cursorY += 4;
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Loan', 'Member', 'Amount', 'Balance', 'Status'],
      tableRows,
      pdfMeta
    );

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
      ]
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
      ]
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

    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Member Statement of Account',
      subtitle: member.name,
      meta: [
        `Generated: ${new Date().toLocaleString()}`,
        `Report Range: ${reportRangeLabel()}`,
        `Membership #: ${member.membershipNumber}`,
        `Period: ${periodLabel}`
      ]
    });

    let cursorY = startY;
    cursorY = addSectionTitle(doc, cursorY, 'Totals', pdfMeta, 4);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Entries', value: memberLedger.length },
      { label: 'Net Amount', value: formatCurrency(totalAmount) }
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
      ['Loan', 'Amount', 'Balance', 'Applied'],
      activeLoans.length
        ? activeLoans.map(loan => ([
            getLoanLabel(loan.$id),
            formatCurrency(loan.amount || 0),
            formatCurrency(loan.balance || loan.amount || 0),
            loan.createdAt ? new Date(loan.createdAt).toLocaleDateString() : ''
          ]))
        : [['No active loans', '', '', '']],
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
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Report Date Range</h2>
            <p className="text-sm text-slate-500">Applies to summaries and all exports.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
              className="btn-secondary h-11 mt-6"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Total Members</div>
            <div className="text-2xl font-bold text-blue-600">{financialSummary.totalMembers}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Total Savings (Ledger)</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(financialSummary.totalSavings)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Active Loans (Balance)</div>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(financialSummary.portfolioValue)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Cash at Bank (Net)</div>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(financialSummary.cashAtBank)}</div>
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
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.totalLoansDisbursed)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Loan Repayments</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.totalLoanRepayments)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Subscriptions</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.totalSubscriptions)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Unit Trust</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.totalUnitTrust)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Expenses</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.totalExpenses)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Transfer Charges</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.totalTransferCharges)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Interest Paid (Loans)</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.loanInterestPaid)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Accrued Interest (Loans)</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.loanInterestAccrued)}</div>
          </div>
          <div className="card">
            <div className="text-sm font-medium text-gray-500">Trust Interest Earned</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.trustInterestEarned)}</div>
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
              className="w-full flex items-center justify-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export AGM Summary (PDF)
            </button>
            <button
              onClick={exportCashAtBankPdf}
              className="w-full flex items-center justify-center px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Cash at Bank (PDF)
            </button>
            <button
              onClick={exportLoanPortfolioPdf}
              className="w-full flex items-center justify-center px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Loan Portfolio (PDF)
            </button>
            <button
              onClick={exportMemberSavingsPdf}
              className="w-full flex items-center justify-center px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Member Savings (PDF)
            </button>
            <button
              onClick={exportInterestDistributionPdf}
              className="w-full flex items-center justify-center px-4 py-2 bg-indigo-700 text-white rounded-lg hover:bg-indigo-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Interest Distribution (PDF)
            </button>
            <button
              onClick={() => exportToCSV(memberReport, 'member-report')}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Member Report (CSV)
            </button>
            <button
              onClick={() => exportToCSV(filteredLedger, 'ledger-entries')}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
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
              className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
              className="w-full flex items-center justify-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Loan Disbursements (CSV)
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
              className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
              className="w-full flex items-center justify-center px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Export Cash at Bank (CSV)
            </button>
            <button
              onClick={() => exportToCSV(getLedgerRows('Expense'), 'expenses-ledger')}
              className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
