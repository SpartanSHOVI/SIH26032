import React, { createContext, useContext, useState } from 'react';
import { centerApi } from '../services/api';
import toast from 'react-hot-toast';

export interface CenterOperatorSession {
  center_id: string;
  center_code: string;
  center_name: string;
  name?: string;
  classification: string;
  state: string;
  district: string;
  location?: string;
  capacity_per_hour?: number;
  counters?: number;
  avg_processing_min?: number;
  operator_id: string;
  operator_name?: string;
  token?: string;
  logged_in_at?: string;
}

interface CenterAuthContextType {
  currentCenter: CenterOperatorSession | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginAsCenter: (data: { center_code?: string; center_id?: string; operator_id?: string; pin?: string; operator_name?: string }) => Promise<CenterOperatorSession>;
  logoutCenter: () => void;
  setDirectCenter: (session: CenterOperatorSession) => void;
}

const CenterAuthContext = createContext<CenterAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'annsetu_center_session';

export function CenterAuthProvider({ children }: { children: React.ReactNode }) {
  const [currentCenter, setCurrentCenter] = useState<CenterOperatorSession | null>(() => {
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

  const loginAsCenter = async (params: { center_code?: string; center_id?: string; operator_id?: string; pin?: string; operator_name?: string }) => {
    setLoading(true);
    try {
      const res = await centerApi.operatorLogin(params);
      const session: CenterOperatorSession = {
        ...res.data,
        name: res.data.center_name,
        operator_name: params.operator_name || params.operator_id || 'APMC Officer',
      };
      setCurrentCenter(session);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      toast.success(`Logged in to ${session.center_name} [${session.classification || 'APMC Yard'}]`);
      return session;
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to authenticate procurement center.';
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const setDirectCenter = (session: CenterOperatorSession) => {
    setCurrentCenter(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    toast.success(`Active Mandi: ${session.center_name} [${session.classification || 'APMC'}]`);
  };

  const logoutCenter = () => {
    setCurrentCenter(null);
    localStorage.removeItem(STORAGE_KEY);
    toast('Procurement center session terminated.');
  };

  return (
    <CenterAuthContext.Provider
      value={{
        currentCenter,
        isAuthenticated: !!currentCenter,
        loading,
        loginAsCenter,
        logoutCenter,
        setDirectCenter,
      }}
    >
      {children}
    </CenterAuthContext.Provider>
  );
}

export function useCenterAuth() {
  const context = useContext(CenterAuthContext);
  if (!context) {
    throw new Error('useCenterAuth must be used within a CenterAuthProvider');
  }
  return context;
}
