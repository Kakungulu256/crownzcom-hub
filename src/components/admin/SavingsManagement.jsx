import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { databases, DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { formatCurrency } from '../../utils/financial';
import { PlusIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { ID } from 'appwrite';
import toast from 'react-hot-toast';
import { listAllDocuments } from '../../lib/pagination';
import { createLedgerEntry } from '../../lib/ledger';

const SavingsManagement = () => {
  const [members, setMembers] = useState([]);
  const [savings, setSavings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [savingLoading, setSavingLoading] = useState(false);
  const [savingDeleteId, setSavingDeleteId] = useState('');
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const fetchData = async () => {
    try {
      const [members, savings] = await Promise.all([
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.MEMBERS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS)
      ]);
      
      setMembers(members);
      setSavings(savings);
    } catch (error) {
      toast.error('Failed to fetch data');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      setSavingLoading(true);
      const savingData = {
        memberId: data.memberId,
        amount: parseInt(data.amount),
        month: data.month,
        createdAt: new Date().toISOString()
      };
      
      await databases.createDocument(DATABASE_ID, COLLECTIONS.SAVINGS, ID.unique(), savingData);
      await createLedgerEntry({
        databases,
        DATABASE_ID,
        COLLECTIONS,
        entry: {
          type: 'Savings',
          amount: savingData.amount,
          memberId: savingData.memberId,
          month: savingData.month,
          year: parseInt(savingData.month.split('-')[0], 10)
        }
      });
      toast.success('Savings recorded successfully');
      reset();
      setShowAddForm(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to record savings');
      console.error('Error recording savings:', error);
    } finally {
      setSavingLoading(false);
    }
  };

  const deleteSaving = async (saving) => {
    if (!saving?.$id) return;
    if (!confirm('Delete this savings record?')) return;
    try {
      setSavingDeleteId(saving.$id);
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SAVINGS, saving.$id);
      await createLedgerEntry({
        databases,
        DATABASE_ID,
        COLLECTIONS,
        entry: {
          type: 'Savings',
          amount: -(parseInt(saving.amount) || 0),
          memberId: typeof saving.memberId === 'object' && saving.memberId ? saving.memberId.$id : saving.memberId,
          month: saving.month,
          year: parseInt(saving.month?.split('-')[0], 10) || null,
          notes: 'Savings record deleted'
        }
      });
      toast.success('Savings record deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete savings');
    } finally {
      setSavingDeleteId('');
    }
  };

  const getMemberSavings = (memberId) => {
    const memberSavings = savings.filter(saving => {
      // Handle different memberId formats
      const savingMemberId = typeof saving.memberId === 'object' && saving.memberId ? saving.memberId.$id : saving.memberId;
      return savingMemberId === memberId;
    });
    
    return memberSavings.reduce((total, saving) => {
      const amount = typeof saving.amount === 'number' ? saving.amount : parseInt(saving.amount) || 0;
      return total + amount;
    }, 0);
  };

  const getMonthlySavings = (memberId, month) => {
    const monthlySaving = savings.find(saving => {
      const savingMemberId = typeof saving.memberId === 'object' && saving.memberId ? saving.memberId.$id : saving.memberId;
      return savingMemberId === memberId && saving.month === month;
    });
    
    return monthlySaving ? (typeof monthlySaving.amount === 'number' ? monthlySaving.amount : parseInt(monthlySaving.amount) || 0) : 0;
  };

  const totalSavings = savings.reduce((total, saving) => {
    const amount = typeof saving.amount === 'number' ? saving.amount : parseInt(saving.amount) || 0;
    return total + amount;
  }, 0);

  const thisMonthSavings = savings
    .filter(saving => saving.month === selectedMonth)
    .reduce((total, saving) => {
      const amount = typeof saving.amount === 'number' ? saving.amount : parseInt(saving.amount) || 0;
      return total + amount;
    }, 0);

  if (loading) {
    return <div className="animate-pulse">Loading savings data...</div>;
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Savings Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Record and track member savings contributions
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="form-input"
            />
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Record Savings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Total Savings</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSavings)}</div>
          <div className="text-xs text-gray-400">Records: {savings.length}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Active Members</div>
          <div className="text-2xl font-bold text-blue-600">{members.length}</div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">Average Savings</div>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(members.length > 0 ? totalSavings / members.length : 0)}
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-medium text-gray-500">This Month ({selectedMonth})</div>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(thisMonthSavings)}
          </div>
          <div className="text-xs text-gray-400">
            Records: {savings.filter(s => s.month === selectedMonth).length}
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Record Savings</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Member
                </label>
                <select
                  {...register('memberId', { required: 'Please select a member' })}
                  className="form-input"
                >
                  <option value="">Select member</option>
                  {members.map((member) => (
                    <option key={member.$id} value={member.$id}>
                      {member.name} ({member.membershipNumber})
                    </option>
                  ))}
                </select>
                {errors.memberId && (
                  <p className="mt-1 text-sm text-red-600">{errors.memberId.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (UGX)
                </label>
                <input
                  {...register('amount', { required: 'Amount is required' })}
                  type="number"
                  className="form-input"
                  placeholder="Enter amount"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Month
                </label>
                <input
                  {...register('month', { required: 'Month is required' })}
                  type="month"
                  className="form-input"
                  defaultValue={selectedMonth}
                />
                {errors.month && (
                  <p className="mt-1 text-sm text-red-600">{errors.month.message}</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  reset();
                  setShowAddForm(false);
                }}
                className="btn-secondary"
                disabled={savingLoading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={savingLoading}>
                {savingLoading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Record Savings'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Membership #
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  This Month
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Savings
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Loan Eligibility
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => {
                const totalMemberSavings = getMemberSavings(member.$id);
                const monthlyAmount = getMonthlySavings(member.$id, selectedMonth);
                const loanEligibility = Math.floor(totalMemberSavings * 0.8);
                
                return (
                  <tr key={member.$id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{member.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.membershipNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatCurrency(monthlyAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                      {formatCurrency(totalMemberSavings)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-600">
                      {formatCurrency(loanEligibility)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {members.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No members found. Add members first to record savings.</p>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Savings Records ({selectedMonth})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recorded At
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {savings
                .filter(saving => saving.month === selectedMonth)
                .map((saving) => {
                  const memberId = typeof saving.memberId === 'object' && saving.memberId ? saving.memberId.$id : saving.memberId;
                  const member = members.find(m => m.$id === memberId);
                  return (
                    <tr key={saving.$id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(saving.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {saving.createdAt ? new Date(saving.createdAt).toLocaleDateString() : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => deleteSaving(saving)}
                          disabled={savingDeleteId === saving.$id}
                          className="text-red-600 hover:text-red-900"
                        >
                          {savingDeleteId === saving.$id ? (
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                          ) : (
                            'Delete'
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {savings.filter(saving => saving.month === selectedMonth).length === 0 && (
            <div className="text-center py-6 text-gray-500">No savings recorded for this month.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavingsManagement;
