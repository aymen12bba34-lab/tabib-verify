'use client';

import React, { useState } from 'react';

interface StepOTPProps {
  sessionId: string;
  onComplete: () => void;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function StepOTP({ sessionId, onComplete }: StepOTPProps) {
  const [email, setEmail]       = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function sendOTP() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/verification/${sessionId}/step/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setMaskedEmail(data.message.replace('Code envoyé à ', ''));
      setCodeSent(true);
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/verification/${sessionId}/step/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      onComplete();
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-1">Vérification par email</h2>
      <p className="text-sm text-gray-500 mb-5">
        Entrez votre adresse email professionnelle pour recevoir un code de vérification.
      </p>

      {!codeSent ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && isValidEmail(email) && sendOTP()}
              placeholder="dr.mansouri@gmail.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              autoComplete="email"
              autoFocus
            />
          </div>

          <button
            onClick={sendOTP}
            disabled={loading || !isValidEmail(email)}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Envoi en cours...
              </span>
            ) : 'Envoyer le code →'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Success banner */}
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
            <span className="text-green-500 text-lg mt-0.5">✉</span>
            <div>
              <p className="text-sm font-medium text-green-800">Code envoyé !</p>
              <p className="text-xs text-green-600 mt-0.5">
                Vérifiez votre boîte mail : <strong>{maskedEmail || email}</strong>
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code à 6 chiffres
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && code.length === 6 && verifyCode()}
              placeholder="• • • • • •"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center text-2xl tracking-[0.5em] font-mono"
              maxLength={6}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1.5 text-center">Expire dans 5 minutes · 3 tentatives max</p>
          </div>

          <button
            onClick={verifyCode}
            disabled={loading || code.length !== 6}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Vérification...
              </span>
            ) : 'Vérifier le code →'}
          </button>

          <button
            onClick={() => { setCodeSent(false); setCode(''); setError(''); }}
            className="w-full py-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
          >
            ← Changer d&apos;adresse email
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <span className="text-red-500 text-sm mt-0.5">⚠</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
