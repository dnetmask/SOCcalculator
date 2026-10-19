# Precio SOC Netmask — punto de equilibrio con 4 clientes

Escenario de personal: **ajustado** — SOC OT ajustado: 1 analista N1, 1 N2 y 1 analista de vulnerabilidades, ingeniero de plataforma al 50 % y líder al 30 %; salarios base ajustados (-40 % sobre la referencia; N2 y vulnerabilidades además -30 %); horario extendido 8x5 + disponibilidad.
Plan base por cliente: 10 dispositivos/consolas fuente, 0 agentes avanzados. TRM supuesta: 4000 COP/USD.
Retención base de eventos: 30 días en línea + 11 meses archivados.

## Precio propuesto (mensual por cliente, USD)

| Componente | Equilibrio | Precio lista |
|---|---:|---:|
| SOC de incidentes, plan base (plataforma + 10 dispositivos/consolas fuente) | $2,329.43 | $2,350.00 |
| Gestión de vulnerabilidades OT, por sede (sin licencia de sonda) | $175.56 | $560.00 |
| Vulnerabilidades desde la sede 11 del contrato (50 % de descuento) | — | $280.00 |
| Dispositivo/Consola fuente adicional | — | $52.00 |
| Agente avanzado adicional | — | $10.00 |
| UEBA por agente avanzado (opcional) | — | $11.00 |

Los dos servicios se venden juntos o por separado. El equilibrio por sede supone 2 sedes por cliente (8 sedes con 4 clientes). El equipo de vulnerabilidades cuesta $1,404.48/mes: a $560.00 por sede se cubre desde 3 sedes.

## Costos mensuales con 4 clientes (40 dispositivos/consolas fuente agregados en FortiSIEM)

| Concepto | USD/mes |
|---|---:|
| Personal — incidentes | $2,690.40 |
| Personal — vulnerabilidades | $1,276.80 |
| Personal — compartido | $1,983.60 |
| Disponibilidad fuera de horario | $375.00 |
| Azure consumo base: 2 VM FortiSIEM MSSP (Supervisor + Worker) | $400.00 |
| Herramientas SOC (ticketing, threat intel, acceso remoto) | $150.00 |
| Cuota anual programa FortiSIEM MSSP (prorrateada /12) | $416.67 |
| Licencia FortiSIEM dispositivos (50 facturables × $25.52) | $1,276.00 |
| Licencia FortiSIEM agentes_avanzados (50 facturables × $4.97) | $248.50 |
| Licencia FortiSIEM ueba (25 facturables × $5.22) | $130.50 |
| Azure almacenamiento de eventos por cliente × 4 | $800.00 |
| Contingencia (10%) | $974.75 |
| **Total** | **$10,722.21** |

## SOC de incidentes: sensibilidad al número de clientes (plan base $2,350.00)

Costo sin el equipo de vulnerabilidades, que lo cubre su propio servicio.

| Clientes | Ingreso | Costo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $2,350.00 | $8,657.73 | $-6,307.73 | -268.41% |
| 2 | $4,700.00 | $8,877.73 | $-4,177.73 | -88.89% |
| 3 | $7,050.00 | $9,097.73 | $-2,047.73 | -29.05% |
| 4 | $9,400.00 | $9,317.73 | $82.27 | 0.88% |
| 5 | $11,750.00 | $9,537.73 | $2,212.27 | 18.83% |
| 6 | $14,100.00 | $10,038.45 | $4,061.55 | 28.81% |
| 7 ⚠️ requiere ampliar equipo | $16,450.00 | $10,539.17 | $5,910.83 | 35.93% |
| 8 ⚠️ requiere ampliar equipo | $18,800.00 | $11,039.89 | $7,760.11 | 41.28% |
| 9 ⚠️ requiere ampliar equipo | $21,150.00 | $11,540.61 | $9,609.39 | 45.43% |
| 10 ⚠️ requiere ampliar equipo | $23,500.00 | $12,041.33 | $11,458.67 | 48.76% |

## Gestión de vulnerabilidades: sensibilidad al número de sedes ($560.00 por sede)

| Sedes | Ingreso | Costo equipo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $560.00 | $1,404.48 | $-844.48 | -150.80% |
| 2 | $1,120.00 | $1,404.48 | $-284.48 | -25.40% |
| 3 | $1,680.00 | $1,404.48 | $275.52 | 16.40% |
| 4 | $2,240.00 | $1,404.48 | $835.52 | 37.30% |
| 5 | $2,800.00 | $1,404.48 | $1,395.52 | 49.84% |
| 6 | $3,360.00 | $1,404.48 | $1,955.52 | 58.20% |
| 7 | $3,920.00 | $1,404.48 | $2,515.52 | 64.17% |
| 8 | $4,480.00 | $1,404.48 | $3,075.52 | 68.65% |
| 9 | $5,040.00 | $1,404.48 | $3,635.52 | 72.13% |
| 10 | $5,600.00 | $1,404.48 | $4,195.52 | 74.92% |
| 11 ⚠️ requiere ampliar equipo | $6,160.00 | $1,404.48 | $4,755.52 | 77.20% |
| 12 ⚠️ requiere ampliar equipo | $6,720.00 | $1,404.48 | $5,315.52 | 79.10% |

## Colector FortiSIEM (opcional, se cobra aparte del plan)

| Opción | Cargo adicional mensual | Duración del cargo | Total cobrado vs costo |
|---|---:|---|---|
| VM o servidor del cliente | $0.00 | recurrente | — |
| NUC industrial on-prem | $250.00 | 12 meses | $3,000.00 vs $1,500.00 |
| Colector en Azure | $200.00 | recurrente | — |

## Referencia: almacenamiento con la retención base

Un cliente con 200 EPS promedio genera ~8.6 GB/día crudos. Con compresión al 15% mantiene ~39 GB en línea ($0.15/GB-mes) y ~428 GB archivados ($0.02/GB-mes): $14.39/mes. El presupuesto de almacenamiento por cliente cubre ~2781 EPS.

