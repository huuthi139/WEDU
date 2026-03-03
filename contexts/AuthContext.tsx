'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type MemberLevel = 'Free' | 'Premium' | 'VIP';
export type UserRole = 'admin' | 'user';

export interface User {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  memberLevel: MemberLevel;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isAdminRole(role: string): boolean {
  const normalized = role.toLowerCase().trim();
  const adminValues = ['admin', 'administrator', 'quản trị', 'quản trị viên', 'qtv'];
  return adminValues.some(v => normalized.includes(v));
}

function normalizeUser(raw: Record<string, string | undefined>): User {
  const role = raw.role || 'user';
  const memberLevel = raw.memberLevel || 'Free';
  return {
    name: raw.name || '',
    email: raw.email || '',
    phone: raw.phone || '',
    role: isAdminRole(role) ? 'admin' : 'user',
    memberLevel: (['Free', 'Premium', 'VIP'].includes(memberLevel) ? memberLevel : 'Free') as MemberLevel,
  };
}

async function loginViaAppsScript(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    return { success: false, error: 'Client fallback không khả dụng' };
  }

  const params = new URLSearchParams({ action: 'login', email, password });
  const url = `${scriptUrl}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    const data = await res.json();

    if (data.success && data.user) {
      return { success: true, user: normalizeUser(data.user) };
    }

    return { success: false, error: data.error || 'Đăng nhập thất bại' };
  } catch {
    return { success: false, error: 'Không thể kết nối đến hệ thống' };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function registerViaAppsScript(data: { name: string; email: string; password: string; phone?: string }): Promise<{ success: boolean; user?: User; error?: string }> {
  const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    return { success: false, error: 'Client fallback không khả dụng' };
  }

  const params = new URLSearchParams({
    action: 'register',
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone || '',
  });
  const url = `${scriptUrl}?${params.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    const result = await res.json();

    if (result.success && result.user) {
      return { success: true, user: normalizeUser(result.user) };
    }

    return { success: false, error: result.error || 'Đăng ký thất bại' };
  } catch {
    return { success: false, error: 'Không thể kết nối đến hệ thống' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage or cookie on mount
  useEffect(() => {
    try {
      let savedUser = localStorage.getItem('wepower-user');

      // Fallback: check cookie if localStorage is empty
      if (!savedUser) {
        const cookies = document.cookie.split(';');
        for (const c of cookies) {
          const trimmed = c.trim();
          if (trimmed.startsWith('wepower-user=')) {
            const encoded = trimmed.substring('wepower-user='.length);
            savedUser = atob(encoded);
            // Sync to localStorage
            if (savedUser) localStorage.setItem('wepower-user', savedUser);
            break;
          }
        }
      }

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch {
      // localStorage corrupted, start fresh
    }
    setIsLoading(false);
  }, []);

  // Save user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('wepower-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('wepower-user');
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Method 1: Server API
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success && data.user) {
        setUser(data.user);
        return { success: true };
      }

      // If server can't reach Google (503), try client-side fallback
      if (data.useClientFallback || res.status === 503) {
        const fallback = await loginViaAppsScript(email, password);
        if (fallback.success && fallback.user) {
          setUser(fallback.user);
          return { success: true };
        }
        return { success: false, error: fallback.error || 'Đăng nhập thất bại' };
      }

      return { success: false, error: data.error || 'Đăng nhập thất bại' };
    } catch {
      // Server completely unreachable - try client-side fallback
      const fallback = await loginViaAppsScript(email, password);
      if (fallback.success && fallback.user) {
        setUser(fallback.user);
        return { success: true };
      }
      return { success: false, error: fallback.error || 'Lỗi kết nối. Vui lòng thử lại.' };
    }
  };

  const register = async (regData: { name: string; email: string; password: string; phone?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      // Method 1: Server API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
      });

      const data = await res.json();

      if (data.success && data.user) {
        setUser(data.user);
        return { success: true };
      }

      // If server can't reach Google (503), try client-side fallback
      if (data.useClientFallback || res.status === 503) {
        const fallback = await registerViaAppsScript(regData);
        if (fallback.success && fallback.user) {
          setUser(fallback.user);
          return { success: true };
        }
        return { success: false, error: fallback.error || 'Đăng ký thất bại' };
      }

      return { success: false, error: data.error || 'Đăng ký thất bại' };
    } catch {
      // Server completely unreachable - try client-side fallback
      const fallback = await registerViaAppsScript(regData);
      if (fallback.success && fallback.user) {
        setUser(fallback.user);
        return { success: true };
      }
      return { success: false, error: fallback.error || 'Lỗi kết nối. Vui lòng thử lại.' };
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
