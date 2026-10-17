# Precio SOC Netmask — punto de equilibrio con 3 clientes

Escenario de personal: **esbelto** — Arranque con equipo mínimo 8x5 + disponibilidad; vulnerabilidades a media dedicación.
Plan base por cliente: 25 dispositivos, 0 agentes avanzados. TRM supuesta: 4000 COP/USD.

## Precio propuesto (mensual por cliente, USD)

| Componente | Equilibrio | Precio lista |
|---|---:|---:|
| SOC base (incidentes + plataforma + 25 dispositivos) | $4,339.38 | $4,350.00 |
| Módulo gestión de vulnerabilidades OT | $557.33 | $600.00 |
| **SOC OT completo** | **$4,896.71** | **$4,950.00** |
| Dispositivo adicional | — | $52.00 |
| Agente avanzado adicional | — | $10.00 |

## Costos mensuales con 3 clientes (75 dispositivos agregados en FortiSIEM)

| Concepto | USD/mes |
|---|---:|
| Personal — incidentes | $5,510.00 |
| Personal — vulnerabilidades | $1,520.00 |
| Personal — compartido | $2,090.00 |
| Disponibilidad fuera de horario | $375.00 |
| Azure consumo base: 2 VM FortiSIEM MSSP (Supervisor + Worker) | $400.00 |
| Herramientas SOC (ticketing, threat intel, acceso remoto) | $150.00 |
| Cuota anual programa FortiSIEM MSSP (prorrateada /12) | $416.67 |
| Licencia FortiSIEM dispositivos (75 facturables × $25.52) | $1,914.00 |
| Licencia FortiSIEM agentes_avanzados (50 facturables × $4.97) | $248.50 |
| Licencia FortiSIEM ueba (25 facturables × $5.22) | $130.50 |
| Azure almacenamiento de eventos por cliente × 3 | $600.00 |
| Contingencia (10%) | $1,335.47 |
| **Total** | **$14,690.13** |

## Sensibilidad al número de clientes (precio lista SOC OT completo $4,950.00)

| Clientes | Ingreso | Costo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $4,950.00 | $13,548.33 | $-8,598.33 | -173.70% |
| 2 | $9,900.00 | $13,768.33 | $-3,868.33 | -39.07% |
| 3 | $14,850.00 | $14,690.13 | $159.87 | 1.08% |
| 4 | $19,800.00 | $15,611.93 | $4,188.07 | 21.15% |
| 5 | $24,750.00 | $16,533.73 | $8,216.27 | 33.20% |
| 6 | $29,700.00 | $17,455.53 | $12,244.47 | 41.23% |
| 7 ⚠️ requiere ampliar equipo | $34,650.00 | $17,316.66 | $17,333.34 | 50.02% |
| 8 ⚠️ requiere ampliar equipo | $39,600.00 | $18,086.93 | $21,513.07 | 54.33% |
| 9 ⚠️ requiere ampliar equipo | $44,550.00 | $18,857.21 | $25,692.79 | 57.67% |
| 10 ⚠️ requiere ampliar equipo | $49,500.00 | $19,627.48 | $29,872.52 | 60.35% |

## Colector FortiSIEM (opcional, se cobra aparte del plan)

| Opción | Mensual por cliente | Duración del cargo |
|---|---:|---|
| VM o servidor del cliente | $0.00 | recurrente |
| NUC industrial on-prem (USD 1500 financiado en 6 cuotas) | $250.00 | 6 cuotas |
| Colector en Azure | $200.00 | recurrente |

## Referencia: almacenamiento por EPS

Un cliente con 200 EPS promedio genera ~8.6 GB/día crudos; con compresión al 15% y 365 días de retención son ~473 GB → $70.96/mes a $0.15/GB-mes.

