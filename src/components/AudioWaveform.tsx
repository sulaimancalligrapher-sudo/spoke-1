import React, { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  isRecording: boolean;
  isPlaying?: boolean;
  stream?: MediaStream | null;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording,
  isPlaying,
  stream,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!isRecording || !stream) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      return;
    }

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = Math.max(4, (dataArray[i] / 255) * canvas.height * 0.85);

          // Beautiful emerald to amber gradient
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, '#10b981');
          gradient.addColorStop(0.7, '#06b6d4');
          gradient.addColorStop(1, '#6366f1');

          ctx.fillStyle = gradient;
          // Center the bars vertically
          const y = (canvas.height - barHeight) / 2;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth - 2, barHeight, 3);
          ctx.fill();

          x += barWidth;
        }
      };

      draw();
    } catch (err) {
      console.warn('AudioWaveform init error:', err);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isRecording, stream]);

  if (!isRecording && !isPlaying) {
    return (
      <div className="flex items-center justify-center gap-1.5 h-10 w-full opacity-40">
        {[16, 24, 32, 20, 28, 18, 30, 22, 14, 26, 18, 12].map((height, i) => (
          <div
            key={i}
            className="w-1.5 bg-slate-300 rounded-full transition-all"
            style={{ height: `${height}px` }}
          />
        ))}
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div className="flex items-center justify-center gap-1.5 h-10 w-full">
        {[20, 36, 18, 42, 28, 48, 22, 40, 26, 32, 18, 24].map((baseHeight, i) => (
          <div
            key={i}
            className="w-1.5 bg-emerald-500 rounded-full animate-pulse"
            style={{
              height: `${baseHeight}px`,
              animationDuration: `${0.4 + (i % 5) * 0.15}s`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full h-12">
      <canvas
        ref={canvasRef}
        width={240}
        height={48}
        className="w-60 h-12 rounded-lg"
      />
    </div>
  );
};
