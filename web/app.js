/* Interfaz del cotizador SOC: arma la oferta en tiempo real con cotizador.js. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const usd = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", currencyDisplay: "code", minimumFractionDigits: 2 });
  const usd0 = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", currencyDisplay: "code", maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });
  const CLAVE = "cotizador-soc-borrador";
  const CAMPOS = ["cliente", "contacto", "plazo", "vuln", "dispositivos", "agentes", "descuento", "escenario", "clientesEq"];

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
      vulnerabilidades: $("vuln").checked,
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

  function render() {
    const sel = seleccion();
    const q = modelo.cotizar(sel);
    ultima = q;
    const p = q.precio;

    $("precioBase").textContent = usd0.format(p.listaBase) + "/mes";
    $("precioVuln").textContent = usd0.format(p.listaVulnerabilidades);
    $("precioDisp").textContent = usd0.format(p.precioDispositivo);
    $("precioAgente").textContent = usd0.format(p.precioAgente);
    $("incluidos").textContent = $("incluidos2").textContent = p.dispositivosIncluidos;
    $("descuentoOut").textContent = `${$("descuento").value} %`;

    const cliente = $("cliente").value.trim() || "Cliente sin nombre";
    $("hClient").textContent = cliente;
    $("hContact").textContent = $("contacto").value.trim();
    $("hNum").textContent = numeroCotizacion(cliente);
    $("hDate").textContent = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
    $("hPlazo").textContent = `Plazo ${q.plazoMeses} meses`;

    $("lineas").innerHTML = q.lineas.map((l) => `
      <tr>
        <td>${esc(l.concepto)}${l.meses ? `<small>Cargo durante ${l.meses} meses</small>` : ""}</td>
        <td class="r num">${l.cantidad}</td>
        <td class="r num">${usd.format(l.unitario)}</td>
        <td class="r num">${usd.format(l.subtotal)}</td>
      </tr>`).join("");

    $("pie").innerHTML = q.descuentoMensual
      ? `<tr><td colspan="3">Subtotal</td><td class="r num">${usd.format(q.subtotalMensual)}</td></tr>
         <tr class="disc"><td colspan="3">Descuento ${pct.format(q.descuento)} sobre servicios SOC</td><td class="r num">−${usd.format(q.descuentoMensual)}</td></tr>`
      : "";

    const temporal = q.mesesConCargoTemporal && q.mensualInicial !== q.mensualRecurrente;
    $("totales").innerHTML = `
      <div class="total main"><span class="eyebrow">${temporal ? `Mensualidad meses 1–${q.mesesConCargoTemporal}` : "Mensualidad"}</span><b>${usd.format(q.mensualInicial)}</b><small>USD + impuestos</small></div>
      ${temporal ? `<div class="total"><span class="eyebrow">Desde el mes ${q.mesesConCargoTemporal + 1}</span><b>${usd.format(q.mensualRecurrente)}</b><small>sin cargo de colector</small></div>` : ""}
      <div class="total"><span class="eyebrow">Valor del contrato</span><b>${usd.format(q.valorContrato)}</b><small>${q.plazoMeses} meses</small></div>`;

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

  function renderInterna(q, sel) {
    const p = q.precio;
    const ok = q.contribucion >= 0;
    const plan = q.lineas.filter((l) => l.id === "base" || l.id === "vuln").reduce((a, l) => a + l.neto, 0);
    const eqPlan = p.equilibrioBase + (sel.vulnerabilidades ? p.equilibrioVulnerabilidades : 0);
    $("kpis").innerHTML = `
      <div class="kpi"><span class="eyebrow">Equilibrio del plan</span><b>${usd.format(eqPlan)}</b><small class="muted">por cliente con ${p.clientes} clientes</small></div>
      <div class="kpi"><span class="eyebrow">Piso de esta oferta</span><b>${usd.format(q.pisoEquilibrio)}</b><small class="muted">equilibrio + costo de adicionales y colector</small></div>
      <div class="kpi ${ok ? "ok" : "bad"}"><span class="eyebrow">Contribución mensual</span><b>${usd.format(q.contribucion)}</b><span class="pill ${ok ? "ok" : "bad"}">${ok ? "Sobre equilibrio" : "Bajo equilibrio"} · ${pct.format(q.margenSobrePiso)}</span></div>
      <div class="kpi"><span class="eyebrow">Costo SOC mensual</span><b>${usd.format(p.costos.total)}</b><small class="muted">${p.costos.dispositivos} dispositivos agregados</small></div>`;

    const filas = modelo.sensibilidad(plan, 8, sel.escenario);
    const maxAbs = Math.max(1, ...filas.map((f) => Math.abs(f.utilidad)));
    $("bars").innerHTML = filas.map((f) => {
      const w = (Math.abs(f.utilidad) / maxAbs) * 50;
      return `<div class="bar" title="Ingreso ${usd0.format(f.ingreso)} · costo ${usd0.format(f.costo)}">
        <span class="num">${f.clientes} cl.${f.excedeCapacidad ? " *" : ""}</span>
        <span class="track"><span class="fill ${f.utilidad >= 0 ? "pos" : "neg"}" style="width:${w}%"></span></span>
        <span class="num r">${usd0.format(f.utilidad)}</span></div>`;
    }).join("");
    $("notaInterna").textContent =
      `Plan neto ${usd0.format(plan)}/mes por cliente (base${sel.vulnerabilidades ? " + vulnerabilidades" : ""}, sin adicionales ni colector). ` +
      `* Supera la capacidad del equipo actual (${modelo.supuestos.capacidad_max_clientes_sin_contratar} clientes); habría que contratar. ` +
      `Supuestos editables en data/supuestos_soc.json.`;
  }

  function textoOferta() {
    const q = ultima;
    const lineas = q.lineas.map((l) => `- ${l.concepto}: ${l.cantidad} × ${usd.format(l.unitario)} = ${usd.format(l.subtotal)}/mes${l.meses ? ` (durante ${l.meses} meses)` : ""}`);
    return [
      `Propuesta SOC Netmask ${$("hNum").textContent}`,
      `Cliente: ${$("hClient").textContent}${$("hContact").textContent ? ` · ${$("hContact").textContent}` : ""}`,
      `Plazo: ${q.plazoMeses} meses`,
      "",
      ...lineas,
      q.descuentoMensual ? `- Descuento ${pct.format(q.descuento)} sobre servicios SOC: −${usd.format(q.descuentoMensual)}/mes` : null,
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
    $("vuln").checked = false;
    $("dispositivos").value = modelo.supuestos.plan_base.dispositivos_incluidos;
    $("agentes").value = 0;
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
