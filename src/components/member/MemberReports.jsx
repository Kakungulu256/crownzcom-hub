import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { useAuth } from '../../lib/auth';
import { formatCurrency } from '../../utils/financial';
import { DocumentArrowDownIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { fetchMemberRecord } from '../../lib/member';
import { listAllDocuments } from '../../lib/pagination';
import { createPdfDoc, addSectionTitle, addKeyValueRows, addSimpleTable, savePdf } from '../../lib/pdf';

const MemberReports = () => {
  const { user } = useAuth();
  const [memberData, setMemberData] = useState({
    member: null,
    savings: [],
    loans: [],
    loanCharges: [],
    ledger: []
  });
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
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_CHARGES)
      ];

      if (COLLECTIONS.LEDGER_ENTRIES) {
        requests.push(listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LEDGER_ENTRIES, [
          Query.equal('memberId', memberId)
        ]));
      }

      const [savings, loans, charges, ledger = []] = await Promise.all(requests);
      
      setMemberData({
        member,
        savings,
        loans,
        loanCharges: charges.filter(charge => 
          loans.some(loan => loan.$id === charge.loanId)
        ),
        ledger
      });
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
    const loanEligibility = totalSavings * 0.8;
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

    const activeLoans = filteredLoans.filter(loan => loan.status === 'active');
    const completedLoans = filteredLoans.filter(loan => loan.status === 'completed');

    const activeLoanRows = activeLoans
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map(loan => ([
        formatCurrency(loan.amount),
        formatCurrency(loan.balance || loan.amount),
        loan.createdAt ? new Date(loan.createdAt).toLocaleDateString() : ''
      ]));

    const completedLoanRows = completedLoans
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map(loan => ([
        formatCurrency(loan.amount),
        loan.updatedAt ? new Date(loan.updatedAt).toLocaleDateString() : '',
        loan.purpose || ''
      ]));

    const interestRows = filteredLedger
      .filter(entry => entry.type === 'InterestPayout')
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .map(entry => ([
        entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '',
        formatCurrency(entry.amount || 0),
        entry.notes || ''
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
      { label: 'Total Interest Paid', value: formatCurrency(totalInterestPaid) },
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
    cursorY = addSectionTitle(doc, cursorY, 'Loans - Active', pdfMeta, 5);
    cursorY = addKeyValueRows(doc, cursorY, [
      { label: 'Active Loans', value: activeLoans.length },
      { label: 'Active Balance', value: formatCurrency(activeLoans.reduce((sum, loan) => sum + (loan.balance || loan.amount || 0), 0)) }
    ], pdfMeta);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Amount', 'Balance', 'Applied'],
      activeLoanRows.length ? activeLoanRows : [['No active loans', '', '']],
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
      ['Amount', 'Completed', 'Purpose'],
      completedLoanRows.length ? completedLoanRows : [['No completed loans', '', '']],
      pdfMeta
    );

    cursorY += 4;
    cursorY = addSectionTitle(doc, cursorY, 'Interest Distribution', pdfMeta, 4);
    cursorY = addSimpleTable(
      doc,
      cursorY,
      ['Date', 'Amount', 'Notes'],
      interestRows.length ? interestRows : [['No interest payouts', '', '']],
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
      const loanEligibility = totalSavings * 0.8;
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
        csvContent += 'Amount,Duration,Purpose,Status,Applied Date,Balance\n';
        
        const loansData = filteredLoans
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(loan => 
            `${loan.amount},${loan.duration} months,"${loan.purpose || 'N/A'}",${loan.status},${new Date(loan.createdAt).toLocaleDateString()},${loan.balance || loan.amount}`
          );
        
        csvContent += loansData.join('\n');
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
              className="w-full flex items-center justify-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Download Member Report (PDF)
            </button>
            <button
              onClick={() => exportToCSV(null, 'financial-statement')}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
              className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
                  balance: loan.balance || loan.amount
                })),
                'loan-history'
              )}
              className="w-full flex items-center justify-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
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
