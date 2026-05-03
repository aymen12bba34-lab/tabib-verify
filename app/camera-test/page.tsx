'use client';

import { useRef, useState } from 'react';

export default function CameraTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Click the button to start camera');
  const [streamInfo, setStreamInfo] = useState('');

  async function startCamera() {
    setStatus('Requesting camera...');
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setStreamInfo(`Found ${videoDevices.length} camera(s): ${videoDevices.map(d => d.label || 'unnamed').join(', ')}`);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStatus('Stream acquired! Attaching to video...');

      const video = videoRef.current!;
      video.srcObject = stream;

      video.onloadedmetadata = () => {
        setStatus(`Metadata loaded: ${video.videoWidth}x${video.videoHeight}`);
        video.play().then(() => {
          setStatus(`✅ Playing! Resolution: ${video.videoWidth}x${video.videoHeight}`);
        }).catch(err => {
          setStatus(`❌ Play failed: ${err.message}`);
        });
      };

      video.onerror = () => {
        setStatus(`❌ Video element error`);
      };

    } catch (err: any) {
      setStatus(`❌ Camera error: ${err.message}`);
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Camera Test</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>{status}</p>
      <p style={{ color: '#999', fontSize: 12, marginBottom: 16 }}>{streamInfo}</p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: 400, background: '#111', borderRadius: 8 }}
      />
      <br />
      <button
        onClick={startCamera}
        style={{ marginTop: 16, padding: '12px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16 }}
      >
        Start Camera
      </button>
    </div>
  );
}
