# Precio SOC Netmask — punto de equilibrio con 3 clientes

Escenario de personal: **completo** — SOC OT con los dos equipos de la POC (incidentes y vulnerabilidades), horario extendido 8x5 + disponibilidad.
Plan base por cliente: 25 dispositivos, 0 agentes avanzados. TRM supuesta: 4000 COP/USD.
Retención base de eventos: 30 días en línea + 11 meses archivados.

## Precio propuesto (mensual por cliente, USD)

| Componente | Equilibrio | Precio lista |
|---|---:|---:|
| SOC de incidentes, plan base (plataforma + 25 dispositivos) | $5,551.58 | $5,600.00 |
| Gestión de vulnerabilidades OT, por sede (sin licencia de sonda) | $557.33 | $560.00 |
| Dispositivo adicional | — | $52.00 |
| Agente avanzado adicional | — | $10.00 |
| UEBA por agente avanzado (opcional) | — | $11.00 |

Los dos servicios se venden juntos o por separado. El equilibrio por sede supone 2 sedes por cliente (6 sedes con 3 clientes). El equipo de vulnerabilidades cuesta $3,344.00/mes: a $560.00 por sede se cubre desde 6 sedes.

## Costos mensuales con 3 clientes (75 dispositivos agregados en FortiSIEM)

| Concepto | USD/mes |
|---|---:|
| Personal — incidentes | $7,600.00 |
| Personal — vulnerabilidades | $3,040.00 |
| Personal — compartido | $3,306.00 |
| Disponibilidad fuera de horario | $375.00 |
| Azure consumo base: 2 VM FortiSIEM MSSP (Supervisor + Worker) | $400.00 |
| Herramientas SOC (ticketing, threat intel, acceso remoto) | $150.00 |
| Cuota anual programa FortiSIEM MSSP (prorrateada /12) | $416.67 |
| Licencia FortiSIEM dispositivos (75 facturables × $25.52) | $1,914.00 |
| Licencia FortiSIEM agentes_avanzados (50 facturables × $4.97) | $248.50 |
| Licencia FortiSIEM ueba (25 facturables × $5.22) | $130.50 |
| Azure almacenamiento de eventos por cliente × 3 | $600.00 |
| Contingencia (10%) | $1,818.07 |
| **Total** | **$19,998.73** |

## SOC de incidentes: sensibilidad al número de clientes (plan base $5,600.00)

Costo sin el equipo de vulnerabilidades, que lo cubre su propio servicio.

| Clientes | Ingreso | Costo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $5,600.00 | $15,512.93 | $-9,912.93 | -177.02% |
| 2 | $11,200.00 | $15,732.93 | $-4,532.93 | -40.47% |
| 3 | $16,800.00 | $16,654.73 | $145.27 | 0.86% |
| 4 | $22,400.00 | $17,576.53 | $4,823.47 | 21.53% |
| 5 | $28,000.00 | $18,498.33 | $9,501.67 | 33.93% |
| 6 | $33,600.00 | $19,420.13 | $14,179.87 | 42.20% |
| 7 ⚠️ requiere ampliar equipo | $39,200.00 | $19,281.26 | $19,918.74 | 50.81% |
| 8 ⚠️ requiere ampliar equipo | $44,800.00 | $20,051.53 | $24,748.47 | 55.24% |
| 9 ⚠️ requiere ampliar equipo | $50,400.00 | $20,821.81 | $29,578.19 | 58.69% |
| 10 ⚠️ requiere ampliar equipo | $56,000.00 | $21,592.08 | $34,407.92 | 61.44% |

## Gestión de vulnerabilidades: sensibilidad al número de sedes ($560.00 por sede)

| Sedes | Ingreso | Costo equipo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $560.00 | $3,344.00 | $-2,784.00 | -497.14% |
| 2 | $1,120.00 | $3,344.00 | $-2,224.00 | -198.57% |
| 3 | $1,680.00 | $3,344.00 | $-1,664.00 | -99.05% |
| 4 | $2,240.00 | $3,344.00 | $-1,104.00 | -49.29% |
| 5 | $2,800.00 | $3,344.00 | $-544.00 | -19.43% |
| 6 | $3,360.00 | $3,344.00 | $16.00 | 0.48% |
| 7 | $3,920.00 | $3,344.00 | $576.00 | 14.69% |
| 8 | $4,480.00 | $3,344.00 | $1,136.00 | 25.36% |
| 9 | $5,040.00 | $3,344.00 | $1,696.00 | 33.65% |
| 10 | $5,600.00 | $3,344.00 | $2,256.00 | 40.29% |
| 11 ⚠️ requiere ampliar equipo | $6,160.00 | $3,344.00 | $2,816.00 | 45.71% |
| 12 ⚠️ requiere ampliar equipo | $6,720.00 | $3,344.00 | $3,376.00 | 50.24% |

## Colector FortiSIEM (opcional, se cobra aparte del plan)

| Opción | Cargo adicional mensual | Duración del cargo | Total cobrado vs costo |
|---|---:|---|---|
| VM o servidor del cliente | $0.00 | recurrente | — |
| NUC industrial on-prem | $250.00 | 12 meses | $3,000.00 vs $1,500.00 |
| Colector en Azure | $200.00 | recurrente | — |

## Referencia: almacenamiento con la retención base

Un cliente con 200 EPS promedio genera ~8.6 GB/día crudos. Con compresión al 15% mantiene ~39 GB en línea ($0.15/GB-mes) y ~428 GB archivados ($0.02/GB-mes): $14.39/mes. El presupuesto de almacenamiento por cliente cubre ~2781 EPS.

