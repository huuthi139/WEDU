'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isAdminRole } from '@/lib/utils/auth';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('wepower-user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('[AuthProvider] localStorage error:', error instanceof Error ? error.message : String(error));
    }
    setIsLoading(false);
  }, []);

  // Save user to localStorage when it changes (UI display only, not for auth)
  useEffect(() => {
    if (user) {
      localStorage.setItem('wepower-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('wepower-user');
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Server API — JWT session set via HTTP-only cookie on server side
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        return { success: false, error: 'Lỗi kết nối server.' };
      }

      if (data.success && data.user) {
        setUser(normalizeUser(data.user));
        return { success: true };
      }

      return { success: false, error: data.error || 'Đăng nhập thất bại' };
    } catch {
      return { success: false, error: 'Không thể kết nối đến hệ thống' };
    }
  };

  const register = async (regData: { name: string; email: string; password: string; phone?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      // Server API — JWT session set via HTTP-only cookie on server side
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        return { success: false, error: 'Lỗi kết nối server.' };
      }

      if (data.success && data.user) {
        setUser(normalizeUser(data.user));
        return { success: true };
      }

      return { success: false, error: data.error || 'Đăng ký thất bại' };
    } catch {
      return { success: false, error: 'Không thể kết nối đến hệ thống' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('[AuthProvider] Logout request failed:', error instanceof Error ? error.message : String(error));
    }
    setUser(null);
    localStorage.removeItem('wepower-user');
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
