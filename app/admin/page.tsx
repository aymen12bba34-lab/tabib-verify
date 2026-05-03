'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Session {
  id: string;
  partner_ref: string;
  status: string;
  trust_score: number;
  full_name: string;
  cnom_number: string;
  specialty: string;
  wilaya_name: string;
  otp_verified: boolean;
  cnom_verified: boolean;
  face_verified: boolean;
  face_method: string | null;
  nfc_verified: boolean;
  document_verified: boolean;
  document_nin_match: boolean;
  created_at: string;
  completed_at: string | null;
}

type Tab = 'pending' | 'verified' | 'rejected' | 'all';

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [stats, setStats] = useState({ pending: 0, verified: 0, rejected: 0, total: 0 });

  // ─── Login ──────────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setLoggedIn(true);
        setPassword('');
      } else {
        const data = await res.json();
        setLoginError(data.message || 'Mot de passe incorrect');
      }
    } catch {
      setLoginError('Erreur de connexion');
    }
  }

  // ─── Fetch sessions ─────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions?tab=${tab}`);
      if (res.status === 401) {
        setLoggedIn(false);
        return;
      }
      const data = await res.json();
      setSessions(data.sessions || []);
      setStats(data.stats || { pending: 0, verified: 0, rejected: 0, total: 0 });
    } catch {
      console.error('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (loggedIn) fetchSessions();
  }, [loggedIn, tab, fetchSessions]);

  // ─── Approve / Reject ───────────────────────────────────────────────────────

  async function handleAction(sessionId: string, action: 'approve' | 'reject') {
    if (actionLoading) return;

    const confirmMsg = action === 'approve'
      ? 'Approuver cette vérification ?'
      : 'Rejeter cette vérification ?';
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(sessionId);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/${action}`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchSessions(); // Refresh the list
      } else {
        const data = await res.json();
        alert(data.message || 'Erreur');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setActionLoading(null);
    }
  }

  // ─── Login screen ──────────────────────────────────────────────────────────

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-4 shadow-lg shadow-blue-500/25">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">TabibVerify Admin</h1>
            <p className="text-sm text-slate-400 mt-1">Panneau d&apos;administration</p>
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Mot de passe administrateur
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoFocus
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {loginError && (
              <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                <span>⚠</span> {loginError}
              </p>
            )}
            <button
              type="submit"
              className="mt-4 w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 active:scale-[0.98]"
            >
              Se connecter
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  const tabConfig: { key: Tab; label: string; color: string; count: number }[] = [
    { key: 'pending',  label: 'En attente',  color: 'amber',  count: stats.pending },
    { key: 'verified', label: 'Approuvées',  color: 'green',  count: stats.verified },
    { key: 'rejected', label: 'Rejetées',    color: 'red',    count: stats.rejected },
    { key: 'all',      label: 'Toutes',      color: 'slate',  count: stats.total },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TabibVerify Admin</h1>
              <p className="text-xs text-slate-400">Gestion des vérifications</p>
            </div>
          </div>
          <button
            onClick={() => { setLoggedIn(false); document.cookie = 'admin_token=; path=/; max-age=0'; }}
            className="text-sm text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/10"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {tabConfig.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`p-4 rounded-2xl border transition-all text-left ${
                tab === t.key
                  ? 'bg-white/10 border-white/20 shadow-lg'
                  : 'bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/10'
              }`}
            >
              <p className="text-xs text-slate-400 font-medium">{t.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{t.count}</p>
            </button>
          ))}
        </div>

        {/* Session table */}
        {loading ? (
          <div className="text-center py-16">
            <svg className="animate-spin w-8 h-8 text-blue-400 mx-auto" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-slate-400 mt-3">Chargement...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-slate-400">Aucune session {tab === 'pending' ? 'en attente' : ''}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <div
                key={s.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 transition"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Doctor info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-white truncate">
                        {s.full_name || 'Inconnu'}
                      </h3>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>CNOM: <span className="text-slate-300">{s.cnom_number || '—'}</span></span>
                      <span>Spécialité: <span className="text-slate-300">{s.specialty || '—'}</span></span>
                      <span>Wilaya: <span className="text-slate-300">{s.wilaya_name || '—'}</span></span>
                    </div>

                    {/* Trust signals */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Signal label="OTP" ok={s.otp_verified} />
                      <Signal label="CNOM" ok={s.cnom_verified} />
                      <Signal label="Doc OCR" ok={s.document_verified} />
                      <Signal label="NIN ✓" ok={s.document_nin_match} />
                      <Signal label={s.face_method === 'mediapipe_headnod' ? 'Face MP' : 'Face'} ok={s.face_verified} />
                      <Signal label="NFC" ok={s.nfc_verified} />
                    </div>
                  </div>

                  {/* Right: Score + Actions */}
                  <div className="flex items-center gap-4">
                    {/* Score circle */}
                    <div className="flex flex-col items-center">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2 ${
                        s.trust_score >= 70
                          ? 'text-green-400 border-green-500/40 bg-green-500/10'
                          : s.trust_score >= 40
                            ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                            : 'text-red-400 border-red-500/40 bg-red-500/10'
                      }`}>
                        {s.trust_score}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1">score</span>
                    </div>

                    {/* Action buttons (only for pending) */}
                    {s.status === 'pending' && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleAction(s.id, 'approve')}
                          disabled={actionLoading === s.id}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-50 shadow-lg shadow-green-600/20"
                        >
                          {actionLoading === s.id ? '...' : '✓ Approuver'}
                        </button>
                        <button
                          onClick={() => handleAction(s.id, 'reject')}
                          disabled={actionLoading === s.id}
                          className="px-4 py-2 bg-red-600/80 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                        >
                          {actionLoading === s.id ? '...' : '✗ Rejeter'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: timestamps + session ID */}
                <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-x-4 text-[11px] text-slate-500">
                  <span>ID: {s.id.slice(0, 12)}…</span>
                  <span>Créé: {new Date(s.created_at).toLocaleString('fr-FR')}</span>
                  {s.completed_at && (
                    <span>Terminé: {new Date(s.completed_at).toLocaleString('fr-FR')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Refresh button */}
        <div className="mt-6 text-center">
          <button
            onClick={fetchSessions}
            className="text-sm text-slate-400 hover:text-white transition px-4 py-2 rounded-lg hover:bg-white/10"
          >
            ↻ Actualiser
          </button>
        </div>
      </main>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending:     { bg: 'bg-amber-500/20',  text: 'text-amber-400',  label: 'En attente' },
    verified:    { bg: 'bg-green-500/20',  text: 'text-green-400',  label: 'Vérifié' },
    rejected:    { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'Rejeté' },
    in_progress: { bg: 'bg-blue-500/20',   text: 'text-blue-400',   label: 'En cours' },
    revoked:     { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Révoqué' },
    expired:     { bg: 'bg-slate-500/20',  text: 'text-slate-400',  label: 'Expiré' },
  };
  const c = config[status] || config.expired;

  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function Signal({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
      ok
        ? 'bg-green-500/15 text-green-400 border border-green-500/20'
        : 'bg-white/5 text-slate-500 border border-white/5'
    }`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}
