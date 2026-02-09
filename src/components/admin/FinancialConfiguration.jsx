import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { databases, DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { ID, Query } from 'appwrite';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';

const FinancialConfiguration = () => {
  const [config, setConfig] = useState({ ...DEFAULT_FINANCIAL_CONFIG });
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [interestRecords, setInterestRecords] = useState([]);
  const [retainedRecords, setRetainedRecords] = useState([]);
  const [interestForm, setInterestForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    loanInterestTotal: '',
    trustInterestTotal: '',
    notes: ''
  });
  const [retainedForm, setRetainedForm] = useState({
    year: new Date().getFullYear(),
    percentage: '',
    notes: ''
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        if (!COLLECTIONS.FINANCIAL_CONFIG) {
          setConfig({ ...DEFAULT_FINANCIAL_CONFIG });
          return;
        }
        const configDoc = await fetchFinancialConfig(
          databases,
          DATABASE_ID,
          COLLECTIONS.FINANCIAL_CONFIG,
          { createIfMissing: true }
        );
        setConfig({ ...DEFAULT_FINANCIAL_CONFIG, ...configDoc });
        setConfigId(configDoc.$id || null);
        await Promise.all([loadInterestRecords(), loadRetainedRecords()]);
      } catch (error) {
        toast.error('Failed to load configuration');
      }
    };
    fetchConfig();
  }, []);

  const loadInterestRecords = async () => {
    if (!COLLECTIONS.INTEREST_MONTHLY) return;
    const records = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.INTEREST_MONTHLY,
      [Query.orderDesc('month'), Query.limit(12)]
    );
    setInterestRecords(records.documents);
  };

  const loadRetainedRecords = async () => {
    if (!COLLECTIONS.RETAINED_EARNINGS) return;
    const records = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.RETAINED_EARNINGS,
      [Query.orderDesc('year'), Query.limit(10)]
    );
    setRetainedRecords(records.documents);
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  const saveConfiguration = async () => {
    setLoading(true);
    try {
      if (!COLLECTIONS.FINANCIAL_CONFIG) {
        throw new Error('Financial configuration collection is not set.');
      }
      if (configId) {
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.FINANCIAL_CONFIG,
          configId,
          config
        );
      } else {
        const created = await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.FINANCIAL_CONFIG,
          ID.unique(),
          config
        );
        setConfigId(created.$id);
      }
      toast.success('Configuration saved successfully');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = () => {
    setConfig({
      ...DEFAULT_FINANCIAL_CONFIG
    });
    toast.success('Configuration reset to defaults');
  };

  const handleInterestChange = (field, value) => {
    setInterestForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRetainedChange = (field, value) => {
    setRetainedForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveInterestRecord = async (event) => {
    event.preventDefault();
    try {
      if (!COLLECTIONS.INTEREST_MONTHLY) {
        throw new Error('Interest monthly collection is not set.');
      }
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.INTEREST_MONTHLY,
        ID.unique(),
        {
          month: interestForm.month,
          year: parseInt(interestForm.month.split('-')[0], 10),
          loanInterestTotal: parseInt(interestForm.loanInterestTotal || 0, 10),
          trustInterestTotal: parseInt(interestForm.trustInterestTotal || 0, 10),
          notes: interestForm.notes || '',
          createdAt: new Date().toISOString()
        }
      );
      toast.success('Monthly interest recorded');
      setInterestForm({
        month: new Date().toISOString().slice(0, 7),
        loanInterestTotal: '',
        trustInterestTotal: '',
        notes: ''
      });
      await loadInterestRecords();
    } catch (error) {
      toast.error(error.message || 'Failed to record monthly interest');
    }
  };

  const saveRetainedRecord = async (event) => {
    event.preventDefault();
    try {
      if (!COLLECTIONS.RETAINED_EARNINGS) {
        throw new Error('Retained earnings collection is not set.');
      }
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.RETAINED_EARNINGS,
        ID.unique(),
        {
          year: parseInt(retainedForm.year, 10),
          percentage: parseFloat(retainedForm.percentage || 0),
          notes: retainedForm.notes || '',
          createdAt: new Date().toISOString()
        }
      );
      toast.success('Retained earnings percentage recorded');
      setRetainedForm({
        year: new Date().getFullYear(),
        percentage: '',
        notes: ''
      });
      await loadRetainedRecords();
    } catch (error) {
      toast.error(error.message || 'Failed to record retained earnings');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Financial Configuration</h2>
        <div className="space-x-3">
          <button
            onClick={resetToDefaults}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
          >
            Reset to Defaults
          </button>
          <button
            onClick={saveConfiguration}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monthly Interest Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.loanInterestRate}
                onChange={(e) => handleConfigChange('loanInterestRate', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">Current: {config.loanInterestRate}% per month</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loan Eligibility Percentage (%)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                value={config.loanEligibilityPercentage}
                onChange={(e) => handleConfigChange('loanEligibilityPercentage', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Members can borrow up to {config.loanEligibilityPercentage}% of their savings
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Early Repayment Penalty (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.earlyRepaymentPenalty}
                onChange={(e) => handleConfigChange('earlyRepaymentPenalty', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Additional {config.earlyRepaymentPenalty}% charge for early repayments
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Loan Duration (months)
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={config.maxLoanDuration}
                onChange={(e) => handleConfigChange('maxLoanDuration', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum loan term: {config.maxLoanDuration} months
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Amount Limits</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Loan Amount (UGX)
              </label>
              <input
                type="number"
                step="1000"
                value={config.minLoanAmount}
                onChange={(e) => handleConfigChange('minLoanAmount', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum: UGX {config.minLoanAmount.toLocaleString()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Loan Amount (UGX)
              </label>
              <input
                type="number"
                step="100000"
                value={config.maxLoanAmount}
                onChange={(e) => handleConfigChange('maxLoanAmount', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: UGX {config.maxLoanAmount.toLocaleString()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Bank Charge (UGX)
              </label>
              <input
                type="number"
                step="1000"
                value={config.defaultBankCharge}
                onChange={(e) => handleConfigChange('defaultBankCharge', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default charge: UGX {config.defaultBankCharge.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-lg font-medium text-blue-900 mb-4">Current Configuration Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p><strong>Monthly Interest:</strong> {config.loanInterestRate}%</p>
            <p><strong>Loan Eligibility:</strong> {config.loanEligibilityPercentage}% of savings</p>
            <p><strong>Early Repayment Penalty:</strong> {config.earlyRepaymentPenalty}%</p>
          </div>
          <div>
            <p><strong>Max Duration:</strong> {config.maxLoanDuration} months</p>
            <p><strong>Loan Range:</strong> UGX {config.minLoanAmount.toLocaleString()} - {config.maxLoanAmount.toLocaleString()}</p>
            <p><strong>Default Bank Charge:</strong> UGX {config.defaultBankCharge.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
        <h3 className="text-lg font-medium text-yellow-900 mb-2">SACCO Business Rules</h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>- Loan eligibility is calculated as: (Total Savings x {config.loanEligibilityPercentage}%) - Outstanding Loans</li>
          <li>- Monthly interest is calculated on the principal amount</li>
          <li>- Early repayments incur an additional {config.earlyRepaymentPenalty}% penalty for that month</li>
          <li>- Bank charges are added to approved loans and appear in the first repayment</li>
          <li>- All financial calculations are performed server-side for security</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Record Monthly Interest</h3>
          <form onSubmit={saveInterestRecord} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <input
                type="month"
                value={interestForm.month}
                onChange={(e) => handleInterestChange('month', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Interest Total (UGX)</label>
              <input
                type="number"
                value={interestForm.loanInterestTotal}
                onChange={(e) => handleInterestChange('loanInterestTotal', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trust Interest Total (UGX)</label>
              <input
                type="number"
                value={interestForm.trustInterestTotal}
                onChange={(e) => handleInterestChange('trustInterestTotal', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={interestForm.notes}
                onChange={(e) => handleInterestChange('notes', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                rows="2"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              Save Monthly Interest
            </button>
          </form>
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Interest Records</h4>
            <div className="space-y-2">
              {interestRecords.length === 0 && (
                <p className="text-sm text-gray-500">No monthly interest records yet.</p>
              )}
              {interestRecords.map((record) => (
                <div key={record.$id} className="border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900">{record.month}</span>
                    <span className="text-gray-500">UGX {(record.loanInterestTotal || 0) + (record.trustInterestTotal || 0)}</span>
                  </div>
                  <div className="text-gray-500">
                    Loan: UGX {record.loanInterestTotal || 0} | Trust: UGX {record.trustInterestTotal || 0}
                  </div>
                  {record.notes ? (
                    <div className="text-gray-500">Notes: {record.notes}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Retained Earnings Percentage</h3>
          <form onSubmit={saveRetainedRecord} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input
                type="number"
                value={retainedForm.year}
                onChange={(e) => handleRetainedChange('year', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retained Earnings (%)</label>
              <input
                type="number"
                step="0.1"
                value={retainedForm.percentage}
                onChange={(e) => handleRetainedChange('percentage', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={retainedForm.notes}
                onChange={(e) => handleRetainedChange('notes', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                rows="2"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              Save Retained Earnings
            </button>
          </form>
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Retained Earnings History</h4>
            <div className="space-y-2">
              {retainedRecords.length === 0 && (
                <p className="text-sm text-gray-500">No retained earnings records yet.</p>
              )}
              {retainedRecords.map((record) => (
                <div key={record.$id} className="border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900">{record.year}</span>
                    <span className="text-gray-500">{record.percentage}%</span>
                  </div>
                  {record.notes ? (
                    <div className="text-gray-500">Notes: {record.notes}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialConfiguration;
