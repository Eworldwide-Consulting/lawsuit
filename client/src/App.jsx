import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import Spinner from './components/ui/Spinner';

// Public pages — eagerly loaded (first paint target)
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import TwoFactor from './pages/auth/TwoFactor';
import ForgotPassword from './pages/auth/ForgotPassword';
import AuthCallback from './pages/auth/AuthCallback';
import VerifyEmail from './pages/auth/VerifyEmail';

// Intake pages — code split (never loaded until user starts intake)
const IntakeWizard      = lazy(() => import('./pages/intake/IntakeWizard'));
const MatterDetails     = lazy(() => import('./pages/intake/MatterDetails'));
const RequiredDocuments = lazy(() => import('./pages/intake/RequiredDocuments'));

// Dashboards — code split (recharts ~220 KB only loaded for the active role)
const ClientDashboard    = lazy(() => import('./pages/dashboard/ClientDashboard'));
const AttorneyDashboard  = lazy(() => import('./pages/dashboard/AttorneyDashboard'));
const PartnerDashboard   = lazy(() => import('./pages/dashboard/PartnerDashboard'));
const ITSupportDashboard = lazy(() => import('./pages/dashboard/ITSupportDashboard'));

// App pages — code split
const Matters          = lazy(() => import('./pages/Matters'));
const MatterDetail     = lazy(() => import('./pages/MatterDetail'));
const Documents        = lazy(() => import('./pages/Documents'));
const Messages         = lazy(() => import('./pages/Messages'));
const Appointments     = lazy(() => import('./pages/Appointments'));
const Settings         = lazy(() => import('./pages/Settings'));
const CareTasks        = lazy(() => import('./pages/CareTasks'));
const Payments         = lazy(() => import('./pages/Payments'));
const Checklist        = lazy(() => import('./pages/Checklist'));
const ChecklistReview  = lazy(() => import('./pages/ChecklistReview'));
const MyCase           = lazy(() => import('./pages/MyCase'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Spinner size={8} />
  </div>
);

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!['itsupport', 'partner'].includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user?.role) return <Navigate to="/login" replace />;
  if (user.role === 'itsupport') return <ITSupportDashboard />;
  if (user.role === 'partner')   return <PartnerDashboard />;
  if (user.role === 'attorney')  return <AttorneyDashboard />;
  if (user.role === 'client')    return <ClientDashboard />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<TwoFactor />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Intake (auth required) */}
        <Route path="/intake" element={<RequireAuth><IntakeWizard /></RequireAuth>} />
        <Route path="/intake/matter-details" element={<RequireAuth><MatterDetails /></RequireAuth>} />
        <Route path="/intake/documents" element={<RequireAuth><RequiredDocuments /></RequireAuth>} />

        {/* Dashboard routes */}
        <Route path="/dashboard" element={<RequireAuth><DashboardLayout><DashboardRouter /></DashboardLayout></RequireAuth>} />
        <Route path="/matters" element={<RequireAuth><DashboardLayout><Matters /></DashboardLayout></RequireAuth>} />
        <Route path="/matters/:id" element={<RequireAuth><DashboardLayout><MatterDetail /></DashboardLayout></RequireAuth>} />
        <Route path="/my-case" element={<RequireAuth><DashboardLayout><MyCase /></DashboardLayout></RequireAuth>} />
        <Route path="/documents" element={<RequireAuth><DashboardLayout><Documents /></DashboardLayout></RequireAuth>} />
        <Route path="/messages" element={<RequireAuth><DashboardLayout><Messages /></DashboardLayout></RequireAuth>} />
        <Route path="/appointments" element={<RequireAuth><DashboardLayout><Appointments /></DashboardLayout></RequireAuth>} />
        <Route path="/open-tasks" element={<RequireAuth><DashboardLayout><CareTasks /></DashboardLayout></RequireAuth>} />
        <Route path="/care-tasks" element={<Navigate to="/open-tasks" replace />} />
        <Route path="/settings" element={<RequireAuth><DashboardLayout><Settings /></DashboardLayout></RequireAuth>} />
        <Route path="/payments" element={<RequireAuth><DashboardLayout><Payments /></DashboardLayout></RequireAuth>} />
        <Route path="/payments/success" element={<RequireAuth><DashboardLayout><Payments /></DashboardLayout></RequireAuth>} />
        <Route path="/checklist" element={<RequireAuth><DashboardLayout><Checklist /></DashboardLayout></RequireAuth>} />
        <Route path="/checklist-review" element={<RequireAuth><DashboardLayout><ChecklistReview /></DashboardLayout></RequireAuth>} />

        {/* Admin panel — itsupport and partner roles only */}
        <Route path="/admin" element={<RequireAdmin><DashboardLayout><ITSupportDashboard /></DashboardLayout></RequireAdmin>} />
        <Route path="/admin/*" element={<RequireAdmin><DashboardLayout><ITSupportDashboard /></DashboardLayout></RequireAdmin>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}