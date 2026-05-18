import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import Spinner from './components/ui/Spinner';

// Public pages
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import TwoFactor from './pages/auth/TwoFactor';
import ForgotPassword from './pages/auth/ForgotPassword';
import AuthCallback from './pages/auth/AuthCallback';

// Intake pages
import IntakeWizard from './pages/intake/IntakeWizard';
import MatterDetails from './pages/intake/MatterDetails';
import RequiredDocuments from './pages/intake/RequiredDocuments';

// Dashboards
import ClientDashboard from './pages/dashboard/ClientDashboard';
import AttorneyDashboard from './pages/dashboard/AttorneyDashboard';
import PartnerDashboard from './pages/dashboard/PartnerDashboard';

// App pages
import Matters from './pages/Matters';
import MatterDetail from './pages/MatterDetail';
import Documents from './pages/Documents';
import Messages from './pages/Messages';
import Appointments from './pages/Appointments';
import Settings from './pages/Settings';
import CareTasks from './pages/CareTasks';
import Payments from './pages/Payments';

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={8} /></div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (user?.role === 'partner') return <PartnerDashboard />;
  if (user?.role === 'attorney') return <AttorneyDashboard />;
  return <ClientDashboard />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<TwoFactor />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Intake (auth required) */}
      <Route path="/intake" element={<RequireAuth><IntakeWizard /></RequireAuth>} />
      <Route path="/intake/matter-details" element={<RequireAuth><MatterDetails /></RequireAuth>} />
      <Route path="/intake/documents" element={<RequireAuth><RequiredDocuments /></RequireAuth>} />

      {/* Dashboard routes */}
      <Route path="/dashboard" element={<RequireAuth><DashboardLayout><DashboardRouter /></DashboardLayout></RequireAuth>} />
      <Route path="/matters" element={<RequireAuth><DashboardLayout><Matters /></DashboardLayout></RequireAuth>} />
      <Route path="/matters/:id" element={<RequireAuth><DashboardLayout><MatterDetail /></DashboardLayout></RequireAuth>} />
      <Route path="/my-case" element={<RequireAuth><DashboardLayout><MatterDetail /></DashboardLayout></RequireAuth>} />
      <Route path="/documents" element={<RequireAuth><DashboardLayout><Documents /></DashboardLayout></RequireAuth>} />
      <Route path="/messages" element={<RequireAuth><DashboardLayout><Messages /></DashboardLayout></RequireAuth>} />
      <Route path="/appointments" element={<RequireAuth><DashboardLayout><Appointments /></DashboardLayout></RequireAuth>} />
      <Route path="/care-tasks" element={<RequireAuth><DashboardLayout><CareTasks /></DashboardLayout></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><DashboardLayout><Settings /></DashboardLayout></RequireAuth>} />
      <Route path="/payments" element={<RequireAuth><DashboardLayout><Payments /></DashboardLayout></RequireAuth>} />
      <Route path="/payments/success" element={<RequireAuth><DashboardLayout><Payments /></DashboardLayout></RequireAuth>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
