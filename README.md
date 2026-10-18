# SOC Calculator — Netmask

La base es la calculadora de licenciamiento FortiSIEM MSSP del líder del SOC (`core.py`, `storage.py`, `ui.py`, `data/precios.json`, `data/reglas.json`). Sobre ella, `precio_soc.py` estima **cuánto cobrar a los clientes por el servicio SOC** para que el servicio **llegue al punto de equilibrio con 4 clientes**.

## Modelo de precio

Se venden dos servicios, juntos o por separado:

- **SOC de gestión de incidentes (mensual por cliente)**: plataforma FortiSIEM e incluye **10 dispositivos/consolas fuente** (`plan_base`); precio lista USD 4.050. Su punto de equilibrio excluye el equipo de vulnerabilidades.
- **Gestión de vulnerabilidades OT (mensual por sede)**: USD 560 por sede (sedes 1 a 10 del contrato; desde la sede 11, 50 % de descuento: USD 280), sin licencias FortiSIEM ni colector. No incluye la licencia de la sonda OT, que aporta el cliente. Cubre el equipo de vulnerabilidades (USD 3.344/mes): con 2 sedes por cliente, 4 clientes = 8 sedes, el equilibrio es USD 418 por sede.
- **Retención base incluida**: 1 mes de eventos en línea + 11 meses archivados (12 meses en total), cubierta por el almacenamiento Azure por cliente.
- **Dispositivo/Consola fuente, agente o UEBA adicional**: costo de licencia FortiSIEM del primer nivel (el más caro) / (1 − margen). UEBA se contrata por agente avanzado y no puede superar la cantidad de agentes.
- **Colector (opcional, se cobra aparte del plan; se elige la cantidad de colectores NUC o Azure)**:
  - VM o servidor del cliente: sin costo.
  - NUC industrial de USD 1.500: cargo adicional de USD 250/mes (costo/6) durante 12 meses.
  - Colector en Azure: USD 200/mes.

Costo mensual con N clientes:

```
personal (salario COP × factor prestacional / TRM) + disponibilidad
+ costos fijos (Azure base 2 VM USD 400, herramientas)
+ cuota anual del programa FortiSIEM / 12 (USD 5.000 / 12)
+ licencias FortiSIEM sobre los dispositivos/consolas fuente agregados de todos los clientes (motor core.py)
+ N × costo variable por cliente (almacenamiento Azure USD 200)
+ contingencia 10 %
```

Precio de equilibrio del SOC de incidentes = (costo(4) − equipo de vulnerabilidades) / 4, redondeado hacia arriba a múltiplos de USD 50. Vulnerabilidades: equilibrio por sede = equipo de vulnerabilidades / (4 clientes × sedes promedio).

## Uso

```bash
python precio_soc.py                       # escenario "completo", 4 clientes
python precio_soc.py --escenario esbelto   # equipo mínimo
python precio_soc.py --clientes 5
python -m unittest discover -s tests -p "test_*.py"
```

Todos los supuestos están en `data/supuestos_soc.json`. Los que tienen `"origen": "supuesto"` son estimaciones que hay que reemplazar por cifras reales de nómina. Los reportes generados están en `docs/`.

## Cotizador web (`web/`)

Aplicación estática en HTML + JavaScript, sin compilación, con la imagen combinada Netmask + FortiSIEM. Arma la oferta en tiempo real: SOC de incidentes (con retención incluida, dispositivos/consolas fuente, agentes avanzados, UEBA y colector) y gestión de vulnerabilidades OT por sede, juntos o por separado, con descuento y plazo. Muestra la mensualidad, la mensualidad sin colector y el valor del contrato. Incluye una vista interna con el piso de equilibrio, la contribución de la oferta, la utilidad del SOC según el número de clientes y una estimación del almacenamiento por EPS con la retención base.

- `web/cotizador.js`: motor de cálculo. Replica `core.py` y `precio_soc.py` y lee los mismos `data/*.json`, así que al cambiar un supuesto cambian a la vez el cotizador y el reporte Python.
- `web/app.js` y `web/index.html`: interfaz.
- Pruebas: `node --test web/cotizador.test.js` (comparan con los valores del modelo Python).

Para usarlo localmente, sirve la raíz del repositorio y abre `web/`:

```bash
python -m http.server 8000   # luego abrir http://localhost:8000/web/
```

Despliegue en Vercel: `vercel.json` copia solo `web/` y `data/` a `public/` (sin el código Python ni las pruebas) y marca el sitio como `noindex`.

**Código de acceso:** `middleware.js` bloquea todas las rutas (también `data/*.json`) hasta que se ingresa el código. El código vive en la variable de entorno `ACCESS_CODE` del proyecto en Vercel (con `ACCESS_SECRET` como sal del token), nunca en el repositorio. Al acertar se guarda una cookie HttpOnly de 12 horas; `/salir` la borra. Para cambiar el código: editar `ACCESS_CODE` en Vercel → Settings → Environment Variables y redesplegar; las sesiones abiertas se invalidan. Sin `ACCESS_CODE` el sitio queda cerrado.

## Observaciones sobre las fuentes

- El motor de licencias aplica **mínimos obligatorios** (50 dispositivos, 50 agentes, 25 UEBA). Eso deja un piso de USD 1.655/mes en licencias aunque haya 0 agentes y 0 UEBA. El Excel de Business Case de Fortinet no los aplica (cotiza 20 dispositivos en el año 1), así que conviene confirmarlo con Fortinet.
- Los niveles de precio aplican **una sola tarifa a todas las unidades** del agregado: al pasar de 150 a 175 dispositivos, el precio baja de 25,52 a 20,01 por dispositivo. Por eso el costo total baja entre 6 y 7 clientes.
- El Business Case de Fortinet proyecta 20 / 50 / 150 dispositivos en los años 1, 2 y 3. Con 4 clientes en el plan base son 40 dispositivos/consolas fuente, por debajo del mínimo facturable de 50: el SOC paga 50 aunque use menos.
- En el Excel de Business Case, la fórmula de agentes asigna al rango 51–150 el precio de la fila 88 (USD 2,97, el SKU de 1K) porque las filas no están ordenadas. El motor `core.py` usa el precio correcto (USD 4,97).
