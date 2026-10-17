/* Interfaz del cotizador SOC: arma la oferta en tiempo real con cotizador.js. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const usd = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", currencyDisplay: "code", minimumFractionDigits: 2 });
  const usd0 = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", currencyDisplay: "code", maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });
  const CLAVE = "cotizador-soc-borrador";
  const CAMPOS = ["cliente", "contacto", "plazo", "soc", "vuln", "sedes", "dispositivos", "agentes", "ueba", "descuento", "escenario", "clientesEq", "eps"];
  const LICENCIAS = new Set(["disp", "agt", "ueba"]);

  let modelo = null;
  let ultima = null;

  async function cargarJSON(nombre) {
    for (const base of ["data/", "../data/"]) {
      try {
        const r = await fetch(base + nombre);
        if (r.ok) return await r.json();
      } catch (_) { /* probar la siguiente ruta */ }
    }
    throw new Error(`No se pudo cargar ${nombre}. Abre el cotizador desde un servidor web (por ejemplo: python -m http.server en la raíz del repositorio).`);
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function entero(id) {
    const v = Math.floor(Number($(id).value));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  }

  function seleccion() {
    const col = document.querySelector('input[name="colector"]:checked');
    return {
      dispositivos: entero("dispositivos"),
      agentes: entero("agentes"),
      ueba: entero("ueba"),
      soc: $("soc").checked,
      vulnerabilidades: $("vuln").checked,
      sedes: entero("sedes"),
      colector: col ? Number(col.value) : 0,
      descuento: Number($("descuento").value) / 100,
      plazoMeses: Number($("plazo").value),
      clientesEquilibrio: Math.max(1, entero("clientesEq") || 1),
      escenario: $("escenario").value,
    };
  }

  function numeroCotizacion(cliente) {
    const d = new Date();
    let h = 0;
    for (const c of cliente) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const f = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `NM-SOC-${f}-${String(h % 1000).padStart(3, "0")}`;
  }

  function retencionTexto(p) {
    const r = p.retencion;
    const linea = r.enLineaDias % 30 === 0 ? `${r.enLineaDias / 30} ${r.enLineaDias === 30 ? "mes" : "meses"}` : `${r.enLineaDias} días`;
    return { linea, archivo: `${r.archivadoMeses} ${r.archivadoMeses === 1 ? "mes" : "meses"}` };
  }

  // UEBA depende de los agentes: se limita y se desactiva cuando no hay agentes.
  function sincronizarUeba() {
    const agentes = entero("agentes");
    if (entero("ueba") > agentes) $("ueba").value = agentes;
    const sinAgentes = agentes === 0;
    $("ueba").disabled = sinAgentes;
    document.querySelectorAll('[data-step="ueba"]').forEach((b) => { b.disabled = sinAgentes; });
    $("filaUeba").classList.toggle("disabled", sinAgentes);
  }

  // Cada servicio se activa por separado; sin SOC de incidentes no aplican sus complementos.
  function sincronizarServicios() {
    const soc = $("soc").checked;
    const vuln = $("vuln").checked;
    $("cardSoc").classList.toggle("off", !soc);
    $("cardVuln").classList.toggle("off", !vuln);
    $("seccionSoc").hidden = !soc;
    if (vuln && entero("sedes") < 1) $("sedes").value = 1;
    $("sedes").disabled = !vuln;
    document.querySelectorAll('[data-step="sedes"]').forEach((b) => { b.disabled = !vuln; });
    $("sinServicio").hidden = soc || vuln;
  }

  function render() {
    sincronizarServicios();
    sincronizarUeba();
    const sel = seleccion();
    const q = modelo.cotizar(sel);
    ultima = q;
    const p = q.precio;

    $("precioBase").textContent = usd0.format(p.listaBase) + "/mes";
    $("precioSede").textContent = usd0.format(p.precioPorSede);
    const dv = p.descuentoVolumen;
    $("notaVolumen").textContent = `Desde la sede ${dv.desdeSede}: ${usd0.format(dv.precio)}/sede (${Math.round(dv.fraccion * 100)} % de descuento).`;
    $("precioDisp").textContent = usd0.format(p.precioDispositivo);
    $("precioAgente").textContent = usd0.format(p.precioAgente);
    $("precioUeba").textContent = usd0.format(p.precioUeba);
    const ret = retencionTexto(p);
    $("retLinea").textContent = ret.linea;
    $("retArch").textContent = ret.archivo;
    $("incluidos").textContent = $("incluidos2").textContent = p.dispositivosIncluidos;
    $("descuentoOut").textContent = `${$("descuento").value} %`;

    const cliente = $("cliente").value.trim() || "Cliente sin nombre";
    $("hClient").textContent = cliente;
    $("hContact").textContent = $("contacto").value.trim();
    $("hNum").textContent = numeroCotizacion(cliente);
    $("hDate").textContent = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    $("hPlazo").textContent = `Plazo ${q.plazoMeses} meses`;

    $("lineas").innerHTML = q.vacia
      ? `<tr><td colspan="4" class="muted">Activa el SOC de incidentes o la gestión de vulnerabilidades para armar la propuesta.</td></tr>`
      : q.lineas.map((l) => `
      <tr>
        <td>${LICENCIAS.has(l.id) ? '<span class="lic" title="Licencia FortiSIEM MSSP"></span>' : ""}${esc(l.concepto)}${l.meses ? `<small>Cargo durante ${l.meses} meses</small>` : ""}</td>
        <td class="r num">${l.cantidad}</td>
        <td class="r num">${usd.format(l.unitario)}</td>
        <td class="r num">${usd.format(l.subtotal)}</td>
      </tr>`).join("");

    $("pie").innerHTML = q.descuentoMensual
      ? `<tr><td colspan="3">Subtotal</td><td class="r num">${usd.format(q.subtotalMensual)}</td></tr>
         <tr class="disc"><td colspan="3">Descuento ${pct.format(q.descuento)} sobre servicios</td><td class="r num">−${usd.format(q.descuentoMensual)}</td></tr>`
      : "";

    const temporal = q.mesesConCargoTemporal && q.mensualInicial !== q.mensualRecurrente;
    $("totales").innerHTML = `
      <div class="total main"><span class="eyebrow">${temporal ? `Mensualidad meses 1–${q.mesesConCargoTemporal}` : "Mensualidad"}</span><b>${usd.format(q.mensualInicial)}</b><small>USD + impuestos</small></div>
      ${temporal ? `<div class="total"><span class="eyebrow">Desde el mes ${q.mesesConCargoTemporal + 1}</span><b>${usd.format(q.mensualRecurrente)}</b><small>sin cargo de colector</small></div>` : ""}
      <div class="total"><span class="eyebrow">Valor del contrato</span><b>${usd.format(q.valorContrato)}</b><small>${q.plazoMeses} meses</small></div>`;

    $("incluye").innerHTML = textoIncluye(q).map((x) => `<span>${x}</span>`).join("");
    $("incluye").hidden = q.vacia;
    $("termUeba").hidden = !q.soc;
    $("termDisp").hidden = !q.soc;
    $("termSonda").hidden = !q.sedes;

    const col = q.lineas.find((l) => l.id === "col");
    $("termColector").hidden = !col;
    if (col) {
      $("termColector").textContent = col.meses
        ? `El colector se cobra ${usd.format(col.unitario)} al mes durante ${col.meses} meses, sumado a la mensualidad.`
        : `El colector se cobra ${usd.format(col.unitario)} al mes mientras dure el servicio.`;
    }

    renderInterna(q, sel);
    guardarBorrador();
  }

  function textoIncluye(q) {
    const p = q.precio;
    const ret = retencionTexto(p);
    const partes = [];
    if (q.soc) partes.push(`<b>SOC de incidentes:</b> ${p.dispositivosIncluidos} dispositivos, retención de eventos de ${ret.linea} en línea + ${ret.archivo} archivados, plataforma FortiSIEM MSSP en Azure con IOC de FortiGuard.`);
    if (q.sedes) partes.push(`<b>Vulnerabilidades OT:</b> ${q.sedes} ${q.sedes === 1 ? "sede" : "sedes"} con inventario de activos, priorización por CVE, virtual patching y ciclo de parches ISA/IEC 62443-2-3.`);
    return partes;
  }

  function barras(filas, unidad) {
    const maxAbs = Math.max(1, ...filas.map((f) => Math.abs(f.utilidad)));
    return filas.map((f) => {
      const w = (Math.abs(f.utilidad) / maxAbs) * 50;
      return `<div class="bar" title="Ingreso ${usd0.format(f.ingreso)} · costo ${usd0.format(f.costo)}">
        <span class="num">${f.clientes} ${unidad}${f.excedeCapacidad ? " *" : ""}</span>
        <span class="track"><span class="fill ${f.utilidad >= 0 ? "pos" : "neg"}" style="width:${w}%"></span></span>
        <span class="num r">${usd0.format(f.utilidad)}</span></div>`;
    }).join("");
  }

  function renderInterna(q, sel) {
    const p = q.precio;
    const ok = q.contribucion >= 0;
    const base = q.lineas.find((l) => l.id === "base");
    const vuln = q.lineas.find((l) => l.id === "vuln");
    const planSoc = base ? base.neto : p.listaBase;
    const precioSedeNeto = vuln ? vuln.neto / vuln.cantidad : p.precioPorSede;
    $("kpis").innerHTML = `
      <div class="kpi"><span class="eyebrow">Equilibrio SOC incidentes</span><b>${usd.format(p.equilibrioBase)}</b><small>por cliente con ${p.clientes} clientes</small></div>
      <div class="kpi"><span class="eyebrow">Equilibrio vulnerabilidades</span><b>${usd.format(p.equilibrioPorSede)}</b><small>por sede con ${p.sedesEquilibrio} sedes · equipo ${usd0.format(p.costoVulnerabilidades)}/mes</small></div>
      <div class="kpi"><span class="eyebrow">Piso de esta oferta</span><b>${usd.format(q.pisoEquilibrio)}</b><small>equilibrio + costo de adicionales y colector</small></div>
      <div class="kpi ${ok ? "ok" : "bad"}"><span class="eyebrow">Contribución mensual</span><b>${usd.format(q.contribucion)}</b><span class="pill ${ok ? "ok" : "bad"}">${ok ? "Sobre equilibrio" : "Bajo equilibrio"} · ${pct.format(q.margenSobrePiso)}</span></div>`;

    $("bars").innerHTML = barras(modelo.sensibilidad(planSoc, 8, sel.escenario), "cl.");
    $("barsVuln").innerHTML = barras(modelo.sensibilidadVulnerabilidades(precioSedeNeto, 12, sel.escenario), "sed.");
    const a = modelo.estimarAlmacenamiento(entero("eps"));
    const gb = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
    $("almacenamiento").innerHTML = `
      <dt>Volumen diario crudo</dt><dd class="num">${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(a.gbDia)} GB</dd>
      <dt>En línea (${p.retencion.enLineaDias} días)</dt><dd class="num">${gb.format(a.gbEnLinea)} GB</dd>
      <dt>Archivado (${p.retencion.archivadoMeses} meses)</dt><dd class="num">${gb.format(a.gbArchivado)} GB</dd>
      <dt>Costo estimado Azure</dt><dd class="num">${usd.format(a.costo)}/mes</dd>
      <dt>Presupuesto por cliente</dt><dd class="num">${usd.format(a.presupuesto)}/mes</dd>
      <dt>EPS que cubre el presupuesto</dt><dd class="num">~${gb.format(a.epsCubiertos)}</dd>`;

    $("notaInterna").textContent =
      `SOC de incidentes a ${usd0.format(planSoc)}/mes por cliente, sin adicionales ni colector; su costo excluye el equipo de vulnerabilidades. ` +
      `Vulnerabilidades a ${usd0.format(precioSedeNeto)} por sede: cubre su equipo desde ${Math.ceil(p.costoVulnerabilidades / precioSedeNeto - 1e-9)} sedes. ` +
      `* Supera la capacidad del equipo actual (${modelo.supuestos.capacidad_max_clientes_sin_contratar} clientes / ${modelo.supuestos.gestion_vulnerabilidades.capacidad_max_sedes} sedes). ` +
      `Supuestos editables en data/supuestos_soc.json.`;
  }

  function textoOferta() {
    const q = ultima;
    const lineas = q.lineas.map((l) => `- ${l.concepto}: ${l.cantidad} × ${usd.format(l.unitario)} = ${usd.format(l.subtotal)}/mes${l.meses ? ` (durante ${l.meses} meses)` : ""}`);
    return [
      `Propuesta SOC Netmask ${$("hNum").textContent}`,
      `Cliente: ${$("hClient").textContent}${$("hContact").textContent ? ` · ${$("hContact").textContent}` : ""}`,
      `Plazo: ${q.plazoMeses} meses`,
      ...textoIncluye(q).map((x) => x.replace(/<\/?b>/g, "")),
      q.sedes ? "No incluye la licencia de la sonda OT, que aporta el cliente." : null,
      "",
      ...lineas,
      q.descuentoMensual ? `- Descuento ${pct.format(q.descuento)} sobre servicios: −${usd.format(q.descuentoMensual)}/mes` : null,
      "",
      `Mensualidad: ${usd.format(q.mensualInicial)}` + (q.mensualInicial !== q.mensualRecurrente ? ` (desde el mes ${q.mesesConCargoTemporal + 1}: ${usd.format(q.mensualRecurrente)})` : ""),
      `Valor del contrato: ${usd.format(q.valorContrato)}`,
      "Valores en USD antes de impuestos.",
    ].filter((x) => x !== null).join("\n");
  }

  async function copiar() {
    const texto = textoOferta();
    const toast = $("toast");
    try {
      await navigator.clipboard.writeText(texto);
      toast.textContent = "Oferta copiada";
    } catch (_) {
      const area = $("copiaTexto");
      area.value = texto;
      area.hidden = false;
      area.rows = 10;
      area.style.width = "100%";
      area.select();
      toast.textContent = "Selecciona el texto y cópialo";
    }
    setTimeout(() => { toast.textContent = ""; }, 3000);
  }

  function guardarBorrador() {
    try {
      const datos = Object.fromEntries(CAMPOS.map((id) => [id, $(id).type === "checkbox" ? $(id).checked : $(id).value]));
      datos.colector = (document.querySelector('input[name="colector"]:checked') || {}).value;
      localStorage.setItem(CLAVE, JSON.stringify(datos));
    } catch (_) { /* sin almacenamiento: la página funciona igual */ }
  }

  function cargarBorrador() {
    try {
      const datos = JSON.parse(localStorage.getItem(CLAVE) || "null");
      if (!datos) return;
      for (const id of CAMPOS) {
        if (datos[id] === undefined) continue;
        if ($(id).type === "checkbox") $(id).checked = datos[id];
        else $(id).value = datos[id];
      }
      const radio = document.querySelector(`input[name="colector"][value="${datos.colector}"]`);
      if (radio) radio.checked = true;
      $("ejemplo").hidden = true;
    } catch (_) { /* borrador ilegible: se ignora */ }
  }

  function reiniciar() {
    try { localStorage.removeItem(CLAVE); } catch (_) { /* nada */ }
    $("cliente").value = "";
    $("contacto").value = "";
    $("plazo").value = "12";
    $("soc").checked = true;
    $("vuln").checked = false;
    $("sedes").value = 1;
    $("dispositivos").value = modelo.supuestos.plan_base.dispositivos_incluidos;
    $("agentes").value = 0;
    $("ueba").value = 0;
    $("descuento").value = 0;
    document.querySelector('input[name="colector"]').checked = true;
    $("ejemplo").hidden = true;
    $("copiaTexto").hidden = true;
    render();
    $("cliente").focus();
  }

  async function iniciar() {
    try {
      const [precios, reglas, supuestos] = await Promise.all(
        ["precios.json", "reglas.json", "supuestos_soc.json"].map(cargarJSON));
      modelo = Cotizador.crearModelo(precios, reglas, supuestos);
    } catch (e) {
      $("error").textContent = e.message;
      $("error").hidden = false;
      return;
    }

    $("escenario").innerHTML = modelo.escenarios.map((n) =>
      `<option value="${esc(n)}"${n === modelo.supuestos.escenario_personal ? " selected" : ""}>${esc(n)}</option>`).join("");
    $("clientesEq").value = modelo.supuestos.clientes_punto_equilibrio;

    const ops = modelo.opcionesColector();
    const nuc = ops.find((o) => o.mesesCobro) || ops[0];
    $("colectores").innerHTML = ops.map((o) => `
      <label class="opt">
        <input type="radio" name="colector" id="colector-${o.id}" value="${o.id}"${o.id === nuc.id ? " checked" : ""}>
        <strong>${esc(o.opcion)}</strong>
        <span class="num">${o.precioMensual ? usd0.format(o.precioMensual) + "/mes" : "Sin costo"}</span>
        <small>${o.mesesCobro ? `Equipo de ${usd0.format(o.costoTotal)} · durante ${o.mesesCobro} meses` : o.precioMensual ? "Recurrente" : "El cliente aporta la VM"}</small>
      </label>`).join("");

    cargarBorrador();

    $("form").addEventListener("input", render);
    $("form").addEventListener("change", render);
    $("form").addEventListener("submit", (e) => e.preventDefault());
    $("interna").addEventListener("input", render);
    $("interna").addEventListener("change", render);
    document.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
      const input = $(b.dataset.step);
      input.value = Math.max(0, entero(b.dataset.step) + Number(b.dataset.d));
      render();
    }));
    $("copiar").addEventListener("click", copiar);
    $("reiniciar").addEventListener("click", reiniciar);
    render();
  }

  iniciar();
})();
