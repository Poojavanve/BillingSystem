import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { useBranchStore } from '../store/branchStore';
import toast from 'react-hot-toast';
import type { ApiErrorResponse } from './apiResponse';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/';

const axiosClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

const isLoginRequest = (url?: string) => url?.includes('/api/v1/auth/login') || false;

// Request interceptor
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const auth = useAuthStore.getState();
    const skipSessionHeaders = isLoginRequest(config.url);
    if (!skipSessionHeaders && auth.token && !auth.isSessionValid()) {
      auth.logout();
      window.location.href = '/login';
      return Promise.reject(new Error('Session expired. Please login again.'));
    }
    const token = auth.token;
    if (!skipSessionHeaders && token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const branchState = useBranchStore.getState();
    const selectedBranchId = branchState.selectedBranchId;
    if (!skipSessionHeaders && selectedBranchId) {
      config.headers['X-Branch-Id'] = String(selectedBranchId);
    }
    if (!skipSessionHeaders && branchState.selectedBranchIds.length > 0) {
      config.headers['X-Branch-Ids'] = branchState.selectedBranchIds.join(',');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      toast.error('Session expired. Please login again.');
    } else if (error.response?.data?.message) {
      const isSuperAdmin = useAuthStore.getState().user?.role?.trim().toLowerCase() === 'super admin';
      const isBranchRequired = error.response.data.message.toLowerCase().includes('branch is required');
      if (!(isSuperAdmin && isBranchRequired)) {
        toast.error(error.response.data.message);
      }
    } else if (error.message) {
      const isSuperAdmin = useAuthStore.getState().user?.role?.trim().toLowerCase() === 'super admin';
      const isBranchRequired = error.message.toLowerCase().includes('branch is required');
      if (!(isSuperAdmin && isBranchRequired)) {
        toast.error(error.message);
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default axiosClient;
