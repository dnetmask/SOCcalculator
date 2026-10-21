// Pruebas de la exportación de la propuesta a Markdown y Excel.
// Ejecutar: node --test web/
const test = require("node:test");
const assert = require("node:assert/strict");
const { markdown, xlsx, nombreArchivo } = require("./exportar.js");

const oferta = {
  titulo: "Propuesta SOC IT Netmask", numero: "NM-SOC-20261021-946", fecha: "21 de octubre de 2026",
  cliente: "Tecnoquímicas · Tecnofar", contacto: "Gerencia TI", plazoMeses: 12, moneda: "COP",
  lineas: [
    { concepto: "SOC de incidentes: plataforma FortiSIEM y 10 dispositivos/consolas fuente", cantidad: 1, unitario: 10325000, subtotal: 10325000, meses: null },
    { concepto: "Colector: NUC on-prem", cantidad: 1, unitario: 875000, subtotal: 875000, meses: 12 },
  ],
  descuento: { texto: "Descuento 10 % sobre servicios", valor: 1032500 },
  totales: [{ etiqueta: "Mensualidad meses 1–12", valor: 10167500 }, { etiqueta: "Valor del contrato (12 meses)", valor: 122010000 }],
  incluye: ["SOC de incidentes: 10 dispositivos/consolas fuente | retención 12 meses"],
  notas: ["Valores en COP. Excluido de IVA por ser servicio de computación en la nube."],
};

test("markdown con tabla, totales y condiciones", () => {
  const md = markdown(oferta);
  assert.match(md, /^# Propuesta SOC IT Netmask/);
  assert.match(md, /\| Colector: NUC on-prem \(cargo durante 12 meses\) \| 1 \| COP 875\.000 \| COP 875\.000 \|/);
  assert.match(md, /\| Descuento 10 % sobre servicios \| \| \| −COP 1\.032\.500 \|/);
  assert.match(md, /- \*\*Valor del contrato \(12 meses\):\*\* COP 122\.010\.000/);
  const conBarra = markdown({ ...oferta, lineas: [{ ...oferta.lineas[0], concepto: "Firewall | mid range" }] });
  assert.ok(conBarra.includes("| Firewall \\| mid range |")); // los | del texto no rompen la tabla
});

test("xlsx es un ZIP válido con la hoja y valores numéricos", () => {
  const b = Buffer.from(xlsx(oferta));
  assert.equal(b.readUInt32LE(0), 0x04034b50);
  assert.equal(b.readUInt32LE(b.length - 22), 0x06054b50);
  const hoja = b.toString("utf8");
  assert.ok(hoja.includes("xl/worksheets/sheet1.xml"));
  assert.ok(hoja.includes("<v>10325000</v>") && hoja.includes("<v>-1032500</v>"));
  assert.ok(hoja.includes("Tecnoquímicas · Tecnofar"));
  assert.ok(!/costo|equilibrio/i.test(hoja)); // nada de la vista interna
});

test("nombre de archivo sin tildes ni espacios", () => {
  assert.equal(nombreArchivo(oferta, "xlsx"), "NM-SOC-20261021-946-Tecnoquimicas-Tecnofar.xlsx");
});
