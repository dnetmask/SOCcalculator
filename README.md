# SOC Calculator — Netmask

La base es la calculadora de licenciamiento FortiSIEM MSSP del líder del SOC (`core.py`, `storage.py`, `ui.py`, `data/precios.json`, `data/reglas.json`). Sobre ella, `precio_soc.py` estima **cuánto cobrar a los clientes por el servicio SOC** para que el servicio **llegue al punto de equilibrio con 3 clientes**.

## Modelo de precio

- **Plan SOC base (mensual por cliente)**: gestión de incidentes + plataforma; incluye **25 dispositivos** (`plan_base`).
- **Módulo de gestión de vulnerabilidades OT**: precio aparte; cubre el costo del equipo de vulnerabilidades.
- **Dispositivo / agente adicional**: costo de licencia FortiSIEM del primer nivel (el más caro) / (1 − margen).
- **Colector (opcional, se cobra aparte del plan)**:
  - VM o servidor del cliente: sin costo.
  - NUC industrial de USD 1.500: cargo adicional de USD 250/mes (costo/6) durante 12 meses.
  - Colector en Azure: USD 200/mes.

Costo mensual con N clientes:

```
personal (salario COP × factor prestacional / TRM) + disponibilidad
+ costos fijos (Azure base 2 VM USD 400, herramientas)
+ cuota anual del programa FortiSIEM / 12 (USD 5.000 / 12)
+ licencias FortiSIEM sobre los dispositivos agregados de todos los clientes (motor core.py)
+ N × costo variable por cliente (almacenamiento Azure USD 200)
+ contingencia 10 %
```

Precio de equilibrio = costo(3) / 3, redondeado hacia arriba a múltiplos de USD 50.

## Uso

```bash
python precio_soc.py                       # escenario "completo", 3 clientes
python precio_soc.py --escenario esbelto   # equipo mínimo
python precio_soc.py --clientes 4
python -m unittest discover -s tests -p "test_*.py"
```

Todos los supuestos están en `data/supuestos_soc.json`. Los que tienen `"origen": "supuesto"` son estimaciones que hay que reemplazar por cifras reales de nómina. Los reportes generados están en `docs/`.

## Cotizador web (`web/`)

Aplicación estática en HTML + JavaScript, sin compilación. Arma la oferta en tiempo real: plan base, módulo de vulnerabilidades OT, dispositivos y agentes adicionales, colector, descuento y plazo. Muestra la mensualidad, la mensualidad sin colector y el valor del contrato. Incluye una vista interna con el piso de equilibrio, la contribución de la oferta y la utilidad del SOC según el número de clientes.

- `web/cotizador.js`: motor de cálculo. Replica `core.py` y `precio_soc.py` y lee los mismos `data/*.json`, así que al cambiar un supuesto cambian a la vez el cotizador y el reporte Python.
- `web/app.js` y `web/index.html`: interfaz.
- Pruebas: `node --test web/cotizador.test.js` (comparan con los valores del modelo Python).

Para usarlo localmente, sirve la raíz del repositorio y abre `web/`:

```bash
python -m http.server 8000   # luego abrir http://localhost:8000/web/
```

Para publicarlo (Vercel, Azure Static Web Apps, GitHub Pages…), despliega la raíz del repositorio: el cotizador busca los JSON en `data/` o en `../data/`.

## Observaciones sobre las fuentes

- El motor de licencias aplica **mínimos obligatorios** (50 dispositivos, 50 agentes, 25 UEBA). Eso deja un piso de USD 1.655/mes en licencias aunque haya 0 agentes y 0 UEBA. El Excel de Business Case de Fortinet no los aplica (cotiza 20 dispositivos en el año 1), así que conviene confirmarlo con Fortinet.
- Los niveles de precio aplican **una sola tarifa a todas las unidades** del agregado: al pasar de 150 a 175 dispositivos, el precio baja de 25,52 a 20,01 por dispositivo. Por eso el costo total baja entre 6 y 7 clientes.
- El Business Case de Fortinet proyecta 20 / 50 / 150 dispositivos en los años 1, 2 y 3. Con 3 clientes en el plan base ya son 75 dispositivos, así que hay que actualizar la proyección.
- En el Excel de Business Case, la fórmula de agentes asigna al rango 51–150 el precio de la fila 88 (USD 2,97, el SKU de 1K) porque las filas no están ordenadas. El motor `core.py` usa el precio correcto (USD 4,97).
