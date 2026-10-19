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
  assert.equal(p.costos.total, 12002.9);
  assert.equal(p.equilibrioBase, 2599.45);
  assert.equal(p.listaBase, 2600);
  assert.equal(p.costoVulnerabilidades, 1605.12);
  assert.equal(p.sedesEquilibrio, 8);
  assert.equal(p.equilibrioPorSede, 200.64);
  assert.equal(p.precioPorSede, 560);
  assert.equal(p.sedesMinimas, 3);
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
  // 2600 + 2x560 + 20x52 + 20x10 = 4960; 10% = 496; + 250 NUC
  assert.equal(q.subtotalMensual, 5210);
  assert.equal(q.descuentoMensual, 496);
  assert.equal(q.mensualInicial, 4714);
  assert.equal(q.mensualRecurrente, 4464);
  assert.equal(q.mesesConCargoTemporal, 12);
  assert.equal(q.valorContrato, 4464 * 24 + 250 * 12);
  // Con 10 % de descuento el plan base (2340) queda bajo su equilibrio (2599.45),
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
  assert.equal(q.mensualInicial, 2600);
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
  assert.equal(q.pisoEquilibrio, 601.92);
});

test("sin servicios la oferta queda vacía", () => {
  const q = modelo.cotizar({ soc: false, vulnerabilidades: false });
  assert.equal(q.vacia, true);
  assert.equal(q.mensualInicial, 0);
});

test("sensibilidad de vulnerabilidades cruza cero en 3 sedes", () => {
  const f = modelo.sensibilidadVulnerabilidades(560, 12);
  assert.ok(f[1].utilidad < 0 && f[2].utilidad > 0);
  assert.equal(f[10].excedeCapacidad, true);
});

test("vulnerabilidades: 50 % de descuento desde la sede 11", () => {
  const q = modelo.cotizar({ soc: false, vulnerabilidades: true, sedes: 13 });
  assert.deepEqual(q.lineas.map((l) => [l.id, l.cantidad, l.unitario]), [["vuln", 10, 560], ["vuln2", 3, 280]]);
  assert.equal(q.mensualInicial, 5600 + 840);
  // Piso: equipo completo (1605.12) + 3 sedes sobre la capacidad de 10 a 160.512 c/u
  assert.equal(q.pisoEquilibrio, 2086.66);
  assert.equal(modelo.cotizar({ soc: false, vulnerabilidades: true, sedes: 10 }).lineas.length, 1);
});

test("colectores NUC y Azure independientes", () => {
  const ops = modelo.opcionesColector();
  const nuc = ops.find((o) => o.opcion.startsWith("NUC")).id;
  const azure = ops.find((o) => o.opcion.includes("Azure")).id;
  const q = modelo.cotizar({ dispositivos: 10, colectores: { [nuc]: 3, [azure]: 2 }, plazoMeses: 24 });
  const cols = q.lineas.filter((x) => x.id.startsWith("col"));
  assert.deepEqual(cols.map((l) => [l.cantidad, l.unitario, l.meses]), [[3, 250, 12], [2, 200, null]]);
  assert.equal(q.mensualInicial, 2600 + 750 + 400);
  assert.equal(q.mensualRecurrente, 2600 + 400);
  assert.equal(q.valorContrato, (2600 + 400) * 24 + 750 * 12);
  assert.equal(modelo.cotizar({ dispositivos: 10, colectores: { [nuc]: 0, [azure]: 0 } }).lineas.length, 1);
});

test("desglose de personal: escenario ajustado con salario base y prestaciones", () => {
  const d = modelo.detallePersonal("ajustado");
  const n2 = d.roles.find((r) => r.rol.includes("N2"));
  assert.equal(n2.salarioCop, 3780000); // 9.000.000 - 30 % - 40 %
  assert.equal(n2.baseCop, 3780000);
  assert.equal(Math.round(n2.prestacionesCop), 1965600); // 52 %
  assert.equal(Math.round(n2.costoCop), 5745600);
  assert.equal(d.roles.find((r) => r.rol.includes("vulnerabilidades")).salarioCop, 3360000); // 8.000.000 - 30 % - 40 %
  assert.equal(d.roles.find((r) => r.rol.includes("N1")).cantidad, 1);
  assert.equal(d.porModulo.incidentes, 3074.74);
  assert.equal(d.porModulo.vulnerabilidades, 1459.2);
  assert.equal(Math.round(d.totalCop), 26215200); // líder al 50 %, ingeniero al 30 %
  assert.equal(d.fte, 3.8); // 1 + 1 + 1 + 0.5 + 0.3
  assert.deepEqual(modelo.compararEscenarios(4).map((x) => [x.nombre, x.listaBase, x.equilibrioPorSede]), [["ajustado", 2600, 200.64]]);
});

test("margen comercial sobre el precio de venta del plan SOC", () => {
  assert.equal(modelo.precio(4, undefined, 0.2).listaBase, 3250); // 2599.45 / 0.8 = 3249.31 -> 3250
  assert.equal(modelo.precio(4, undefined, 0.3).listaBase, 3750);
  assert.equal(modelo.cotizar({ dispositivos: 10, margenComercial: 0.2 }).mensualInicial, 3250);
  assert.throws(() => modelo.precio(4, undefined, 1));
});
