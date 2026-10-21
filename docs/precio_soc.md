# Precio SOC Netmask — punto de equilibrio con 4 clientes

Escenario de personal: **ajustado** — SOC OT ajustado: 1 analista N1, 1 N2 y 1 analista de vulnerabilidades, líder técnico SIEM al 30 % y líder de operaciones SOC al 50 % (ambos COP 6,5 M); analistas con salarios base ajustados (-40 % sobre la referencia; N2 y vulnerabilidades además -30 %); horario extendido 8x5 + disponibilidad.
Plan base por cliente: 10 dispositivos/consolas fuente, 0 agentes avanzados. TRM supuesta: 3500 COP/USD.
Retención base de eventos: 30 días en línea + 11 meses archivados.

## Precio propuesto (mensual por cliente, USD)

| Componente | Equilibrio | Precio lista |
|---|---:|---:|
| SOC de incidentes, plan base (plataforma + 10 dispositivos/consolas fuente) | $2,352.88 | $2,400.00 |
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
| Personal — compartido | $2,258.29 |
| Disponibilidad fuera de horario | $428.57 |
| Azure consumo base: 2 VM FortiSIEM MSSP (Supervisor + Worker) | $400.00 |
| Herramientas SOC (ticketing, threat intel, acceso remoto) | $150.00 |
| Cuota anual programa FortiSIEM MSSP (prorrateada /12) | $416.67 |
| Licencia FortiSIEM dispositivos (50 facturables × $25.52) | $1,276.00 |
| Licencia FortiSIEM agentes_avanzados (50 facturables × $4.97) | $248.50 |
| Licencia FortiSIEM ueba (25 facturables × $5.22) | $130.50 |
| Azure almacenamiento de logs (600 EPS por cliente) × 4 | $172.64 |
| Contingencia (10%) | $1,001.51 |
| **Total** | **$11,016.62** |

## SOC de incidentes: sensibilidad al número de clientes (plan base $2,400.00)

Costo sin el equipo de vulnerabilidades, que lo cubre su propio servicio.

| Clientes | Ingreso | Costo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $2,400.00 | $9,269.07 | $-6,869.07 | -286.21% |
| 2 | $4,800.00 | $9,316.55 | $-4,516.55 | -94.09% |
| 3 | $7,200.00 | $9,364.02 | $-2,164.02 | -30.06% |
| 4 | $9,600.00 | $9,411.50 | $188.50 | 1.96% |
| 5 | $12,000.00 | $9,458.97 | $2,541.03 | 21.18% |
| 6 | $14,400.00 | $9,787.17 | $4,612.83 | 32.03% |
| 7 ⚠️ requiere ampliar equipo | $16,800.00 | $10,115.37 | $6,684.63 | 39.79% |
| 8 ⚠️ requiere ampliar equipo | $19,200.00 | $10,443.56 | $8,756.44 | 45.61% |
| 9 ⚠️ requiere ampliar equipo | $21,600.00 | $10,771.76 | $10,828.24 | 50.13% |
| 10 ⚠️ requiere ampliar equipo | $24,000.00 | $11,099.95 | $12,900.05 | 53.75% |

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

Un cliente con 600 EPS promedio genera ~25.9 GB/día crudos. Con compresión al 15% mantiene ~117 GB en línea ($0.15/GB-mes) y ~1283 GB archivados ($0.02/GB-mes): $43.16/mes. Ese costo por cliente entra al punto de equilibrio. El colector en Azure es una VM aparte y se cobra como opción de colector.

