import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import FarmerLayout from './components/FarmerLayout';
import CenterLayout from './components/CenterLayout';
import AdminLayout from './components/AdminLayout';
import PortalGateway from './pages/PortalGateway';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Booking from './pages/Booking';
import QueueStatus from './pages/QueueStatus';
import ProcurementStatus from './pages/ProcurementStatus';
import PaymentStatus from './pages/PaymentStatus';
import Profile from './pages/Profile';
import CenterDashboard from './pages/CenterDashboard';
import CenterLogin from './pages/CenterLogin';
import AdminDashboard from './pages/AdminDashboard';
import { useAuth } from './hooks/useAuth';
import { CenterAuthProvider } from './context/CenterAuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <CenterAuthProvider>
        <Routes>
          {/* Role Portal Gateway (separate entry point) */}
          <Route path="/" element={<PortalGateway />} />
          <Route path="/portal" element={<PortalGateway />} />

          {/* Public Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Center Operator Login Gateway */}
          <Route path="/center/login" element={<CenterLogin />} />
          
          {/* 1. SEPARATE FARMER PORTAL PATH: /farmer/* (with dedicated FarmerLayout) */}
          <Route element={<ProtectedRoute><FarmerLayout /></ProtectedRoute>}>
            <Route path="/farmer" element={<Navigate to="/farmer/dashboard" replace />} />
            <Route path="/farmer/dashboard" element={<Dashboard />} />
            <Route path="/farmer/booking" element={<Booking />} />
            <Route path="/farmer/queue" element={<QueueStatus />} />
            <Route path="/farmer/procurement" element={<ProcurementStatus />} />
            <Route path="/farmer/payment" element={<PaymentStatus />} />
            <Route path="/farmer/profile" element={<Profile />} />

            {/* Backward compatibility aliases */}
            <Route path="/dashboard" element={<Navigate to="/farmer/dashboard" replace />} />
            <Route path="/booking" element={<Navigate to="/farmer/booking" replace />} />
            <Route path="/queue" element={<Navigate to="/farmer/queue" replace />} />
            <Route path="/procurement" element={<Navigate to="/farmer/procurement" replace />} />
            <Route path="/payment" element={<Navigate to="/farmer/payment" replace />} />
            <Route path="/profile" element={<Navigate to="/farmer/profile" replace />} />
          </Route>

          {/* 2. SEPARATE PROCUREMENT CENTER TERMINAL PATH: /center (with dedicated CenterLayout) */}
          <Route element={<CenterLayout />}>
            <Route path="/center" element={<CenterDashboard />} />
            <Route path="/procurement-center" element={<Navigate to="/center" replace />} />
          </Route>

          {/* 3. SEPARATE NODAL OFFICER COMMAND PATH: /admin (with dedicated AdminLayout) */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/nodal-officer" element={<Navigate to="/admin" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CenterAuthProvider>

      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f172a',
            color: '#fff',
            borderRadius: '0.75rem',
            padding: '0.85rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;