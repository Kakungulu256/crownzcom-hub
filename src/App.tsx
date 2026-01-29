import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Savings from "./pages/Savings";
import Loans from "./pages/Loans";
import Transactions from "./pages/Transactions";
import Statements from "./pages/Statements";
import AdminDashboard from "./pages/admin/AdminDashboard";
import MembersPage from "./pages/admin/MembersPage";
import LoanApprovalsPage from "./pages/admin/LoanApprovalsPage";
import InterestPage from "./pages/admin/InterestPage";
import ReportsPage from "./pages/admin/ReportsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Member Routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/savings" element={<ProtectedRoute><Savings /></ProtectedRoute>} />
            <Route path="/loans" element={<ProtectedRoute><Loans /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
            <Route path="/statements" element={<ProtectedRoute><Statements /></ProtectedRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/members" element={<ProtectedRoute requireAdmin><MembersPage /></ProtectedRoute>} />
            <Route path="/admin/loans" element={<ProtectedRoute requireAdmin><LoanApprovalsPage /></ProtectedRoute>} />
            <Route path="/admin/interest" element={<ProtectedRoute requireAdmin><InterestPage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute requireAdmin><ReportsPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><SettingsPage /></ProtectedRoute>} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;