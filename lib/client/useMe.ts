'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api';
import type { Me } from '../shared';

export function useRequireRole(roles: Me['role'][], next: string) {
  const router = useRouter();
  const q = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/auth/me'), retry: false, staleTime: 60_000 });
  useEffect(() => {
    if (q.error instanceof ApiError && q.error.status === 401) router.replace(`/login?next=${next}`);
  }, [q.error, router, next]);
  return { me: q.data, allowed: !!q.data && roles.includes(q.data.role), loading: q.isLoading };
}
