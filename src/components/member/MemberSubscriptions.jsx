import React, { useState, useEffect } from 'react';
import { databases, DATABASE_ID, COLLECTIONS, Query } from '../../lib/appwrite';
import { useAuth } from '../../lib/auth';
import { formatCurrency } from '../../utils/financial';
import toast from 'react-hot-toast';
import { fetchMemberRecord } from '../../lib/member';
import { listAllDocuments } from '../../lib/pagination';

const MemberSubscriptions = () => {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);

  useEffect(() => {
    if (user) {
      fetchSubscriptions();
    }
  }, [user]);

  const fetchSubscriptions = async () => {
    try {
      const member = await fetchMemberRecord({ databases, DATABASE_ID, COLLECTIONS, user });
      if (!member) {
        setSubscriptions([]);
        return;
      }
      const subscriptions = await listAllDocuments(
        databases,
        DATABASE_ID,
        COLLECTIONS.SUBSCRIPTIONS,
        [
          Query.equal('memberId', member.$id),
          Query.orderDesc('createdAt')
        ]
      );
      setSubscriptions(subscriptions);
      const years = Array.from(
        new Set(
          subscriptions
            .map((sub) => (sub.month ? sub.month.split('-')[0] : ''))
            .filter(Boolean)
            .map((year) => parseInt(year, 10))
        )
      );
      const currentYear = new Date().getFullYear();
      const allYears = Array.from(new Set([currentYear, ...years])).sort((a, b) => b - a);
      setAvailableYears(allYears);
      if (!allYears.includes(selectedYear)) {
        setSelectedYear(allYears[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionYear = (subscription) => {
    if (!subscription) return '';
    if (typeof subscription.year === 'number' || typeof subscription.year === 'string') {
      return String(subscription.year);
    }
    if (subscription.month) return String(subscription.month).split('-')[0];
    return '';
  };

  const hasSelectedYearSubscription = () => {
    return subscriptions.some(sub => getSubscriptionYear(sub) === selectedYear.toString());
  };

  const getTotalSubscriptions = () => {
    return subscriptions.reduce((sum, sub) => sum + sub.amount, 0);
  };

  const getYearlyTotal = (year) => {
    return subscriptions
      .filter(sub => getSubscriptionYear(sub) === year.toString())
      .reduce((sum, sub) => sum + sub.amount, 0);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Subscriptions</h2>
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="form-input"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <div className="text-sm text-gray-500">
            Annual subscriptions are managed by admin
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg">
          <h3 className="text-lg font-medium">Total Subscriptions</h3>
          <p className="text-2xl font-bold">{formatCurrency(getTotalSubscriptions())}</p>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg">
          <h3 className="text-lg font-medium">{selectedYear} Total</h3>
          <p className="text-2xl font-bold">{formatCurrency(getYearlyTotal(selectedYear))}</p>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg">
          <h3 className="text-lg font-medium">{selectedYear} Status</h3>
          <p className="text-2xl font-bold">{hasSelectedYearSubscription() ? 'Paid' : 'Pending'}</p>
        </div>
      </div>

      {/* Selected Year Status */}
      <div className={`p-4 rounded-lg border ${
        hasSelectedYearSubscription()
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div>
          <h3 className={`font-medium ${
            hasSelectedYearSubscription() ? 'text-green-800' : 'text-yellow-800'
          }`}>
            {hasSelectedYearSubscription()
              ? 'Annual Subscription Paid'
              : 'Annual Subscription Pending'
            }
          </h3>
          <p className={`text-sm ${
            hasSelectedYearSubscription() ? 'text-green-600' : 'text-yellow-600'
          }`}>
            {hasSelectedYearSubscription()
              ? `Your annual subscription for ${selectedYear} has been paid`
              : `Your annual subscription for ${selectedYear} is pending. Contact admin for payment.`
            }
          </p>
        </div>
      </div>

      {/* Subscription History */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Subscription History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date Paid
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.$id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {getSubscriptionYear(subscription) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {formatCurrency(subscription.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(subscription.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {subscriptions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No subscription payments found
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberSubscriptions;
