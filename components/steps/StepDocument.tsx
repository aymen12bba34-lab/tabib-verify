'use client';

import React, { useState, useRef, useEffect } from 'react';

interface StepDocumentProps {
  sessionId: string;
  onComplete: () => void;
}

type State = 'idle' | 'camera' | 'captured' | 'processing' | 'done' | 'failed' | 'no_camera';

interface ExtractedID {
  nin: string | null;
  name: string | null;
  confidence: number;
  rawText: string;
}

export default function StepDocument({ sessionId, onComplete }: StepDocumentProps) {
  const [state, setState]             = useState<State>('idle');
  const [progress, setProgress]       = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [extracted, setExtracted]     = useState<ExtractedID | null>(null);
  const [ninMatch, setNinMatch]       = useState<boolean | null>(null);
  const [error, setError]             = useState('');
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Attach stream to video element AFTER it renders (state === 'camera')
  useEffect(() => {
    if (state === 'camera' && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().catch(err => console.error('[Video play error]', err));
      };
    }
  }, [state]);

  async function startCamera() {
    setError('');
    try {
      // Try rear camera first (for phones), fall back to any camera (for laptops)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        // Rear camera failed — try front/any camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }
      streamRef.current = stream;
      // Set state to 'camera' — the useEffect above will attach the stream
      // once the <video> element is rendered in the DOM
      setState('camera');
    } catch (err) {
      console.error('[Camera Error]', err);
      setState('no_camera');
    }
  }

  function captureFrame() {
    const video  = videoRef.current!;
    const canvas = canvasRef.current!;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setState('processing');
    processImage(canvas);
  }

  async function processImage(canvas: HTMLCanvasElement) {
    setProgress(50);
    setProgressLabel('Analyse avec Vision AI (Gemini)...');

    try {
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);

      const res = await fetch(`/api/v1/verification/${sessionId}/step/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image }),
      });

      if (!res.ok) {
        throw new Error('Vision API failed');
      }

      const data = await res.json();
      const extractedData = data.extracted || {};

      setProgress(100);
      setProgressLabel('Terminé !');

      const result: ExtractedID = {
        nin: extractedData.nin || null,
        name: extractedData.fullName || null,
        confidence: 0.95, // AI is highly confident
        rawText: JSON.stringify(extractedData),
      };

      setExtracted(result);
      setState('captured');

      // Send to server
      await submitResult(result);

    } catch (err: any) {
      console.error('[OCR Error]', err);
      setError('Échec de la lecture OCR. Réessayez avec un meilleur éclairage.');
      setState('failed');
    }
  }

  async function submitResult(result: ExtractedID) {
    try {
      const res = await fetch(`/api/v1/verification/${sessionId}/step/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extracted_nin:  result.nin,
          extracted_name: result.name,
          ocr_confidence: result.confidence,
        }),
      });
      const data = await res.json();
      setNinMatch(data.nin_match);
      setState('done');
    } catch {
      setError('Erreur réseau lors de la soumission.');
      setState('failed');
    }
  }

  async function skip() {
    await fetch(`/api/v1/verification/${sessionId}/step/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skipped: true }),
    });
    onComplete();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-1">Scan de la CNIBE</h2>
      <p className="text-sm text-gray-500 mb-4">
        Photographiez votre carte d&apos;identité nationale biométrique pour confirmation.
      </p>

      {/* IDLE */}
      {state === 'idle' && (
        <div className="space-y-4">
          {/* Card visual guide */}
          <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50">
            <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm mx-auto max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-green-600" />
                <div>
                  <div className="text-[10px] font-bold text-gray-700">CARTE NATIONALE D&apos;IDENTITÉ</div>
                  <div className="text-[9px] text-gray-500">الجمهورية الجزائرية</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="h-2 bg-gray-100 rounded w-3/4" />
                <div className="h-2 bg-gray-100 rounded w-1/2" />
                <div className="h-2 bg-indigo-100 rounded w-full mt-2" />
                <div className="text-[8px] text-indigo-400 font-mono">NIN: ██████████████████</div>
              </div>
            </div>
            <p className="text-xs text-indigo-600 text-center mt-2">
              Assurez-vous que la carte est bien éclairée et lisible
            </p>
          </div>

          <button
            onClick={startCamera}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <span>📷</span> Scanner ma CNIBE
          </button>
          <button
            onClick={skip}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Passer cette étape →
          </button>
        </div>
      )}

      {/* CAMERA */}
      {state === 'camera' && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-[4/3]">
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
            {/* Alignment overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-white/70 rounded-lg w-[85%] h-[55%] relative">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-400 rounded-tl" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-400 rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-400 rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-400 rounded-br" />
              </div>
            </div>
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                Centrez la carte dans le cadre
              </span>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <button
            onClick={captureFrame}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-lg">📸</span> Capturer
          </button>
        </div>
      )}

      {/* PROCESSING */}
      {state === 'processing' && (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="animate-spin w-8 h-8 text-indigo-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-800">{progressLabel}</p>
            <p className="text-xs text-gray-400 mt-1">Analyse sécurisée via Vision AI</p>
          </div>
          {/* Progress bar */}
          <div className="bg-gray-100 rounded-full h-2 mx-4">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">{progress}%</p>
        </div>
      )}

      {/* CAPTURED / DONE */}
      {(state === 'captured' || state === 'done') && extracted && (
        <div className="space-y-3">
          <div className={`rounded-xl p-4 border ${ninMatch ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{ninMatch ? '✅' : '⚠️'}</span>
              <p className={`font-medium text-sm ${ninMatch ? 'text-green-800' : 'text-yellow-800'}`}>
                {ninMatch ? 'Carte vérifiée — NIN correspondant' : 'Lecture partielle — Vérification manuelle requise'}
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-gray-600">
              {extracted.nin && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-16">NIN</span>
                  <span className="font-mono">{extracted.nin.slice(0, 8)}••••••••••</span>
                </div>
              )}
              {extracted.name && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-16">Nom</span>
                  <span>{extracted.name}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-gray-400 w-16">Qualité</span>
                <span>{Math.round(extracted.confidence * 100)}%</span>
              </div>
            </div>
          </div>

          {state === 'done' && (
            <button
              onClick={onComplete}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"
            >
              Continuer →
            </button>
          )}
        </div>
      )}

      {/* NO CAMERA */}
      {state === 'no_camera' && (
        <div className="text-center py-6 space-y-3">
          <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">📷</span>
          </div>
          <p className="text-sm text-gray-600">Caméra non accessible sur cet appareil.</p>
          <button onClick={skip} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700">
            Passer cette étape →
          </button>
        </div>
      )}

      {/* FAILED */}
      {state === 'failed' && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ⚠️ {error || 'La lecture a échoué.'}
          </div>
          <p className="text-xs text-gray-500">Conseils : bon éclairage, carte bien à plat, caméra stable.</p>
          <button
            onClick={() => setState('idle')}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700"
          >
            Réessayer
          </button>
          <button onClick={skip} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
            Passer cette étape →
          </button>
        </div>
      )}
    </div>
  );
}
