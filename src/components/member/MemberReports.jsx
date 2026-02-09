import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { useAuth } from '../../lib/auth';
import { formatCurrency } from '../../utils/financial';
import { DocumentArrowDownIcon, ChartBarIcon, CalendarIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { fetchMemberRecord } from '../../lib/member';
import { listAllDocuments } from '../../lib/pagination';

const MemberReports = () => {
  const { user } = useAuth();
  const [memberData, setMemberData] = useState({
    member: null,
    savings: [],
    loans: [],
    loanCharges: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
      const [savings, loans, charges] = await Promise.all([
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS, [
          Query.equal('memberId', memberId)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS, [
          Query.equal('memberId', memberId)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_CHARGES)
      ]);
      
      setMemberData({
        member,
        savings,
        loans,
        loanCharges: charges.filter(charge => 
          loans.some(loan => loan.$id === charge.loanId)
        )
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
    if (!data || (Array.isArray(data) && data.length === 0)) {
      toast.error('No data to export');
      return;
    }

    let csvContent = '';
    
    if (filename === 'financial-statement') {
      // Generate comprehensive financial statement
      const statement = generateFinancialStatement();
      
      csvContent = [
        'FINANCIAL STATEMENT',
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
      
      const savingsData = memberData.savings
        .sort((a, b) => new Date(b.month) - new Date(a.month))
        .map(saving => 
          `${new Date(saving.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })},${saving.amount},${new Date(saving.createdAt).toLocaleDateString()}`
        );
      
      csvContent += '\n' + savingsData.join('\n');
      
      if (memberData.loans.length > 0) {
        csvContent += '\n\nLOAN HISTORY\n';
        csvContent += 'Amount,Duration,Purpose,Status,Applied Date,Balance\n';
        
        const loansData = memberData.loans
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
              onClick={() => exportToCSV(null, 'financial-statement')}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Download Financial Statement
            </button>
            <button
              onClick={() => exportToCSV(
                memberData.savings.map(saving => ({
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
                memberData.loans.map(loan => ({
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
              disabled={memberData.loans.length === 0}
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              Download Loan History
            </button>
            <div className="text-sm text-gray-500 text-center">
              {memberData.loans.length === 0 ? 'No loans to export' : `${memberData.loans.length} loan(s) available`}
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
