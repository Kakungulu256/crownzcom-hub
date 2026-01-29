const API_URL = import.meta.env.VITE_API_URL;

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'member' | 'admin';
}

export interface AuthResponse {
  user: User;
  token: string;
}

class AuthService {
  private token: string | null = localStorage.getItem('auth_token');

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();
    this.token = data.token;
    localStorage.setItem('auth_token', data.token);
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    this.token = data.token;
    localStorage.setItem('auth_token', data.token);
    return data;
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.token) return null;

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    if (!response.ok) {
      this.logout();
      return null;
    }

    const data = await response.json();
    return data.user;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }
}

export const authService = new AuthService();