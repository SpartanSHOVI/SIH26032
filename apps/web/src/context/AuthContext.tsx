import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface Farmer {
  id: string;
  farmerId?: string;
  farmer_id?: string;
  name: string;
  mobile?: string;
  phone?: string;
  address?: string;
  state?: string;
  district?: string;
  crop?: string;
  quantity?: number;
  bankAccount?: string;
  bank_account?: string;
  ifsc?: string;
  language?: string;
  aadhaarMasked?: string;
  phoneMasked?: string;
  stateCode?: string;
  preferredLanguage?: string;
  preferredCenterId?: string;
  centerPreferenceId?: string;
  consentGiven?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  farmer: Farmer | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (mobile: string, passwordOrOtp: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateFarmerData: (data: Partial<Farmer>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStoredAuth = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem('annsetu_token');
      const storedRefreshToken = localStorage.getItem('annsetu_refresh_token');
      const storedFarmer = localStorage.getItem('annsetu_farmer');

      if (storedToken && storedFarmer) {
        try {
          const parsedFarmer = JSON.parse(storedFarmer);
          setToken(storedToken);
          setRefreshToken(storedRefreshToken);
          setFarmer(parsedFarmer);
        } catch (parseErr) {
          localStorage.removeItem('annsetu_farmer');
          setFarmer(null);
          setToken(null);
        }
      } else {
        // No static farmer fallback: User must log in or register uniquely
        setFarmer(null);
        setToken(null);
        setRefreshToken(null);
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
      setFarmer(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  const login = async (identifier: string, passwordOrOtp: string) => {
    const cred = identifier.trim();
    const response = await api.post('/auth/login', {
      mobile: cred,
      credential: cred,
      password: passwordOrOtp || '123456',
    });

    const data = response.data;
    const farmerData: Farmer = data.farmer || data;
    const accessToken = data.accessToken || data.token || `token-${farmerData.id}`;
    const newRefreshToken = data.refreshToken || `refresh-${farmerData.id}`;
    const newCsrfToken = data.csrfToken || '';

    setToken(accessToken);
    setRefreshToken(newRefreshToken);
    setFarmer(farmerData);

    localStorage.setItem('annsetu_token', accessToken);
    localStorage.setItem('annsetu_refresh_token', newRefreshToken);
    if (newCsrfToken) localStorage.setItem('annsetu_csrf_token', newCsrfToken);
    localStorage.setItem('annsetu_farmer', JSON.stringify(farmerData));
  };

  const register = async (data: any) => {
    const payload = {
      name: data.name,
      mobile: data.mobile || data.phone,
      password: data.password || '123456',
      state: data.state || data.stateCode,
      district: data.district,
      address: data.address,
      crop: data.crop || 'Wheat',
      quantity: data.quantity ? Number(data.quantity) : 30,
      bank_account: data.bank_account || data.bankAccount,
      ifsc: data.ifsc,
      preferred_center_id: data.preferred_center_id || data.centerPreferenceId,
      language: data.language || data.preferredLanguage || 'English',
      aadhaar: data.aadhaar,
    };

    const response = await api.post('/auth/register', payload);
    const resData = response.data;
    const farmerData: Farmer = resData.farmer || resData;
    const accessToken = resData.accessToken || resData.token || `token-${farmerData.id}`;
    const newRefreshToken = resData.refreshToken || `refresh-${farmerData.id}`;
    const newCsrfToken = resData.csrfToken || '';

    setToken(accessToken);
    setRefreshToken(newRefreshToken);
    setFarmer(farmerData);

    localStorage.setItem('annsetu_token', accessToken);
    localStorage.setItem('annsetu_refresh_token', newRefreshToken);
    if (newCsrfToken) localStorage.setItem('annsetu_csrf_token', newCsrfToken);
    localStorage.setItem('annsetu_farmer', JSON.stringify(farmerData));
  };

  const logout = () => {
    setFarmer(null);
    setToken(null);
    setRefreshToken(null);
    localStorage.removeItem('annsetu_token');
    localStorage.removeItem('annsetu_refresh_token');
    localStorage.removeItem('annsetu_csrf_token');
    localStorage.removeItem('annsetu_farmer');
  };

  const refreshAuth = async () => {
    if (!refreshToken) return;
    try {
      const csrfToken = localStorage.getItem('annsetu_csrf_token');
      const response = await api.post('/auth/refresh', { refreshToken, csrfToken });
      const { accessToken, refreshToken: nextRefreshToken, csrfToken: nextCsrfToken, farmer: farmerData } = response.data;
      setToken(accessToken);
      if (nextRefreshToken) setRefreshToken(nextRefreshToken);
      if (farmerData) setFarmer(farmerData);
      localStorage.setItem('annsetu_token', accessToken);
      if (nextRefreshToken) localStorage.setItem('annsetu_refresh_token', nextRefreshToken);
      if (nextCsrfToken) localStorage.setItem('annsetu_csrf_token', nextCsrfToken);
    } catch (error) {
      logout();
    }
  };

  const updateFarmerData = (data: Partial<Farmer>) => {
    if (!farmer) return;
    const updated = { ...farmer, ...data };
    setFarmer(updated);
    localStorage.setItem('annsetu_farmer', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        farmer,
        token,
        refreshToken,
        isAuthenticated: !!farmer,
        loading,
        login,
        register,
        logout,
        refreshAuth,
        updateFarmerData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
