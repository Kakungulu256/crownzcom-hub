import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { databases, DATABASE_ID, COLLECTIONS, functions } from '../../lib/appwrite';
import { listAllDocuments } from '../../lib/pagination';
import { ID } from 'appwrite';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { Query } from 'appwrite';

const MembersManagement = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [memberDetails, setMemberDetails] = useState({
    savings: [],
    loans: [],
    repayments: [],
    charges: []
  });
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const members = await listAllDocuments(databases, DATABASE_ID, COLLECTIONS.MEMBERS);
      console.log('📋 Fetched members:', members);
      console.log('📋 First member $id:', members[0]?.$id);
      console.log('📋 First member full object:', members[0]);
      setMembers(members);
    } catch (error) {
      toast.error('Failed to fetch members');
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
  try {
    setIsSavingMember(true);
    if (editingMember) {
      // Update existing member
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.MEMBERS, editingMember.$id, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        membershipNumber: data.membershipNumber,
        joinDate: data.joinDate || editingMember.joinDate || null
      });
      toast.success('Member updated successfully');
    } else {
      // Create new member using Appwrite Function
      try {
        const response = await functions.createExecution(
          import.meta.env.VITE_APPWRITE_FUNCTION_ID,
          JSON.stringify({
            name: data.name,
            email: data.email,
            password: data.password,
            phone: data.phone,
            membershipNumber: data.membershipNumber,
            joinDate: data.joinDate || new Date().toISOString().split('T')[0]
          })
        );
        
        const result = JSON.parse(response.responseBody);
        console.log('Function result:', result); // DEBUG: Check what's returned
        
        if (result.success) {
          toast.success('Member and auth account created successfully');
          
          // Add a small delay to ensure database is updated
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          throw new Error(result.error || 'Function execution failed');
        }
      } catch (functionError) {
        console.warn('Function failed, creating database record only:', functionError);
        
        const memberData = {
          name: data.name,
          email: data.email,
          phone: data.phone,
          membershipNumber: data.membershipNumber,
          joinDate: data.joinDate || new Date().toISOString().split('T')[0],
          status: 'active'
        };
        
        await databases.createDocument(DATABASE_ID, COLLECTIONS.MEMBERS, ID.unique(), memberData);
        toast.success('Member added to database (function failed)');
      }
    }
    
    reset();
    setShowAddForm(false);
    setEditingMember(null);
    await fetchMembers(); // Ensure this completes
  } catch (error) {
    toast.error(editingMember ? 'Failed to update member' : 'Failed to add member');
    console.error('Error saving member:', error);
  } finally {
    setIsSavingMember(false);
  }
};

  const openMemberDetails = async (member) => {
    setSelectedMember(member);
    setShowMemberDetails(true);
    try {
      const [savings, loans, repayments, charges] = await Promise.all([
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.SAVINGS, [
          Query.equal('memberId', member.$id)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOANS, [
          Query.equal('memberId', member.$id)
        ]),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS),
        listAllDocuments(databases, DATABASE_ID, COLLECTIONS.LOAN_CHARGES)
      ]);

      const loanIds = new Set(loans.map(l => l.$id));
      setMemberDetails({
        savings,
        loans,
        repayments: repayments.filter(r => loanIds.has(r.loanId?.$id || r.loanId)),
        charges: charges.filter(c => loanIds.has(c.loanId?.$id || c.loanId))
      });
    } catch (error) {
      toast.error('Failed to load member details');
    }
  };

  const getLoanLabelMap = (loanList) => {
    return loanList
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .reduce((acc, loan, index) => {
        acc[loan.$id] = `Loan_${index + 1}`;
        return acc;
      }, {});
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    reset({
      name: member.name,
      email: member.email,
      phone: member.phone,
      membershipNumber: member.membershipNumber,
      joinDate: member.joinDate ? new Date(member.joinDate).toISOString().split('T')[0] : ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (member) => {
    if (!confirm('Are you sure you want to delete this member?')) return;
    
    try {
      try {
        const response = await functions.createExecution(
          import.meta.env.VITE_APPWRITE_FUNCTION_ID,
          JSON.stringify({
            action: 'delete',
            memberId: member.$id,
            authUserId: member.authUserId || null
          })
        );
        const result = JSON.parse(response.responseBody || '{}');
        if (!result.success) {
          throw new Error(result.error || 'Deletion function failed');
        }
      } catch (functionError) {
        console.warn('Function failed, deleting member record only:', functionError);
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.MEMBERS, member.$id);
      }
      toast.success('Member deleted successfully');
      fetchMembers();
    } catch (error) {
      toast.error('Failed to delete member');
      console.error('Error deleting member:', error);
    }
  };

  const cancelForm = () => {
    reset();
    setShowAddForm(false);
    setEditingMember(null);
  };

  if (loading) {
    return <div className="animate-pulse">Loading members...</div>;
  }

  

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage SACCO members and their accounts
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Member
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="card mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingMember ? 'Edit Member' : 'Add New Member'}
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  className="form-input"
                  placeholder="Enter full name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^\S+@\S+$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  type="email"
                  className="form-input"
                  placeholder="Enter email address"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  {...register('phone', { required: 'Phone number is required' })}
                  className="form-input"
                  placeholder="Enter phone number"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Membership Number
                </label>
                <input
                  {...register('membershipNumber', { required: 'Membership number is required' })}
                  className="form-input"
                  placeholder="Enter membership number"
                />
                {errors.membershipNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.membershipNumber.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Join Date
                </label>
                <input
                  {...register('joinDate')}
                  type="date"
                  className="form-input"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Optional. Use to backfill historical members.
                </p>
              </div>
              
              {!editingMember && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Password
                  </label>
                  <input
                    {...register('password', { 
                      required: !editingMember ? 'Password is required' : false,
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters'
                      }
                    })}
                    type="password"
                    className="form-input"
                    placeholder="Enter initial password"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={cancelForm}
                className="btn-secondary"
                disabled={isSavingMember}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary flex items-center justify-center" disabled={isSavingMember}>
                {isSavingMember && (
                  <span className="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                )}
                {editingMember ? (isSavingMember ? 'Updating...' : 'Update Member') : (isSavingMember ? 'Adding...' : 'Add Member')}
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
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Membership #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {members.map((member) => (
                <tr key={member.$id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-semibold text-sm">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                      <button
                        onClick={() => openMemberDetails(member)}
                        className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                        title="View member details"
                      >
                        {member.name}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{member.email}</div>
                    <div className="text-sm text-gray-500">{member.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {member.membershipNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {member.joinDate ? new Date(member.joinDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`badge ${
                      member.status === 'active' 
                        ? 'badge-success' 
                        : 'badge-danger'
                    }`}>
                      {member.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit member"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openMemberDetails(member)}
                        className="p-2 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="View details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {members.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No members found. Add your first member to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Member Details Modal */}
      {showMemberDetails && selectedMember && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-5xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Member Details - {selectedMember.name}
              </h3>
              <button
                onClick={() => setShowMemberDetails(false)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(() => {
                const loanLabelMap = getLoanLabelMap(memberDetails.loans);
                const getLoanLabel = (loanId) => loanLabelMap[loanId?.$id || loanId] || 'Loan';

                return (
                  <>
              <div className="card">
                <h4 className="text-md font-semibold text-gray-900 mb-3">Savings</h4>
                {memberDetails.savings.length === 0 ? (
                  <div className="text-sm text-gray-500">No savings records.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {memberDetails.savings.map(s => (
                          <tr key={s.$id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{s.month}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{s.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card">
                <h4 className="text-md font-semibold text-gray-900 mb-3">Loans</h4>
                {memberDetails.loans.length === 0 ? (
                  <div className="text-sm text-gray-500">No loans recorded.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {memberDetails.loans.map(l => (
                          <tr key={l.$id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{l.amount}</td>
                            <td className="px-4 py-2 text-center text-sm">{l.status}</td>
                            <td className="px-4 py-2 text-center text-sm">{l.balance || l.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card">
                <h4 className="text-md font-semibold text-gray-900 mb-3">Repayments</h4>
                {memberDetails.repayments.length === 0 ? (
                  <div className="text-sm text-gray-500">No repayments recorded.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loan</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Month</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {memberDetails.repayments.map(r => (
                          <tr key={r.$id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{getLoanLabel(r.loanId)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{r.amount}</td>
                            <td className="px-4 py-2 text-sm text-center">{r.month}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card">
                <h4 className="text-md font-semibold text-gray-900 mb-3">Charges</h4>
                {memberDetails.charges.length === 0 ? (
                  <div className="text-sm text-gray-500">No charges recorded.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loan</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {memberDetails.charges.map(c => (
                          <tr key={c.$id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{getLoanLabel(c.loanId)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{c.amount}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{c.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersManagement;
