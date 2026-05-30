# Métricas Biomecánicas Clínicas — Flexión de Bíceps (Curl con Mancuernas)

## Landmarks Clave (MediaPipe Pose)
- **Hombro**: landmark 11 (izq) / 12 (der)
- **Codo**: landmark 13 (izq) / 14 (der)
- **Muñeca**: landmark 15 (izq) / 16 (der)
- **Cadera**: landmark 23 (izq) / 24 (der)

---

## 1. ROM — Rango de Movimiento (Range of Motion)

**Fórmula:**
```
ROM_rep = θ_extensión_máx − θ_flexión_mín
```
Donde `θ` es el ángulo del codo formado por los vectores hombro→codo y muñeca→codo.

**Cálculo del ángulo:**
```
θ = arccos( (A·B) / (|A|·|B|) )
A = hombro - codo
B = muñeca - codo
```

**Valores de referencia:**
- Extensión completa: ~160–170°
- Flexión máxima (curl completo): ~30–40°
- ROM saludable esperado: ~120–140°

**Justificación clínica:**
El ROM es el gold standard en rehabilitación para medir recuperación articular. Es la métrica #1 que un fisioterapeuta documenta en cada sesión. La pérdida de ROM indica restricción articular, fibrosis, dolor inhibitorio, o debilidad muscular.

**Dónde se usa:**
- Rehabilitación post-quirúrgica (manguito rotador, fracturas de húmero)
- Seguimiento de capsulitis adhesiva ("hombro congelado")
- Evaluación de artritis reumatoide y osteoartritis
- Progresión en protocolos de fortalecimiento

**Referencia:** Norkin & White, *Measurement of Joint Motion: A Guide to Goniometry*, 6th Ed.

---

## 2. Velocidad Angular (ω — Angular Velocity)

**Fórmula:**
```
ω_instantánea = |θ(t) − θ(t−1)| / Δt    [°/s]
ω_media_fase = |θ_final − θ_inicial| / t_fase
ω_pico = max(ω_instantánea) en la fase
```

**Valores de referencia:**
- Curl controlado: 40–80 °/s
- Curl explosivo/deportivo: 100–200 °/s
- Movimiento muy lento (rehab): 15–30 °/s

**Justificación clínica:**
La velocidad angular revela control neuromuscular. Un movimiento balístico (muy rápido) indica uso de momentum en lugar de fuerza muscular. Un movimiento excesivamente lento puede indicar debilidad o dolor. La asimetría de velocidad entre fases concéntrica y excéntrica es marcador de patología.

**Dónde se usa:**
- Rehabilitación neurológica post-ACV (evaluación de espasticidad y control motor)
- Evaluación isocinética (comparación con dinamómetro Biodex)
- Deportes: medición de potencia en fases explosivas
- Detección de fatiga neuromuscular

**Referencia:** Winter, D.A., *Biomechanics and Motor Control of Human Movement*, 4th Ed.

---

## 3. Tiempo Bajo Tensión (TUT — Time Under Tension)

**Fórmula:**
```
TUT_rep = t_fin_rep − t_inicio_rep    [segundos]
TUT_total = Σ TUT_rep    [segundos]
```
El inicio y fin de rep se definen por los cruces del ángulo por un umbral (ej. cuando θ < 150° = "en movimiento").

**Valores de referencia:**
- Hipertrofia: 3–5 s por rep (40–70 s por set)
- Fuerza máxima: 1–3 s por rep
- Resistencia/rehab: 4–8 s por rep

**Justificación clínica:**
El TUT determina el estímulo mecánico total sobre el músculo. Mayor TUT incrementa el estrés metabólico y la activación de unidades motoras. En rehabilitación, prescribir TUT específico asegura dosis terapéutica adecuada.

**Dónde se usa:**
- Programación de entrenamiento de hipertrofia (Schoenfeld, 2010)
- Protocolos de rehabilitación por sarcopenia en adultos mayores
- Dosificación de ejercicio en tendinopatías

**Referencia:** Burd et al. (2012), *Muscle time under tension during resistance exercise stimulates differential muscle protein sub-fractional synthetic responses in men*, J Physiol.

---

## 4. Ratio Concéntrico:Excéntrico (C:E Ratio)

**Fórmula:**
```
Ratio_CE = t_concéntrico / t_excéntrico

t_concéntrico = duración fase de flexión (subir el peso, θ disminuye)
t_excéntrico = duración fase de extensión (bajar el peso, θ aumenta)
```

**Valores de referencia:**
- Ideal general: 1:2 (ej. 1s subiendo, 2s bajando)
- Protocolo excéntrico (rehab): 1:3 o 1:4
- Movimiento descontrolado: 1:0.5 (dejar caer el peso)

**Justificación clínica:**
La fase excéntrica es donde ocurre mayor remodelación tendinosa y adaptación muscular. Un ratio C:E invertido (excéntrica más rápida que concéntrica) indica pérdida de control, fatiga, o dolor. Los protocolos excéntricos (Alfredson) son tratamiento de primera línea en tendinopatías.

**Dónde se usa:**
- Tendinopatía del bíceps y epicondilitis (codo de tenista)
- Protocolos de Alfredson para tendón de Aquiles (adaptado a MMSS)
- Prevención de lesiones en atletas (ACL, isquiotibiales)
- Evaluación de control motor en neurorrehabilitación

**Referencia:** Alfredson H. et al. (1998), *Heavy-load eccentric calf muscle training for treatment of chronic Achilles tendinosis*, Am J Sports Med.

---

## 5. Índice de Fatiga (Fatigue Index)

**Fórmula:**
```
FI_ROM = ((ROM_primeras_3 − ROM_últimas_3) / ROM_primeras_3) × 100    [%]
FI_vel = ((ω_primeras_3 − ω_últimas_3) / ω_primeras_3) × 100    [%]

ROM_primeras_3 = promedio ROM de las 3 primeras repeticiones
ROM_últimas_3 = promedio ROM de las 3 últimas repeticiones
```

**Valores de referencia:**
- FI < 10%: Fatiga mínima, peso adecuado
- FI 10–25%: Fatiga moderada, esperable en sets de 8–12 reps
- FI > 25%: Fatiga excesiva, considerar reducir carga

**Justificación clínica:**
Cuantifica objetivamente la degradación del rendimiento a lo largo de un set. Permite identificar el punto exacto donde la forma se deteriora (rep de quiebre). En rehabilitación, indica cuántas repeticiones puede hacer el paciente manteniendo calidad de movimiento.

**Dónde se usa:**
- Determinación de carga óptima en rehabilitación
- Evaluación de resistencia muscular localizada
- Seguimiento de progresión de fuerza en sesiones sucesivas
- Prescripción basada en RPE (Rate of Perceived Exertion)

**Referencia:** Enoka & Duchateau (2008), *Muscle fatigue: what, why and how it influences muscle function*, J Physiol.

---

## 6. Ángulo de Compensación del Tronco (Trunk Lean)

**Fórmula:**
```
θ_tronco = arctan2(hombro_x − cadera_x, cadera_y − hombro_y) × (180/π)

Compensación = |θ_tronco|    [grados desde vertical]
```
Nota: se usa cadera_y − hombro_y porque el eje Y en MediaPipe va hacia abajo.

**Valores de referencia:**
- Ideal: < 5° de desviación
- Compensación leve: 5–10°
- Compensación significativa: > 10° (peso excesivo o debilidad)

**Justificación clínica:**
En el curl de bíceps, inclinar el tronco hacia atrás es la compensación más común. Indica que el peso excede la capacidad del bíceps y el paciente/atleta recluta momentum y musculatura lumbar. Es factor de riesgo para lesión lumbar y reduce la eficacia del ejercicio.

**Dónde se usa:**
- Evaluación de calidad de movimiento en cualquier ejercicio de MMSS
- Detección de carga excesiva en programas de fortalecimiento
- Evaluación funcional en lumbalgia (uso compensatorio del tronco)

**Referencia:** Sahrmann, S., *Movement System Impairment Syndromes of the Extremities, Cervical and Thoracic Spines*.

---

## 7. Coeficiente de Variación (CV — Rep Consistency)

**Fórmula:**
```
CV = (σ_ROM / μ_ROM) × 100    [%]

σ_ROM = desviación estándar del ROM entre todas las reps
μ_ROM = media del ROM entre todas las reps
```
Se puede aplicar también a TUT y velocidad angular.

**Valores de referencia:**
- CV < 5%: Alta consistencia (atleta entrenado o patrón motor consolidado)
- CV 5–15%: Variabilidad normal
- CV > 15%: Inconsistencia significativa (fatiga, dolor, aprendizaje motor temprano)

**Justificación clínica:**
La variabilidad del movimiento es un indicador de madurez del patrón motor. En rehabilitación, alta variabilidad temprana que se reduce a lo largo de sesiones indica aprendizaje motor exitoso. Variabilidad que aumenta dentro de un set indica fatiga.

**Dónde se usa:**
- Evaluación de aprendizaje motor (neurorrehabilitación post-ACV)
- Monitoreo de Parkinson y trastornos del movimiento
- Progresión en programas de ejercicio terapéutico
- Control de calidad en entrenamiento deportivo

**Referencia:** Stergiou & Decker (2011), *Human Movement Variability, Nonlinear Dynamics, and Pathology*, Human Movement Science.

---

## 8. Tiempo de Contracción Pico (Peak Hold Time)

**Fórmula:**
```
t_hold = duración donde θ < θ_umbral    [segundos]
θ_umbral = ángulo de máxima flexión + 10° (ej. si mín = 35°, umbral = 45°)
```

**Valores de referencia:**
- Sin pausa intencional: < 0.3 s
- Pausa isométrica controlada: 0.5–2.0 s
- Protocolo isométrico terapéutico: 2–5 s

**Justificación clínica:**
El tiempo en contracción máxima indica capacidad de control voluntario y fuerza isométrica en el punto de mayor acortamiento muscular. Protocolos isométricos son analgésicos en tendinopatías (Rio et al., 2015).

**Dónde se usa:**
- Evaluación de fuerza isométrica sin dinamómetro
- Protocolos de isometría para manejo del dolor en tendinopatías
- Evaluación de control motor fino

**Referencia:** Rio et al. (2015), *Isometric exercise induces analgesia and reduces inhibition in patellar tendinopathy*, Br J Sports Med.
