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
  assert.equal(p.costos.total, 15086.13);
  assert.equal(p.equilibrioBase, 3186.33);
  assert.equal(p.listaBase, 3200);
  assert.equal(p.costoVulnerabilidades, 2340.8);
  assert.equal(p.sedesEquilibrio, 8);
  assert.equal(p.equilibrioPorSede, 292.6);
  assert.equal(p.precioPorSede, 560);
  assert.equal(p.sedesMinimas, 5);
  assert.equal(p.precioDispositivo, 52);
  assert.equal(p.precioAgente, 10);
  assert.equal(p.precioUeba, 11);
});

test("colector NUC: 250/mes durante 12 meses", () => {
  const nuc = modelo.opcionesColector().find((o) => o.opcion.startsWith("NUC"));
  assert.equal(nuc.precioMensual, 250);
  assert.equal(nuc.mesesCobro, 12);
});

test("cotización con base, módulo, adicionales y colector", () => {
  const nuc = modelo.opcionesColector().find((o) => o.opcion.startsWith("NUC")).id;
  const q = modelo.cotizar({ dispositivos: 30, agentes: 20, vulnerabilidades: true, sedes: 2, colectores: { [nuc]: 1 }, descuento: 0.1, plazoMeses: 24 });
  // 3200 + 2x560 + 20x52 + 20x10 = 5560; 10% = 556; + 250 NUC
  assert.equal(q.subtotalMensual, 5810);
  assert.equal(q.descuentoMensual, 556);
  assert.equal(q.mensualInicial, 5254);
  assert.equal(q.mensualRecurrente, 5004);
  assert.equal(q.mesesConCargoTemporal, 12);
  assert.equal(q.valorContrato, 5004 * 24 + 250 * 12);
  // Con 10 % de descuento el plan base (2880) queda bajo su equilibrio (3186.33),
  // aunque el margen de los adicionales compensa la oferta completa.
  assert.ok(q.lineas.find((l) => l.id === "base").neto < q.precio.equilibrioBase);
  assert.ok(q.contribucion > 0);
  const sinDescuento = modelo.cotizar({ dispositivos: 30, agentes: 20, vulnerabilidades: true, sedes: 2, colectores: { [nuc]: 1 } });
  assert.ok(sinDescuento.contribucion > 0);
});

test("sin adicionales ni colector la oferta es solo el plan base", () => {
  const vm = modelo.opcionesColector().find((o) => o.precioMensual === 0).id;
  const q = modelo.cotizar({ dispositivos: 10, agentes: 0, vulnerabilidades: false, colectores: {} });
  assert.deepEqual(q.lineas.map((l) => l.id), ["base"]);
  assert.equal(q.mensualInicial, 3200);
});

test("UEBA se cobra por agente y nunca supera los agentes", () => {
  const vm = modelo.opcionesColector().find((o) => o.precioMensual === 0).id;
  const q = modelo.cotizar({ dispositivos: 25, agentes: 10, ueba: 40 });
  const l = q.lineas.find((x) => x.id === "ueba");
  assert.equal(l.cantidad, 10);
  assert.equal(l.subtotal, 110);
  assert.equal(modelo.cotizar({ dispositivos: 25, agentes: 0, ueba: 5 }).lineas.some((x) => x.id === "ueba"), false);
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
  const q = modelo.cotizar({ soc: false, dispositivos: 80, agentes: 10, ueba: 10, colectores: { [nuc]: 2 }, vulnerabilidades: true, sedes: 3 });
  assert.deepEqual(q.lineas.map((l) => l.id), ["vuln"]);
  assert.equal(q.mensualInicial, 1680);
  assert.equal(q.pisoEquilibrio, 877.8);
});

test("sin servicios la oferta queda vacía", () => {
  const q = modelo.cotizar({ soc: false, vulnerabilidades: false });
  assert.equal(q.vacia, true);
  assert.equal(q.mensualInicial, 0);
});

test("sensibilidad de vulnerabilidades cruza cero en 5 sedes", () => {
  const f = modelo.sensibilidadVulnerabilidades(560, 12);
  assert.ok(f[3].utilidad < 0 && f[4].utilidad > 0);
  assert.equal(f[10].excedeCapacidad, true);
});

test("vulnerabilidades: 50 % de descuento desde la sede 11", () => {
  const q = modelo.cotizar({ soc: false, vulnerabilidades: true, sedes: 13 });
  assert.deepEqual(q.lineas.map((l) => [l.id, l.cantidad, l.unitario]), [["vuln", 10, 560], ["vuln2", 3, 280]]);
  assert.equal(q.mensualInicial, 5600 + 840);
  // Piso: equipo completo (2340.80) + 3 sedes sobre la capacidad de 10 a 234.08 c/u
  assert.equal(q.pisoEquilibrio, 3043.04);
  assert.equal(modelo.cotizar({ soc: false, vulnerabilidades: true, sedes: 10 }).lineas.length, 1);
});

test("colectores NUC y Azure independientes", () => {
  const ops = modelo.opcionesColector();
  const nuc = ops.find((o) => o.opcion.startsWith("NUC")).id;
  const azure = ops.find((o) => o.opcion.includes("Azure")).id;
  const q = modelo.cotizar({ dispositivos: 10, colectores: { [nuc]: 3, [azure]: 2 }, plazoMeses: 24 });
  const cols = q.lineas.filter((x) => x.id.startsWith("col"));
  assert.deepEqual(cols.map((l) => [l.cantidad, l.unitario, l.meses]), [[3, 250, 12], [2, 200, null]]);
  assert.equal(q.mensualInicial, 3200 + 750 + 400);
  assert.equal(q.mensualRecurrente, 3200 + 400);
  assert.equal(q.valorContrato, (3200 + 400) * 24 + 750 * 12);
  assert.equal(modelo.cotizar({ dispositivos: 10, colectores: { [nuc]: 0, [azure]: 0 } }).lineas.length, 1);
});

test("desglose de personal: escenario ajustado con salario base y prestaciones", () => {
  const d = modelo.detallePersonal("ajustado");
  const n2 = d.roles.find((r) => r.rol.includes("N2"));
  assert.equal(n2.salarioCop, 6300000); // 9.000.000 - 30 %
  assert.equal(n2.baseCop, 6300000);
  assert.equal(Math.round(n2.prestacionesCop), 3276000); // 52 %
  assert.equal(Math.round(n2.costoCop), 9576000);
  assert.equal(d.roles.find((r) => r.rol.includes("vulnerabilidades")).salarioCop, 5600000); // 8.000.000 - 30 %
  assert.equal(d.roles.find((r) => r.rol.includes("N1")).cantidad, 1);
  assert.equal(d.porModulo.incidentes, 4484);
  assert.equal(d.porModulo.vulnerabilidades, 2128);
  assert.equal(Math.round(d.totalCop), 41172000);
  assert.equal(d.fte, 3.8); // 1 + 1 + 1 + 0.5 + 0.3
  assert.deepEqual(modelo.compararEscenarios(4).map((x) => [x.nombre, x.listaBase, x.equilibrioPorSede]), [["ajustado", 3200, 292.6]]);
});
