import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export interface User {
  user_id: string;
  name: string;
  email: string;
  exam_type: string;
  subscription_status: string;
  daily_streak: number;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  loadAuth: () => Promise<void>;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (token: string, user: User) => {
    api.setToken(token);
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    api.setToken(null);
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userStr = await AsyncStorage.getItem('auth_user');
      if (token && userStr) {
        api.setToken(token);
        try {
          const me: User = await api.get('/auth/me');
          set({ token, user: me, isAuthenticated: true, isLoading: false });
        } catch {
          api.setToken(null);
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('auth_user');
          set({ isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  updateUser: (user: User) => {
    AsyncStorage.setItem('auth_user', JSON.stringify(user));
    set({ user });
  },
}));
