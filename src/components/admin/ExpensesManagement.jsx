import React, { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { ID } from 'appwrite';
import { formatCurrency } from '../../utils/financial';
import toast from 'react-hot-toast';
import { listAllDocuments } from '../../lib/pagination';
import { createLedgerEntry } from '../../lib/ledger';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const ExpensesManagement = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'operational',
    date: new Date().toISOString().split('T')[0]
  });

  const categories = [
    'operational',
    'administrative',
    'marketing',
    'maintenance',
    'utilities',
    'transport',
    'other'
  ];

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const records = await listAllDocuments(
        databases,
        DATABASE_ID,
        COLLECTIONS.EXPENSES,
        [Query.orderDesc('date')]
      );
      setExpenses(records);
    } catch (error) {
      toast.error('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setExpenseLoading(true);
      const payload = {
        ...formData,
        amount: parseInt(formData.amount),
        date: new Date(formData.date).toISOString(),
        createdAt: new Date().toISOString()
      };
      if (editingExpense) {
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.EXPENSES,
          editingExpense.$id,
          payload
        );
        const month = payload.date.slice(0, 7);
        const delta = payload.amount - (editingExpense.amount || 0);
        if (delta !== 0) {
          await createLedgerEntry({
            databases,
            DATABASE_ID,
            COLLECTIONS,
            entry: {
              type: 'Expense',
              amount: delta,
              month,
              year: parseInt(month.split('-')[0], 10),
              notes: `Adjustment (edit) - ${payload.category}${payload.description ? ` - ${payload.description}` : ''}`
            }
          });
        }
        toast.success('Expense updated successfully');
      } else {
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.EXPENSES,
          ID.unique(),
          payload
        );
        const month = payload.date.slice(0, 7);
        await createLedgerEntry({
          databases,
          DATABASE_ID,
          COLLECTIONS,
          entry: {
            type: 'Expense',
            amount: payload.amount,
            month,
            year: parseInt(month.split('-')[0], 10),
            notes: `${payload.category}${payload.description ? ` - ${payload.description}` : ''}`
          }
        });
        toast.success('Expense added successfully');
      }
      setFormData({
        description: '',
        amount: '',
        category: 'operational',
        date: new Date().toISOString().split('T')[0]
      });
      setEditingExpense(null);
      setShowForm(false);
      fetchExpenses();
    } catch (error) {
      toast.error(editingExpense ? 'Failed to update expense' : 'Failed to add expense');
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description || '',
      amount: String(expense.amount || ''),
      category: expense.category || 'operational',
      date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setShowForm(true);
  };

  const handleDelete = async (expense) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.EXPENSES, expense.$id);
      const month = expense.date ? expense.date.slice(0, 7) : new Date().toISOString().slice(0, 7);
      await createLedgerEntry({
        databases,
        DATABASE_ID,
        COLLECTIONS,
        entry: {
          type: 'Expense',
          amount: -(expense.amount || 0),
          month,
          year: parseInt(month.split('-')[0], 10),
          notes: `Reversal (delete) - ${expense.category}${expense.description ? ` - ${expense.description}` : ''}`
        }
      });
      toast.success('Expense deleted');
      fetchExpenses();
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const getTotalByCategory = (category) => {
    return expenses
      .filter(expense => expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0);
  };

  const getTotalExpenses = () => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Expenses Management</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <h3 className="text-sm font-medium text-red-800">Total Expenses</h3>
          <p className="text-xl font-bold text-red-900">{formatCurrency(getTotalExpenses())}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-800">Operational</h3>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(getTotalByCategory('operational'))}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-800">Administrative</h3>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(getTotalByCategory('administrative'))}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-800">Other</h3>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(getTotalByCategory('other'))}</p>
        </div>
      </div>

      {/* Expense Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {editingExpense ? 'Edit Expense' : 'Add Expense'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
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
                  disabled={expenseLoading}
                >
                  {expenseLoading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    editingExpense ? 'Update Expense' : 'Add Expense'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingExpense(null);
                    setFormData({
                      description: '',
                      amount: '',
                      category: 'operational',
                      date: new Date().toISOString().split('T')[0]
                    });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                  disabled={expenseLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense) => (
              <tr key={expense.$id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(expense.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {expense.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                    {expense.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatCurrency(expense.amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEdit(expense)}
                      className="p-2 text-blue-600 hover:text-blue-800"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense)}
                      className="p-2 text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && (
          <div className="text-center py-8 text-gray-500">No expenses found</div>
        )}
      </div>
    </div>
  );
};

export default ExpensesManagement;
