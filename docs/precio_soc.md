# Precio SOC Netmask — punto de equilibrio con 4 clientes

Escenario de personal: **ajustado** — SOC OT ajustado: 1 analista N1, 1 N2 y 1 analista de vulnerabilidades, líder técnico SIEM al 30 % y líder de operaciones SOC al 50 % (ambos COP 6,5 M); analistas N1 y de vulnerabilidades a COP 3,5 M y N2 a COP 4 M; horario extendido 8x5 + disponibilidad.
Plan base por cliente: 10 dispositivos/consolas fuente, 0 agentes avanzados. TRM supuesta: 3500 COP/USD.
Retención base de eventos: 30 días en línea + 11 meses archivados.

## Precio propuesto (mensual por cliente, USD)

| Componente | Equilibrio | Precio lista |
|---|---:|---:|
| SOC de incidentes, plan base (plataforma + 10 dispositivos/consolas fuente) | $2,403.04 | $3,050.00 |
| SOC Esencial (hasta 3 dispositivos/consolas fuente, 1/3 del cupo de un cliente) | $801.01 | $1,050.00 |
| Gestión de vulnerabilidades OT, por sede (sin licencia de sonda) | $209.00 | $560.00 |
| Vulnerabilidades desde la sede 11 del contrato (50 % de descuento) | — | $280.00 |
| Otra consola fuente adicional (EDR, gestión, OT) | — | $52.00 |
| Agente avanzado adicional | — | $10.00 |
| UEBA por agente avanzado (opcional) | — | $11.00 |

Los dos servicios se venden juntos o por separado. El equilibrio por sede supone 2 sedes por cliente (8 sedes con 4 clientes). El equipo de vulnerabilidades cuesta $1,672.00/mes: a $560.00 por sede se cubre desde 3 sedes.

## Costos mensuales con 4 clientes (40 dispositivos/consolas fuente agregados en FortiSIEM)

| Concepto | USD/mes |
|---|---:|
| Personal — incidentes | $3,257.14 |
| Personal — vulnerabilidades | $1,520.00 |
| Personal — compartido | $2,258.29 |
| Disponibilidad fuera de horario | $428.57 |
| Azure consumo base: 2 VM FortiSIEM MSSP (Supervisor + Worker) | $400.00 |
| Herramientas SOC (ticketing, threat intel, acceso remoto) | $150.00 |
| Cuota anual programa FortiSIEM MSSP (prorrateada /12) | $416.67 |
| Licencia FortiSIEM dispositivos (50 facturables × $25.52) | $1,276.00 |
| Licencia FortiSIEM agentes_avanzados (50 facturables × $4.97) | $248.50 |
| Licencia FortiSIEM ueba (25 facturables × $5.22) | $130.50 |
| Azure almacenamiento de logs (600 EPS por cliente) × 4 | $172.64 |
| Contingencia (10%) | $1,025.83 |
| **Total** | **$11,284.14** |

## SOC de incidentes: sensibilidad al número de clientes (plan base $3,050.00)

Costo sin el equipo de vulnerabilidades, que lo cubre su propio servicio.

| Clientes | Ingreso | Costo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $3,050.00 | $9,469.71 | $-6,419.71 | -210.48% |
| 2 | $6,100.00 | $9,517.19 | $-3,417.19 | -56.02% |
| 3 | $9,150.00 | $9,564.66 | $-414.66 | -4.53% |
| 4 | $12,200.00 | $9,612.14 | $2,587.86 | 21.21% |
| 5 | $15,250.00 | $9,659.61 | $5,590.39 | 36.66% |
| 6 | $18,300.00 | $9,987.81 | $8,312.19 | 45.42% |
| 7 ⚠️ requiere ampliar equipo | $21,350.00 | $10,316.01 | $11,033.99 | 51.68% |
| 8 ⚠️ requiere ampliar equipo | $24,400.00 | $10,644.20 | $13,755.80 | 56.38% |
| 9 ⚠️ requiere ampliar equipo | $27,450.00 | $10,972.40 | $16,477.60 | 60.03% |
| 10 ⚠️ requiere ampliar equipo | $30,500.00 | $11,300.59 | $19,199.41 | 62.95% |

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

