import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { account, databases, DATABASE_ID, ALLOWED_EMAILS_COLLECTION_ID } from '@/lib/appwrite';
import { Models } from 'appwrite';

interface AuthContextType {
  user: Models.User<Models.Preferences> | null;
  isAdmin: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkIfAdmin = async (email: string) => {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        ALLOWED_EMAILS_COLLECTION_ID
      );
      return response.documents.some((doc: any) => doc.email === email && doc.isAdmin);
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };

  const checkAuth = async () => {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
      const adminStatus = await checkIfAdmin(currentUser.email);
      setIsAdmin(adminStatus);
    } catch (error) {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      await account.createOAuth2Session('google', `${window.location.origin}/auth/callback`);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await account.deleteSession('current');
      setUser(null);
      setIsAdmin(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};