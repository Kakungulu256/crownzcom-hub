import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { databases, storage, DATABASE_ID, COLLECTIONS, DOCUMENTS_BUCKET_ID, BRANDING_BUCKET_ID } from '../../lib/appwrite';
import { ID, Query, Permission, Role } from 'appwrite';
import { DEFAULT_FINANCIAL_CONFIG, fetchFinancialConfig } from '../../lib/financialConfig';

const INTEGER_CONFIG_FIELDS = new Set([
  'loanEligibilityPercentage',
  'defaultBankCharge',
  'maxLoanDuration',
  'longTermMaxRepaymentMonths',
  'minLoanAmount',
  'maxLoanAmount'
]);
const INTEREST_CALCULATION_MODES = new Set(['flat', 'reducing_balance']);

const FinancialConfiguration = () => {
  const [config, setConfig] = useState({ ...DEFAULT_FINANCIAL_CONFIG });
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
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
        if (configDoc.logoFileId) {
          const bucketId = configDoc.logoBucketId || BRANDING_BUCKET_ID || DOCUMENTS_BUCKET_ID;
          setLogoPreviewUrl(storage.getFilePreview(bucketId, configDoc.logoFileId));
        }
        await Promise.all([loadInterestRecords(), loadRetainedRecords()]);
      } catch (error) {
        toast.error('Failed to load configuration');
      }
    };
    fetchConfig();
  }, []);

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!COLLECTIONS.FINANCIAL_CONFIG) {
      toast.error('Financial configuration collection is not set.');
      return;
    }

    try {
      setLogoUploading(true);
      const targetBucket = BRANDING_BUCKET_ID || DOCUMENTS_BUCKET_ID;
      const uploaded = await storage.createFile(
        targetBucket,
        ID.unique(),
        file,
        [Permission.read(Role.any())]
      );
      const nextLogoFileId = uploaded.$id;
      const nextLogoBucketId = targetBucket;

      if (config.logoFileId && config.logoBucketId) {
        try {
          await storage.deleteFile(config.logoBucketId, config.logoFileId);
        } catch {
          // ignore deletion errors
        }
      }

      if (configId) {
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.FINANCIAL_CONFIG,
          configId,
          {
            logoFileId: nextLogoFileId,
            logoBucketId: nextLogoBucketId
          }
        );
      } else {
        const created = await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.FINANCIAL_CONFIG,
          ID.unique(),
          {
            ...DEFAULT_FINANCIAL_CONFIG,
            ...config,
            logoFileId: nextLogoFileId,
            logoBucketId: nextLogoBucketId
          }
        );
        setConfigId(created.$id);
      }

      setConfig((prev) => ({
        ...prev,
        logoFileId: nextLogoFileId,
        logoBucketId: nextLogoBucketId
      }));
      setLogoPreviewUrl(storage.getFilePreview(nextLogoBucketId, nextLogoFileId));
      toast.success('Logo updated');
    } catch (error) {
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

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
    if (field === 'interestCalculationMode') {
      const normalized = String(value || '').trim().toLowerCase();
      setConfig(prev => ({
        ...prev,
        interestCalculationMode: INTEREST_CALCULATION_MODES.has(normalized)
          ? normalized
          : DEFAULT_FINANCIAL_CONFIG.interestCalculationMode
      }));
      return;
    }

    const parsedValue = Number(value);
    const safeValue = Number.isFinite(parsedValue) ? parsedValue : 0;
    setConfig(prev => ({
      ...prev,
      [field]: INTEGER_CONFIG_FIELDS.has(field) ? Math.trunc(safeValue) : safeValue
    }));
  };

  const validateConfiguration = () => {
    if (config.loanInterestRate <= 0) return 'Short-term interest rate must be greater than 0%.';
    if (config.longTermInterestRate <= 0) return 'Long-term interest rate must be greater than 0%.';
    if (!INTEREST_CALCULATION_MODES.has(String(config.interestCalculationMode || '').toLowerCase())) {
      return 'Interest calculation mode is invalid.';
    }
    if (config.loanEligibilityPercentage < 1 || config.loanEligibilityPercentage > 100) {
      return 'Loan eligibility percentage must be between 1% and 100%.';
    }
    if (config.earlyRepaymentPenalty < 0) return 'Early repayment penalty cannot be negative.';
    if (config.maxLoanDuration < 1 || config.maxLoanDuration > 12) {
      return 'Short-term maximum repayment must be between 1 and 12 months.';
    }
    if (config.longTermMaxRepaymentMonths < 1 || config.longTermMaxRepaymentMonths > 120) {
      return 'Long-term maximum repayment must be between 1 and 120 months.';
    }
    if (config.longTermMaxRepaymentMonths <= config.maxLoanDuration) {
      return 'Long-term maximum repayment must be greater than short-term maximum repayment.';
    }
    if (config.minLoanAmount < 0) return 'Minimum loan amount cannot be negative.';
    if (config.maxLoanAmount <= 0) return 'Maximum loan amount must be greater than 0.';
    if (config.minLoanAmount > config.maxLoanAmount) {
      return 'Minimum loan amount cannot exceed maximum loan amount.';
    }
    if (config.defaultBankCharge < 0) return 'Default bank charge cannot be negative.';
    return null;
  };

  const saveConfiguration = async () => {
    const validationError = validateConfiguration();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      console.log('[FinancialConfiguration] Saving configuration...', {
        configId,
        config
      });
      if (!COLLECTIONS.FINANCIAL_CONFIG) {
        throw new Error('Financial configuration collection is not set.');
      }
      const payload = Object.keys(DEFAULT_FINANCIAL_CONFIG).reduce((acc, key) => {
        if (key === 'interestCalculationMode') {
          const normalized = String(config[key] || '').trim().toLowerCase();
          acc[key] = INTEREST_CALCULATION_MODES.has(normalized)
            ? normalized
            : DEFAULT_FINANCIAL_CONFIG.interestCalculationMode;
          return acc;
        }
        if (key === 'logoFileId' || key === 'logoBucketId') {
          const rawValue = config[key];
          const normalized = typeof rawValue === 'string' ? rawValue.trim() : '';
          if (normalized.length > 0) {
            acc[key] = normalized;
          }
          return acc;
        }
        const parsedValue = Number(config[key]);
        const normalizedValue = Number.isFinite(parsedValue)
          ? parsedValue
          : Number(DEFAULT_FINANCIAL_CONFIG[key]);
        acc[key] = INTEGER_CONFIG_FIELDS.has(key) ? Math.trunc(normalizedValue) : normalizedValue;
        return acc;
      }, {});
      console.log('[FinancialConfiguration] Save payload', payload);
      if (configId) {
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.FINANCIAL_CONFIG,
          configId,
          payload
        );
      } else {
        const created = await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.FINANCIAL_CONFIG,
          ID.unique(),
          payload
        );
        setConfigId(created.$id);
      }
      setConfig(prev => ({ ...prev, ...payload }));
      toast.success('Configuration saved successfully');
    } catch (error) {
      console.error('[FinancialConfiguration] Save failed', error);
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
                Short-Term Monthly Interest Rate (%)
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
                Long-Term Monthly Interest Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.longTermInterestRate}
                onChange={(e) => handleConfigChange('longTermInterestRate', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">Current: {config.longTermInterestRate}% per month</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interest Calculation Mode
              </label>
              <select
                value={config.interestCalculationMode}
                onChange={(e) => handleConfigChange('interestCalculationMode', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="flat">Flat (on original principal)</option>
                <option value="reducing_balance">Reducing Balance (on outstanding principal)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Current: {config.interestCalculationMode === 'reducing_balance' ? 'Reducing Balance' : 'Flat'}
              </p>
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
                Short-Term Maximum Repayment (months)
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
                Maximum short-term loan term: {config.maxLoanDuration} months
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Long-Term Maximum Repayment (months)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={config.longTermMaxRepaymentMonths}
                onChange={(e) => handleConfigChange('longTermMaxRepaymentMonths', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum long-term loan term: {config.longTermMaxRepaymentMonths} months
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
            <p><strong>Short-Term Interest:</strong> {config.loanInterestRate}%</p>
            <p><strong>Long-Term Interest:</strong> {config.longTermInterestRate}%</p>
            <p><strong>Interest Mode:</strong> {config.interestCalculationMode === 'reducing_balance' ? 'Reducing Balance' : 'Flat'}</p>
            <p><strong>Loan Eligibility:</strong> {config.loanEligibilityPercentage}% of savings</p>
            <p><strong>Early Repayment Penalty:</strong> {config.earlyRepaymentPenalty}%</p>
          </div>
          <div>
            <p><strong>Short-Term Max Duration:</strong> {config.maxLoanDuration} months</p>
            <p><strong>Long-Term Max Duration:</strong> {config.longTermMaxRepaymentMonths} months</p>
            <p><strong>Loan Range:</strong> UGX {config.minLoanAmount.toLocaleString()} - {config.maxLoanAmount.toLocaleString()}</p>
            <p><strong>Default Bank Charge:</strong> UGX {config.defaultBankCharge.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Branding (Logo)</h3>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="h-24 w-24 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
            {logoPreviewUrl ? (
              <img src={logoPreviewUrl} alt="Club logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-gray-500">No logo</span>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Upload a new logo to replace the current one.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="block text-sm text-gray-600"
              disabled={logoUploading}
            />
            {logoUploading && (
              <div className="text-sm text-blue-600">Uploading...</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
        <h3 className="text-lg font-medium text-yellow-900 mb-2">SACCO Business Rules</h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>- Loan eligibility is calculated as: (Total Savings x {config.loanEligibilityPercentage}%) - Outstanding Loans</li>
          <li>- Short-term loans use {config.loanInterestRate}% monthly interest up to {config.maxLoanDuration} months</li>
          <li>- Long-term loans use {config.longTermInterestRate}% monthly interest up to {config.longTermMaxRepaymentMonths} months</li>
          <li>- Interest mode is currently {config.interestCalculationMode === 'reducing_balance' ? 'Reducing Balance' : 'Flat'} for all loans</li>
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
