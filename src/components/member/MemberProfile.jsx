import React, { useState, useEffect } from 'react';
import { account, databases, DATABASE_ID, COLLECTIONS } from '../../lib/appwrite';
import { useAuth } from '../../lib/auth';
import toast from 'react-hot-toast';
import { fetchMemberRecord } from '../../lib/member';

const MemberProfile = () => {
  const { user, logout } = useAuth();
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
    currentPassword: ''
  });

  useEffect(() => {
    if (user) {
      fetchMemberData();
    }
  }, [user]);

  const fetchMemberData = async () => {
    try {
      const member = await fetchMemberRecord({ databases, DATABASE_ID, COLLECTIONS, user });
      if (member) {
        setMemberData(member);
        setProfileForm({
          name: member.name || '',
          phone: member.phone || '',
          email: member.email || user.email || '',
          currentPassword: ''
        });
      }
    } catch (error) {
      toast.error('Failed to fetch profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);

    try {
      const nextEmail = profileForm.email?.trim();
      const emailChanged = nextEmail && nextEmail !== user.email;

      if (emailChanged && !profileForm.currentPassword) {
        toast.error('Enter your current password to change email.');
        return;
      }

      // Update email in Appwrite Auth first (if changed)
      if (emailChanged) {
        await account.updateEmail(nextEmail, profileForm.currentPassword);
      }

      // Update member document
      if (memberData) {
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.MEMBERS,
          memberData.$id,
          {
            name: profileForm.name,
            phone: profileForm.phone,
            email: nextEmail || profileForm.email
          }
        );
      }

      toast.success('Profile updated successfully');
      fetchMemberData();
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to logout');
    }
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
        <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Logout
        </button>
      </div>

      {/* Profile Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password (required to change email)
            </label>
            <input
              type="password"
              value={profileForm.currentPassword}
              onChange={(e) => setProfileForm({...profileForm, currentPassword: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Enter current password"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updating}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updating ? 'Updating...' : 'Update Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Account Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
        <div className="space-y-3">
          {memberData && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">Membership Number:</span>
                <span className="font-medium">{memberData.membershipNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Join Date:</span>
                <span className="font-medium">
                  {new Date(memberData.joinDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  memberData.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {memberData.status}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Account Created:</span>
            <span className="font-medium">
              {new Date(user.$createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      {/* Password changes are currently disabled in the member profile. */}

      {/* Security Tips */}
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h4 className="font-medium text-yellow-800 mb-2">Security Tips</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Use a strong password with at least 8 characters</li>
          <li>• Don't share your login credentials with anyone</li>
          <li>• Log out when using shared computers</li>
          <li>• Contact admin if you notice any suspicious activity</li>
        </ul>
      </div>
    </div>
  );
};

export default MemberProfile;
