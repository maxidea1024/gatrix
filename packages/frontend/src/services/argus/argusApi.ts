/**
 * Shared Argus axios instance and base URL constant.
 * All Argus sub-modules import from here instead of creating their own instances.
 */
import axios, { AxiosInstance } from 'axios';
import { apiService } from '../api';

// Dedicated axios instance for Argus — no baseURL prefix
export const argusApi: AxiosInstance = axios.create({
  timeout: 60000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Share the auth token from the main ApiService
argusApi.interceptors.request.use((config) => {
  const token = apiService.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Pass logged-in user name for activity tracking
  try {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      if (user?.name) {
        config.headers['x-user-name'] = user.name;
      }
    }
  } catch {
    /* ignore */
  }
  return config;
});

// Prefix for all Argus API calls
export const ARGUS_BASE = '/argus/api';
