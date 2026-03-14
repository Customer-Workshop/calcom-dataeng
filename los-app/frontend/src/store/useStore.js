import { create } from 'zustand';
import api from '../utils/api';

const useStore = create((set, get) => ({
  // Auth state
  user: JSON.parse(localStorage.getItem('los_user') || 'null'),
  token: localStorage.getItem('los_token') || null,
  isAuthenticated: !!localStorage.getItem('los_token'),

  // Application state
  applications: [],
  currentApplication: null,
  applicationsTotal: 0,
  applicationsPage: 1,

  // Pipeline state
  pipeline: [],

  // Dashboard state
  dashboard: null,

  // Loading state
  loading: false,
  error: null,

  // Auth actions
  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('los_token', data.token);
      localStorage.setItem('los_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, loading: false });
      return data.user;
    } catch (err) {
      const error = err.response?.data?.error || 'Login failed';
      set({ loading: false, error });
      throw new Error(error);
    }
  },

  register: async (userData) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', userData);
      localStorage.setItem('los_token', data.token);
      localStorage.setItem('los_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, loading: false });
      return data.user;
    } catch (err) {
      const error = err.response?.data?.error || 'Registration failed';
      set({ loading: false, error });
      throw new Error(error);
    }
  },

  logout: () => {
    localStorage.removeItem('los_token');
    localStorage.removeItem('los_user');
    set({ user: null, token: null, isAuthenticated: false, applications: [], currentApplication: null, dashboard: null });
  },

  // Application actions
  fetchApplications: async (params = {}) => {
    set({ loading: true });
    try {
      const { data } = await api.get('/applications', { params });
      set({ applications: data.data, applicationsTotal: data.total, applicationsPage: data.page, loading: false });
    } catch (err) {
      set({ loading: false, error: err.response?.data?.error });
    }
  },

  fetchApplication: async (id) => {
    set({ loading: true });
    try {
      const { data } = await api.get(`/applications/${id}`);
      set({ currentApplication: data, loading: false });
      return data;
    } catch (err) {
      set({ loading: false, error: err.response?.data?.error });
    }
  },

  createApplication: async (appData) => {
    set({ loading: true });
    try {
      const { data } = await api.post('/applications', appData);
      set({ loading: false });
      return data;
    } catch (err) {
      set({ loading: false, error: err.response?.data?.error });
      throw err;
    }
  },

  // Pipeline
  fetchPipeline: async () => {
    try {
      const { data } = await api.get('/reporting/pipeline');
      set({ pipeline: data.pipeline });
    } catch (err) {
      console.error('Pipeline fetch failed:', err);
    }
  },

  // Dashboard
  fetchDashboard: async (params = {}) => {
    set({ loading: true });
    try {
      const { data } = await api.get('/reporting/dashboard', { params });
      set({ dashboard: data, loading: false });
    } catch (err) {
      set({ loading: false, error: err.response?.data?.error });
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));

export default useStore;
