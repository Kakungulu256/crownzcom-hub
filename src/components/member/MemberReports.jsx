import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { useAuth } from '../../lib/auth';
import { formatCurrency } from '../../utils/financial';
import { DocumentArrowDownIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { fetchMemberRecord } from '../../lib/member';
import { listAllDocuments } from '../../lib/pagination';
import { createPdfDoc, addSectionTitle, addKeyValueRows, addSimpleTable, savePdf } from '../../lib/pdf';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';

const MemberReports = () => {
  const { user } = useAuth();
  const [memberData, setMemberData] = useState({
    member: null,
    savings: [],
    loans: [],
    loanCharges: [],
    loanRepayments: [],
    subscriptions: [],
    ledger: []
  });
  const [financialConfig, setFinancialConfig] = useState({ ...DEFAULT_FINANCIAL_CONFIG });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

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
      
      // Fetch member's data
      const requests = [
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS, [
          Query.equal('memberId', memberId)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS, [
          Query.equal('memberId', memberId)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_CHARGES),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SUBSCRIPTIONS, [
          Query.equal('memberId', memberId)
        ]),
        fetchFinancialConfig(databases, DATABASE_ID, COLLECTIONS.FINANCIAL_CONFIG)
      ];

      if (COLLECTIONS.LEDGER_ENTRIES) {
        requests.push(listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LEDGER_ENTRIES, [
          Query.equal('memberId', memberId)
        ]));
      }

      const [savings, loans, repayments, charges, subscriptions, config, ledger = []] = await Promise.all(requests);
      
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

      const loanIdSet = new Set(loans.map((loan) => normalizeLoanId(loan.$id || loan)));
      const memberLoanRepayments = repayments.filter((repayment) =>
        loanIdSet.has(normalizeLoanId(repayment.loanId))
      );

      setMemberData({
        member,
        savings,
        loans,
        loanCharges: charges.filter(charge =>
          loanIdSet.has(normalizeLoanId(charge.loanId))
        ),
        loanRepayments: memberLoanRepayments,
        subscriptions,
        ledger
      });
      setFinancialConfig(config || { ...DEFAULT_FINANCIAL_CONFIG });
    } catch (error) {
      console.error('Error fetching member data:', error);
      toast.error('Failed to fetch member data');
    } finally {
      setLoading(false);
    }
  };

  const generateFinancialStatement = () => {
    const totalSavings = memberData.savings.reduce((total, saving) => total + saving.amount, 0);
    const activeLoans = memberData.loans.filter(loan => loan.status === 'active');
    const totalLoanAmount = activeLoans.reduce((total, loan) => total + loan.amount, 0);
    const totalLoanBalance = activeLoans.reduce((total, loan) => total + (loan.balance || loan.amount), 0);
    const eligibilityPercent = (Number(financialConfig.loanEligibilityPercentage) || 80) / 100;
    const loanEligibility = totalSavings * eligibilityPercent;
    const availableCredit = Math.max(0, loanEligibility - totalLoanBalance);

    return {
      memberInfo: {
        name: memberData.member?.name || '',
        membershipNumber: memberData.member?.membershipNumber || '',
        email: memberData.member?.email || '',
        joinDate: memberData.member?.joinDate || ''
      },
      financialSummary: {
        totalSavings,
        loanEligibility,
        totalLoans: memberData.loans.length,
        activeLoans: activeLoans.length,
        totalLoanAmount,
        totalLoanBalance,
        availableCredit
      },
      yearlyBreakdown: generateYearlyBreakdown()
    };
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

  const filteredSavings = filterByDate(memberData.savings, 'createdAt');
  const filteredLoans = filterByDate(memberData.loans, 'createdAt');
  const filteredLoanRepayments = filterByDate(memberData.loanRepayments, 'paidAt');
  const filteredSubscriptions = filterByDate(memberData.subscriptions, 'createdAt');
  const filteredLedger = filterByDate(memberData.ledger, 'createdAt');

  const reportRangeLabel = () => {
    if (!reportStartDate && !reportEndDate) return 'All dates';
    const start = reportStartDate ? new Date(reportStartDate).toLocaleDateString() : 'Any';
    const end = reportEndDate ? new Date(reportEndDate).toLocaleDateString() : 'Any';
    return `${start} - ${end}`;
  };

  const exportMemberPdf = () => {
    if (!memberData.member) {
      toast.error('Member data not available');
      return;
    }

    const sortedSavings = filteredSavings
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const savingsRows = sortedSavings.map(saving => ([
      saving.createdAt ? new Date(saving.createdAt).toLocaleDateString() : '',
      new Date(saving.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
      formatCurrency(saving.amount)
    ]));

    const totalSavingsInRange = filteredSavings.reduce((sum, saving) => sum + (saving.amount || 0), 0);
    const totalInterestPaid = filteredLedger
      .filter(entry => entry.type === 'InterestPayout')
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);

    const { doc, cursorY: startY, meta: pdfMeta } = createPdfDoc({
      title: 'Member Financial Report',
      subtitle: memberData.member?.name || '',
      meta: [
        `Generated: ${new Date().toLocaleString()}`,
        `Report Range: ${reportRangeLabel()}`,
        `Membership #: ${memberData.member?.membershipNumber || ''}`
      ]
    });

    let cursorY = startY;
    cursorY = addSectionTitle(doc, cursorY, 'Summary', pdfMeta, 4);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Total Savings (Range)', value: formatCurrency(totalSavingsInRange) },
      { label: 'Interest Earned (Savings)', value: formatCurrency(totalInterestPaid) },
      { label: 'Active Loans', value: filteredLoans.filter(loan => loan.status === 'active').length }
    ], pdfMeta);

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Savings', pdfMeta, 5);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Savings Total', value: formatCurrency(totalSavingsInRange) }
    ], pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Date', 'Month', 'Amount'],
      savingsRows.length ? savingsRows : [['No savings in range', '', '']],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Loan Summary', pdfMeta, 5);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Loan', 'Type', 'Amount', 'Date Applied', 'Status', 'Interest Mode', 'Rate (%)', 'Balance'],
      loanSummaryRows.length
        ? loanSummaryRows.map((row) => ([
          row.label,
          row.loanType,
          formatCurrency(row.amount),
          row.appliedDate ? new Date(row.appliedDate).toLocaleDateString() : '',
          row.status,
          row.interestMode,
          `${row.interestRatePercent}%`,
          formatCurrency(row.balance)
        ]))
        : [['No loans', '', '', '', '', '', '', '']],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Loan Repayment History', pdfMeta, 5);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Loan', 'Paid Date', 'Month', 'Amount', 'Interest', 'Early Payment'],
      repaymentHistoryRows.length
        ? repaymentHistoryRows.map((row) => ([
          loanSummaryRows.find((loan) => loan.loanId === row.loanId)?.label || 'Loan',
          row.paidDate ? new Date(row.paidDate).toLocaleDateString() : '',
          row.month,
          formatCurrency(row.amount),
          formatCurrency(row.interest || 0),
          row.isEarlyPayment
        ]))
        : [['No repayments', '', '', '', '', '']],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Subscriptions', pdfMeta, 4);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Year', 'Amount', 'Status'],
      subscriptionRows.length
        ? subscriptionRows.map((row) => ([
          row.year,
          formatCurrency(row.amount),
          row.status
        ]))
        : [['No subscriptions', '', '']],
      pdfMeta
    );

    savePdf(doc, `member-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const generateYearlyBreakdown = () => {
    const years = [...new Set(memberData.savings.map(saving => 
      new Date(saving.month).getFullYear()
    ))].sort((a, b) => b - a);

    return years.map(year => {
      const yearSavings = memberData.savings.filter(saving => 
        new Date(saving.month).getFullYear() === year
      );
      const yearTotal = yearSavings.reduce((total, saving) => total + saving.amount, 0);
      
      return {
        year,
        totalSavings: yearTotal,
        monthlyBreakdown: generateMonthlyBreakdown(year)
      };
    });
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

  const getLoanChargesTotal = (loanId) => {
    const target = normalizeLoanId(loanId);
    return memberData.loanCharges
      .filter((charge) => normalizeLoanId(charge.loanId) === target)
      .reduce((sum, charge) => sum + (parseInt(charge.amount, 10) || 0), 0);
  };

  const getLoanRepaymentsForLoan = (loanId) => {
    const target = normalizeLoanId(loanId);
    return filteredLoanRepayments
      .filter((repayment) => normalizeLoanId(repayment.loanId) === target)
      .sort((a, b) => {
        const aDate = new Date(a.paidAt || a.createdAt || a.$createdAt || 0).getTime();
        const bDate = new Date(b.paidAt || b.createdAt || b.$createdAt || 0).getTime();
        return aDate - bDate;
      });
  };

  const getLoanChargesForLoan = (loanId) => {
    const target = normalizeLoanId(loanId);
    return memberData.loanCharges
      .filter((charge) => normalizeLoanId(charge.loanId) === target)
      .sort((a, b) => {
        const aDate = new Date(a.createdAt || a.$createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || b.$createdAt || 0).getTime();
        return aDate - bDate;
      });
  };

  const getLoanInterestModeLabel = (loan) => {
    const mode = String(
      loan?.interestCalculationModeApplied || financialConfig.interestCalculationMode || 'flat'
    ).trim().toLowerCase();
    return mode === 'reducing_balance' ? 'Reducing Balance' : 'Flat Principal';
  };

  const getLoanMonthlyRatePercent = (loan) => {
    const stored = Number(loan?.monthlyInterestRateApplied);
    if (Number.isFinite(stored) && stored >= 0) return stored;
    return loan?.loanType === 'long_term'
      ? Number(financialConfig.longTermInterestRate || 1.5)
      : Number(financialConfig.loanInterestRate || 2);
  };

  const getLoanInterestBasisLabel = (loan) => (
    `${getLoanInterestModeLabel(loan)} @ ${getLoanMonthlyRatePercent(loan)}%`
  );

  const parseRepaymentPlan = (loan) => {
    if (!loan?.repaymentPlan) return [];
    try {
      const parsed = JSON.parse(loan.repaymentPlan);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getRepaymentInterest = (loan, repayment) => {
    const month = parseInt(repayment?.month, 10);
    if (!Number.isFinite(month)) return 0;
    const schedule = parseRepaymentPlan(loan);
    const match = schedule.find((row) => parseInt(row?.month, 10) === month);
    return match ? (parseInt(match.interest, 10) || 0) : 0;
  };

  const buildLoanSummaryRows = () => (
    filteredLoans.map((loan, index) => ({
      loanId: loan.$id,
      label: `Loan_${index + 1}`,
      loanType: loan.loanType || 'short_term',
      amount: parseInt(loan.amount, 10) || 0,
      appliedDate: loan.createdAt || loan.$createdAt || '',
      status: loan.status || '',
      interestMode: getLoanInterestModeLabel(loan),
      interestRatePercent: getLoanMonthlyRatePercent(loan),
      interestBasis: getLoanInterestBasisLabel(loan),
      balance: loan.status === 'completed'
        ? 0
        : (parseInt(loan.balance, 10) || parseInt(loan.amount, 10) || 0)
    }))
  );

  const buildRepaymentHistoryRows = (loan) => {
    const repaymentRows = getLoanRepaymentsForLoan(loan.$id).map((repayment) => ({
      loanId: loan.$id,
      paidDate: repayment.paidAt || repayment.createdAt || repayment.$createdAt || '',
      month: parseInt(repayment.month, 10) || '',
      amount: parseInt(repayment.amount, 10) || 0,
      interest: getRepaymentInterest(loan, repayment),
      isEarlyPayment: repayment.isEarlyPayment ? 'Yes' : 'No'
    }));

    const chargeRows = getLoanChargesForLoan(loan.$id).map((charge) => ({
      loanId: loan.$id,
      paidDate: charge.createdAt || charge.$createdAt || '',
      month: '-',
      amount: parseInt(charge.amount, 10) || 0,
      interest: 0,
      isEarlyPayment: 'Bank Charge'
    }));

    return [...repaymentRows, ...chargeRows].sort((a, b) => {
      const aDate = new Date(a.paidDate || 0).getTime();
      const bDate = new Date(b.paidDate || 0).getTime();
      return aDate - bDate;
    });
  };

  const normalizeSubscriptionStatus = (value) => {
    const status = String(value || '').trim().toLowerCase();
    if (!status) return 'Paid';
    if (status.includes('pend') || ['unpaid', 'due', 'overdue'].includes(status)) {
      return 'Pending';
    }
    return 'Paid';
  };

  const buildSubscriptionRows = () => (
    filteredSubscriptions.map((subscription) => {
      const rawMonth = String(subscription.month || '').trim();
      const year = rawMonth ? rawMonth.split('-')[0] : '';
      const fallbackDate = new Date(subscription.createdAt || subscription.$createdAt || 0);
      const resolvedYear = year || (Number.isFinite(fallbackDate.getTime()) ? String(fallbackDate.getFullYear()) : '');
      return {
        year: resolvedYear,
        amount: parseInt(subscription.amount, 10) || 0,
        status: normalizeSubscriptionStatus(subscription.status)
      };
    })
  );

  const loanSummaryRows = buildLoanSummaryRows();
  const repaymentHistoryRows = filteredLoans.flatMap((loan) => buildRepaymentHistoryRows(loan));
  const subscriptionRows = buildSubscriptionRows();

  const generateMonthlyBreakdown = (year) => {
    const months = [];
    for (let month = 0; month < 12; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthSaving = memberData.savings.find(saving => saving.month === monthKey);
      
      months.push({
        month: new Date(year, month).toLocaleDateString('en-US', { month: 'long' }),
        amount: monthSaving ? monthSaving.amount : 0,
        date: monthSaving ? monthSaving.createdAt : null
      });
    }
    return months;
  };

  const exportToCSV = (data, filename) => {
    if (filename !== 'financial-statement' && (!data || (Array.isArray(data) && data.length === 0))) {
      toast.error('No data to export');
      return;
    }

    let csvContent = '';
    
    if (filename === 'financial-statement') {
      // Generate comprehensive financial statement
      const totalSavings = filteredSavings.reduce((total, saving) => total + saving.amount, 0);
      const activeLoans = filteredLoans.filter(loan => loan.status === 'active');
      const totalLoanAmount = activeLoans.reduce((total, loan) => total + loan.amount, 0);
      const totalLoanBalance = activeLoans.reduce((total, loan) => total + (loan.balance || loan.amount), 0);
      const eligibilityPercent = (Number(financialConfig.loanEligibilityPercentage) || 80) / 100;
      const loanEligibility = totalSavings * eligibilityPercent;
      const availableCredit = Math.max(0, loanEligibility - totalLoanBalance);
      const statement = {
        memberInfo: {
          name: memberData.member?.name || '',
          membershipNumber: memberData.member?.membershipNumber || '',
          email: memberData.member?.email || '',
          joinDate: memberData.member?.joinDate || ''
        },
        financialSummary: {
          totalSavings,
          loanEligibility,
          totalLoans: filteredLoans.length,
          activeLoans: activeLoans.length,
          totalLoanAmount,
          totalLoanBalance,
          availableCredit
        }
      };
      
      csvContent = [
        'FINANCIAL STATEMENT',
        '',
        `Report Range,${reportRangeLabel()}`,
        '',
        'MEMBER INFORMATION',
        `Name,${statement.memberInfo.name}`,
        `Membership Number,${statement.memberInfo.membershipNumber}`,
        `Email,${statement.memberInfo.email}`,
        `Join Date,${new Date(statement.memberInfo.joinDate).toLocaleDateString()}`,
        '',
        'FINANCIAL SUMMARY',
        `Total Savings,${statement.financialSummary.totalSavings}`,
        `Loan Eligibility,${statement.financialSummary.loanEligibility}`,
        `Active Loans,${statement.financialSummary.activeLoans}`,
        `Total Loan Amount,${statement.financialSummary.totalLoanAmount}`,
        `Available Credit,${statement.financialSummary.availableCredit}`,
        '',
        'SAVINGS HISTORY',
        'Month,Amount,Date Recorded'
      ].join('\n');
      
      const savingsData = filteredSavings
        .sort((a, b) => new Date(b.month) - new Date(a.month))
        .map(saving => 
          `${new Date(saving.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })},${saving.amount},${new Date(saving.createdAt).toLocaleDateString()}`
        );
      
      csvContent += '\n' + savingsData.join('\n');
      
      if (filteredLoans.length > 0) {
        csvContent += '\n\nLOAN HISTORY\n';
        csvContent += 'Amount,Duration,Purpose,Status,Applied Date,Interest Mode,Rate (%),Balance\n';
        
        const loansData = filteredLoans
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(loan => {
            const interestMode = getLoanInterestModeLabel(loan);
            const rate = getLoanMonthlyRatePercent(loan);
            return `${loan.amount},${loan.duration} months,"${loan.purpose || 'N/A'}",${loan.status},${new Date(loan.createdAt).toLocaleDateString()},${interestMode},${rate}%,${loan.balance || loan.amount}`;
          });
        
        csvContent += loansData.join('\n');
      }
      if (loanSummaryRows.length > 0) {
        csvContent += '\n\nLOAN SUMMARY\n';
        csvContent += 'Loan,Type,Amount,Applied Date,Status,Interest Mode,Rate (%),Interest Basis,Repayment Months,Bank Charges,Balance\n';
        csvContent += loanSummaryRows.map((row) =>
          [
            row.label,
            row.loanType,
            row.amount,
            row.appliedDate ? new Date(row.appliedDate).toLocaleDateString() : '',
            row.status,
            row.interestMode,
            `${row.interestRatePercent}%`,
            `"${row.interestBasis}"`,
            row.repaymentMonths,
            row.bankCharges,
            row.balance
          ].join(',')
        ).join('\n');
      }

      if (repaymentHistoryRows.length > 0) {
        csvContent += '\n\nLOAN REPAYMENT HISTORY\n';
        csvContent += 'Loan,Paid Date,Month,Amount,Early Payment\n';
        csvContent += repaymentHistoryRows.map((row) =>
          [
            loanSummaryRows.find((loan) => loan.loanId === row.loanId)?.label || 'Loan',
            row.paidDate ? new Date(row.paidDate).toLocaleDateString() : '',
            row.month,
            row.amount,
            row.isEarlyPayment
          ].join(',')
        ).join('\n');
      }

      if (repaymentPlanRows.length > 0) {
        csvContent += '\n\nLOAN REPAYMENT PLAN\n';
        csvContent += 'Loan,Month,Payment,Principal,Interest,Balance\n';
        csvContent += repaymentPlanRows.map((row) =>
          [
            loanSummaryRows.find((loan) => loan.loanId === row.loanId)?.label || 'Loan',
            row.month,
            row.payment,
            row.principal,
            row.interest,
            row.balance
          ].join(',')
        ).join('\n');
      }
    } else {
      // Handle array data
      const headers = Object.keys(data[0]);
      csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          }).join(',')
        )
      ].join('\n');
    }

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

  const financialStatement = generateFinancialStatement();
  const availableYears = [...new Set(memberData.savings.map(saving => 
    new Date(saving.month).getFullYear()
  ))].sort((a, b) => b - a);

  if (loading) {
    return <div className="animate-pulse">Loading reports data...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Reports</h1>
        <p className="mt-1 text-sm text-gray-600">
          Download your financial statements and transaction history
        </p>
      </div>

      <div className="card mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Report Date Range</h3>
            <p className="text-sm text-gray-500">Applies to PDF and CSV exports.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
      </div>

      {/* Member Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Total Savings</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(financialStatement.financialSummary.totalSavings)}
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Loan Eligibility</div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(financialStatement.financialSummary.loanEligibility)}
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Active Loans</div>
          <div className="text-2xl font-bold text-yellow-600">
            {financialStatement.financialSummary.activeLoans}
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Available Credit</div>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(financialStatement.financialSummary.availableCredit)}
          </div>
        </div>
      </div>

      {/* Export Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Reports</h3>
          <div className="space-y-4">
            <button
              onClick={exportMemberPdf}
              className="w-full flex items-center justify-center h-11 px-4 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Download Member Report (PDF)
            </button>
            <button
              onClick={() => exportToCSV(null, 'financial-statement')}
              className="w-full flex items-center justify-center h-11 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Download Financial Statement
            </button>
            <button
              onClick={() => exportToCSV(
                filteredSavings.map(saving => ({
                  month: new Date(saving.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
                  amount: saving.amount,
                  dateRecorded: new Date(saving.createdAt).toLocaleDateString()
                })),
                'savings-history'
              )}
              className="w-full flex items-center justify-center h-11 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Download Savings History
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Reports</h3>
          <div className="space-y-4">
            <button
              onClick={() => exportToCSV(
                filteredLoans.map(loan => ({
                  amount: loan.amount,
                  duration: `${loan.duration} months`,
                  purpose: loan.purpose || 'N/A',
                  status: loan.status,
                  appliedDate: new Date(loan.createdAt).toLocaleDateString(),
                  interestMode: getLoanInterestModeLabel(loan),
                  interestRatePercent: `${getLoanMonthlyRatePercent(loan)}%`,
                  balance: loan.balance || loan.amount
                })),
                'loan-history'
              )}
              className="w-full flex items-center justify-center h-11 px-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              disabled={filteredLoans.length === 0}
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Download Loan History
            </button>
            <div className="text-sm text-gray-500 text-center">
              {filteredLoans.length === 0 ? 'No loans to export' : `${filteredLoans.length} loan(s) available`}
            </div>
          </div>
        </div>
      </div>

      {/* Yearly Breakdown */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Savings Summary by Year</h3>
          <ChartBarIcon className="h-5 w-5 text-gray-400" />
        </div>
        
        {availableYears.length > 0 ? (
          <div className="space-y-6">
            {financialStatement.yearlyBreakdown.map((yearData) => (
              <div key={yearData.year} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-medium text-gray-900">{yearData.year}</h4>
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(yearData.totalSavings)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {yearData.monthlyBreakdown.map((monthData, index) => (
                    <div key={index} className="text-center">
                      <div className="text-xs text-gray-500">{monthData.month.slice(0, 3)}</div>
                      <div className={`text-sm font-medium ${
                        monthData.amount > 0 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {monthData.amount > 0 ? formatCurrency(monthData.amount) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No savings data available.</p>
            <p className="text-sm text-gray-400 mt-1">
              Contact your SACCO administrator to record your contributions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberReports;
