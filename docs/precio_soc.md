# Precio SOC Netmask — punto de equilibrio con 4 clientes

Escenario de personal: **ajustado** — SOC OT ajustado: 1 analista N1, N2 y analista de vulnerabilidades con salario ajustado (-30 %), ingeniero de plataforma al 50 % y líder al 30 %; horario extendido 8x5 + disponibilidad.
Plan base por cliente: 10 dispositivos/consolas fuente, 0 agentes avanzados. TRM supuesta: 4000 COP/USD.
Retención base de eventos: 30 días en línea + 11 meses archivados.

## Precio propuesto (mensual por cliente, USD)

| Componente | Equilibrio | Precio lista |
|---|---:|---:|
| SOC de incidentes, plan base (plataforma + 10 dispositivos/consolas fuente) | $3,186.33 | $3,200.00 |
| Gestión de vulnerabilidades OT, por sede (sin licencia de sonda) | $292.60 | $560.00 |
| Vulnerabilidades desde la sede 11 del contrato (50 % de descuento) | — | $280.00 |
| Dispositivo/Consola fuente adicional | — | $52.00 |
| Agente avanzado adicional | — | $10.00 |
| UEBA por agente avanzado (opcional) | — | $11.00 |

Los dos servicios se venden juntos o por separado. El equilibrio por sede supone 2 sedes por cliente (8 sedes con 4 clientes). El equipo de vulnerabilidades cuesta $2,340.80/mes: a $560.00 por sede se cubre desde 5 sedes.

## Costos mensuales con 4 clientes (40 dispositivos/consolas fuente agregados en FortiSIEM)

| Concepto | USD/mes |
|---|---:|
| Personal — incidentes | $4,484.00 |
| Personal — vulnerabilidades | $2,128.00 |
| Personal — compartido | $3,306.00 |
| Disponibilidad fuera de horario | $375.00 |
| Azure consumo base: 2 VM FortiSIEM MSSP (Supervisor + Worker) | $400.00 |
| Herramientas SOC (ticketing, threat intel, acceso remoto) | $150.00 |
| Cuota anual programa FortiSIEM MSSP (prorrateada /12) | $416.67 |
| Licencia FortiSIEM dispositivos (50 facturables × $25.52) | $1,276.00 |
| Licencia FortiSIEM agentes_avanzados (50 facturables × $4.97) | $248.50 |
| Licencia FortiSIEM ueba (25 facturables × $5.22) | $130.50 |
| Azure almacenamiento de eventos por cliente × 4 | $800.00 |
| Contingencia (10%) | $1,371.47 |
| **Total** | **$15,086.13** |

## SOC de incidentes: sensibilidad al número de clientes (plan base $3,200.00)

Costo sin el equipo de vulnerabilidades, que lo cubre su propio servicio.

| Clientes | Ingreso | Costo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $3,200.00 | $12,085.33 | $-8,885.33 | -277.67% |
| 2 | $6,400.00 | $12,305.33 | $-5,905.33 | -92.27% |
| 3 | $9,600.00 | $12,525.33 | $-2,925.33 | -30.47% |
| 4 | $12,800.00 | $12,745.33 | $54.67 | 0.43% |
| 5 | $16,000.00 | $12,965.33 | $3,034.67 | 18.97% |
| 6 | $19,200.00 | $13,466.05 | $5,733.95 | 29.86% |
| 7 ⚠️ requiere ampliar equipo | $22,400.00 | $13,966.77 | $8,433.23 | 37.65% |
| 8 ⚠️ requiere ampliar equipo | $25,600.00 | $14,467.49 | $11,132.51 | 43.49% |
| 9 ⚠️ requiere ampliar equipo | $28,800.00 | $14,968.21 | $13,831.79 | 48.03% |
| 10 ⚠️ requiere ampliar equipo | $32,000.00 | $15,468.93 | $16,531.07 | 51.66% |

## Gestión de vulnerabilidades: sensibilidad al número de sedes ($560.00 por sede)

| Sedes | Ingreso | Costo equipo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $560.00 | $2,340.80 | $-1,780.80 | -318.00% |
| 2 | $1,120.00 | $2,340.80 | $-1,220.80 | -109.00% |
| 3 | $1,680.00 | $2,340.80 | $-660.80 | -39.33% |
| 4 | $2,240.00 | $2,340.80 | $-100.80 | -4.50% |
| 5 | $2,800.00 | $2,340.80 | $459.20 | 16.40% |
| 6 | $3,360.00 | $2,340.80 | $1,019.20 | 30.33% |
| 7 | $3,920.00 | $2,340.80 | $1,579.20 | 40.29% |
| 8 | $4,480.00 | $2,340.80 | $2,139.20 | 47.75% |
| 9 | $5,040.00 | $2,340.80 | $2,699.20 | 53.56% |
| 10 | $5,600.00 | $2,340.80 | $3,259.20 | 58.20% |
| 11 ⚠️ requiere ampliar equipo | $6,160.00 | $2,340.80 | $3,819.20 | 62.00% |
| 12 ⚠️ requiere ampliar equipo | $6,720.00 | $2,340.80 | $4,379.20 | 65.17% |

## Colector FortiSIEM (opcional, se cobra aparte del plan)

| Opción | Cargo adicional mensual | Duración del cargo | Total cobrado vs costo |
|---|---:|---|---|
| VM o servidor del cliente | $0.00 | recurrente | — |
| NUC industrial on-prem | $250.00 | 12 meses | $3,000.00 vs $1,500.00 |
| Colector en Azure | $200.00 | recurrente | — |

## Referencia: almacenamiento con la retención base

Un cliente con 200 EPS promedio genera ~8.6 GB/día crudos. Con compresión al 15% mantiene ~39 GB en línea ($0.15/GB-mes) y ~428 GB archivados ($0.02/GB-mes): $14.39/mes. El presupuesto de almacenamiento por cliente cubre ~2781 EPS.

