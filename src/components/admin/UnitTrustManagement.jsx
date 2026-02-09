import React, { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { ID } from 'appwrite';
import { formatCurrency } from '../../utils/financial';
import toast from 'react-hot-toast';
import { listAllDocuments } from '../../lib/pagination';
import { createLedgerEntry } from '../../lib/ledger';

const UnitTrustManagement = () => {
  const [unitTrustRecords, setUnitTrustRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [unitTrustLoading, setUnitTrustLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'purchase',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchUnitTrustRecords();
  }, []);

  const fetchUnitTrustRecords = async () => {
    try {
      const records = await listAllDocuments(
        databases,
        DATABASE_ID,
        COLLECTIONS.UNIT_TRUST,
        [Query.orderDesc('date')]
      );
      setUnitTrustRecords(records);
    } catch (error) {
      toast.error('Failed to fetch unit trust records');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setUnitTrustLoading(true);
      const payload = {
        ...formData,
        amount: parseInt(formData.amount),
        date: new Date(formData.date).toISOString(),
        createdAt: new Date().toISOString()
      };
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.UNIT_TRUST,
        ID.unique(),
        payload
      );
      const month = payload.date.slice(0, 7);
      await createLedgerEntry({
        databases,
        DATABASE_ID,
        COLLECTIONS,
        entry: {
          type: 'UnitTrust',
          amount: payload.amount,
          month,
          year: parseInt(month.split('-')[0], 10),
          notes: `${payload.type}${payload.description ? ` - ${payload.description}` : ''}`
        }
      });
      toast.success('Unit trust record added successfully');
      setFormData({
        type: 'purchase',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowForm(false);
      fetchUnitTrustRecords();
    } catch (error) {
      toast.error('Failed to add unit trust record');
    } finally {
      setUnitTrustLoading(false);
    }
  };

  const getTotalByType = (type) => {
    return unitTrustRecords
      .filter(record => record.type === type)
      .reduce((sum, record) => sum + record.amount, 0);
  };

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Unit Trust Management</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Transaction
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <h3 className="text-lg font-medium text-green-800">Total Purchases</h3>
          <p className="text-2xl font-bold text-green-900">{formatCurrency(getTotalByType('purchase'))}</p>
        </div>
        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <h3 className="text-lg font-medium text-red-800">Total Withdrawals</h3>
          <p className="text-2xl font-bold text-red-900">{formatCurrency(getTotalByType('withdrawal'))}</p>
        </div>
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-lg font-medium text-blue-800">Total Interest</h3>
          <p className="text-2xl font-bold text-blue-900">{formatCurrency(getTotalByType('interest'))}</p>
        </div>
      </div>

      {/* Transaction Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Add Unit Trust Transaction</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="purchase">Purchase</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="interest">Interest</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows="3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  disabled={unitTrustLoading}
                >
                  {unitTrustLoading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Add Transaction'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                  disabled={unitTrustLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {unitTrustRecords.map((record) => (
              <tr key={record.$id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(record.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    record.type === 'purchase' ? 'bg-green-100 text-green-800' :
                    record.type === 'withdrawal' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {record.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatCurrency(record.amount)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {record.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {unitTrustRecords.length === 0 && (
          <div className="text-center py-8 text-gray-500">No unit trust records found</div>
        )}
      </div>
    </div>
  );
};

export default UnitTrustManagement;
