# Precio SOC Netmask — punto de equilibrio con 3 clientes

Escenario de personal: **completo** — SOC OT con los dos equipos de la POC (incidentes y vulnerabilidades), horario extendido 8x5 + disponibilidad.
Plan base por cliente: 25 dispositivos, 0 agentes avanzados. TRM supuesta: 4000 COP/USD.

## Precio propuesto (mensual por cliente, USD)

| Componente | Equilibrio | Precio lista |
|---|---:|---:|
| SOC base (incidentes + plataforma + 25 dispositivos) | $5,551.57 | $5,600.00 |
| Módulo gestión de vulnerabilidades OT | $1,114.67 | $1,150.00 |
| **SOC OT completo** | **$6,666.24** | **$6,750.00** |
| Dispositivo adicional | — | $52.00 |
| Agente avanzado adicional | — | $10.00 |

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

## Sensibilidad al número de clientes (precio lista SOC OT completo $6,750.00)

| Clientes | Ingreso | Costo | Utilidad | Margen |
|---:|---:|---:|---:|---:|
| 1 | $6,750.00 | $18,856.93 | $-12,106.93 | -179.36% |
| 2 | $13,500.00 | $19,076.93 | $-5,576.93 | -41.31% |
| 3 | $20,250.00 | $19,998.73 | $251.27 | 1.24% |
| 4 | $27,000.00 | $20,920.53 | $6,079.47 | 22.52% |
| 5 | $33,750.00 | $21,842.33 | $11,907.67 | 35.28% |
| 6 | $40,500.00 | $22,764.13 | $17,735.87 | 43.79% |
| 7 ⚠️ requiere ampliar equipo | $47,250.00 | $22,625.26 | $24,624.74 | 52.12% |
| 8 ⚠️ requiere ampliar equipo | $54,000.00 | $23,395.53 | $30,604.47 | 56.67% |
| 9 ⚠️ requiere ampliar equipo | $60,750.00 | $24,165.81 | $36,584.19 | 60.22% |
| 10 ⚠️ requiere ampliar equipo | $67,500.00 | $24,936.08 | $42,563.92 | 63.06% |

## Colector FortiSIEM (opcional, se cobra aparte del plan)

| Opción | Mensual por cliente | Duración del cargo |
|---|---:|---|
| VM o servidor del cliente | $0.00 | recurrente |
| NUC industrial on-prem (USD 1500 financiado en 6 cuotas) | $250.00 | 6 cuotas |
| Colector en Azure | $200.00 | recurrente |

## Referencia: almacenamiento por EPS

Un cliente con 200 EPS promedio genera ~8.6 GB/día crudos; con compresión al 15% y 365 días de retención son ~473 GB → $70.96/mes a $0.15/GB-mes.

