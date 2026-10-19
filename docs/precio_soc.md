# Precio SOC Netmask — punto de equilibrio con 4 clientes

Escenario de personal: **ajustado** — SOC OT ajustado: 1 analista N1, 1 N2 y 1 analista de vulnerabilidades, ingeniero de plataforma al 30 % y líder al 50 %; salarios base ajustados (-40 % sobre la referencia; N2 y vulnerabilidades además -30 %); horario extendido 8x5 + disponibilidad.
Plan base por cliente: 10 dispositivos/consolas fuente, 0 agentes avanzados. TRM supuesta: 3500 COP/USD.
Retención base de eventos: 30 días en línea + 11 meses archivados.

## Precio propuesto (mensual por cliente, USD)

| Componente | Equilibrio | Precio lista |
|---|---:|---:|
| SOC de incidentes, plan base (plataforma + 10 dispositivos/consolas fuente) | $2,599.45 | $2,600.00 |
| Gestión de vulnerabilidades OT, por sede (sin licencia de sonda) | $200.64 | $560.00 |
| Vulnerabilidades desde la sede 11 del contrato (50 % de descuento) | — | $280.00 |
| Otra consola fuente adicional (EDR, gestión, OT) | — | $52.00 |
| Agente avanzado adicional | — | $10.00 |
| UEBA por agente avanzado (opcional) | — | $11.00 |

Los dos servicios se venden juntos o por separado. El equilibrio por sede supone 2 sedes por cliente (8 sedes con 4 clientes). El equipo de vulnerabilidades cuesta $1,605.12/mes: a $560.00 por sede se cubre desde 3 sedes.

## Costos mensuales con 4 clientes (40 dispositivos/consolas fuente agregados en FortiSIEM)

| Concepto | USD/mes |
|---|---:|
| Personal — incidentes | $3,074.74 |
| Personal — vulnerabilidades | $1,459.20 |
| Personal — compartido | $2,527.54 |
| Disponibilidad fuera de horario | $428.57 |
| Azure consumo base: 2 VM FortiSIEM MSSP (Supervisor + Worker) | $400.00 |
| Herramientas SOC (ticketing, threat intel, acceso remoto) | $150.00 |
| Cuota anual programa FortiSIEM MSSP (prorrateada /12) | $416.67 |
| Licencia FortiSIEM dispositivos (50 facturables × $25.52) | $1,276.00 |
| Licencia FortiSIEM agentes_avanzados (50 facturables × $4.97) | $248.50 |
| Licencia FortiSIEM ueba (25 facturables × $5.22) | $130.50 |
| Azure almacenamiento de eventos por cliente × 4 | $800.00 |
| Contingencia (10%) | $1,091.17 |
| **Total** | **$12,002.90** |

## SOC de incidentes: sensibilidad al número de clientes (plan base $2,600.00)

Costo sin el equipo de vulnerabilidades, que lo cubre su propio servicio.

| Clientes | Ingreso | Costo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $2,600.00 | $9,737.78 | $-7,137.78 | -274.53% |
| 2 | $5,200.00 | $9,957.78 | $-4,757.78 | -91.50% |
| 3 | $7,800.00 | $10,177.78 | $-2,377.78 | -30.48% |
| 4 | $10,400.00 | $10,397.78 | $2.22 | 0.02% |
| 5 | $13,000.00 | $10,617.78 | $2,382.22 | 18.32% |
| 6 | $15,600.00 | $11,118.50 | $4,481.50 | 28.73% |
| 7 ⚠️ requiere ampliar equipo | $18,200.00 | $11,619.22 | $6,580.78 | 36.16% |
| 8 ⚠️ requiere ampliar equipo | $20,800.00 | $12,119.94 | $8,680.06 | 41.73% |
| 9 ⚠️ requiere ampliar equipo | $23,400.00 | $12,620.66 | $10,779.34 | 46.07% |
| 10 ⚠️ requiere ampliar equipo | $26,000.00 | $13,121.38 | $12,878.62 | 49.53% |

## Gestión de vulnerabilidades: sensibilidad al número de sedes ($560.00 por sede)

| Sedes | Ingreso | Costo equipo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $560.00 | $1,605.12 | $-1,045.12 | -186.63% |
| 2 | $1,120.00 | $1,605.12 | $-485.12 | -43.31% |
| 3 | $1,680.00 | $1,605.12 | $74.88 | 4.46% |
| 4 | $2,240.00 | $1,605.12 | $634.88 | 28.34% |
| 5 | $2,800.00 | $1,605.12 | $1,194.88 | 42.67% |
| 6 | $3,360.00 | $1,605.12 | $1,754.88 | 52.23% |
| 7 | $3,920.00 | $1,605.12 | $2,314.88 | 59.05% |
| 8 | $4,480.00 | $1,605.12 | $2,874.88 | 64.17% |
| 9 | $5,040.00 | $1,605.12 | $3,434.88 | 68.15% |
| 10 | $5,600.00 | $1,605.12 | $3,994.88 | 71.34% |
| 11 ⚠️ requiere ampliar equipo | $6,160.00 | $1,605.12 | $4,554.88 | 73.94% |
| 12 ⚠️ requiere ampliar equipo | $6,720.00 | $1,605.12 | $5,114.88 | 76.11% |

## Fuentes adicionales por tipo (precio fijo en COP frente a la competencia)

| Tipo | Competencia | Netmask | Costo licencia | Margen |
|---|---:|---:|---:|---:|
| Firewall entry level | COP 330.000 | COP 280.000 | COP 89.320 | 68.1% |
| Firewall mid range | COP 520.000 | COP 440.000 | COP 89.320 | 79.7% |
| Firewall high-end | COP 660.000 | COP 560.000 | COP 89.320 | 84.0% |
| Servidor | COP 310.000 | COP 260.000 | COP 89.320 | 65.6% |
| Switch core | COP 210.000 | COP 170.000 | COP 89.320 | 47.5% |
| Switch de distribución / acceso | COP 120.000 | COP 100.000 | COP 89.320 | 10.7% |

## Colector FortiSIEM (opcional, se cobra aparte del plan)

| Opción | Cargo adicional mensual | Duración del cargo | Total cobrado vs costo |
|---|---:|---|---|
| VM o servidor del cliente | $0.00 | recurrente | — |
| NUC industrial on-prem | $250.00 | 12 meses | $3,000.00 vs $1,500.00 |
| Colector en Azure | $200.00 | recurrente | — |

## Referencia: almacenamiento con la retención base

Un cliente con 200 EPS promedio genera ~8.6 GB/día crudos. Con compresión al 15% mantiene ~39 GB en línea ($0.15/GB-mes) y ~428 GB archivados ($0.02/GB-mes): $14.39/mes. El presupuesto de almacenamiento por cliente cubre ~2781 EPS.

