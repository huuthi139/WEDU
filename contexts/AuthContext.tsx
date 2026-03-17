'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';

export type MemberLevel = 'Free' | 'Premium' | 'VIP';
export type UserRole = 'admin' | 'sub_admin' | 'instructor' | 'student' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  memberLevel: MemberLevel;
  avatarUrl?: string | null;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  permissions: string[];
  status: AuthStatus;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// BroadcastChannel for multi-tab sync
const AUTH_CHANNEL = 'wedu-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Hydrate auth state from /api/auth/me (server is source of truth)
  const hydrate = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        setUser(null);
        setPermissions([]);
        setStatus('unauthenticated');
        return;
      }
      const data = await res.json();
      if (data.success && data.data?.user) {
        const u = data.data.user;
        setUser({
          id: u.id || '',
          name: u.name || '',
          email: u.email || '',
          phone: u.phone || '',
          role: u.role as UserRole || 'user',
          memberLevel: (u.memberLevel || 'Free') as MemberLevel,
          avatarUrl: u.avatarUrl || null,
        });
        setPermissions(data.data.permissions || []);
        setStatus('authenticated');
      } else {
        setUser(null);
        setPermissions([]);
        setStatus('unauthenticated');
      }
    } catch {
      setUser(null);
      setPermissions([]);
      setStatus('unauthenticated');
    }
  }, []);

  // On mount: hydrate from server
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Multi-tab sync via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'auth:logout') {
        setUser(null);
        setPermissions([]);
        setStatus('unauthenticated');
      } else if (type === 'auth:login' || type === 'profile:updated') {
        // Re-hydrate from server when another tab logs in or updates profile
        hydrate();
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [hydrate]);

  const broadcastEvent = useCallback((type: string) => {
    try {
      channelRef.current?.postMessage({ type });
    } catch {
      // BroadcastChannel may not be supported
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      let data;
      try {
        data = await res.json();
      } catch {
        return { success: false, error: 'Lỗi kết nối server.' };
      }

      if (data.success) {
        // Hydrate auth state from /api/auth/me after login
        await hydrate();
        broadcastEvent('auth:login');
        return { success: true };
      }

      return { success: false, error: data.error?.message || data.error || 'Đăng nhập thất bại' };
    } catch {
      return { success: false, error: 'Không thể kết nối đến hệ thống' };
    }
  };

  const register = async (regData: { name: string; email: string; password: string; phone?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
        credentials: 'include',
      });

      let data;
      try {
        data = await res.json();
      } catch {
        return { success: false, error: 'Lỗi kết nối server.' };
      }

      if (data.success) {
        // Hydrate auth state from /api/auth/me after registration
        await hydrate();
        broadcastEvent('auth:login');
        return { success: true };
      }

      return { success: false, error: data.error?.message || data.error || 'Đăng ký thất bại' };
    } catch {
      return { success: false, error: 'Không thể kết nối đến hệ thống' };
    }
  };

  const updateUser = useCallback((data: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...data } : null);
    broadcastEvent('profile:updated');
  }, [broadcastEvent]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Best-effort logout
    }
    setUser(null);
    setPermissions([]);
    setStatus('unauthenticated');
    // Clean up any legacy localStorage keys
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wedu-user');
      localStorage.removeItem('wedu-profile');
    }
    broadcastEvent('auth:logout');
  };

  const refreshAuth = hydrate;

  return (
    <AuthContext.Provider value={{
      user,
      permissions,
      status,
      isLoading: status === 'loading',
      login,
      register,
      logout,
      updateUser,
      refreshAuth,
    }}>
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
