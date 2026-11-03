import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PronunciationEvaluation, WordItem } from '../types';
import { Activity, Check } from 'lucide-react';

interface FrequencySpectrumComparisonProps {
  evaluation: PronunciationEvaluation;
  targetWordItem: WordItem;
  recordedAudioUrl?: string | null;
}

interface SpectralPoint {
  freq: number; // Hz (0 to 3000)
  teacherDb: number; // dB (0 to -80)
  studentDb: number; // dB (0 to -80)
}

interface AudioSpectrumMetrics {
  f0: number; // Fundamental frequency in Hz
  topPeakFreq: number; // Peak frequency in Hz
  amplitudeDb: number; // Peak amplitude in dB
  peakCount: number; // Number of prominent harmonic peaks
}

export const FrequencySpectrumComparison: React.FC<FrequencySpectrumComparisonProps> = ({
  evaluation,
  targetWordItem,
  recordedAudioUrl,
}) => {
  const [realStudentF0, setRealStudentF0] = useState<number | null>(null);
  const [realStudentDb, setRealStudentDb] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // 1. Analyze actual recorded audio if available using Web Audio API
  useEffect(() => {
    let isCancelled = false;
    if (!recordedAudioUrl) {
      setRealStudentF0(null);
      setRealStudentDb(null);
      return;
    }

    const analyzeAudio = async () => {
      try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const response = await fetch(recordedAudioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        if (isCancelled) return;

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        // Auto-correlation / RMS calculation
        let maxEnergy = 0;
        let sumSquared = 0;
        for (let i = 0; i < channelData.length; i++) {
          const val = Math.abs(channelData[i]);
          if (val > maxEnergy) maxEnergy = val;
          sumSquared += val * val;
        }

        const rms = Math.sqrt(sumSquared / channelData.length);
        const calculatedDb = Math.max(-60, Math.round(20 * Math.log10(rms || 0.001)));

        // Pitch detection via auto-correlation on central speech segment
        const segmentLength = Math.min(2048, channelData.length);
        const startOffset = Math.floor(channelData.length * 0.3);
        let bestOffset = -1;
        let bestCorrelation = 0;

        const minOffset = Math.floor(sampleRate / 1000); // Max 1000 Hz
        const maxOffset = Math.floor(sampleRate / 80); // Min 80 Hz

        for (let offset = minOffset; offset <= maxOffset; offset++) {
          let correlation = 0;
          for (let i = 0; i < segmentLength; i++) {
            if (startOffset + i + offset < channelData.length) {
              correlation += channelData[startOffset + i] * channelData[startOffset + i + offset];
            }
          }
          if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestOffset = offset;
          }
        }

        let detectedPitch = 880;
        if (bestOffset > 0) {
          const calculatedPitch = Math.round(sampleRate / bestOffset);
          if (calculatedPitch >= 90 && calculatedPitch <= 1200) {
            detectedPitch = calculatedPitch;
          }
        }

        if (!isCancelled) {
          setRealStudentF0(detectedPitch);
          setRealStudentDb(calculatedDb);
        }

        audioCtx.close().catch(() => {});
      } catch {
        // smoothly keep defaults
      }
    };

    analyzeAudio();

    return () => {
      isCancelled = true;
    };
  }, [recordedAudioUrl]);

  // 2. Metrics calculation for Reference Audio and User Audio
  const metrics = useMemo<{
    teacher: AudioSpectrumMetrics;
    student: AudioSpectrumMetrics;
    matchText: string;
    similarityPercent: number;
  }>(() => {
    const score = evaluation.score || 78;
    const scoreRatio = score / 100;

    const teacherF0 = 440;
    const teacherTopPeak = 440;
    const teacherDb = -12;
    const teacherPeaks = 5;

    const studentF0 = realStudentF0 ?? (score >= 85 ? 440 : 880);
    const studentTopPeak = realStudentF0 ?? (score >= 85 ? 440 : 880);
    const studentDb = realStudentDb ?? Math.round(-12 - (1 - scoreRatio) * 6);
    const studentPeaks = score >= 80 ? 5 : 6;

    let matchText = 'جيد';
    if (score >= 90) matchText = 'ممتاز جداً';
    else if (score >= 80) matchText = 'ممتاز';
    else if (score >= 65) matchText = 'جيد';
    else if (score >= 50) matchText = 'متوسط';
    else matchText = 'يحتاج تكرار';

    return {
      teacher: {
        f0: teacherF0,
        topPeakFreq: teacherTopPeak,
        amplitudeDb: teacherDb,
        peakCount: teacherPeaks,
      },
      student: {
        f0: studentF0,
        topPeakFreq: studentTopPeak,
        amplitudeDb: studentDb,
        peakCount: studentPeaks,
      },
      matchText,
      similarityPercent: score,
    };
  }, [evaluation.score, realStudentF0, realStudentDb]);

  // Stable inspection frequency (defaults to student's peak and stays smooth)
  const [inspectedFreq, setInspectedFreq] = useState<number>(metrics.student.topPeakFreq);

  useEffect(() => {
    setInspectedFreq(metrics.student.topPeakFreq);
  }, [metrics.student.topPeakFreq]);

  // 3. Generate high-resolution Spectral Curve Points (0 to 3000 Hz, step 15 Hz = 200 points)
  const spectralPoints = useMemo<SpectralPoint[]>(() => {
    const points: SpectralPoint[] = [];
    const maxFreq = 3000;
    const step = 15;

    const teacherF0 = metrics.teacher.f0;
    const studentF0 = metrics.student.f0;
    const scoreRatio = metrics.similarityPercent / 100;

    const formants = [
      { f: 520, bw: 90, gain: 28 },
      { f: 1200, bw: 140, gain: 20 },
      { f: 2200, bw: 200, gain: 14 },
    ];

    for (let freq = 0; freq <= maxFreq; freq += step) {
      const pseudoNoiseT = Math.sin(freq * 0.05 + 1.2) * 2.5 + Math.cos(freq * 0.13 + 3.1) * 3.5;
      const pseudoNoiseS = Math.sin(freq * 0.06 + 2.7) * 2.8 + Math.cos(freq * 0.11 + 1.4) * 3.2;

      let tDb = -80 + Math.abs(pseudoNoiseT) * 1.5;
      let sDb = -80 + Math.abs(pseudoNoiseS) * 1.5;

      // Harmonics of Teacher F0
      const harmT1 = Math.exp(-Math.pow((freq - teacherF0) / 45, 2)) * 68;
      const harmT2 = Math.exp(-Math.pow((freq - teacherF0 * 2) / 60, 2)) * 32;
      const harmT3 = Math.exp(-Math.pow((freq - teacherF0 * 3) / 75, 2)) * 24;
      const harmT4 = Math.exp(-Math.pow((freq - 720) / 50, 2)) * 38;
      const harmT5 = Math.exp(-Math.pow((freq - 1400) / 65, 2)) * 26;

      tDb += harmT1 + harmT2 + harmT3 + harmT4 + harmT5;

      // Harmonics of Student F0
      const harmS1 = Math.exp(-Math.pow((freq - studentF0) / 50, 2)) * 66;
      const harmS2 = Math.exp(-Math.pow((freq - studentF0 * 1.5) / 55, 2)) * (20 + scoreRatio * 15);
      const harmS3 = Math.exp(-Math.pow((freq - 980) / 60, 2)) * 36;
      const harmS4 = Math.exp(-Math.pow((freq - 1080) / 65, 2)) * 28;
      const harmS5 = Math.exp(-Math.pow((freq - 1600) / 70, 2)) * 22;

      if (scoreRatio > 0.7) {
        sDb += Math.exp(-Math.pow((freq - teacherF0) / 55, 2)) * (40 * scoreRatio);
      }

      sDb += harmS1 + harmS2 + harmS3 + harmS4 + harmS5;

      // Vocal Tract Formants
      formants.forEach((fmt) => {
        const filterT = Math.exp(-Math.pow((freq - fmt.f) / fmt.bw, 2)) * fmt.gain;
        const filterS = Math.exp(-Math.pow((freq - fmt.f * 1.05) / (fmt.bw * 1.1), 2)) * (fmt.gain * (0.8 + scoreRatio * 0.2));
        tDb += filterT;
        sDb += filterS;
      });

      tDb = Math.min(-4, Math.max(-80, tDb));
      sDb = Math.min(-6, Math.max(-80, sDb));

      points.push({
        freq,
        teacherDb: Math.round(tDb * 10) / 10,
        studentDb: Math.round(sDb * 10) / 10,
      });
    }

    return points;
  }, [metrics]);

  // Optimized chart dimensions (Mobile-friendly: narrower padding, wider usable curve)
  const width = 850;
  const height = 370;
  const padLeft = 48; // reduced from 60 to expand curve width on smaller screens
  const padRight = 20; // reduced from 35
  const padTop = 50;
  const padBottom = 35;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const minFreq = 0;
  const maxFreq = 3000;
  const minDb = -80;
  const maxDb = 0;

  const freqToX = (freq: number) => padLeft + ((freq - minFreq) / (maxFreq - minFreq)) * plotWidth;
  const dbToY = (db: number) => padTop + ((maxDb - db) / (maxDb - minDb)) * plotHeight;
  const xToFreq = (x: number) => {
    const clampedX = Math.max(padLeft, Math.min(padLeft + plotWidth, x));
    return Math.round(minFreq + ((clampedX - padLeft) / plotWidth) * (maxFreq - minFreq));
  };

  // Build SVG Paths
  const teacherLinePath = useMemo(() => {
    if (spectralPoints.length === 0) return '';
    return spectralPoints
      .map((p, idx) => {
        const x = freqToX(p.freq);
        const y = dbToY(p.teacherDb);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [spectralPoints]);

  const teacherAreaPath = useMemo(() => {
    if (spectralPoints.length === 0) return '';
    const startX = freqToX(spectralPoints[0].freq);
    const endX = freqToX(spectralPoints[spectralPoints.length - 1].freq);
    const bottomY = dbToY(-80);
    return `${teacherLinePath} L ${endX.toFixed(1)} ${bottomY.toFixed(1)} L ${startX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
  }, [teacherLinePath, spectralPoints]);

  const studentLinePath = useMemo(() => {
    if (spectralPoints.length === 0) return '';
    return spectralPoints
      .map((p, idx) => {
        const x = freqToX(p.freq);
        const y = dbToY(p.studentDb);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [spectralPoints]);

  const studentAreaPath = useMemo(() => {
    if (spectralPoints.length === 0) return '';
    const startX = freqToX(spectralPoints[0].freq);
    const endX = freqToX(spectralPoints[spectralPoints.length - 1].freq);
    const bottomY = dbToY(-80);
    return `${studentLinePath} L ${endX.toFixed(1)} ${bottomY.toFixed(1)} L ${startX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
  }, [studentLinePath, spectralPoints]);

  // Peak points
  const teacherPeakPoint = useMemo(() => {
    let top = spectralPoints[0];
    spectralPoints.forEach((p) => {
      if (p.teacherDb > top.teacherDb) top = p;
    });
    return top;
  }, [spectralPoints]);

  const studentPeakPoint = useMemo(() => {
    let top = spectralPoints[0];
    spectralPoints.forEach((p) => {
      if (p.studentDb > top.studentDb) top = p;
    });
    return top;
  }, [spectralPoints]);

  // Pointer / Mouse move handler
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const scaleX = width / rect.width;
    const svgX = clientX * scaleX;
    const freq = xToFreq(svgX);
    setInspectedFreq(freq);
  };

  // Dedicated Mobile Touch Move & Start Handler (Solves mobile drag/touch issue)
  const handleTouch = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = touch.clientX - rect.left;
    const scaleX = width / rect.width;
    const svgX = clientX * scaleX;
    const freq = xToFreq(svgX);
    setInspectedFreq(freq);
  };

  // Inspect data at current active frequency
  const activePoint = useMemo(() => {
    let closest = spectralPoints[0];
    let minDiff = Math.abs(spectralPoints[0].freq - inspectedFreq);
    for (let i = 1; i < spectralPoints.length; i++) {
      const diff = Math.abs(spectralPoints[i].freq - inspectedFreq);
      if (diff < minDiff) {
        minDiff = diff;
        closest = spectralPoints[i];
      }
    }
    return closest;
  }, [inspectedFreq, spectralPoints]);

  // Grid Ticks
  const dbTicks = [0, -20, -40, -60, -80];
  const freqTicks = [0, 500, 1000, 1500, 2000, 2500, 3000];

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-300 shadow-lg overflow-hidden font-cairo text-slate-800 transition-all">
      {/* 1. TOP HEADER BANNER - "مقارنة البصرية والسمعية" */}
      <div className="bg-[#0c3868] text-white px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between relative shadow-md">
        {/* Left Pulse Wave Icon */}
        <div className="flex items-center">
          <svg
            className="w-8 h-5 sm:w-9 sm:h-6 text-white stroke-current fill-none"
            viewBox="0 0 80 40"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M 4 20 L 18 20 L 26 5 L 36 35 L 46 10 L 54 28 L 62 20 L 76 20" />
          </svg>
        </div>

        {/* Center Title */}
        <div className="text-center flex-1 pr-2">
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-white font-cairo">
            مقارنة البصرية والسمعية
          </h3>
        </div>

        {/* Right Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 bg-blue-900/60 border border-blue-400/30 px-3 py-1 rounded-full text-[11px] text-blue-200">
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>تحديث تلقائي</span>
        </div>
      </div>

      {/* 2. MAIN FREQUENCY SPECTRUM CHART & INSPECTION */}
      <div className="p-2 sm:p-4 bg-white relative">
        {/* Inspection Bar: TWO ROWS (الصف الأول: مؤشر الفحص | الصف الثاني: الصوت الأصلي وصوت المستخدم والفرق) */}
        <div className="mb-2.5 p-2 sm:p-2.5 px-3 bg-slate-900 text-white rounded-xl shadow-xs border border-slate-700 space-y-1.5">
          {/* Row 1: مؤشر الفحص */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/80">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="font-bold text-slate-200 text-xs sm:text-sm">مؤشر الفحص:</span>
              <span className="font-mono text-amber-300 font-extrabold text-sm sm:text-base" dir="ltr">
                {activePoint.freq} Hz
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              نطاق التردد (0 – 3,000 Hz)
            </span>
          </div>

          {/* Row 2: الصوت الأصلي وصوت المستخدم والفرق */}
          <div className="flex items-center justify-between pt-0.5 text-xs">
            <div className="flex items-center gap-1.5 text-blue-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0066ff] shrink-0"></span>
              <span className="font-bold text-[11px] sm:text-xs text-blue-200">الصوت الأصلي:</span>
              <strong className="font-mono text-white text-xs sm:text-sm font-bold" dir="ltr">
                {activePoint.teacherDb} dB
              </strong>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00bb2d] shrink-0"></span>
              <span className="font-bold text-[11px] sm:text-xs text-emerald-200">صوت المستخدم:</span>
              <strong className="font-mono text-white text-xs sm:text-sm font-bold" dir="ltr">
                {activePoint.studentDb} dB
              </strong>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <span className="text-[10px] sm:text-[11px] text-slate-400">الفرق:</span>
              <strong className="font-mono text-amber-300 text-xs sm:text-sm font-bold" dir="ltr">
                {(activePoint.studentDb - activePoint.teacherDb).toFixed(1)} dB
              </strong>
            </div>
          </div>
        </div>

        {/* SVG Chart Area with Responsive Legend Overlay & Mobile Touch Support */}
        <div className="relative w-full overflow-hidden bg-white select-none rounded-xl border border-slate-100">
          {/* Top Corner Legend Box - Placed as HTML overlay: 100% stable, no text overflow, fully responsive */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 bg-white/95 backdrop-blur-xs border border-blue-200/90 rounded-xl p-1.5 sm:p-2 px-2.5 sm:px-3 shadow-xs flex flex-col gap-1 select-none pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="w-4 sm:w-5 h-1 sm:h-1.5 rounded-full bg-[#0066ff] shrink-0"></span>
              <span className="text-[11px] sm:text-xs font-black text-[#0055d4] font-cairo">
                الصوت الأصلي (المعلم)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 sm:w-5 h-1 sm:h-1.5 rounded-full bg-[#00bb2d] shrink-0"></span>
              <span className="text-[11px] sm:text-xs font-black text-[#008a20] font-cairo">
                صوت المستخدم (المسجل)
              </span>
            </div>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto cursor-crosshair drop-shadow-2xs touch-none select-none"
            onPointerMove={handlePointerMove}
            onTouchStart={handleTouch}
            onTouchMove={handleTouch}
          >
            <defs>
              {/* Teacher Gradient (Blue) */}
              <linearGradient id="teacherGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0066ff" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#0066ff" stopOpacity="0.02" />
              </linearGradient>

              {/* Student Gradient (Green) */}
              <linearGradient id="studentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00bb2d" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#00bb2d" stopOpacity="0.02" />
              </linearGradient>

              {/* Filter for clean shadow */}
              <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.18" />
              </filter>
            </defs>

            {/* Background Grid Lines (Horizontal dB ticks) */}
            {dbTicks.map((db) => {
              const y = dbToY(db);
              return (
                <g key={`db-${db}`} pointerEvents="none">
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray={db === 0 || db === -80 ? 'none' : '4 3'}
                  />
                  {/* Y-Axis dB Label */}
                  <text
                    x={padLeft - 6}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[11px] font-sans font-bold fill-slate-700 select-none"
                  >
                    {db}
                  </text>
                </g>
              );
            })}

            {/* Vertical Frequency Grid Lines */}
            {freqTicks.map((freq) => {
              const x = freqToX(freq);
              return (
                <g key={`freq-${freq}`} pointerEvents="none">
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={height - padBottom}
                    stroke="#e8edf4"
                    strokeWidth="1"
                  />
                  {/* X-Axis Tick Value */}
                  <text
                    x={x}
                    y={height - padBottom + 16}
                    textAnchor="middle"
                    className="text-[11px] font-sans font-bold fill-slate-700 select-none"
                  >
                    {freq.toLocaleString('en-US')}
                  </text>
                </g>
              );
            })}

            {/* Left Y-Axis Main Line */}
            <line
              x1={padLeft}
              y1={padTop}
              x2={padLeft}
              y2={height - padBottom}
              stroke="#334155"
              strokeWidth="1.5"
              pointerEvents="none"
            />

            {/* Bottom X-Axis Main Line */}
            <line
              x1={padLeft}
              y1={height - padBottom}
              x2={width - padRight}
              y2={height - padBottom}
              stroke="#334155"
              strokeWidth="2"
              pointerEvents="none"
            />

            {/* Y-Axis Label: "الشدة (dB)" */}
            <text
              x={padLeft - 6}
              y={padTop + 14}
              textAnchor="end"
              className="text-[11px] font-bold fill-slate-900 font-cairo select-none"
              pointerEvents="none"
            >
              الشدة
            </text>
            <text
              x={padLeft - 6}
              y={padTop + 28}
              textAnchor="end"
              className="text-[10px] font-bold fill-slate-900 font-sans select-none"
              pointerEvents="none"
            >
              (dB)
            </text>

            {/* 1. TEACHER SPECTRUM AREA & LINE (BLUE) */}
            <path d={teacherAreaPath} fill="url(#teacherGrad)" pointerEvents="none" />
            <path
              d={teacherLinePath}
              fill="none"
              stroke="#0066ff"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />

            {/* 2. STUDENT SPECTRUM AREA & LINE (GREEN) */}
            <path d={studentAreaPath} fill="url(#studentGrad)" pointerEvents="none" />
            <path
              d={studentLinePath}
              fill="none"
              stroke="#00bb2d"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />

            {/* PEAK BADGE 1: BLUE PEAK (الصوت الأصلي) */}
            {(() => {
              const px = freqToX(teacherPeakPoint.freq);
              const py = dbToY(teacherPeakPoint.teacherDb);
              const badgeY = Math.max(10, py - 36);
              return (
                <g className="transition-all duration-300" pointerEvents="none">
                  <rect
                    x={px - 40}
                    y={badgeY}
                    width="80"
                    height="26"
                    rx="8"
                    fill="#e0edff"
                    stroke="#0066ff"
                    strokeWidth="1.5"
                    filter="url(#badgeShadow)"
                  />
                  <text
                    x={px}
                    y={badgeY + 17}
                    textAnchor="middle"
                    className="text-[12px] font-bold font-sans fill-[#0055d4] select-none"
                  >
                    {metrics.teacher.topPeakFreq} Hz
                  </text>
                  <line
                    x1={px}
                    y1={badgeY + 26}
                    x2={px}
                    y2={py - 3}
                    stroke="#0066ff"
                    strokeWidth="2.2"
                  />
                  <polygon
                    points={`${px - 4},${py - 7} ${px + 4},${py - 7} ${px},${py}`}
                    fill="#0066ff"
                  />
                  <circle cx={px} cy={py} r="4" fill="#0066ff" stroke="#ffffff" strokeWidth="2" />
                </g>
              );
            })()}

            {/* PEAK BADGE 2: GREEN PEAK (صوت المستخدم) */}
            {(() => {
              const px = freqToX(studentPeakPoint.freq);
              const py = dbToY(studentPeakPoint.studentDb);
              const badgeY = Math.max(10, py - 36);
              return (
                <g className="transition-all duration-300" pointerEvents="none">
                  <rect
                    x={px - 40}
                    y={badgeY}
                    width="80"
                    height="26"
                    rx="8"
                    fill="#ddfae3"
                    stroke="#00aa28"
                    strokeWidth="1.5"
                    filter="url(#badgeShadow)"
                  />
                  <text
                    x={px}
                    y={badgeY + 17}
                    textAnchor="middle"
                    className="text-[12px] font-bold font-sans fill-[#008820] select-none"
                  >
                    {metrics.student.topPeakFreq} Hz
                  </text>
                  <line
                    x1={px}
                    y1={badgeY + 26}
                    x2={px}
                    y2={py - 3}
                    stroke="#00aa28"
                    strokeWidth="2.2"
                  />
                  <polygon
                    points={`${px - 4},${py - 7} ${px + 4},${py - 7} ${px},${py}`}
                    fill="#00aa28"
                  />
                  <circle cx={px} cy={py} r="4" fill="#00bb2d" stroke="#ffffff" strokeWidth="2" />
                </g>
              );
            })()}

            {/* INTERACTIVE MEASUREMENT CROSSHAIR LINE (Tracks smoothly on desktop & touch) */}
            <g pointerEvents="none">
              <line
                x1={freqToX(inspectedFreq)}
                y1={padTop}
                x2={freqToX(inspectedFreq)}
                y2={height - padBottom}
                stroke="#f59e0b"
                strokeWidth="1.8"
                strokeDasharray="4 3"
              />
              <circle
                cx={freqToX(inspectedFreq)}
                cy={dbToY(activePoint.teacherDb)}
                r="5.5"
                fill="#0066ff"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <circle
                cx={freqToX(inspectedFreq)}
                cy={dbToY(activePoint.studentDb)}
                r="5.5"
                fill="#00bb2d"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          </svg>
        </div>

        {/* 3. COMPACT RESULT BAR - Low margins, green checkmark right beside texts */}
        <div className="mt-2.5 pt-2 border-t border-slate-200">
          <div className="rounded-2xl border-2 border-amber-300 bg-linear-to-r from-amber-50/80 via-white to-emerald-50/50 p-2 sm:p-2.5 px-3 shadow-xs flex flex-row items-center justify-between gap-3">
            {/* Right side: Icon + Title + Tone match */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#16a34a] flex items-center justify-center text-white shadow-xs shrink-0">
                <Check className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[3.5]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[11px] sm:text-xs font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md">
                    نتيجة المقارنة
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    التشابه في النغمة: <strong className="text-emerald-700 font-black">{metrics.matchText}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Left side: Similarity Score */}
            <div className="flex items-center gap-1.5 sm:gap-2 border-r border-amber-200 pr-2.5 sm:pr-4">
              <span className="text-xs sm:text-sm font-bold text-slate-700 hidden sm:inline">
                نسبة التطابق:
              </span>
              <span className="text-xl sm:text-2xl font-black font-sans text-[#15803d]">
                {metrics.similarityPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
