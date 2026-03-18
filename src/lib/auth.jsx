import { createContext, useContext, useEffect, useState } from 'react';
import { account, databases, DATABASE_ID, COLLECTIONS } from '../lib/appwrite';
import { fetchMemberRecord } from './member';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const requireMemberProfile = import.meta.env.VITE_REQUIRE_MEMBER_PROFILE === 'true';

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const accountUser = await account.get();
      const member = COLLECTIONS.MEMBERS
        ? await fetchMemberRecord({
            databases,
            DATABASE_ID,
            COLLECTIONS,
            user: accountUser
          })
        : null;

      const roleSet = new Set();
      const userLabels = Array.isArray(accountUser.labels) ? accountUser.labels : [];
      if (userLabels.includes('admin')) roleSet.add('admin');
      if (userLabels.includes('member')) roleSet.add('member');
      if (member) roleSet.add('member');

      const isAdminUser = roleSet.has('admin');
      if (requireMemberProfile && !member && !isAdminUser) {
        await account.deleteSession('current');
        setUser(null);
        setRoles([]);
        setAuthError('Access denied. Your account is not linked to a member profile.');
        return;
      }

      setUser(accountUser);
      setRoles([...roleSet]);
      setAuthError('');
    } catch (error) {
      setUser(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      await account.createEmailSession(email, password);
      await checkAuth();
      return await account.get();
    } catch (error) {
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    const origin = window.location.origin;
    const successUrl = import.meta.env.VITE_APPWRITE_OAUTH_SUCCESS_URL || `${origin}/`;
    const failureUrl = import.meta.env.VITE_APPWRITE_OAUTH_FAILURE_URL || `${origin}/login?auth=failed`;
    await account.createOAuth2Session('google', successUrl, failureUrl);
  };

  const logout = async () => {
    try {
      await account.deleteSession('current');
      setUser(null);
      setRoles([]);
      setAuthError('');
    } catch (error) {
      throw error;
    }
  };

  const clearAuthError = () => setAuthError('');

  const value = {
    user,
    login,
    loginWithGoogle,
    logout,
    loading,
    roles,
    isAdmin: roles.includes('admin'),
    isMember: roles.includes('member'),
    authError,
    clearAuthError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
