import React, { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { ID } from 'appwrite';
import { formatCurrency } from '../../utils/financial';
import toast from 'react-hot-toast';
import { listAllDocuments } from '../../lib/pagination';
import { createLedgerEntry } from '../../lib/ledger';

const SubscriptionsManagement = () => {
  const [members, setMembers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    year: new Date().getFullYear()
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, year: selectedYear }));
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      const [members, subscriptions] = await Promise.all([
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.MEMBERS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SUBSCRIPTIONS, [Query.orderDesc('createdAt')])
      ]);
      setMembers(members);
      setSubscriptions(subscriptions);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubscriptionLoading(true);
      const subscriptionData = {
        memberId: formData.memberId,
        amount: parseInt(formData.amount),
        month: `${formData.year}-12`, // Annual subscription recorded in December
        createdAt: new Date().toISOString()
      };
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.SUBSCRIPTIONS,
        ID.unique(),
        subscriptionData
      );
      await createLedgerEntry({
        databases,
        DATABASE_ID,
        COLLECTIONS,
        entry: {
          type: 'Subscription',
          amount: subscriptionData.amount,
          memberId: subscriptionData.memberId,
          month: subscriptionData.month,
          year: parseInt(subscriptionData.month.split('-')[0], 10)
        }
      });
      toast.success('Annual subscription recorded');
      setFormData({ memberId: '', amount: '', year: selectedYear });
      setShowForm(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to record subscription');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const getMemberName = (memberId) => {
    const member = members.find(m => m.$id === memberId);
    return member ? member.name : 'Unknown';
  };

  const getSubscriptionMemberId = (subscription) => {
    if (!subscription) return '';
    if (typeof subscription.memberId === 'string') return subscription.memberId;
    if (subscription.memberId && typeof subscription.memberId === 'object') {
      if (subscription.memberId.$id) return subscription.memberId.$id;
      if (subscription.memberId.id) return subscription.memberId.id;
      if (Array.isArray(subscription.memberId) && subscription.memberId[0]?.$id) {
        return subscription.memberId[0].$id;
      }
    }
    return '';
  };

  const getSubscriptionYear = (subscription) => {
    if (!subscription) return '';
    if (typeof subscription.year === 'number' || typeof subscription.year === 'string') {
      return String(subscription.year);
    }
    if (subscription.month) return String(subscription.month).split('-')[0];
    return '';
  };

  const getMemberSubscriptions = (memberId) => {
    return subscriptions.filter(sub => getSubscriptionMemberId(sub) === memberId);
  };

  const getMemberYearSubscriptions = (memberId, year) => {
    return subscriptions.filter(
      (sub) => getSubscriptionMemberId(sub) === memberId && getSubscriptionYear(sub) === year.toString()
    );
  };

  const hasYearlySubscription = (memberId, year) => {
    return subscriptions.some(sub =>
      getSubscriptionMemberId(sub) === memberId && getSubscriptionYear(sub) === year.toString()
    );
  };

  const getTotalSubscriptions = (year) => {
    return subscriptions
      .filter(sub => getSubscriptionYear(sub) === year.toString())
      .reduce((sum, sub) => sum + sub.amount, 0);
  };

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Subscriptions Management</h2>
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="form-input"
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Record Annual Subscription
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-lg font-medium text-blue-900">Total Annual Subscriptions</h3>
        <p className="text-2xl font-bold text-blue-900">{formatCurrency(getTotalSubscriptions(selectedYear))}</p>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{selectedYear} Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Paid</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => {
              const memberSubs = getMemberSubscriptions(member.$id);
              const memberYearSubs = getMemberYearSubscriptions(member.$id, selectedYear);
              const currentYearPaid = hasYearlySubscription(member.$id, selectedYear);
              const totalPaid = memberYearSubs.reduce((sum, sub) => sum + sub.amount, 0);
              
              return (
                <tr key={member.$id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-500">{member.membershipNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      currentYearPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {currentYearPaid ? 'Paid' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {formatCurrency(totalPaid)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedMember(member);
                        setFormData({ memberId: member.$id, amount: '', year: selectedYear });
                        setShowForm(true);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Record Payment
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Record Annual Subscription</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
                <select
                  value={formData.memberId}
                  onChange={(e) => setFormData({...formData, memberId: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select Member</option>
                  {members.map(member => (
                    <option key={member.$id} value={member.$id}>
                      {member.name} - {member.membershipNumber}
                    </option>
                  ))}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  disabled={subscriptionLoading}
                >
                  {subscriptionLoading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Record Subscription'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                  disabled={subscriptionLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsManagement;
