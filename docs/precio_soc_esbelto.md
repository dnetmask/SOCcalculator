# Precio SOC Netmask — punto de equilibrio con 4 clientes

Escenario de personal: **esbelto** — Arranque con equipo mínimo 8x5 + disponibilidad; vulnerabilidades a media dedicación.
Plan base por cliente: 10 dispositivos/consolas fuente, 0 agentes avanzados. TRM supuesta: 4000 COP/USD.
Retención base de eventos: 30 días en línea + 11 meses archivados.

## Precio propuesto (mensual por cliente, USD)

| Componente | Equilibrio | Precio lista |
|---|---:|---:|
| SOC de incidentes, plan base (plataforma + 10 dispositivos/consolas fuente) | $3,134.08 | $3,150.00 |
| Gestión de vulnerabilidades OT, por sede (sin licencia de sonda) | $209.00 | $560.00 |
| Vulnerabilidades desde la sede 11 del contrato (50 % de descuento) | — | $280.00 |
| Dispositivo/Consola fuente adicional | — | $52.00 |
| Agente avanzado adicional | — | $10.00 |
| UEBA por agente avanzado (opcional) | — | $11.00 |

Los dos servicios se venden juntos o por separado. El equilibrio por sede supone 2 sedes por cliente (8 sedes con 4 clientes). El equipo de vulnerabilidades cuesta $1,672.00/mes: a $560.00 por sede se cubre desde 3 sedes.

## Costos mensuales con 4 clientes (40 dispositivos/consolas fuente agregados en FortiSIEM)

| Concepto | USD/mes |
|---|---:|
| Personal — incidentes | $5,510.00 |
| Personal — vulnerabilidades | $1,520.00 |
| Personal — compartido | $2,090.00 |
| Disponibilidad fuera de horario | $375.00 |
| Azure consumo base: 2 VM FortiSIEM MSSP (Supervisor + Worker) | $400.00 |
| Herramientas SOC (ticketing, threat intel, acceso remoto) | $150.00 |
| Cuota anual programa FortiSIEM MSSP (prorrateada /12) | $416.67 |
| Licencia FortiSIEM dispositivos (50 facturables × $25.52) | $1,276.00 |
| Licencia FortiSIEM agentes_avanzados (50 facturables × $4.97) | $248.50 |
| Licencia FortiSIEM ueba (25 facturables × $5.22) | $130.50 |
| Azure almacenamiento de eventos por cliente × 4 | $800.00 |
| Contingencia (10%) | $1,291.67 |
| **Total** | **$14,208.33** |

## SOC de incidentes: sensibilidad al número de clientes (plan base $3,150.00)

Costo sin el equipo de vulnerabilidades, que lo cubre su propio servicio.

| Clientes | Ingreso | Costo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $3,150.00 | $11,876.33 | $-8,726.33 | -277.03% |
| 2 | $6,300.00 | $12,096.33 | $-5,796.33 | -92.01% |
| 3 | $9,450.00 | $12,316.33 | $-2,866.33 | -30.33% |
| 4 | $12,600.00 | $12,536.33 | $63.67 | 0.51% |
| 5 | $15,750.00 | $12,756.33 | $2,993.67 | 19.01% |
| 6 | $18,900.00 | $13,257.05 | $5,642.95 | 29.86% |
| 7 ⚠️ requiere ampliar equipo | $22,050.00 | $13,757.77 | $8,292.23 | 37.61% |
| 8 ⚠️ requiere ampliar equipo | $25,200.00 | $14,258.49 | $10,941.51 | 43.42% |
| 9 ⚠️ requiere ampliar equipo | $28,350.00 | $14,759.21 | $13,590.79 | 47.94% |
| 10 ⚠️ requiere ampliar equipo | $31,500.00 | $15,259.93 | $16,240.07 | 51.56% |

## Gestión de vulnerabilidades: sensibilidad al número de sedes ($560.00 por sede)

| Sedes | Ingreso | Costo equipo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $560.00 | $1,672.00 | $-1,112.00 | -198.57% |
| 2 | $1,120.00 | $1,672.00 | $-552.00 | -49.29% |
| 3 | $1,680.00 | $1,672.00 | $8.00 | 0.48% |
| 4 | $2,240.00 | $1,672.00 | $568.00 | 25.36% |
| 5 | $2,800.00 | $1,672.00 | $1,128.00 | 40.29% |
| 6 | $3,360.00 | $1,672.00 | $1,688.00 | 50.24% |
| 7 | $3,920.00 | $1,672.00 | $2,248.00 | 57.35% |
| 8 | $4,480.00 | $1,672.00 | $2,808.00 | 62.68% |
| 9 | $5,040.00 | $1,672.00 | $3,368.00 | 66.83% |
| 10 | $5,600.00 | $1,672.00 | $3,928.00 | 70.14% |
| 11 ⚠️ requiere ampliar equipo | $6,160.00 | $1,672.00 | $4,488.00 | 72.86% |
| 12 ⚠️ requiere ampliar equipo | $6,720.00 | $1,672.00 | $5,048.00 | 75.12% |

## Colector FortiSIEM (opcional, se cobra aparte del plan)

| Opción | Cargo adicional mensual | Duración del cargo | Total cobrado vs costo |
|---|---:|---|---|
| VM o servidor del cliente | $0.00 | recurrente | — |
| NUC industrial on-prem | $250.00 | 12 meses | $3,000.00 vs $1,500.00 |
| Colector en Azure | $200.00 | recurrente | — |

## Referencia: almacenamiento con la retención base

Un cliente con 200 EPS promedio genera ~8.6 GB/día crudos. Con compresión al 15% mantiene ~39 GB en línea ($0.15/GB-mes) y ~428 GB archivados ($0.02/GB-mes): $14.39/mes. El presupuesto de almacenamiento por cliente cubre ~2781 EPS.

