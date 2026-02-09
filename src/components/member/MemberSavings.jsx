import { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { useAuth } from '../../lib/auth';
import { formatCurrency } from '../../utils/financial';
import { CalendarIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { calculateAvailableCredit } from '../../utils/financial';
import { fetchMemberRecord } from '../../lib/member';
import { listAllDocuments } from '../../lib/pagination';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';

const MemberSavings = () => {
  const { user } = useAuth();
  const [savings, setSavings] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [financialConfig, setFinancialConfig] = useState({ ...DEFAULT_FINANCIAL_CONFIG });

  useEffect(() => {
    if (user) {
      fetchSavings();
    }
  }, [user, selectedYear]);

  const fetchSavings = async () => {
    try {
      // Get member record (prefer authUserId mapping)
      const member = await fetchMemberRecord({ databases, DATABASE_ID, COLLECTIONS, user });
      if (!member) {
        console.error('Member record not found');
        return;
      }
      const memberId = member.$id;
      
      // Fetch member's savings
      const [savings, loans, config] = await Promise.all([
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS, [
          Query.equal('memberId', memberId)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS, [
          Query.equal('memberId', memberId)
        ]),
        fetchFinancialConfig(databases, DATABASE_ID, COLLECTIONS.FINANCIAL_CONFIG)
      ]);
      
      setSavings(savings);
      setLoans(loans);
      setFinancialConfig(config);

      const years = [...new Set(savings.map(saving =>
        new Date(saving.month).getFullYear()
      ))].sort((a, b) => b - a);
      if (years.length > 0 && !years.includes(selectedYear)) {
        setSelectedYear(years[0]);
      }
    } catch (error) {
      console.error('Error fetching savings:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalSavings = savings.reduce((sum, saving) => sum + saving.amount, 0);
  const currentYearSavings = savings.filter(saving => 
    new Date(saving.month).getFullYear() === selectedYear
  );
  const yearlyTotal = currentYearSavings.reduce((sum, saving) => sum + saving.amount, 0);

  // Generate monthly data for the selected year
  const monthlyData = [];
  for (let month = 0; month < 12; month++) {
    const monthKey = `${selectedYear}-${String(month + 1).padStart(2, '0')}`;
    const monthSaving = currentYearSavings.find(saving => 
      saving.month === monthKey
    );
    
    monthlyData.push({
      month: new Date(selectedYear, month).toLocaleDateString('en-US', { month: 'long' }),
      amount: monthSaving ? monthSaving.amount : 0,
      date: monthSaving ? monthSaving.createdAt : null
    });
  }

  const availableYears = [...new Set(savings.map(saving => 
    new Date(saving.month).getFullYear()
  ))].sort((a, b) => b - a);

  if (loading) {
    return <div className="animate-pulse">Loading savings data...</div>;
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Savings</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your monthly savings at a glance.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="form-input"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
            {availableYears.length === 0 && (
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            )}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-xl bg-emerald-500">
                <ChartBarIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-slate-500">Total Savings</div>
              <div className="text-xl font-bold text-emerald-600">{formatCurrency(totalSavings)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-xl bg-blue-500">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-slate-500">{selectedYear} Total</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(yearlyTotal)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-xl bg-indigo-500">
                <ChartBarIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-slate-500">Loan Eligibility</div>
              <div className="text-xl font-bold text-indigo-600">
                {formatCurrency(calculateAvailableCredit(
                  totalSavings, 
                  loans.filter(loan => loan.status === 'active' || loan.status === 'approved').reduce((sum, loan) => sum + (loan.balance || loan.amount), 0),
                  (financialConfig.loanEligibilityPercentage || 80) / 100
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Calendar */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {selectedYear} Savings Calendar
          </h3>
          <div className="text-sm text-slate-500">
            Total: <span className="font-semibold text-slate-700">{formatCurrency(yearlyTotal)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {monthlyData.map((data) => (
            <div
              key={data.month}
              className={`rounded-2xl border p-4 ${
                data.amount > 0
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="text-sm font-semibold text-slate-900">{data.month}</div>
              <div className="mt-2 text-xl font-bold">
                {data.amount > 0 ? formatCurrency(data.amount) : '—'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {data.date ? `Recorded ${new Date(data.date).toLocaleDateString()}` : 'No contribution'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemberSavings;
