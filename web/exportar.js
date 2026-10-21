/*
 * Exporta la propuesta del cliente a Markdown y a Excel (.xlsx), sin dependencias.
 * Solo lleva lo que ve el cliente: nunca costos ni datos de la vista interna.
 *
 * oferta = { titulo, numero, fecha, cliente, contacto, plazoMeses, moneda,
 *            lineas: [{ concepto, cantidad, unitario, subtotal, meses }],
 *            descuento: { texto, valor } | null,
 *            totales: [{ etiqueta, valor }], incluye: [texto], notas: [texto] }
 * Los valores ya vienen en la moneda de presentación.
 */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ExportarOferta = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const decimales = (moneda) => (moneda === "COP" ? 0 : 2);

  function dinero(valor, moneda) {
    const d = decimales(moneda);
    const txt = new Intl.NumberFormat("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(valor));
    return `${valor < 0 ? "−" : ""}${moneda} ${txt}`;
  }

  function nombreArchivo(oferta, extension) {
    const base = `${oferta.numero || "propuesta-soc"} ${oferta.cliente || ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    return `${base || "propuesta-soc"}.${extension}`;
  }

  // ---------- Markdown ----------
  function markdown(oferta) {
    const m = (v) => dinero(v, oferta.moneda);
    const celda = (t) => String(t).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
    const filas = oferta.lineas.map((l) =>
      `| ${celda(l.concepto + (l.meses ? ` (cargo durante ${l.meses} meses)` : ""))} | ${l.cantidad} | ${m(l.unitario)} | ${m(l.subtotal)} |`);
    if (oferta.descuento) filas.push(`| ${celda(oferta.descuento.texto)} | | | ${m(-oferta.descuento.valor)} |`);
    return [
      `# ${oferta.titulo}`,
      "",
      `**Propuesta:** ${oferta.numero} · **Fecha:** ${oferta.fecha}  `,
      `**Cliente:** ${oferta.cliente}${oferta.contacto ? ` · **Contacto:** ${oferta.contacto}` : ""}  `,
      `**Plazo:** ${oferta.plazoMeses} meses`,
      "",
      "## Servicios incluidos",
      "",
      ...oferta.incluye.map((x) => `- ${x}`),
      "",
      "## Detalle mensual",
      "",
      "| Concepto | Cant. | Unitario | Mensual |",
      "|---|---:|---:|---:|",
      ...filas,
      "",
      "## Totales",
      "",
      ...oferta.totales.map((t) => `- **${t.etiqueta}:** ${m(t.valor)}`),
      "",
      "## Condiciones",
      "",
      ...oferta.notas.map((x) => `- ${x}`),
      "",
    ].join("\n");
  }

  // ---------- Excel (.xlsx) ----------
  const xml = (t) => String(t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Estilos: 0 normal, 1 negrita, 2 dinero, 3 dinero en negrita, 4 título, 5 encabezado de tabla, 6 texto ajustado, 7 alineado arriba.
  function estilos(moneda) {
    const formato = `&quot;${moneda} &quot;#,##0${decimales(moneda) ? ".00" : ""};[Red]&quot;−${moneda} &quot;#,##0${decimales(moneda) ? ".00" : ""}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="${formato}"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF0A2540"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0A2540"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  function hoja(oferta) {
    const filas = [];
    const fusiones = [];
    const altos = {};
    const fila = (...celdas) => { filas.push(celdas); return filas.length; };
    const texto = (v, s = 0) => ({ t: "s", v, s });
    const num = (v, s = 0) => ({ t: "n", v, s });
    const dineroCelda = (v, negrita) => num(Math.round(v * 100) / 100, negrita ? 3 : 2);
    // Las celdas combinadas no ajustan su alto solas: se estima con ~120 caracteres por renglón (A:E).
    const parrafo = (t, s = 6) => {
      const r = fila(texto(t, s));
      fusiones.push(`A${r}:E${r}`);
      altos[r] = 15 * Math.max(1, Math.ceil(String(t).length / 120));
    };

    fila(texto(oferta.titulo, 4));
    fila(texto("Propuesta", 1), texto(oferta.numero));
    fila(texto("Fecha", 1), texto(oferta.fecha));
    fila(texto("Cliente", 1), texto(oferta.cliente));
    if (oferta.contacto) fila(texto("Contacto", 1), texto(oferta.contacto));
    fila(texto("Plazo", 1), texto(`${oferta.plazoMeses} meses`));
    fila();
    fila(texto("Servicios incluidos", 1));
    oferta.incluye.forEach((x) => parrafo(x));
    fila();
    fila(...["Concepto", "Cantidad", `Unitario (${oferta.moneda}/mes)`, `Mensual (${oferta.moneda})`, "Meses de cobro"].map((t) => texto(t, 5)));
    for (const l of oferta.lineas) {
      fila(texto(l.concepto, 6), num(l.cantidad, 7), dineroCelda(l.unitario), dineroCelda(l.subtotal), texto(l.meses ? `${l.meses} meses` : "Todo el plazo", 7));
    }
    if (oferta.descuento) fila(texto(oferta.descuento.texto, 6), null, null, dineroCelda(-oferta.descuento.valor));
    fila();
    for (const t of oferta.totales) fila(texto(t.etiqueta, 1), null, null, dineroCelda(t.valor, true));
    fila();
    fila(texto("Condiciones", 1));
    oferta.notas.forEach((x) => parrafo(x));

    const col = (i) => String.fromCharCode(65 + i);
    const cuerpo = filas.map((celdas, r) => `<row r="${r + 1}"${altos[r + 1] ? ` ht="${altos[r + 1]}" customHeight="1"` : ""}>${celdas.map((c, i) => {
      if (!c) return "";
      const ref = `${col(i)}${r + 1}`;
      const s = c.s ? ` s="${c.s}"` : "";
      return c.t === "n" ? `<c r="${ref}"${s}><v>${c.v}</v></c>`
        : `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(c.v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<cols><col min="1" max="1" width="62" customWidth="1"/><col min="2" max="2" width="11" customWidth="1"/><col min="3" max="4" width="22" customWidth="1"/><col min="5" max="5" width="16" customWidth="1"/></cols>
<sheetData>${cuerpo}</sheetData>
${fusiones.length ? `<mergeCells count="${fusiones.length}">${fusiones.map((r) => `<mergeCell ref="${r}"/>`).join("")}</mergeCells>` : ""}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  }

  function xlsx(oferta) {
    return zip([
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Propuesta" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ["xl/worksheets/sheet1.xml", hoja(oferta)],
      ["xl/styles.xml", estilos(oferta.moneda)],
    ]);
  }

  // ZIP sin compresión (método «store»): suficiente para un .xlsx pequeño.
  const TABLA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function zip(archivos) {
    const enc = new TextEncoder();
    const partes = [];
    const central = [];
    let desplazamiento = 0;
    for (const [nombre, contenido] of archivos) {
      const n = enc.encode(nombre);
      const datos = enc.encode(contenido);
      const crc = crc32(datos);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // nombres en UTF-8
      local.setUint16(12, 0x21, true); // 1980-01-01
      local.setUint32(14, crc, true);
      local.setUint32(18, datos.length, true);
      local.setUint32(22, datos.length, true);
      local.setUint16(26, n.length, true);
      partes.push(new Uint8Array(local.buffer), n, datos);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x0800, true);
      c.setUint16(14, 0x21, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, datos.length, true);
      c.setUint32(24, datos.length, true);
      c.setUint16(28, n.length, true);
      c.setUint32(42, desplazamiento, true);
      central.push(new Uint8Array(c.buffer), n);
      desplazamiento += 30 + n.length + datos.length;
    }
    const tamCentral = central.reduce((a, b) => a + b.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true);
    fin.setUint16(8, archivos.length, true);
    fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamCentral, true);
    fin.setUint32(16, desplazamiento, true);
    const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
    const salida = new Uint8Array(todo.reduce((a, b) => a + b.length, 0));
    let i = 0;
    for (const p of todo) { salida.set(p, i); i += p.length; }
    return salida;
  }

  return { markdown, xlsx, nombreArchivo, dinero };
});
