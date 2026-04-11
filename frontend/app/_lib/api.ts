import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

class ApiClient {
  private token: string | null = null;

  async init() {
    this.token = await AsyncStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      AsyncStorage.setItem('auth_token', token);
    } else {
      AsyncStorage.removeItem('auth_token');
    }
  }

  getToken() {
    return this.token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async get<T = any>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}/api${path}`, { headers: this.headers() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async post<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }
}

export const api = new ApiClient();
