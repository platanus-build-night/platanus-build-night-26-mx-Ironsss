<p align="center">
  <img src="public/LogoEasyFisio.png" alt="EasyFisio Logo" width="400" />
</p>

<h3 align="center">Biomechanical analysis of therapeutic exercises using computer vision</h3>

<p align="center">
  <strong>100% client-side</strong> — no servers, no API keys, everything runs in the browser
</p>

<p align="center">
  <a href="https://ironsss.github.io/easyfisio/">Live Demo</a> &nbsp;·&nbsp;
  <a href="https://github.com/Ironsss/easyfisio">Deploy Repo</a> &nbsp;·&nbsp;
  <a href="https://github.com/platanus-build-night/platanus-build-night-26-mx-Ironsss">Hackathon Repo (original)</a>
</p>

<p align="center">
  <em>Proyecto creado en <strong>Platanus Build Night #26 MX</strong></em><br/>
  Hacker: <strong>David Alexis Garcia Espinosa</strong> (<a href="https://github.com/Ironsss">@Ironsss</a>)
</p>

> **Nota sobre deploy:** El deploy en GitHub Pages se realizó en un [repo espejo](https://github.com/Ironsss/easyfisio) ya que la organización del hackathon no otorgaba permisos de admin suficientes para habilitar Pages. El código fuente es idéntico.

---

## Qué hace

Sube un video de un **curl de bíceps** y obtén:

- **8 métricas clínicas** con evaluación automática y tips accionables
- **Detección adaptativa de repeticiones** via análisis de ángulo del codo
- **Skeleton overlay en tiempo real** con anotaciones de MediaPipe Pose sobre el video
- **Digital Twin 3D** — réplica de cuerpo completo sincronizada con el video
- **Visor de segmento FEA** — mapa de esfuerzo con jet colormap en el brazo activo
- **Interpretación por rep** — hallazgos detallados para cada repetición (score + findings)
- **Charts interactivos** — series de tiempo, desglose por rep, y perfil radar
- **Pestaña de Metodología** — fórmulas en LaTeX (KaTeX), diagrama de arquitectura, tech stack
- **Historial de sesiones** (localStorage + modo demo con progresión de 6 semanas)

---

## Arquitectura

```
┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────┐    ┌─────────────┐
│  Video Input │───▶│  Pose Detection  │───▶│  Analysis Engine  │───▶│  3D Digital Twin  │───▶│  Dashboard  │
│  MP4 / WebM  │    │  MediaPipe Pose  │    │  Angles, reps,    │    │  Three.js         │    │  Recharts   │
│  (browser)   │    │  Landmarker WASM │    │  clinical metrics │    │  Mannequin + FEA  │    │  React UI   │
└─────────────┘    └──────────────────┘    └───────────────────┘    └──────────────────┘    └─────────────┘
```

### Pipeline de procesamiento

```
Video (frame-by-frame)
  │
  ▼
MediaPipe Pose Landmarker (WASM + GPU)
  │  33 landmarks por frame (x, y, z, visibility)
  ▼
Cálculo de ángulos
  │  Ángulo del codo: arccos del producto punto entre vectores shoulder→elbow y wrist→elbow
  │  Ángulo del tronco: desviación lateral del torso
  ▼
Detección de repeticiones
  │  Análisis de picos/valles en la señal del ángulo del codo
  │  Umbral adaptativo basado en la amplitud de la señal
  ▼
Métricas clínicas (8 métricas por rep y globales)
  │  ROM, velocidad angular, TUT, ratio C:E, fatigue index,
  │  compensación de tronco, consistencia (CV), hold time
  ▼
Visualización
  ├── Skeleton overlay sobre video (Canvas 2D)
  ├── Digital Twin 3D (Three.js — LatheGeometry, PBR materials, studio lighting)
  ├── Visor FEA del brazo (BufferGeometry con vertex colors, jet colormap)
  ├── Charts interactivos (Recharts — LineChart, BarChart, AreaChart, RadarChart)
  └── Dashboard con interpretación por rep (score + findings + tips)
```

---

## Métricas clínicas

| Métrica | Qué mide | Óptimo | Uso clínico |
|---------|----------|--------|-------------|
| ROM | Rango de movimiento del codo | 120–140° | Recuperación articular |
| Velocidad angular | Control neuromuscular | 40–80 °/s | Espasticidad, potencia |
| TUT | Tiempo bajo tensión | 3–5s/rep | Dosificación del ejercicio |
| Ratio C:E | Tempo concéntrico vs excéntrico | 0.4–0.7 | Tendinopatías |
| Índice de fatiga | Degradación del ROM en la serie | < 10% | Prescripción de carga |
| Compensación tronco | Inclinación lateral del torso | < 5° | Técnica, carga excesiva |
| CV (Consistencia) | Variabilidad entre reps | < 5% | Control motor |
| Hold Time | Pausa en contracción máxima | 0.5–2.0s | Fuerza isométrica |

Documentación completa con fórmulas y referencias: [`docs/CLINICAL_METRICS.md`](docs/CLINICAL_METRICS.md)

---

## Features

### Skeleton Overlay
El video analizado muestra landmarks de MediaPipe Pose en tiempo real:
- **Brazo activo** resaltado en rojo con ángulo del codo en tiempo real
- **Resto del cuerpo** en verde (hombros, torso, caderas, piernas)
- Toggle on/off con el botón de Skeleton

### Digital Twin 3D
Réplica de cuerpo completo renderizada en Three.js:
- Geometría orgánica con LatheGeometry (bulge muscular)
- Materiales PBR con iluminación de estudio (key + fill + rim + hemisphere)
- Sombras suaves (PCFSoftShadowMap)
- Brazo activo coloreado por score de la rep (verde/amarillo/rojo)
- Etiqueta de ángulo del codo con sprite 3D
- Controles de órbita + presets de cámara (Frontal, Lateral, 3/4, Espalda)
- Sincronizado con la reproducción del video

### Visor de Segmento FEA
Vista de detalle del brazo con mapa de esfuerzo:
- BufferGeometry con vertex colors (jet colormap: azul → verde → amarillo → rojo)
- Wireframe overlay semitransparente
- Puño modelado (palma + 4 dedos + pulgar)
- Articulaciones en rosa para distinguir de los esfuerzos
- Barra de color con escala de stress

### Interpretación por Rep
Cada repetición recibe un score (Excelente / Aceptable / Mejorable) con hallazgos contextuales:
- ROM vs promedio de la serie
- Evaluación de compensación del tronco
- Análisis de tempo (concéntrico vs excéntrico)
- Detección de fatiga en reps tardías
- Evaluación de hold isométrico

### Charts interactivos
- Series de tiempo: ángulo del codo, velocidad angular, compensación del tronco
- Zonas de referencia coloreadas (verde = óptimo, amarillo = aceptable, rojo = corregir)
- Marcadores de repeticiones con ReferenceLine
- Texto explicativo debajo de cada chart ("Cómo leer")

### Metodología
- Diagrama de pipeline completo
- Tech stack con versiones, licencias y uso de cada paquetería
- Mapa de componentes del proyecto
- Fórmulas renderizadas en LaTeX con KaTeX

### Loading Spinner
Anillo rotatorio de emojis de hueso durante el análisis del video

---

## Tech Stack

| Tecnología | Versión | Licencia | Uso |
|-----------|---------|----------|-----|
| React | 18.3 | MIT | UI framework, componentes, estado |
| Vite | 5.4 | MIT | Build tool, HMR, bundling |
| MediaPipe Pose Landmarker | 0.10.18 | Apache 2.0 | Detección de pose (WASM + GPU) — 33 landmarks por frame |
| Three.js | 0.184.0 | MIT | Motor 3D WebGL — Digital Twin (LatheGeometry, PBR) + visor FEA (BufferGeometry, vertex colors) |
| Recharts | 2.12.7 | MIT | Charts interactivos (LineChart, BarChart, AreaChart, RadarChart) |
| KaTeX | 0.16.11 | MIT | Renderizado de fórmulas LaTeX |
| Tailwind CSS | CDN | MIT | Framework CSS utility-first |
| Google Fonts | CDN | OFL | Plus Jakarta Sans, Inter, JetBrains Mono |

---

## Estructura del proyecto

```
src/
├── main.jsx                        # Entry point — monta React en el DOM
├── App.jsx                         # App principal: Upload, Processing, Dashboard,
│                                   #   Feedback, TimeSeries, Reps, Methodology, History
├── index.css                       # Estilos globales + animaciones
├── analysis/
│   └── engine.js                   # Motor de análisis: MediaPipe + ángulos + detección
│                                   #   adaptativa de reps + 8 métricas clínicas
├── components/
│   ├── MannequinViewer.jsx         # Digital Twin 3D — cuerpo completo con LatheGeometry,
│   │                               #   materiales PBR, sombras, iluminación de estudio
│   └── ArmDetailViewer.jsx         # Visor FEA del brazo — BufferGeometry con vertex colors,
│                                   #   jet colormap, wireframe overlay, puño modelado
├── data/
│   └── demoHistory.js              # Datos demo: 6 semanas de progresión de rehabilitación
public/
│   └── LogoEasyFisio.png           # Logo
.github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions: build + deploy a GitHub Pages
```

---

## Quick Start

```bash
git clone https://github.com/platanus-build-night/platanus-build-night-26-mx-Ironsss.git
cd platanus-build-night-26-mx-Ironsss
npm install
npm run dev
```

Abre `http://localhost:5173/easyfisio/` en tu navegador.

### Deploy

```bash
npm run deploy
```

Esto hace build con Vite y publica la carpeta `dist/` en la branch `gh-pages`.

---

## Tips para grabar videos

- Graba de **perfil** (vista lateral) para mejor detección
- Buena **iluminación** — evita contraluz
- El brazo activo debe ser **completamente visible**
- **15-30 segundos** es suficiente para 8-12 reps
- Usa trípode o apoya el celular para estabilidad
