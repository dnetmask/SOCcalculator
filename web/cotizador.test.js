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
  assert.equal(p.costos.total, 19516.93);
  assert.equal(p.equilibrioBase, 4043.23);
  assert.equal(p.listaBase, 4050);
  assert.equal(p.costoVulnerabilidades, 3344);
  assert.equal(p.sedesEquilibrio, 8);
  assert.equal(p.equilibrioPorSede, 418);
  assert.equal(p.precioPorSede, 560);
  assert.equal(p.sedesMinimas, 6);
  assert.equal(p.precioDispositivo, 52);
  assert.equal(p.precioAgente, 10);
  assert.equal(p.precioUeba, 11);
  const e = modelo.precio(4, "esbelto");
  assert.equal(e.listaBase, 3150);
});

test("colector NUC: 250/mes durante 12 meses", () => {
  const nuc = modelo.opcionesColector().find((o) => o.opcion.startsWith("NUC"));
  assert.equal(nuc.precioMensual, 250);
  assert.equal(nuc.mesesCobro, 12);
});

test("cotización con base, módulo, adicionales y colector", () => {
  const nuc = modelo.opcionesColector().find((o) => o.opcion.startsWith("NUC")).id;
  const q = modelo.cotizar({ dispositivos: 30, agentes: 20, vulnerabilidades: true, sedes: 2, colector: nuc, descuento: 0.1, plazoMeses: 24 });
  // 4050 + 2x560 + 20x52 + 20x10 = 6410; 10% = 641; + 250 NUC
  assert.equal(q.subtotalMensual, 6660);
  assert.equal(q.descuentoMensual, 641);
  assert.equal(q.mensualInicial, 6019);
  assert.equal(q.mensualRecurrente, 5769);
  assert.equal(q.mesesConCargoTemporal, 12);
  assert.equal(q.valorContrato, 5769 * 24 + 250 * 12);
  // Con 10 % de descuento el plan base (3645) queda bajo su equilibrio (4043.23),
  // aunque el margen de los adicionales compensa la oferta completa.
  assert.ok(q.lineas.find((l) => l.id === "base").neto < q.precio.equilibrioBase);
  assert.ok(q.contribucion > 0);
  const sinDescuento = modelo.cotizar({ dispositivos: 30, agentes: 20, vulnerabilidades: true, sedes: 2, colector: nuc });
  assert.ok(sinDescuento.contribucion > 0);
});

test("sin adicionales ni colector la oferta es solo el plan base", () => {
  const vm = modelo.opcionesColector().find((o) => o.precioMensual === 0).id;
  const q = modelo.cotizar({ dispositivos: 10, agentes: 0, vulnerabilidades: false, colector: vm });
  assert.deepEqual(q.lineas.map((l) => l.id), ["base"]);
  assert.equal(q.mensualInicial, 4050);
});

test("UEBA se cobra por agente y nunca supera los agentes", () => {
  const vm = modelo.opcionesColector().find((o) => o.precioMensual === 0).id;
  const q = modelo.cotizar({ dispositivos: 25, agentes: 10, ueba: 40, colector: vm });
  const l = q.lineas.find((x) => x.id === "ueba");
  assert.equal(l.cantidad, 10);
  assert.equal(l.subtotal, 110);
  assert.equal(modelo.cotizar({ dispositivos: 25, agentes: 0, ueba: 5, colector: vm }).lineas.some((x) => x.id === "ueba"), false);
});

test("almacenamiento con retención base igual a precio_soc.py", () => {
  const r = modelo.estimarAlmacenamiento(200);
  assert.equal(Math.round(r.gbEnLinea), 39);
  assert.equal(Math.round(r.gbArchivado), 428);
  assert.equal(r.costo, 14.39);
  assert.equal(r.epsCubiertos, 2781);
});

test("vulnerabilidades sola: por sede, sin licencias ni colector", () => {
  const nuc = modelo.opcionesColector().find((o) => o.opcion.startsWith("NUC")).id;
  const q = modelo.cotizar({ soc: false, dispositivos: 80, agentes: 10, ueba: 10, colector: nuc, vulnerabilidades: true, sedes: 3 });
  assert.deepEqual(q.lineas.map((l) => l.id), ["vuln"]);
  assert.equal(q.mensualInicial, 1680);
  assert.equal(q.pisoEquilibrio, 1254);
});

test("sin servicios la oferta queda vacía", () => {
  const q = modelo.cotizar({ soc: false, vulnerabilidades: false });
  assert.equal(q.vacia, true);
  assert.equal(q.mensualInicial, 0);
});

test("sensibilidad de vulnerabilidades cruza cero en 6 sedes", () => {
  const f = modelo.sensibilidadVulnerabilidades(560, 12);
  assert.ok(f[4].utilidad < 0 && f[5].utilidad > 0);
  assert.equal(f[10].excedeCapacidad, true);
});

test("vulnerabilidades: 50 % de descuento desde la sede 11", () => {
  const q = modelo.cotizar({ soc: false, vulnerabilidades: true, sedes: 13 });
  assert.deepEqual(q.lineas.map((l) => [l.id, l.cantidad, l.unitario]), [["vuln", 10, 560], ["vuln2", 3, 280]]);
  assert.equal(q.mensualInicial, 5600 + 840);
  // Piso: equipo completo (3344) + 3 sedes sobre la capacidad de 10 a 334.40 c/u
  assert.equal(q.pisoEquilibrio, 3344 + 3 * 334.4);
  assert.equal(modelo.cotizar({ soc: false, vulnerabilidades: true, sedes: 10 }).lineas.length, 1);
});
