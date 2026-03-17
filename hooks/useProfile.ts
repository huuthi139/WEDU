'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const profileKeys = {
  me: ['profile', 'me'] as const,
};

async function fetchProfile() {
  const res = await fetch('/api/profile', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch profile');
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.message || 'Failed to fetch profile');
  return data.data.profile;
}

async function updateProfile(updates: { name?: string; phone?: string }) {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to update profile');
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.message || 'Failed to update profile');
  return data.data.profile;
}

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: fetchProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(profileKeys.me, data);
    },
  });
}
