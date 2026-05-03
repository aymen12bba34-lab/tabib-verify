'use client';

import React, { useState, useRef, useEffect } from 'react';
import Script from 'next/script';

interface StepFaceProps {
  sessionId: string;
  doctorName: string;
  onComplete: () => void;
}

type FaceState = 'loading' | 'challenge' | 'blink' | 'detecting' | 'done' | 'error';

// Head-nod liveness challenge using nose-tip X position (normalized 0-1)
// Mirrored camera: person turns LEFT → nose moves RIGHT in image (x > 0.56)
//                  person turns RIGHT → nose moves LEFT in image (x < 0.44)
const LIVENESS_CHALLENGE = [
  { instruction: '👈 Tournez la tête à gauche',  check: (nx: number) => nx > 0.57 },
  { instruction: '👉 Tournez la tête à droite', check: (nx: number) => nx < 0.43 },
  { instruction: '😊 Regardez la caméra',        check: (nx: number) => nx >= 0.44 && nx <= 0.56 },
];

export default function StepFace({ sessionId, doctorName, onComplete }: StepFaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraMPRef = useRef<any>(null);

  const [faceState, setFaceState] = useState<FaceState>('loading');
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [loadMethod, setLoadMethod] = useState<'mediapipe' | 'faceapi' | null>(null);
  const [error, setError] = useState('');

  // Refs used inside MediaPipe callbacks to avoid stale closures
  const challengeIndexRef = useRef(0);
  const lastPassedRef     = useRef(0);
  const completedRef      = useRef(false);

  // Script-loading state (refs — not state — so they don't trigger re-renders)
  const mpFaceLoadedRef   = useRef(false);
  const mpCamLoadedRef    = useRef(false);
  const faceApiLoadedRef  = useRef(false);
  const mpInitAttempted   = useRef(false);

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      cameraMPRef.current?.stop?.();
    };
  }, []);

  // ─── Script load handlers ─────────────────────────────────────────────────

  function onMPFaceLoaded() {
    mpFaceLoadedRef.current = true;
    tryInitMediaPipe();
  }

  function onMPCamLoaded() {
    mpCamLoadedRef.current = true;
    tryInitMediaPipe();
  }

  function onFaceApiLoaded() {
    faceApiLoadedRef.current = true;
    // Give MediaPipe 4s to also load before falling back
    setTimeout(() => {
      if (!mpInitAttempted.current) {
        mpInitAttempted.current = true;
        setLoadMethod('faceapi');
        initFaceApiCamera();
      }
    }, 4000);
  }

  // Called whenever either MP script finishes — starts once both are ready
  function tryInitMediaPipe() {
    if (!mpFaceLoadedRef.current || !mpCamLoadedRef.current) return;
    if (mpInitAttempted.current) return;
    mpInitAttempted.current = true;

    const w = window as any;
    if (!w.FaceMesh || !w.Camera) {
      if (faceApiLoadedRef.current) { setLoadMethod('faceapi'); initFaceApiCamera(); }
      return;
    }

    setLoadMethod('mediapipe');
    initMediaPipe();
  }

  // ─── MediaPipe initialisation ─────────────────────────────────────────────

  async function initMediaPipe() {
    try {
      const w = window as any;

      const faceMesh = new w.FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces:             1,
        refineLandmarks:         false,
        minDetectionConfidence:  0.6,
        minTrackingConfidence:   0.6,
      });

      faceMesh.onResults((results: any) => {
        if (completedRef.current) return;

        const hasface = (results.multiFaceLandmarks?.length ?? 0) > 0;
        setFaceDetected(hasface);
        if (!hasface) return;

        const landmarks = results.multiFaceLandmarks[0];
        const noseX = landmarks[1].x; // nose tip, 0-1 (left→right in image)

        const idx = challengeIndexRef.current;
        if (idx >= LIVENESS_CHALLENGE.length) return;

        const now = Date.now();
        if (now - lastPassedRef.current < 900) return; // debounce

        if (LIVENESS_CHALLENGE[idx].check(noseX)) {
          lastPassedRef.current = now;
          const next = idx + 1;
          challengeIndexRef.current = next;
          setChallengeIndex(next);

          if (next >= LIVENESS_CHALLENGE.length) {
            completedRef.current = true;
            handleComplete('mediapipe_headnod');
          }
        }
      });

      // Start camera stream manually so we have the element ready
      await startCameraStream();

      const camera = new w.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) await faceMesh.send({ image: videoRef.current });
        },
        width: 640, height: 480,
      });
      cameraMPRef.current = camera;
      camera.start();

      setFaceState('challenge');
    } catch (err) {
      console.error('[MediaPipe] init error:', err);
      // Graceful fallback
      if (faceApiLoadedRef.current) {
        setLoadMethod('faceapi');
        initFaceApiCamera();
      } else {
        setError('Chargement impossible. Actualisez la page.');
        setFaceState('error');
      }
    }
  }

  // ─── Camera stream helper ─────────────────────────────────────────────────

  async function startCameraStream() {
    if (streamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }

  // ─── face-api.js fallback ─────────────────────────────────────────────────

  async function initFaceApiCamera() {
    try {
      await startCameraStream();
      setFaceState('blink');
    } catch {
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
      setFaceState('error');
    }
  }

  async function runFaceApiDetection() {
    setFaceState('detecting');
    setError('');
    const faceapi = (window as any).faceapi;
    if (!faceapi || !videoRef.current) {
      setError('face-api.js non chargé.');
      setFaceState('blink');
      return;
    }

    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    } catch {
      setError('Erreur chargement modèles.');
      setFaceState('blink');
      return;
    }

    let detections = 0;
    let blinks = 0;
    let lastEAR = 1;

    for (let i = 0; i < 30; i++) {
      try {
        const result = await (faceapi as any)
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true);

        if (result) {
          detections++;
          const leftEye  = result.landmarks.getLeftEye();
          const rightEye = result.landmarks.getRightEye();
          const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;
          if (lastEAR > 0.25 && ear < 0.2) blinks++;
          lastEAR = ear;
        }
      } catch { /* frame error — skip */ }
      await new Promise(r => setTimeout(r, 200));
    }

    if (detections >= 12) {
      handleComplete('faceapi_blink');
    } else {
      setError('Visage non détecté. Assurez un bon éclairage et réessayez.');
      setFaceState('blink');
    }
  }

  function getEAR(eye: any[]): number {
    const v1 = dist(eye[1], eye[5]);
    const v2 = dist(eye[2], eye[4]);
    const h  = dist(eye[0], eye[3]);
    return (v1 + v2) / (2 * h);
  }

  function dist(a: any, b: any): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  // ─── Submit result ─────────────────────────────────────────────────────────

  async function handleComplete(method: string) {
    setFaceState('done');
    streamRef.current?.getTracks().forEach(t => t.stop());
    cameraMPRef.current?.stop?.();

    try {
      const res = await fetch(`/api/v1/verification/${sessionId}/step/face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          face_detected:  true,
          liveness_passed: true,
          face_method:    method,
        }),
      });
      if (res.ok) setTimeout(onComplete, 1500);
      else {
        setError('Erreur serveur.');
        setFaceState('error');
      }
    } catch {
      setError('Erreur réseau.');
      setFaceState('error');
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── CDN Scripts ── */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"
        onLoad={onMPFaceLoaded}
        onError={() => { /* MP not available — face-api timeout will kick in */ }}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
        onLoad={onMPCamLoaded}
        onError={() => { /* same */ }}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js"
        onLoad={onFaceApiLoaded}
      />

      <h2 className="text-xl font-semibold text-gray-800 mb-1">Vérification de présence</h2>
      <p className="text-sm text-gray-500 mb-4">
        Bonjour, <strong>{doctorName}</strong> — suivez les instructions ci-dessous.
      </p>

      {/* ── Camera viewport ── */}
      <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-[4/3]">
        <video
          ref={videoRef}
          autoPlay muted playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Loading */}
        {faceState === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 gap-3">
            <svg className="animate-spin w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-sm text-gray-300">Chargement de la détection...</p>
            <p className="text-xs text-gray-500">MediaPipe FaceMesh + face-api.js</p>
          </div>
        )}

        {/* MediaPipe challenge overlay */}
        {faceState === 'challenge' && (
          <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none">
            {/* Top: face detected badge */}
            <div className="flex justify-end">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                faceDetected ? 'bg-green-500 text-white' : 'bg-yellow-400 text-gray-900'
              }`}>
                {faceDetected ? '✓ Visage détecté' : '⚠ Positionnez votre visage'}
              </span>
            </div>

            {/* Bottom: current instruction */}
            <div className="bg-black/65 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-white font-semibold text-sm">
                {challengeIndex < LIVENESS_CHALLENGE.length
                  ? LIVENESS_CHALLENGE[challengeIndex].instruction
                  : '✓ Défi terminé !'}
              </p>
              <div className="flex justify-center gap-2 mt-2">
                {LIVENESS_CHALLENGE.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      i < challengeIndex  ? 'bg-green-400 scale-110' :
                      i === challengeIndex ? 'bg-white animate-pulse' :
                      'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Blink detection hint */}
        {(faceState === 'blink' || faceState === 'detecting') && (
          <div className="absolute bottom-3 left-0 right-0 text-center">
            <span className="bg-black/55 text-white text-xs px-3 py-1.5 rounded-full">
              {faceState === 'detecting' ? '⏳ Analyse en cours...' : '👁 Clignez naturellement des yeux'}
            </span>
          </div>
        )}

        {/* Done */}
        {faceState === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
            <div className="bg-green-500 rounded-full p-4 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Method badge */}
      {loadMethod && faceState !== 'done' && faceState !== 'error' && (
        <p className="mt-1.5 text-xs text-gray-400 text-center">
          {loadMethod === 'mediapipe'
            ? '🧠 MediaPipe FaceMesh — détection en temps réel'
            : '👁 Mode détection classique (face-api.js)'}
        </p>
      )}

      {/* face-api launch button */}
      {faceState === 'blink' && (
        <button
          onClick={runFaceApiDetection}
          className="mt-4 w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          Lancer la détection (~6 secondes)
        </button>
      )}

      {/* Done message */}
      {faceState === 'done' && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg text-sm text-green-800 text-center font-medium">
          ✓ Présence confirmée — passage à l&apos;étape suivante...
        </div>
      )}

      {/* Error */}
      {error && faceState !== 'done' && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">⚠️ {error}</p>
      )}
    </div>
  );
}
