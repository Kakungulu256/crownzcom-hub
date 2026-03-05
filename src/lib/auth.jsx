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
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const requireMemberProfile = import.meta.env.VITE_REQUIRE_MEMBER_PROFILE === 'true';

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const accountUser = await account.get();
      if (!requireMemberProfile || !COLLECTIONS.MEMBERS) {
        setUser(accountUser);
        setAuthError('');
        return;
      }

      const member = await fetchMemberRecord({
        databases,
        DATABASE_ID,
        COLLECTIONS,
        user: accountUser
      });

      const isAdminUser = Array.isArray(accountUser.labels) && accountUser.labels.includes('admin');
      if (!member && !isAdminUser) {
        await account.deleteSession('current');
        setUser(null);
        setAuthError('Access denied. Your account is not linked to a member profile.');
        return;
      }

      setUser(accountUser);
      setAuthError('');
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      await account.createEmailSession(email, password);
      const user = await account.get();
      setUser(user);
      setAuthError('');
      return user;
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
    isAdmin: user?.labels?.includes('admin') || false,
    authError,
    clearAuthError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
