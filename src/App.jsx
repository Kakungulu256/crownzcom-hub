import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './lib/auth';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import MemberDashboard from './pages/MemberDashboard';
import LoadingSpinner from './components/LoadingSpinner';

const ProtectedRoute = ({ children, adminOnly = false, memberOnly = false }) => {
  const { user, loading, isAdmin, isMember } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to={isMember ? "/member" : "/login"} />;
  if (memberOnly && !isMember) return <Navigate to={isAdmin ? "/admin" : "/login"} />;
  
  return children;
};

const AppRoutes = () => {
  const { user, loading, isAdmin, isMember } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <Routes>
      <Route
        path="/login"
        element={
          !user
            ? <Login />
            : <Navigate to={isAdmin ? "/admin" : "/member"} />
        }
      />
      <Route path="/admin/*" element={
        <ProtectedRoute adminOnly>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route
        path="/member/*"
        element={
          <ProtectedRoute memberOnly>
            <MemberDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <Navigate to={user ? (isAdmin ? "/admin" : "/member") : "/login"} />
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <AppRoutes />
          <Toaster position="top-right" />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;