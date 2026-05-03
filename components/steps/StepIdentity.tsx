'use client';

import React, { useState } from 'react';

interface StepIdentityProps {
  sessionId: string;
  onComplete: (name?: string) => void;
}

const SPECIALTIES = [
  'Médecine Générale', 'Cardiologie', 'Pédiatrie', 'Gynécologie',
  'Chirurgie Générale', 'Dermatologie', 'Ophtalmologie', 'Neurologie',
  'Psychiatrie', 'Urologie', 'Endocrinologie', 'ORL',
  'Anesthésie', 'Radiologie', 'Rhumatologie', 'Pneumologie',
];

const WILAYAS = [
  'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar',
  'Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger',
  'Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba','Guelma',
  'Constantine','Médéa','Mostaganem','M\'Sila','Mascara','Ouargla','Oran','El Bayadh',
  'Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt','El Oued',
  'Khenchela','Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma','Aïn Témouchent',
  'Ghardaïa','Relizane','Timimoun','Bordj Badji Mokhtar','Ouled Djellal',
  'Béni Abbès','In Salah','In Guezzam','Touggourt','Djanet','El M\'Ghair','El Meniaa',
];

export default function StepIdentity({ sessionId, onComplete }: StepIdentityProps) {
  const [form, setForm] = useState({ cnom_number: '', nin: '', full_name: '', specialty: '', wilaya: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/verification/${sessionId}/step/identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setResult(data);
      if (data.cnom_found) {
        setTimeout(() => onComplete(form.full_name), 1500);
      }
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Vérification d&apos;identité</h2>
      <p className="text-sm text-gray-500 mb-4">Entrez vos informations professionnelles.</p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">N° CNOM</label>
          <input
            type="text"
            value={form.cnom_number}
            onChange={e => update('cnom_number', e.target.value)}
            placeholder="16-2345-MG"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">NIN (18 chiffres)</label>
          <input
            type="text"
            value={form.nin}
            onChange={e => update('nin', e.target.value.replace(/\D/g, '').slice(0, 18))}
            placeholder="198506121600001234"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            maxLength={18}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
          <input
            type="text"
            value={form.full_name}
            onChange={e => update('full_name', e.target.value)}
            placeholder="Mansouri Karim"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité</label>
          <select
            value={form.specialty}
            onChange={e => update('specialty', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Sélectionner...</option>
            {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Wilaya</label>
          <select
            value={form.wilaya}
            onChange={e => update('wilaya', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Sélectionner...</option>
            {WILAYAS.map((w, i) => <option key={i} value={w}>{String(i + 1).padStart(2, '0')} - {w}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={loading || !form.cnom_number || !form.nin || !form.full_name}
        className="mt-4 w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Vérification...' : 'Vérifier'}
      </button>

      {result && result.cnom_found && (
        <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">
          ✓ CNOM trouvé — Correspondance du nom: {result.name_match_score}%
        </div>
      )}
      {result && !result.cnom_found && (
        <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-800">
          ✗ Numéro CNOM non trouvé dans le registre
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
    </div>
  );
}
