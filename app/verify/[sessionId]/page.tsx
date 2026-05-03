'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import VerifyLayout from '@/components/VerifyLayout';
import StepOTP from '@/components/steps/StepOTP';
import StepIdentity from '@/components/steps/StepIdentity';
import StepDocument from '@/components/steps/StepDocument';
import StepFace from '@/components/steps/StepFace';
import StepNFC from '@/components/steps/StepNFC';
import ResultScreen from '@/components/ResultScreen';

type Step = 'otp' | 'identity' | 'document' | 'face' | 'nfc' | 'result';

const STEP_INDEX: Record<Step, number> = {
  otp: 0, identity: 1, document: 2, face: 3, nfc: 4, result: 5,
};

export default function VerifyPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [step, setStep]           = useState<Step>('otp');
  const [doctorName, setDoctorName] = useState('');
  const [result, setResult]       = useState<{
    status: 'verified' | 'pending' | 'rejected';
    trust_score: number;
    redirect_url?: string;
  } | null>(null);
  const [expired, setExpired]     = useState(false);

  useEffect(() => {
    fetch(`/api/v1/internal/session-status?id=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.status && data.status !== 'in_progress') {
          setResult({ status: data.status, trust_score: data.trust_score, redirect_url: data.redirect_url });
          setStep('result');
          setDoctorName(data.full_name || '');
        } else if (data.expired) {
          setExpired(true);
        }
      })
      .catch(() => {});
  }, [sessionId]);

  if (expired) {
    return (
      <VerifyLayout currentStep={0} totalSteps={5}>
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-xl">⏰</span>
          </div>
          <p className="text-lg font-semibold text-red-600">Session expirée</p>
          <p className="text-sm text-gray-500 mt-2">Veuillez demander un nouveau lien de vérification.</p>
        </div>
      </VerifyLayout>
    );
  }

  async function handleNFCComplete(nfcResult: { nfc_read: boolean; nin_match: boolean; skipped: boolean }) {
    const res = await fetch(`/api/v1/verification/${sessionId}/step/nfc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nfcResult),
    });
    const data = await res.json();
    setResult({ status: data.status, trust_score: data.trust_score, redirect_url: data.redirect_url });
    setStep('result');
  }

  return (
    <VerifyLayout currentStep={STEP_INDEX[step]} totalSteps={5}>
      {step === 'otp' && (
        <StepOTP sessionId={sessionId} onComplete={() => setStep('identity')} />
      )}
      {step === 'identity' && (
        <StepIdentity
          sessionId={sessionId}
          onComplete={(name?: string) => {
            if (name) setDoctorName(name);
            setStep('document');
          }}
        />
      )}
      {step === 'document' && (
        <StepDocument sessionId={sessionId} onComplete={() => setStep('face')} />
      )}
      {step === 'face' && (
        <StepFace
          sessionId={sessionId}
          doctorName={doctorName || 'Docteur'}
          onComplete={() => setStep('nfc')}
        />
      )}
      {step === 'nfc' && (
        <StepNFC nin="" onComplete={handleNFCComplete} />
      )}
      {step === 'result' && result && (
        <ResultScreen
          status={result.status}
          trustScore={result.trust_score}
          redirectUrl={result.redirect_url}
          doctorName={doctorName || 'Docteur'}
        />
      )}
    </VerifyLayout>
  );
}
