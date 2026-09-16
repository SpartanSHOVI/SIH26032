import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, api } from '../services/api';
import toast from 'react-hot-toast';

export interface AdminOfficerSession {
  id: string;
  role: string;
  officer_id: string;
  name: string;
  designation: string;
  token?: string;
  refreshToken?: string;
  csrfToken?: string;
  department: string;
  zone: string;
  logged_in_at: string;
}

interface AdminAuthContextType {
  officer: AdminOfficerSession | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginAdmin: (credential?: string, password?: string) => Promise<AdminOfficerSession>;
  logoutAdmin: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'annsetu_admin_session';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [officer, setOfficer] = useState<AdminOfficerSession | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  const loginAdmin = async (credential = 'admin', password = 'admin123'): Promise<AdminOfficerSession> => {
    setLoading(true);
    try {
      const res = await authApi.login({
        credential: credential.trim(),
        password: password.trim(),
        mobile: credential.trim(),
      });

      const data = res.data;
      const accessToken = data.token || data.accessToken || (typeof data === 'string' ? data : 'admin-session-token');

      const session: AdminOfficerSession = {
        id: data.id || 'ND-HQ-01',
        role: data.role || 'ADMIN',
        officer_id: 'ND-HQ-01',
        name: 'Dr. V. K. Sharma, IAS',
        designation: 'Joint Secretary & National Nodal Officer (Procurement)',
        department: 'Department of Agriculture & Farmers Welfare, GoI',
        zone: 'Pan-India Operations',
        token: accessToken,
        refreshToken: data.refreshToken,
        csrfToken: data.csrfToken,
        logged_in_at: new Date().toISOString(),
      };

      setOfficer(session);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      toast.success('Authenticated to Nodal Officer Command Center');
      return session;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Authentication failed. Please verify credentials.';
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logoutAdmin = () => {
    setOfficer(null);
    localStorage.removeItem(STORAGE_KEY);
    toast('Nodal Officer session securely terminated.');
  };

  return (
    <AdminAuthContext.Provider
      value={{
        officer,
        isAuthenticated: !!officer,
        loading,
        loginAdmin,
        logoutAdmin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
