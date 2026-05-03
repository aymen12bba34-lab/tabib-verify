'use client';

import React from 'react';

interface ResultScreenProps {
  status: 'verified' | 'pending' | 'rejected';
  trustScore: number;
  redirectUrl?: string;
  doctorName: string;
}

export default function ResultScreen({ status, trustScore, redirectUrl, doctorName }: ResultScreenProps) {
  const config = {
    verified: {
      icon: '✓',
      title: 'Vérification réussie',
      subtitle: `Dr. ${doctorName}, votre identité a été confirmée.`,
      bg: 'bg-green-50',
      border: 'border-green-200',
      iconBg: 'bg-green-100',
      iconText: 'text-green-600',
      textColor: 'text-green-800',
    },
    pending: {
      icon: '⏳',
      title: 'En cours de révision',
      subtitle: 'Votre dossier nécessite une vérification manuelle. Vous serez notifié.',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      iconBg: 'bg-yellow-100',
      iconText: 'text-yellow-600',
      textColor: 'text-yellow-800',
    },
    rejected: {
      icon: '✗',
      title: 'Vérification échouée',
      subtitle: 'Nous n\'avons pas pu vérifier votre identité. Veuillez réessayer ou contacter le support.',
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconBg: 'bg-red-100',
      iconText: 'text-red-600',
      textColor: 'text-red-800',
    },
  }[status];

  return (
    <div className={`${config.bg} border ${config.border} rounded-xl p-6 text-center`}>
      <div className={`w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <span className={`text-3xl ${config.iconText}`}>{config.icon}</span>
      </div>
      <h2 className={`text-xl font-semibold ${config.textColor} mb-2`}>{config.title}</h2>
      <p className="text-sm text-gray-600 mb-4">{config.subtitle}</p>
      <p className="text-xs text-gray-400">Score de confiance: {trustScore}/110</p>

      {redirectUrl && status === 'verified' && (
        <a
          href={redirectUrl}
          className="mt-6 inline-block px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          Retourner à l&apos;application →
        </a>
      )}
    </div>
  );
}
