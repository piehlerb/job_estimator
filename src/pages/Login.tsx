import { useState, useEffect } from 'react';
import { LogIn, UserPlus, AlertCircle, Loader, Mail } from 'lucide-react';
import { signIn, signUp, resetPassword } from '../lib/auth';

interface LoginProps {
  onSuccess: () => void;
  onContinueOffline?: () => void;
}

export default function Login({ onSuccess, onContinueOffline }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('error_code');
    if (errorCode) {
      setMode('forgot');
      if (errorCode === 'otp_expired') {
        setError('Your password reset link has expired. Enter your email below to get a new one.');
      } else {
        setError('The reset link was invalid or already used. Request a new one below.');
      }
      // Clean error params from the URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === 'forgot') {
      if (!email) {
        setError('Please enter your email address');
        return;
      }
      setLoading(true);
      try {
        const { error: resetError } = await resetPassword(email);
        if (resetError) {
          setError(resetError.message);
        } else {
          setSuccess('Check your email for a password reset link.');
          setEmail('');
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Validation
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { user, error: signUpError } = await signUp(email, password);

        if (signUpError) {
          setError(signUpError.message);
        } else if (user) {
          setSuccess('Account created! Please check your email to verify your account.');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setTimeout(() => {
            setMode('login');
            setSuccess(null);
          }, 2000);
        }
      } else {
        const { user, error: signInError } = await signIn(email, password);

        if (signInError) {
          setError(signInError.message);
        } else if (user) {
          setSuccess('Login successful!');
          setTimeout(() => {
            onSuccess();
          }, 500);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Job Estimator</h1>
          <p className="text-slate-400">Sign in to sync your data across devices</p>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Mode Toggle (hidden in forgot mode) */}
          {mode !== 'forgot' && (
            <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 py-2 rounded-md font-medium transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 py-2 rounded-md font-medium transition-colors ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Forgot password heading */}
          {mode === 'forgot' && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-800">Reset your password</h2>
              <p className="text-sm text-slate-500 mt-1">We'll send a reset link to your email.</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                disabled={loading}
                required
              />
            </div>

            {/* Password (hidden in forgot mode) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-xs text-gf-lime hover:text-gf-dark-green"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  disabled={loading}
                  required
                  minLength={6}
                />
              </div>
            )}

            {/* Confirm Password (Signup only) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gf-lime focus:border-transparent"
                  disabled={loading}
                  required
                  minLength={6}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gf-lime text-white rounded-lg font-medium hover:bg-gf-dark-green transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  <span>
                    {mode === 'login' ? 'Signing in...' : mode === 'forgot' ? 'Sending...' : 'Creating account...'}
                  </span>
                </>
              ) : (
                <>
                  {mode === 'login' && <><LogIn size={18} /><span>Sign In</span></>}
                  {mode === 'signup' && <><UserPlus size={18} /><span>Create Account</span></>}
                  {mode === 'forgot' && <><Mail size={18} /><span>Send Reset Email</span></>}
                </>
              )}
            </button>

            {/* Back to login in forgot mode */}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccess(null);
                }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 text-center"
              >
                Back to login
              </button>
            )}
          </form>

          {/* Offline Mode Option */}
          {onContinueOffline && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">Or</span>
                </div>
              </div>

              <button
                onClick={onContinueOffline}
                className="w-full px-4 py-2 text-slate-600 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                Continue Offline
              </button>
              <p className="text-xs text-slate-500 text-center mt-2">
                Use the app without syncing across devices
              </p>
            </>
          )}
        </div>

        {/* Help Text */}
        {mode !== 'forgot' && (
          <p className="text-center text-sm text-slate-400 mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-gf-lime hover:text-gf-lime font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
