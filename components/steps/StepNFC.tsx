'use client';

import React, { useState, useEffect } from 'react';

interface StepNFCProps {
  nin: string;
  onComplete: (result: { nfc_read: boolean; nin_match: boolean; skipped: boolean }) => void;
}

export default function StepNFC({ nin, onComplete }: StepNFCProps) {
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setNfcSupported('NDEFReader' in window);
  }, []);

  async function startScan() {
    setScanning(true);
    setStatus('scanning');
    setError('');

    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();

      ndef.addEventListener('reading', ({ message }: any) => {
        const decoder = new TextDecoder();
        let cardNIN = '';
        for (const record of message.records) {
          if (record.recordType === 'text') {
            cardNIN = decoder.decode(record.data);
            break;
          }
        }

        const ninMatch = cardNIN.includes(nin.substring(0, 10));
        setStatus('success');
        setScanning(false);
        onComplete({ nfc_read: true, nin_match: ninMatch, skipped: false });
      });

      setTimeout(() => {
        if (scanning) {
          setError('Délai dépassé. Vous pouvez réessayer ou passer cette étape.');
          setStatus('idle');
          setScanning(false);
        }
      }, 30000);
    } catch (err: any) {
      setError(err.message || 'Erreur NFC');
      setStatus('error');
      setScanning(false);
    }
  }

  function skip() {
    onComplete({ nfc_read: false, nin_match: false, skipped: true });
  }

  if (nfcSupported === null) return <div className="text-center text-gray-500">Vérification NFC...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Scan de la carte CNIBE</h2>

      {nfcSupported ? (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Approchez votre carte d&apos;identité biométrique (CNIBE) du téléphone pour vérification croisée.
          </p>

          <div className="flex flex-col items-center py-8">
            {status === 'idle' && (
              <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {status === 'scanning' && (
              <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center mb-4 animate-pulse">
                <svg className="w-12 h-12 text-indigo-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
            )}
            {status === 'success' && (
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <span className="text-4xl">✓</span>
              </div>
            )}
          </div>

          {status === 'idle' && (
            <button
              onClick={startScan}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              Scanner la carte
            </button>
          )}
          {status === 'scanning' && (
            <p className="text-center text-sm text-indigo-600 animate-pulse">En attente de la carte...</p>
          )}
        </>
      ) : (
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 mb-2">NFC non disponible sur cet appareil</p>
          <p className="text-xs text-gray-400">Cette étape est optionnelle. Votre score sera légèrement réduit.</p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

      <button
        onClick={skip}
        className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
      >
        Passer cette étape →
      </button>
    </div>
  );
}
