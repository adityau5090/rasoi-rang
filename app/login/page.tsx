'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/client/api';
import { Header } from '@/components/Chrome';
import type { Me } from '@/lib/shared';

export default function Login() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const m = useMutation({
    mutationFn: () => api<Me>('/api/auth/login', { method: 'POST', body: { email, password } }),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      const next = new URLSearchParams(window.location.search).get('next');
      const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      router.replace(safe ?? (me.role === 'admin' ? '/admin' : '/kitchen'));
    },
  });
  const e = m.error instanceof ApiError ? m.error : null;
  return (
    <>
      <Header staff sub="Staff entrance" />
      <main className="shell">
        <form className="login-card" onSubmit={(ev) => { ev.preventDefault(); m.mutate(); }} noValidate>
          <h2 style={{ textAlign: 'center', color: 'var(--sindoor-deep)', marginBottom: 14 }}>Staff sign in</h2>
          {e && !e.fields.email && !e.fields.password && <div className="banner" role="alert">{e.message}</div>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(x) => setEmail(x.target.value)} aria-invalid={!!e?.fields.email} />
            {e?.fields.email && <p className="err">{e.fields.email}</p>}
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password" className="input" value={password} onChange={(x) => setPassword(x.target.value)} aria-invalid={!!e?.fields.password} />
            {e?.fields.password && <p className="err">{e.fields.password}</p>}
          </div>
          <button className="btn red block" disabled={m.isPending}>{m.isPending ? 'Signing in…' : 'Sign in'}</button>
          <p className="lbl" style={{ marginTop: 16, fontWeight: 600 }}>Demo logins (tap to fill)</p>
          <div className="demo">
            <button type="button" className="btn small teal" onClick={() => { setEmail('admin@rasoi.test'); setPassword('admin123'); }}>Admin</button>
            <button type="button" className="btn small teal" onClick={() => { setEmail('kitchen@rasoi.test'); setPassword('kitchen123'); }}>Kitchen</button>
          </div>
          <p style={{ textAlign: 'center', marginBottom: 0 }}><Link href="/">Back to the menu</Link></p>
        </form>
      </main>
    </>
  );
}
