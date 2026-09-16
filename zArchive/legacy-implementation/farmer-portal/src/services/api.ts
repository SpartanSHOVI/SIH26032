import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
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
  getStates: () => api.get('/locations/states'),
  getDistricts: (state: string) => api.get('/locations/districts', { params: { state } }),
  getClassifications: () => api.get('/locations/classifications'),
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

export const centerApi = {
  getQueue: (centerId: string, date?: string) => api.get(`/centers/${centerId}/queue`, { params: { date } }),
  getAnalytics: (centerId: string, date?: string) => api.get(`/centers/${centerId}/analytics`, { params: { date } }),
  callNext: (centerId: string, date?: string) => api.post(`/centers/${centerId}/call-next`, {}, { params: { date } }),
  updateStatus: (tokenId: number, status: string, reject_reason?: string, quantity_received?: number) =>
    api.patch(`/tokens/${tokenId}/status`, { status, reject_reason, quantity_received }),
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
  getAnalytics: (params?: { date?: string; state?: string }) => api.get('/admin/analytics', { params }),
  rebalanceMandi: (data: { source_center?: string; target_center?: string; token_count?: number }) =>
    api.post('/admin/rebalance-mandi', data),
};

export const procurementApi = {
  getMyProcurement: (farmerId?: string) => api.get('/bookings/my', { params: { farmerId } }),
  getProcurementStatus: (bookingId: string) => api.get(`/tokens/${bookingId}`),
};

export const paymentApi = {
  getMyPayments: (farmerId?: string) => api.get('/bookings/my', { params: { farmerId } }),
  getPaymentStatus: (lotId: string) => api.get(`/tokens/${lotId}`),
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