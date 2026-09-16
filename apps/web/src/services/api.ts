import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window === 'undefined' ? 'http://localhost:3000/api/v1' : '/api/v1');

function csrfToken() {
  if (typeof document === 'undefined') return '';
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith('annsetu_csrf='))
    ?.split('=')[1] ?? '';
}

type ActiveAuthSession = {
  kind: 'farmer' | 'center' | 'admin';
  token: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
};

function parsedSession(key: string): Record<string, any> | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function activeAuthSession(): ActiveAuthSession {
  if (typeof window === 'undefined') {
    return { kind: 'farmer', token: null, refreshToken: null, csrfToken: null };
  }

  const path = window.location.pathname;
  if (path.startsWith('/center')) {
    const session = parsedSession('annsetu_center_session');
    return {
      kind: 'center',
      token: session?.token ?? null,
      refreshToken: session?.refreshToken ?? null,
      csrfToken: session?.csrfToken ?? null,
    };
  }
  if (path.startsWith('/admin') || window.location.search.includes('role=admin')) {
    const session = parsedSession('annsetu_admin_session');
    return {
      kind: 'admin',
      token: session?.token ?? null,
      refreshToken: session?.refreshToken ?? null,
      csrfToken: session?.csrfToken ?? null,
    };
  }
  return {
    kind: 'farmer',
    token: localStorage.getItem('annsetu_token'),
    refreshToken: localStorage.getItem('annsetu_refresh_token'),
    csrfToken: localStorage.getItem('annsetu_csrf_token'),
  };
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const session = activeAuthSession();
  if (session.token) {
    config.headers.set('Authorization', `Bearer ${session.token}`);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // A role-specific bearer token avoids ambient-cookie identity collisions.
    // When available, pair it with the CSRF value issued for the same session.
    const csrf = session.csrfToken || (!session.token ? csrfToken() : '');
    if (csrf) config.headers.set('X-CSRF-Token', csrf);
  }

  return config;
});

export interface ApiErrorDetail {
  statusCode: number;
  error: string;
  message: string;
  details: string[];
  code?: string;
  path?: string;
}

export class ApiError extends Error {
  statusCode: number;
  error: string;
  details: string[];
  code?: string;
  path?: string;

  constructor(data: ApiErrorDetail) {
    super(data.message || `Request failed with status ${data.statusCode}`);
    this.name = 'ApiError';
    this.statusCode = data.statusCode;
    this.error = data.error;
    this.details = data.details || [];
    this.code = data.code;
    this.path = data.path;
  }
}

export function parseApiError(err: any): ApiErrorDetail {
  const status = err?.response?.status || (err?.statusCode as number) || 500;
  const data = err?.response?.data || {};
  const message = data.message || err?.message || 'An unexpected error occurred';
  const error = data.error || (status >= 500 ? 'Server Error' : 'Request Error');
  const details = Array.isArray(data.details)
    ? data.details.map(String)
    : Array.isArray(data.message)
    ? data.message.map(String)
    : [];

  return {
    statusCode: status,
    error,
    message: typeof message === 'string' ? message : JSON.stringify(message),
    details,
    code: data.code,
    path: data.path,
  };
}

export function formatApiError(err: any): string {
  const parsed = parseApiError(err);
  return `[${parsed.statusCode} ${parsed.error}] ${parsed.message}`;
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

function redirectToLogin(expiredReason = true) {
  if (typeof window === 'undefined') return;

  const currentPath = window.location.pathname;
  const query = expiredReason ? '?expired=true' : '';

  if (currentPath.startsWith('/center')) {
    localStorage.removeItem('annsetu_center_session');
    if (!currentPath.includes('/login')) {
      window.location.href = `/center/login${query}`;
    }
  } else if (currentPath.startsWith('/admin') || window.location.search.includes('role=admin')) {
    localStorage.removeItem('annsetu_admin_session');
    if (!currentPath.includes('/login')) {
      window.location.href = `/portal${query}`;
    }
  } else {
    localStorage.removeItem('annsetu_token');
    localStorage.removeItem('annsetu_refresh_token');
    localStorage.removeItem('annsetu_csrf_token');
    localStorage.removeItem('annsetu_farmer');
    if (!currentPath.includes('/login')) {
      window.location.href = `/login${query}`;
    }
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Attach parsed status details onto the error object for downstream callers
    const parsed = parseApiError(error);
    error.statusCode = parsed.statusCode;
    error.formattedMessage = formatApiError(error);
    error.details = parsed.details;
    error.code = parsed.code;

    // Handle 401 Unauthorized / Token Expiration
    if (status === 401 && originalRequest && !originalRequest._retry) {
      const isAuthUrl =
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh') ||
        originalRequest.url?.includes('/auth/register');

      if (isAuthUrl) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (newToken) {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const session = activeAuthSession();

        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken: session.refreshToken, csrfToken: session.csrfToken },
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
              ...(session.csrfToken ? { 'X-CSRF-Token': session.csrfToken } : {}),
            },
          }
        );

        const newAccessToken =
          refreshResponse.data?.accessToken ||
          refreshResponse.data?.token;

        const newRefreshToken = refreshResponse.data?.refreshToken;
        const newCsrfToken = refreshResponse.data?.csrfToken;

        if (newAccessToken && typeof window !== 'undefined') {
          if (session.kind === 'farmer') {
            localStorage.setItem('annsetu_token', newAccessToken);
            if (newRefreshToken) localStorage.setItem('annsetu_refresh_token', newRefreshToken);
            if (newCsrfToken) localStorage.setItem('annsetu_csrf_token', newCsrfToken);
          } else {
            const key = session.kind === 'center' ? 'annsetu_center_session' : 'annsetu_admin_session';
            const roleSession = parsedSession(key);
            if (roleSession) {
              roleSession.token = newAccessToken;
              if (newRefreshToken) roleSession.refreshToken = newRefreshToken;
              if (newCsrfToken) roleSession.csrfToken = newCsrfToken;
              localStorage.setItem(key, JSON.stringify(roleSession));
            }
          }
        }

        processQueue(null, newAccessToken);
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        redirectToLogin(true);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  sendOtp: (mobile: string) => api.post('/auth/request-otp', { mobile }),
  verifyOtp: (mobile: string, otp: string) => api.post('/auth/verify-otp', { mobile, otp }),
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  lookupByMobile: (mobile: string) => api.get('/farmers/lookup', { params: { mobile } }),
  getProfile: (id?: string) => api.get(id ? `/farmers/${id}` : '/auth/profile'),
  updateProfile: (data: any, id?: string) => api.patch(id ? `/farmers/${id}` : '/auth/profile', data),
};

export const locationApi = {
  getStates: async () => {
    const res = await api.get('/locations/states');
    const list = Array.isArray(res.data)
      ? res.data.map((item: any) => (typeof item === 'string' ? item : item?.state || '')).filter(Boolean)
      : [];
    return { ...res, data: list };
  },
  getDistricts: async (state: string) => {
    const res = await api.get('/locations/districts', { params: { state } });
    const list = Array.isArray(res.data)
      ? res.data.map((item: any) => (typeof item === 'string' ? item : item?.district || '')).filter(Boolean)
      : [];
    return { ...res, data: list };
  },
  getClassifications: async () => {
    const res = await api.get('/locations/classifications');
    const list = Array.isArray(res.data)
      ? res.data.map((item: any) => (typeof item === 'string' ? item : item?.classification || '')).filter(Boolean)
      : [];
    return { ...res, data: list };
  },
  getCenters: (state: string, district: string, classification?: string, search?: string) =>
    api.get('/locations/centers', { params: { state, district, classification, search } }),
};

export const bookingApi = {
  getCenters: (params?: string | { date?: string; state?: string; district?: string; classification?: string; search?: string; limit?: number }) => {
    if (typeof params === 'string') {
      return api.get('/centers', { params: { date: params } });
    }
    return api.get('/centers', { params });
  },
  getSlots: (centerId: string, date?: string) => api.get(`/centers/${centerId}/slots`, { params: { date } }),
  bookToken: (data: { farmer_id: string; center_id: string; slot_id: number; booked_via?: string }) =>
    api.post('/tokens/book', data),
  callBookToken: (data: any) => api.post('/tokens/call-book', data),
  runningLate: (tokenId: number) => api.post(`/tokens/${tokenId}/running-late`),
  getMyBookings: (farmerId?: string) => api.get('/bookings/my', { params: { farmerId } }),
};

export const queueApi = {
  getTokenDetails: (tokenId: string | number) => api.get(`/tokens/${tokenId}`),
  lookupToken: (value: string) => api.get('/tokens/lookup', { params: { value } }),
  getCenterQueue: (centerId: string, date?: string) => api.get(`/centers/${centerId}/queue`, { params: { date } }),
  getNotifications: (farmerId?: string) => api.get(farmerId ? `/farmers/${farmerId}/notifications` : '/notifications'),
};

export const publicTrackingApi = {
  lookup: (value: string) => api.get('/public/track', { params: { value } }),
};

export const staffProcurementApi = {
  // TODO(backend-1/4): swap to real POST /procurement/{id}/gate-entry once backend prompt 1/4 lands
  gateEntry: async (id: string | number) => {
    try {
      return await api.post(`/procurement/${id}/gate-entry`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        return await api.patch(`/tokens/${id}/status`, { status: 'arrived' });
      }
      throw err;
    }
  },
  // TODO(backend-1/4): swap to real POST /procurement/{id}/weighing once backend prompt 1/4 lands
  weighing: async (id: string | number, data: { gross_weight?: number; tare_weight?: number; net_weight?: number }) => {
    try {
      return await api.post(`/procurement/${id}/weighing`, data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        const net = data.net_weight != null ? data.net_weight : (data.gross_weight != null && data.tare_weight != null ? data.gross_weight - data.tare_weight : undefined);
        return await api.patch(`/tokens/${id}/status`, { status: 'verification', quantity_received: net });
      }
      throw err;
    }
  },
  // TODO(backend-1/4): swap to real POST /procurement/{id}/quality-check once backend prompt 1/4 lands
  qualityCheck: async (id: string | number, data: { moisture_percent?: number; quality_pass?: boolean; reject_reason?: string }) => {
    try {
      return await api.post(`/procurement/${id}/quality-check`, data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        const st = data.quality_pass === false ? 'rejected' : 'quality_check';
        return await api.patch(`/tokens/${id}/status`, { status: st, reject_reason: data.reject_reason });
      }
      throw err;
    }
  },
  // TODO(backend-1/4): swap to real POST /procurement/{id}/lot-accepted once backend prompt 1/4 lands
  lotAccepted: async (id: string | number) => {
    try {
      return await api.post(`/procurement/${id}/lot-accepted`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        return await api.patch(`/tokens/${id}/status`, { status: 'accepted' });
      }
      throw err;
    }
  },
  // TODO(backend-1/4): swap to real POST /procurement/{id}/reject once backend prompt 1/4 lands
  rejectLot: async (id: string | number, reason: string) => {
    try {
      return await api.post(`/procurement/${id}/reject`, { reject_reason: reason });
    } catch (err: any) {
      if (err.response?.status === 404) {
        return await api.patch(`/tokens/${id}/status`, { status: 'rejected', reject_reason: reason });
      }
      throw err;
    }
  },
};

export const centerApi = {
  getQueue: (centerId: string, date?: string) => api.get(`/centers/${centerId}/queue`, { params: { date } }),
  getAnalytics: (centerId: string, date?: string) => api.get(`/centers/${centerId}/analytics`, { params: { date } }),
  callNext: (centerId: string, date?: string) => api.post(`/centers/${centerId}/call-next`, {}, { params: { date } }),
  updateStatus: (tokenId: number, status: string, reject_reason?: string, quantity_received?: number) =>
    api.patch(`/tokens/${tokenId}/status`, { status, reject_reason, quantity_received }),
  gateEntry: (id: string | number) => staffProcurementApi.gateEntry(id),
  weighing: (id: string | number, data: any) => staffProcurementApi.weighing(id, data),
  qualityCheck: (id: string | number, data: any) => staffProcurementApi.qualityCheck(id, data),
  lotAccepted: (id: string | number) => staffProcurementApi.lotAccepted(id),
  rejectLot: (id: string | number, reason: string) => staffProcurementApi.rejectLot(id, reason),
  updatePayment: (tokenId: number, payment_method: string, payment_status: string, payment_amount?: number, transaction_ref?: string) =>
    api.patch(`/tokens/${tokenId}/payment`, { payment_method, payment_status, payment_amount, transaction_ref }),
  createAnnouncement: (centerId: string, reason: string, message: string, new_date?: string, new_time?: string) =>
    api.post(`/centers/${centerId}/announcements`, { reason, message, new_date, new_time }),
  getAnnouncements: (centerId: string) => api.get(`/centers/${centerId}/announcements`),
  getMessageLogs: (farmer_id?: string, center_id?: string) => api.get('/messages', { params: { farmer_id, center_id } }),
  operatorLogin: (data: { center_code?: string; center_id?: string; operator_id?: string; pin?: string }) =>
    api.post('/centers/operator/login', data),
};

export const adminApi = {
  getOverview: (date?: string) => api.get('/admin/overview', { params: { date } }),
  getCenters: (params?: string | { date?: string; state?: string; district?: string; classification?: string; search?: string; limit?: number }) => {
    if (typeof params === 'string') {
      return api.get('/admin/centers', { params: { date: params } });
    }
    return api.get('/admin/centers', { params });
  },
  getFarmers: () => api.get('/admin/farmers'),
  predictDemand: (centerId: string) => api.get(`/admin/centers/${centerId}/predict-demand`),
  generateSlots: (centerId: string, expected_demand: number, date?: string) =>
    api.post(`/admin/centers/${centerId}/generate-slots`, { expected_demand, date }),
  // TODO(backend-2/4): swap to real GET /admin/analytics once backend prompt 2/4 lands
  getAnalytics: async (params?: { date?: string; state?: string }) => {
    try {
      return await api.get('/admin/analytics', { params });
    } catch (err: any) {
      if (err.response?.status === 404) {
        return { data: { date: params?.date, centers: [], hourly_throughput: [], district_cpi: [] } };
      }
      throw err;
    }
  },
  rebalanceMandi: (data: { source_center?: string; target_center?: string; token_count?: number }) =>
    api.post('/admin/rebalance-mandi', data),
};

export const procurementApi = {
  // TODO(backend-1/4): swap to real GET /procurement/my once backend prompt 1/4 lands
  getMyProcurement: async (farmerId?: string) => {
    try {
      return await api.get('/procurement/my', { params: { farmerId } });
    } catch (err: any) {
      if (err.response?.status === 404) {
        return await api.get('/bookings/my', { params: { farmerId } });
      }
      throw err;
    }
  },
  // TODO(backend-1/4): swap to real GET /procurement/{bookingId} once backend prompt 1/4 lands
  getProcurementStatus: async (bookingId: string) => {
    try {
      return await api.get(`/procurement/${bookingId}`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        return await api.get(`/tokens/${bookingId}`);
      }
      throw err;
    }
  },
  getReceipt: async (id: string) => {
    return await api.get(`/procurement/${id}/receipt`);
  },
};

export const paymentApi = {
  // TODO(backend-1/4): swap to real GET /payments/my once backend prompt 1/4 lands
  getMyPayments: async (farmerId?: string) => {
    try {
      return await api.get('/payments/my', { params: { farmerId } });
    } catch (err: any) {
      if (err.response?.status === 404) {
        return await api.get('/bookings/my', { params: { farmerId } });
      }
      throw err;
    }
  },
  // TODO(backend-1/4): swap to real GET /payments/{procurementLotId} once backend prompt 1/4 lands
  getPaymentStatus: async (lotId: string) => {
    try {
      return await api.get(`/payments/${lotId}`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        return await api.get(`/tokens/${lotId}`);
      }
      throw err;
    }
  },
};

export const ussdApi = {
  dial: (data: { phoneNumber?: string; text?: string; sessionId?: string; serviceCode?: string }) =>
    api.post('/ussd', data, { headers: { 'Content-Type': 'application/json' }, responseType: 'text' }),
};

export const ivrApi = {
  call: (data: { caller_phone?: string; digits?: string; language?: string; step?: string }) =>
    api.post('/ivr/call', data),
  getAlerts: (params?: { farmer_id?: string; mobile?: string }) =>
    api.get('/ivr/alerts', { params }),
};

export const translationApi = {
  translate: (texts: string[], target: string, source = 'en') =>
    api.post('/translate', { texts, target, source }),
};

export interface MspRateItem {
  id: string;
  crop: string;
  category: string;
  season: string;
  price_per_quintal: number;
  bonus_per_quintal: number;
  effective_price: number;
  market_average: number | null;
  effective_date: string;
  is_active: boolean;
  source: string;
  updated_by: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MspAuditItem {
  id: string;
  msp_rate_id: string;
  crop: string;
  previous_price: number;
  new_price: number;
  previous_bonus: number;
  new_bonus: number;
  reason: string;
  updated_by: string;
  changed_at: string;
}

export const mspApi = {
  getAllRates: (params?: { category?: string; season?: string; active_only?: boolean; search?: string }) =>
    api.get<MspRateItem[]>('/msp', { params }),
  getRateForCrop: (crop: string) =>
    api.get<MspRateItem>(`/msp/crop/${encodeURIComponent(crop)}`),
  getAuditLogs: (params?: { crop?: string; limit?: number }) =>
    api.get<MspAuditItem[]>('/msp/audit-logs', { params }),
  createRate: (data: {
    crop: string;
    category: string;
    season: string;
    price_per_quintal: number;
    bonus_per_quintal?: number;
    market_average?: number;
    notes?: string;
  }) => api.post<MspRateItem>('/msp', data),
  updateRate: (
    id: string,
    data: {
      price_per_quintal?: number;
      bonus_per_quintal?: number;
      market_average?: number;
      season?: string;
      is_active?: boolean;
      reason: string;
      notes?: string;
    },
  ) => api.patch<MspRateItem>(`/msp/${id}`, data),
  syncOfficialBenchmarks: () =>
    api.post<{ synced_count: number; updated_crops: string[]; timestamp: string }>('/msp/sync-official'),
};

export interface CommodityRecord {
  id: number;
  cmdt_name: string;
  image_name: string | null;
  group_id: number;
  group_name: string;
  status: number | string;
}

export interface CommodityGroupRecord {
  id: number;
  name: string;
  count: number;
}

export const commodityApi = {
  getGroups: () => api.get<CommodityGroupRecord[]>('/locations/commodities/groups'),
  getCommodities: (params?: { group?: string; search?: string; limit?: number }) =>
    api.get<CommodityRecord[]>('/locations/commodities', { params }),
};
