import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { databases, storage, DATABASE_ID, COLLECTIONS, DOCUMENTS_BUCKET_ID } from '../lib/appwrite';
import { fetchFinancialConfig } from '../lib/financialConfig';
import toast from 'react-hot-toast';

const Login = () => {
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const { login, loginWithGoogle, authError, clearAuthError } = useAuth();
  const requireMemberProfile = import.meta.env.VITE_REQUIRE_MEMBER_PROFILE === 'true';
  const enableEmailLogin = import.meta.env.VITE_ENABLE_EMAIL_LOGIN === 'true';

  useEffect(() => {
    if (authError) {
      toast.error(authError);
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  useEffect(() => {
    const loadLogo = async () => {
      if (!COLLECTIONS.FINANCIAL_CONFIG) return;
      try {
        const config = await fetchFinancialConfig(
          databases,
          DATABASE_ID,
          COLLECTIONS.FINANCIAL_CONFIG
        );
        if (config.logoFileId) {
          const bucketId = config.logoBucketId || DOCUMENTS_BUCKET_ID;
          setLogoUrl(storage.getFilePreview(bucketId, config.logoFileId));
        }
      } catch {
        // keep default logo
      }
    };
    loadLogo();
  }, []);

  const onGoogleSignIn = async () => {
    setLoadingGoogle(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      toast.error(error.message || 'Google sign-in failed');
      setLoadingGoogle(false);
    } finally {
      // OAuth redirects away on success.
    }
  };

  const onEmailSignIn = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }
    setLoadingEmail(true);
    try {
      await login(email, password);
    } catch (error) {
      toast.error(error.message || 'Email sign-in failed');
    } finally {
      setLoadingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4">
              <img src={logoUrl} alt="club-logo" className="h-12 w-12 object-contain" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Crownzcom Investemt Club
            </h2>
            {/* <p className="text-gray-600">
              Sign in with Google
            </p> */}
          </div>

          <div className="space-y-6">
            {enableEmailLogin && (
              <>
                <form onSubmit={onEmailSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Enter password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loadingEmail}
                    className="w-full inline-flex items-center justify-center rounded-lg bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#111a2e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingEmail ? (
                      <div className="flex items-center justify-center">
                        <div className="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                        Signing in...
                      </div>
                    ) : (
                      'Sign in with Email'
                    )}
                  </button>
                </form>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200"></div>
                  <span className="text-xs text-gray-400">OR</span>
                  <div className="h-px flex-1 bg-gray-200"></div>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={loadingGoogle}
              className="w-full inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingGoogle ? (
                <div className="flex items-center justify-center">
                  <div className="mr-2 h-5 w-5 animate-spin rounded-full border-b-2 border-gray-700"></div>
                  Signing in...
                </div>
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.7 3.5 14.6 2.6 12 2.6c-5.2 0-9.4 4.2-9.4 9.4s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.1-1.6H12z" />
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-500">
              {requireMemberProfile
                ? 'Only accounts linked to SACCO member profiles can access the system.'
                : 'Only valid Appwrite Auth accounts can access the system.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
