'use client';

import React from 'react';

interface VerifyLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
}

const stepLabels = ['Email', 'Identité', 'CNIBE', 'Visage', 'NFC'];

export default function VerifyLayout({ children, currentStep, totalSteps }: VerifyLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-white font-bold text-lg">TabibVerify</h1>
            <span className="text-indigo-200 text-sm">Étape {currentStep}/{totalSteps}</span>
          </div>
          <div className="mt-3 flex gap-1">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex-1">
                <div className={`h-1.5 rounded-full ${i < currentStep ? 'bg-white' : i === currentStep ? 'bg-indigo-300' : 'bg-indigo-400/40'}`} />
                <span className={`text-[10px] mt-1 block ${i <= currentStep ? 'text-indigo-100' : 'text-indigo-300/60'}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
