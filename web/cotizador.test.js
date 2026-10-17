// Pruebas del motor JS contra los valores del modelo Python (precio_soc.py).
// Ejecutar: node --test web/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { crearModelo } = require("./cotizador.js");

const leer = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", n), "utf8"));
const modelo = crearModelo(leer("precios.json"), leer("reglas.json"), leer("supuestos_soc.json"));

test("licencias iguales a core.py", () => {
  assert.equal(modelo.licencias({ dispositivos: 50 }).total, 1655);
  assert.equal(modelo.licencias({ dispositivos: 151 }).componentes[0].subtotal, 3021.51);
  assert.equal(modelo.licencias({ dispositivos: 75 }).total, 2293);
});

test("punto de equilibrio igual a precio_soc.py", () => {
  const p = modelo.precio();
  assert.equal(p.costos.total, 19998.73);
  assert.equal(p.equilibrioBase, 5551.57);
  assert.equal(p.equilibrioVulnerabilidades, 1114.67);
  assert.equal(p.listaBase, 5600);
  assert.equal(p.listaVulnerabilidades, 1150);
  assert.equal(p.precioDispositivo, 52);
  assert.equal(p.precioAgente, 10);
  const e = modelo.precio(3, "esbelto");
  assert.equal(e.listaBase + e.listaVulnerabilidades, 4950);
});

test("colector NUC: 250/mes durante 12 meses", () => {
  const nuc = modelo.opcionesColector().find((o) => o.opcion.startsWith("NUC"));
  assert.equal(nuc.precioMensual, 250);
  assert.equal(nuc.mesesCobro, 12);
});

test("cotización con base, módulo, adicionales y colector", () => {
  const nuc = modelo.opcionesColector().find((o) => o.opcion.startsWith("NUC")).id;
  const q = modelo.cotizar({ dispositivos: 30, agentes: 20, vulnerabilidades: true, colector: nuc, descuento: 0.1, plazoMeses: 24 });
  // 5600 + 1150 + 5x52 + 20x10 = 7210; 10% = 721; + 250 NUC
  assert.equal(q.subtotalMensual, 7460);
  assert.equal(q.descuentoMensual, 721);
  assert.equal(q.mensualInicial, 6739);
  assert.equal(q.mensualRecurrente, 6489);
  assert.equal(q.mesesConCargoTemporal, 12);
  assert.equal(q.valorContrato, 6489 * 24 + 250 * 12);
  // Con 10 % de descuento el plan base (5040) queda bajo su equilibrio (5551.57).
  assert.ok(q.contribucion < 0);
  const sinDescuento = modelo.cotizar({ dispositivos: 30, agentes: 20, vulnerabilidades: true, colector: nuc });
  assert.ok(sinDescuento.contribucion > 0);
});

test("sin adicionales ni colector la oferta es solo el plan base", () => {
  const vm = modelo.opcionesColector().find((o) => o.precioMensual === 0).id;
  const q = modelo.cotizar({ dispositivos: 10, agentes: 0, vulnerabilidades: false, colector: vm });
  assert.deepEqual(q.lineas.map((l) => l.id), ["base"]);
  assert.equal(q.mensualInicial, 5600);
});
