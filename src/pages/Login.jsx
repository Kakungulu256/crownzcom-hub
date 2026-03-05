import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import toast from 'react-hot-toast';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { loginWithGoogle, authError, clearAuthError } = useAuth();
  const requireMemberProfile = import.meta.env.VITE_REQUIRE_MEMBER_PROFILE === 'true';

  useEffect(() => {
    if (authError) {
      toast.error(authError);
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  const onGoogleSignIn = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      toast.error(error.message || 'Google sign-in failed');
      setLoading(false);
    } finally {
      // OAuth redirects away on success.
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4 bg-[#0B1220]">
              <img src="../logo.png" alt="club-logo" className="h-12 w-12 object-contain" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Crownzcom Investemt Club
            </h2>
            <p className="text-gray-600">
              Sign in with Google
            </p>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
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
