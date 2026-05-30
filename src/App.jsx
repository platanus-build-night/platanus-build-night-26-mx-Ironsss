import React, { useState, useRef, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { processVideo, assessMetric, saveSession, getHistory } from './analysis/engine';
import { DEMO_HISTORY, getProgressionData } from './data/demoHistory';

// ════════════════════════════════════════════════
// APP
// ════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState('upload'); // upload | processing | dashboard | history
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [results, setResults] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback(async (file) => {
    if (!file || !file.type.startsWith('video/')) {
      alert('Por favor selecciona un archivo de video');
      return;
    }

    setVideoURL(URL.createObjectURL(file));
    setView('processing');
    setProgressPct(0);

    try {
      const data = await processVideo(
        file,
        (msg) => {
          setProgress(msg);
          const match = msg.match(/(\d+)%/);
          if (match) setProgressPct(parseInt(match[1]));
        },
        null
      );

      if (data.error) {
        alert(data.error);
        setView('upload');
        return;
      }

      setResults(data);
      saveSession(data);
      setView('dashboard');
    } catch (err) {
      console.error(err);
      alert('Error procesando video: ' + err.message);
      setView('upload');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  return (
    <div className="min-h-screen bg-bone">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-ink text-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => setView('upload')} className="flex items-center gap-2">
          <span className="text-accent text-xl font-bold font-display">RM</span>
          <span className="font-display text-lg hidden sm:inline">RehabMotion</span>
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <span className={demoMode ? 'text-glow' : 'text-white/50'}>Demo</span>
            <div
              className={`w-10 h-5 rounded-full relative transition-colors ${demoMode ? 'bg-glow' : 'bg-white/20'}`}
              onClick={() => setDemoMode(!demoMode)}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${demoMode ? 'left-5.5' : 'left-0.5'}`}
                style={{ left: demoMode ? '22px' : '2px' }} />
            </div>
          </label>
          <button
            onClick={() => setView('history')}
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
          >
            Historial
          </button>
        </div>
      </header>

      {/* Views */}
      {view === 'upload' && (
        <UploadView
          onFileSelect={handleFileSelect}
          onDrop={handleDrop}
          fileInputRef={fileInputRef}
        />
      )}
      {view === 'processing' && (
        <ProcessingView progress={progress} progressPct={progressPct} />
      )}
      {view === 'dashboard' && results && (
        <DashboardView
          results={results}
          videoURL={videoURL}
          onNewAnalysis={() => setView('upload')}
        />
      )}
      {view === 'history' && (
        <HistoryView
          demoMode={demoMode}
          onBack={() => setView(results ? 'dashboard' : 'upload')}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// UPLOAD VIEW
// ════════════════════════════════════════════════
function UploadView({ onFileSelect, onDrop, fileInputRef }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="max-w-lg mx-auto px-4 pt-12 pb-20">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl sm:text-5xl text-ink mb-3">
          Análisis de<br /><span className="text-accent">Movimiento</span>
        </h1>
        <p className="text-ink/60 text-sm max-w-sm mx-auto">
          Sube un video de flexión de bíceps y obtén métricas biomecánicas clínicas al instante.
          Sin servidores — todo se procesa en tu dispositivo.
        </p>
      </div>

      <div
        className={`upload-zone rounded-2xl p-10 text-center cursor-pointer ${dragOver ? 'drag-over' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={(e) => { setDragOver(false); onDrop(e); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="text-5xl mb-4">🎬</div>
        <p className="font-medium text-ink/80 mb-1">Arrastra tu video aquí</p>
        <p className="text-sm text-ink/50">o toca para seleccionar</p>
        <p className="text-xs text-ink/40 mt-4">MP4, MOV, WebM • Máx 200MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        />
      </div>

      {/* Exercise info */}
      <div className="mt-8 bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-display text-lg mb-2">Ejercicio: Flexión de Bíceps</h3>
        <p className="text-sm text-ink/60 mb-3">
          Graba el ejercicio preferentemente de perfil (vista lateral) con buena iluminación.
          El análisis detectará automáticamente el brazo activo.
        </p>
        <div className="flex gap-2 flex-wrap">
          {['ROM', 'Velocidad', 'Fatiga', 'Compensación', 'Tempo'].map(tag => (
            <span key={tag} className="text-xs bg-mint/10 text-mint px-2.5 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// PROCESSING VIEW
// ════════════════════════════════════════════════
function ProcessingView({ progress, progressPct }) {
  return (
    <div className="max-w-md mx-auto px-4 pt-24 text-center">
      <div className="text-6xl mb-6 animate-pulse">🦴</div>
      <h2 className="font-display text-2xl mb-2">Analizando poses</h2>
      <p className="text-sm text-ink/60 mb-8">{progress}</p>

      <div className="w-full bg-ink/10 rounded-full h-3 mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-glow rounded-full transition-all duration-300 progress-glow"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="font-mono text-sm text-ink/40">{progressPct}%</p>

      <p className="text-xs text-ink/40 mt-12 max-w-xs mx-auto">
        MediaPipe Pose Landmarker corriendo localmente en tu dispositivo.
        Ningún dato sale de tu navegador.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════
// DASHBOARD VIEW
// ════════════════════════════════════════════════
function DashboardView({ results, videoURL, onNewAnalysis }) {
  const { summary, repMetrics, timeSeries, totalReps, activeSide, duration } = results;
  const [activeTab, setActiveTab] = useState('overview'); // overview | reps | timeseries

  const tabs = [
    { id: 'overview', label: 'Resumen' },
    { id: 'reps', label: 'Por Rep' },
    { id: 'timeseries', label: 'Serie Temporal' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      {/* Summary header */}
      <div className="bg-ink text-white rounded-2xl p-5 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-display text-2xl">Flexión de Bíceps</h2>
            <p className="text-white/50 text-sm mt-1">
              {totalReps} repeticiones • Brazo {activeSide === 'left' ? 'izquierdo' : 'derecho'} • {Math.round(duration)}s
            </p>
          </div>
          <button
            onClick={onNewAnalysis}
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
          >
            + Nuevo
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <QuickStat label="ROM medio" value={`${summary.meanROM}°`} assessment={assessMetric('rom', summary.meanROM)} />
          <QuickStat label="Fatiga" value={`${summary.fatigueIndexROM}%`} assessment={assessMetric('fatigueROM', summary.fatigueIndexROM)} />
          <QuickStat label="Consistencia" value={`CV ${summary.cvROM}%`} assessment={assessMetric('cvROM', summary.cvROM)} />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-ink/5 rounded-xl p-1 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-white text-ink font-medium shadow-sm'
                : 'text-ink/50 hover:text-ink/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab summary={summary} repMetrics={repMetrics} />}
      {activeTab === 'reps' && <RepsTab repMetrics={repMetrics} />}
      {activeTab === 'timeseries' && <TimeseriesTab timeSeries={timeSeries} />}
    </div>
  );
}

function QuickStat({ label, value, assessment }) {
  return (
    <div className="bg-white/10 rounded-xl p-3">
      <p className="text-white/50 text-xs mb-1">{label}</p>
      <p className="font-mono text-lg font-bold">{value}</p>
      <p className="text-xs mt-1" style={{ color: assessment.color }}>
        {assessment.icon} {assessment.label}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────
// OVERVIEW TAB
// ────────────────────────────────────────────
function OverviewTab({ summary, repMetrics }) {
  const radarData = [
    { metric: 'ROM', value: Math.min(100, (summary.meanROM / 140) * 100), fullMark: 100 },
    { metric: 'Consistencia', value: Math.max(0, 100 - summary.cvROM * 5), fullMark: 100 },
    { metric: 'Control Exc.', value: Math.min(100, Math.max(0, (1 - Math.abs(summary.meanCERatio - 0.5) * 2) * 100)), fullMark: 100 },
    { metric: 'Resistencia', value: Math.max(0, 100 - summary.fatigueIndexROM * 3), fullMark: 100 },
    { metric: 'Postura', value: Math.max(0, 100 - summary.meanTrunkCompensation * 8), fullMark: 100 },
    { metric: 'Hold', value: Math.min(100, summary.meanHoldTime * 100), fullMark: 100 },
  ];

  return (
    <div className="space-y-4">
      {/* Radar chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-display text-lg mb-1">Perfil de Movimiento</h3>
        <p className="text-xs text-ink/40 mb-3">Evaluación normalizada 0–100</p>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#1A1A2E15" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#1A1A2E99' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#E94560" fill="#E94560" fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          title="ROM Medio"
          value={`${summary.meanROM}°`}
          subtitle={`σ = ${summary.stdROM}°`}
          assessment={assessMetric('rom', summary.meanROM)}
          detail="Rango de movimiento promedio del codo en todas las repeticiones"
        />
        <MetricCard
          title="Ratio C:E"
          value={summary.meanCERatio}
          subtitle="concéntrico/excéntrico"
          assessment={assessMetric('ceRatio', summary.meanCERatio)}
          detail="Ideal ≈ 0.5 (1:2). Excéntrica debe durar el doble que concéntrica"
        />
        <MetricCard
          title="Índice Fatiga"
          value={`${summary.fatigueIndexROM}%`}
          subtitle="ROM: primeras vs últimas"
          assessment={assessMetric('fatigueROM', summary.fatigueIndexROM)}
          detail="Degradación del ROM entre primeras y últimas repeticiones"
        />
        <MetricCard
          title="Compensación"
          value={`${summary.maxTrunkCompensation}°`}
          subtitle={`media: ${summary.meanTrunkCompensation}°`}
          assessment={assessMetric('trunkLean', summary.maxTrunkCompensation)}
          detail="Inclinación del tronco. > 10° indica peso excesivo"
        />
        <MetricCard
          title="TUT Total"
          value={`${summary.totalTUT}s`}
          subtitle={`${summary.meanTUT}s por rep`}
          assessment={{ label: summary.meanTUT > 3 ? 'Adecuado' : 'Bajo', color: summary.meanTUT > 3 ? '#16C79A' : '#F5A623', icon: summary.meanTUT > 3 ? '✓' : '⚡' }}
          detail="Tiempo bajo tensión total y por repetición"
        />
        <MetricCard
          title="Hold Pico"
          value={`${summary.meanHoldTime}s`}
          subtitle="en contracción máxima"
          assessment={{ label: summary.meanHoldTime > 0.3 ? 'Con pausa' : 'Sin pausa', color: summary.meanHoldTime > 0.3 ? '#16C79A' : '#F5A623', icon: summary.meanHoldTime > 0.3 ? '✓' : '—' }}
          detail="Tiempo en máxima flexión por repetición"
        />
      </div>

      {/* ROM per rep bar chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-display text-lg mb-1">ROM por Repetición</h3>
        <p className="text-xs text-ink/40 mb-3">Degradación indica fatiga muscular</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={repMetrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
            <XAxis dataKey="repNumber" tick={{ fontSize: 11 }} label={{ value: 'Rep', position: 'insideBottom', offset: -2, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(v) => [`${v}°`, 'ROM']}
            />
            <Bar dataKey="rom" fill="#E94560" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, assessment, detail }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="metric-card bg-white rounded-2xl p-4 shadow-sm cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <p className="text-xs text-ink/50 mb-1">{title}</p>
      <p className="font-mono text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink/40 mt-0.5">{subtitle}</p>
      <div className="mt-2 flex items-center gap-1">
        <span className="text-xs font-medium" style={{ color: assessment.color }}>
          {assessment.icon} {assessment.label}
        </span>
      </div>
      {expanded && (
        <p className="text-xs text-ink/50 mt-2 pt-2 border-t border-ink/10">{detail}</p>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// REPS TAB
// ────────────────────────────────────────────
function RepsTab({ repMetrics }) {
  return (
    <div className="space-y-3">
      {repMetrics.map((rep) => (
        <div key={rep.repNumber} className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-display text-lg">Rep {rep.repNumber}</h4>
            <span className="font-mono text-sm text-ink/50">{rep.tut}s</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-mono text-lg font-bold" style={{ color: assessMetric('rom', rep.rom).color }}>{rep.rom}°</p>
              <p className="text-[10px] text-ink/40">ROM</p>
            </div>
            <div>
              <p className="font-mono text-lg font-bold">{rep.ceRatio}</p>
              <p className="text-[10px] text-ink/40">C:E Ratio</p>
            </div>
            <div>
              <p className="font-mono text-lg font-bold" style={{ color: assessMetric('trunkLean', rep.maxTrunkLean).color }}>
                {rep.maxTrunkLean}°
              </p>
              <p className="text-[10px] text-ink/40">Tronco</p>
            </div>
          </div>
          {/* Mini bar showing concentric vs eccentric */}
          <div className="mt-3">
            <div className="flex h-2 rounded-full overflow-hidden bg-ink/5">
              <div
                className="bg-accent h-full rounded-l-full"
                style={{ width: `${(rep.tConcentric / rep.tut) * 100}%` }}
                title={`Concéntrica: ${rep.tConcentric}s`}
              />
              <div
                className="bg-glow h-full rounded-r-full"
                style={{ width: `${(rep.tEccentric / rep.tut) * 100}%` }}
                title={`Excéntrica: ${rep.tEccentric}s`}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-accent">Conc. {rep.tConcentric}s</span>
              <span className="text-[10px] text-glow">Exc. {rep.tEccentric}s</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────
// TIMESERIES TAB
// ────────────────────────────────────────────
function TimeseriesTab({ timeSeries }) {
  const chartData = timeSeries.timestamps.map((t, i) => ({
    time: Math.round(t * 100) / 100,
    angle: Math.round(timeSeries.elbowAngles[i] * 10) / 10,
    trunk: Math.round(timeSeries.trunkAngles[i] * 10) / 10,
  }));

  return (
    <div className="space-y-4">
      {/* Elbow angle over time */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-display text-lg mb-1">Ángulo del Codo</h3>
        <p className="text-xs text-ink/40 mb-3">Flexión/extensión a lo largo del tiempo (señal suavizada)</p>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="angleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E94560" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#E94560" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -2, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={[0, 180]} label={{ value: '°', position: 'insideLeft', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(v) => [`${v}°`, 'Ángulo codo']}
              labelFormatter={(v) => `${v}s`}
            />
            <ReferenceLine y={90} stroke="#F5A623" strokeDasharray="6 3" label={{ value: '90°', fontSize: 10, fill: '#F5A623' }} />
            <Area type="monotone" dataKey="angle" stroke="#E94560" fill="url(#angleGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Trunk lean over time */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-display text-lg mb-1">Compensación del Tronco</h3>
        <p className="text-xs text-ink/40 mb-3">Inclinación lateral. Zona roja: compensación excesiva</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="trunkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F3460" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#0F3460" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(v) => [`${v}°`, 'Tronco']}
            />
            <ReferenceLine y={10} stroke="#E94560" strokeDasharray="4 2" label={{ value: 'Límite', fontSize: 9, fill: '#E94560' }} />
            <Area type="monotone" dataKey="trunk" stroke="#0F3460" fill="url(#trunkGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// HISTORY VIEW
// ════════════════════════════════════════════════
function HistoryView({ demoMode, onBack }) {
  const history = demoMode ? DEMO_HISTORY : getHistory();
  const progression = demoMode ? getProgressionData() : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      <button onClick={onBack} className="text-sm text-ink/50 hover:text-ink mb-4 flex items-center gap-1">
        ← Volver
      </button>

      <h2 className="font-display text-2xl mb-1">
        {demoMode ? 'Historial Demo' : 'Tu Historial'}
      </h2>
      <p className="text-sm text-ink/50 mb-6">
        {demoMode
          ? 'Datos simulados: 6 semanas de rehabilitación de bíceps'
          : `${history.length} sesiones guardadas en este dispositivo`}
      </p>

      {demoMode && progression.length > 0 && (
        <div className="space-y-4 mb-8">
          {/* ROM progression */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-display text-lg mb-1">Progresión del ROM</h3>
            <p className="text-xs text-ink/40 mb-3">Tendencia a lo largo de las sesiones</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={progression}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[60, 150]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="rom" stroke="#E94560" strokeWidth={2.5} dot={{ fill: '#E94560', r: 4 }} name="ROM (°)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Fatigue + CV progression */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-display text-lg mb-1">Fatiga y Consistencia</h3>
            <p className="text-xs text-ink/40 mb-3">Ambas métricas deben disminuir con la rehabilitación</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={progression}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="fatigue" stroke="#E94560" strokeWidth={2} dot={{ fill: '#E94560', r: 3 }} name="Fatiga (%)" />
                <Line type="monotone" dataKey="cv" stroke="#0F3460" strokeWidth={2} dot={{ fill: '#0F3460', r: 3 }} name="CV ROM (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Trunk compensation trend */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-display text-lg mb-1">Compensación del Tronco</h3>
            <p className="text-xs text-ink/40 mb-3">Reducción indica mejor técnica y fuerza adecuada</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={progression}>
                <defs>
                  <linearGradient id="trunkProgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5A623" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F5A623" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A2E10" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <ReferenceLine y={5} stroke="#16C79A" strokeDasharray="4 2" label={{ value: 'Ideal', fontSize: 9, fill: '#16C79A' }} />
                <Area type="monotone" dataKey="trunk" stroke="#F5A623" fill="url(#trunkProgGrad)" strokeWidth={2} dot={{ fill: '#F5A623', r: 3 }} name="Tronco (°)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="space-y-3">
        {history.map((session, i) => (
          <div key={session.id || i} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display text-base">
                  {session.label || `Sesión ${i + 1}`}
                </h4>
                <p className="text-xs text-ink/40">
                  {new Date(session.savedAt || session.analyzedAt).toLocaleDateString('es-MX', {
                    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-bold text-accent">{session.totalReps} reps</p>
                <p className="text-xs text-ink/40">ROM {session.summary?.meanROM || '—'}°</p>
              </div>
            </div>
            {session.summary && (
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-ink/5">
                <MiniStat label="TUT" value={`${session.summary.totalTUT}s`} />
                <MiniStat label="Fatiga" value={`${session.summary.fatigueIndexROM}%`} />
                <MiniStat label="CV" value={`${session.summary.cvROM}%`} />
                <MiniStat label="Tronco" value={`${session.summary.meanTrunkCompensation}°`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {history.length === 0 && (
        <div className="text-center py-16 text-ink/30">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm">No hay sesiones guardadas aún</p>
          <p className="text-xs mt-1">Activa el toggle de Demo para ver datos de ejemplo</p>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="text-center">
      <p className="font-mono text-sm font-bold text-ink">{value}</p>
      <p className="text-[9px] text-ink/40">{label}</p>
    </div>
  );
}
