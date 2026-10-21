/* Interfaz del cotizador SOC: arma la oferta en tiempo real con cotizador.js. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  // El motor calcula en USD (licencias Fortinet y Azure); la presentación usa la moneda de los
  // supuestos (COP por defecto), convirtiendo con la TRM. Se configuran al cargar el modelo.
  let MONEDA = "COP";
  let TRM = 1;
  const formatos = {};
  function formato(decimales) {
    const clave = `${MONEDA}${decimales}`;
    formatos[clave] = formatos[clave] || new Intl.NumberFormat("es-CO", {
      style: "currency", currency: MONEDA, currencyDisplay: "code",
      minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    return formatos[clave];
  }
  const aMoneda = (usd) => (MONEDA === "COP" ? usd * TRM : usd);
  // mon: importes con detalle (centavos en USD, pesos enteros en COP); mon0: importes redondos.
  const mon = { format: (usd) => formato(MONEDA === "COP" ? 0 : 2).format(aMoneda(usd)) };
  const mon0 = { format: (usd) => formato(0).format(aMoneda(usd)) };
  const cop = { format: (pesos) => formato(0).format(MONEDA === "COP" ? pesos : pesos / TRM) };
  const pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });
  const CLAVE = "cotizador-soc-borrador";
  const CAMPOS = ["cliente", "contacto", "plazo", "soc", "vuln", "sedes", "otras", "agentes", "ueba", "descuento", "escenario", "clientesEq", "margenCom", "eps"];
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

  function cantidadesFuentes() {
    return Object.fromEntries(modelo.fuentesPorTipo().map((f) => [f.id, entero(`ft_${f.id}`)]));
  }

  // Cantidad por tipo de colector con costo (NUC, Azure); cada uno es independiente.
  function cantidadesColector() {
    return Object.fromEntries(modelo.opcionesColector()
      .filter((o) => o.precioMensual > 0)
      .map((o) => [o.id, entero(`colN${o.id}`)]));
  }

  function seleccion() {
    return {
      // Las «otras consolas» van por la vía genérica: incluidas + adicionales.
      dispositivos: modelo.supuestos.plan_base.dispositivos_incluidos + entero("otras"),
      fuentesTipo: cantidadesFuentes(),
      agentes: entero("agentes"),
      ueba: entero("ueba"),
      soc: $("soc").checked,
      vulnerabilidades: $("vuln").checked,
      sedes: entero("sedes"),
      colectores: cantidadesColector(),
      descuento: Number($("descuento").value) / 100,
      plazoMeses: Number($("plazo").value),
      clientesEquilibrio: Math.max(1, entero("clientesEq") || 1),
      margenComercial: Math.min(entero("margenCom"), 90) / 100,
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

  // Resalta cada tipo con cantidad > 0; sin colectores pagos, el cliente aporta la VM.
  function sincronizarColector() {
    let alguno = false;
    for (const [id, n] of Object.entries(cantidadesColector())) {
      $(`colCard${id}`).classList.toggle("activo", n > 0);
      alguno = alguno || n > 0;
    }
    const vm = modelo.opcionesColector().find((o) => o.precioMensual === 0);
    if (vm) $(`colCard${vm.id}`).classList.toggle("activo", !alguno);
  }

  function render() {
    sincronizarServicios();
    sincronizarColector();
    sincronizarUeba();
    const sel = seleccion();
    const q = modelo.cotizar(sel);
    ultima = q;
    const p = q.precio;

    $("precioBase").textContent = mon0.format(p.listaBase) + "/mes";
    $("precioSede").textContent = mon0.format(p.precioPorSede);
    const dv = p.descuentoVolumen;
    $("notaVolumen").textContent = `Desde la sede ${dv.desdeSede}: ${mon0.format(dv.precio)}/sede (${Math.round(dv.fraccion * 100)} % de descuento).`;
    $("precioDisp").textContent = mon0.format(p.precioDispositivo);
    $("precioAgente").textContent = mon0.format(p.precioAgente);
    $("precioUeba").textContent = mon0.format(p.precioUeba);
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
        <td>${(LICENCIAS.has(l.id) || l.id.startsWith("fuente-")) ? '<span class="lic" title="Licencia FortiSIEM MSSP"></span>' : ""}${esc(l.concepto)}${l.meses ? `<small>Cargo durante ${l.meses} meses</small>` : ""}</td>
        <td class="r num">${l.cantidad}</td>
        <td class="r num">${mon.format(l.unitario)}</td>
        <td class="r num">${mon.format(l.subtotal)}</td>
      </tr>`).join("");

    $("pie").innerHTML = q.descuentoMensual
      ? `<tr><td colspan="3">Subtotal</td><td class="r num">${mon.format(q.subtotalMensual)}</td></tr>
         <tr class="disc"><td colspan="3">Descuento ${pct.format(q.descuento)} sobre servicios</td><td class="r num">−${mon.format(q.descuentoMensual)}</td></tr>`
      : "";

    const temporal = q.mesesConCargoTemporal && q.mensualInicial !== q.mensualRecurrente;
    $("totales").innerHTML = `
      <div class="total main"><span class="eyebrow">${temporal ? `Mensualidad meses 1–${q.mesesConCargoTemporal}` : "Mensualidad"}</span><b>${mon.format(q.mensualInicial)}</b><small>${MONEDA} · excluido de IVA (servicio en la nube)</small></div>
      ${temporal ? `<div class="total"><span class="eyebrow">Desde el mes ${q.mesesConCargoTemporal + 1}</span><b>${mon.format(q.mensualRecurrente)}</b><small>sin el cargo temporal del NUC</small></div>` : ""}
      <div class="total"><span class="eyebrow">Valor del contrato</span><b>${mon.format(q.valorContrato)}</b><small>${q.plazoMeses} meses</small></div>`;

    $("incluye").innerHTML = textoIncluye(q).map((x) => `<span>${x}</span>`).join("");
    $("incluye").hidden = q.vacia;
    $("termUeba").hidden = !q.soc;
    $("termDisp").hidden = !q.soc;
    $("termSonda").hidden = !q.sedes;

    const cols = q.lineas.filter((l) => l.id.startsWith("col"));
    $("termMoneda").textContent = `${textoMoneda()} Facturación mensual.`;
    $("termColector").hidden = !cols.length;
    $("termColector").textContent = cols.map((c) => {
      const que = `${c.cantidad} × ${c.concepto.replace("Colector: ", "")} a ${mon.format(c.unitario)}`;
      return c.meses ? `${que} al mes durante ${c.meses} meses` : `${que} al mes mientras dure el servicio`;
    }).join("; ") + (cols.length ? ", sumados a la mensualidad." : "");

    renderInterna(q, sel);
    guardarBorrador();
  }

  function textoIncluye(q) {
    const p = q.precio;
    const ret = retencionTexto(p);
    const partes = [];
    if (q.soc) partes.push(`<b>SOC de incidentes:</b> ${p.dispositivosIncluidos} dispositivos/consolas fuente, retención de eventos de ${ret.linea} en línea + ${ret.archivo} archivados, plataforma FortiSIEM MSSP en Azure con IOC de FortiGuard.`);
    if (q.sedes) partes.push(`<b>Vulnerabilidades OT:</b> ${q.sedes} ${q.sedes === 1 ? "sede" : "sedes"} con inventario de activos, priorización por CVE, virtual patching y ciclo de parches ISA/IEC 62443-2-3.`);
    return partes;
  }

  function barras(filas, unidad) {
    const maxAbs = Math.max(1, ...filas.map((f) => Math.abs(f.utilidad)));
    return filas.map((f) => {
      const w = (Math.abs(f.utilidad) / maxAbs) * 50;
      return `<div class="bar" title="Ingreso ${mon0.format(f.ingreso)} · costo ${mon0.format(f.costo)}">
        <span class="num">${f.clientes} ${unidad}${f.excedeCapacidad ? " *" : ""}</span>
        <span class="track"><span class="fill ${f.utilidad >= 0 ? "pos" : "neg"}" style="width:${w}%"></span></span>
        <span class="num r">${mon0.format(f.utilidad)}</span></div>`;
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
      <div class="kpi"><span class="eyebrow">Equilibrio SOC incidentes</span><b>${mon.format(p.equilibrioBase)}</b><small>por cliente con ${p.clientes} clientes</small></div>
      <div class="kpi"><span class="eyebrow">Equilibrio vulnerabilidades</span><b>${mon.format(p.equilibrioPorSede)}</b><small>por sede con ${p.sedesEquilibrio} sedes · equipo ${mon0.format(p.costoVulnerabilidades)}/mes</small></div>
      <div class="kpi"><span class="eyebrow">Piso de esta oferta</span><b>${mon.format(q.pisoEquilibrio)}</b><small>equilibrio + costo de adicionales y colector</small></div>
      <div class="kpi ${ok ? "ok" : "bad"}"><span class="eyebrow">Contribución mensual</span><b>${mon.format(q.contribucion)}</b><span class="pill ${ok ? "ok" : "bad"}">${ok ? "Sobre equilibrio" : "Bajo equilibrio"} · ${pct.format(q.margenSobrePiso)}</span></div>`;

    $("bars").innerHTML = barras(modelo.sensibilidad(planSoc, 8, sel.escenario), "cl.");
    $("barsVuln").innerHTML = barras(modelo.sensibilidadVulnerabilidades(precioSedeNeto, 12, sel.escenario), "sed.");
    const a = modelo.estimarAlmacenamiento(entero("eps"));
    const gb = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
    $("almacenamiento").innerHTML = `
      <dt>Volumen diario crudo</dt><dd class="num">${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(a.gbDia)} GB</dd>
      <dt>En línea (${p.retencion.enLineaDias} días)</dt><dd class="num">${gb.format(a.gbEnLinea)} GB</dd>
      <dt>Archivado (${p.retencion.archivadoMeses} meses)</dt><dd class="num">${gb.format(a.gbArchivado)} GB</dd>
      <dt>Costo estimado Azure</dt><dd class="num">${mon.format(a.costo)}/mes</dd>
      <dt>En el equilibrio (${gb.format(p.costos.epsReferencia)} EPS por cliente)</dt><dd class="num">${mon.format(p.costos.almacenamientoCliente)}/mes</dd>
      <dt>Diferencia de este cliente</dt><dd class="num">${a.costo >= p.costos.almacenamientoCliente ? "+" : "−"}${mon.format(Math.abs(a.costo - p.costos.almacenamientoCliente))}/mes</dd>`;

    renderPersonal(p, sel);
    renderPlataforma(p, q);

    renderEps();

    $("notaInterna").textContent =
      `SOC de incidentes a ${mon0.format(planSoc)}/mes por cliente, sin adicionales ni colector; su costo excluye el equipo de vulnerabilidades. ` +
      `Vulnerabilidades a ${mon0.format(precioSedeNeto)} por sede: cubre su equipo desde ${Math.ceil(p.costoVulnerabilidades / precioSedeNeto - 1e-9)} sedes. ` +
      `* Supera la capacidad del equipo actual (${modelo.supuestos.capacidad_max_clientes_sin_contratar} clientes / ${modelo.supuestos.gestion_vulnerabilidades.capacidad_max_sedes} sedes). ` +
      `Supuestos editables en data/supuestos_soc.json.`;
  }

  // Desglose del personal: salario base cargado al SOC y prestaciones aparte, en la moneda de presentación.
  function renderPersonal(p, sel) {
    const d = modelo.detallePersonal(sel.escenario);
    const dec = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
    const pctD = (x) => `${Math.round(x * 100)} %`;
    const pctP = pctD(d.factor - 1);
    const contingencia = Number(modelo.supuestos.contingencia_fraccion);
    $("formulaPersonal").textContent =
      `Costo de cada rol = salario base × cantidad × dedicación + prestaciones (${pctP} del salario: factor prestacional ${dec.format(d.factor)})`;
    $("hPrestaciones").textContent = `Prestaciones (${pctP})`;
    $("tablaPersonal").innerHTML = d.roles.map((r) => `<tr>
        <td>${esc(r.rol)}</td><td><span class="modulo ${r.modulo}">${r.modulo}</span></td>
        <td class="r num">${r.cantidad}</td><td class="r num">${cop.format(r.salarioCop)}</td>
        <td class="r num">${pctD(r.dedicacion)}</td><td class="r num">${dec.format(r.fte)}</td>
        <td class="r num">${cop.format(r.baseCop)}</td><td class="r num">${cop.format(r.prestacionesCop)}</td>
        <td class="r num">${cop.format(r.costoCop)}</td></tr>`).join("") + `
      <tr><td>Bono de disponibilidad fuera de horario</td><td><span class="modulo">compartido</span></td><td></td><td></td><td></td><td></td>
        <td class="r num">${cop.format(d.disponibilidadCop)}</td><td class="r num">—</td><td class="r num">${cop.format(d.disponibilidadCop)}</td></tr>`;
    $("pieTablaPersonal").innerHTML = `<tr><td colspan="5">Total personal al mes</td><td class="r num">${dec.format(d.fte)}</td>
        <td class="r num">${cop.format(d.baseCop + d.disponibilidadCop)}</td><td class="r num">${cop.format(d.prestacionesCop)}</td>
        <td class="r num">${cop.format(d.totalCop)}</td></tr>
      <tr><td colspan="8">Con contingencia de ${pctD(contingencia)}</td><td class="r num">${cop.format(d.totalCop * (1 + contingencia))}</td></tr>`;
    const socPersonal = d.porModulo.incidentes + d.porModulo.compartido + d.disponibilidadUsd;
    $("repartoPersonal").innerHTML = `
      <div><b>${mon0.format(socPersonal)}</b>Incidentes + compartido + disponibilidad: lo paga el plan SOC, repartido entre ${p.clientes} clientes (${mon0.format(socPersonal * (1 + contingencia) / p.clientes)} por cliente con contingencia)</div>
      <div><b>${mon0.format(d.porModulo.vulnerabilidades)}</b>Equipo de vulnerabilidades: lo paga el servicio por sede (${mon0.format(p.costoVulnerabilidades)} con contingencia ÷ ${p.sedesEquilibrio} sedes = ${mon0.format(p.equilibrioPorSede)} por sede)</div>
      <div><b>${dec.format(d.fte)} FTE</b>Personas equivalentes a tiempo completo: la dedicación parcial (p. ej. líder técnico SIEM al 30 %) cuenta como fracción</div>`;
    $("nEscenarios").textContent = p.clientes;
    $("tablaEscenarios").innerHTML = modelo.compararEscenarios(p.clientes).map((e) => `<tr class="${e.nombre === d.nombre ? "actual" : ""}">
        <td>${esc(e.nombre)}</td><td class="r num">${dec.format(e.fte)}</td><td class="r num">${mon0.format(e.personalUsd)}</td>
        <td class="r num">${mon0.format(e.costoTotal)}</td><td class="r num">${mon0.format(e.equilibrioBase)}</td>
        <td class="r num">${mon0.format(e.listaBase)}</td><td class="r num">${mon0.format(e.equilibrioPorSede)}</td></tr>`).join("");
    $("clavesPersonal").innerHTML = [
      `<b>${esc(d.nombre)}:</b> ${esc(d.descripcion)}`,
      `Las <b>prestaciones (${pctP})</b> suman al salario las prestaciones sociales, seguridad social y parafiscales en Colombia. El bono de disponibilidad se paga sin prestaciones.`,
      `La <b>dedicación</b> es la fracción del tiempo de la persona que se carga al SOC; el resto se asume en otros proyectos de Netmask.`,
      `El escenario no es 24×7: cubre horario laboral extendido con un bono de disponibilidad para incidentes críticos. Cubrir un solo puesto 24×7 exige unas 5 personas (turnos, descansos y vacaciones).`,
      `Licencias Fortinet, Azure y la cuota anual se facturan en USD y se convierten a COP con la TRM de referencia (${new Intl.NumberFormat("es-CO").format(TRM)}): una subida del dólar sube el costo.`,
      `Salarios, prestaciones, TRM y dedicaciones son <b>supuestos</b> editables en <code>data/supuestos_soc.json</code>; reemplázalos por la nómina real.`,
    ].map((x) => `<li>${x}</li>`).join("");
  }

  function cantidadesEps() {
    return Object.fromEntries(modelo.supuestos.estimador_almacenamiento.calculadora_eps.tipos.map((x) => [x.id, entero(`epsN_${x.id}`)]));
  }

  // Calculadora de EPS: inventario del cliente → EPS promedio/pico y su costo de almacenamiento.
  function renderEps() {
    const r = modelo.estimarEps(cantidadesEps());
    const n = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
    const alm = modelo.estimarAlmacenamiento(r.promedio);
    r.filas.forEach((f) => { $(`epsTot_${f.id}`).textContent = n.format(f.eps); });
    $("epsResultado").innerHTML = `
      <dt>Fuentes contadas</dt><dd class="num">${n.format(r.fuentes)}</dd>
      <dt>EPS promedio estimado</dt><dd class="num"><b>${n.format(r.promedio)}</b></dd>
      <dt>EPS pico (×${r.factorPico}, para dimensionar el colector)</dt><dd class="num">${n.format(r.pico)}</dd>
      <dt>Almacenamiento con la retención base</dt><dd class="num">${mon.format(alm.costo)}/mes</dd>
      <dt>Frente al costo usado en el equilibrio</dt><dd class="num">${pct.format(alm.costo / modelo.costos(1).almacenamientoCliente)}</dd>`;
  }

  // Lleva a la calculadora las fuentes adicionales y agentes de la oferta (las incluidas se suman a mano).
  function epsDesdeOferta() {
    const ft = cantidadesFuentes();
    const valores = { fw_entry: ft.fw_entry, fw_mid: ft.fw_mid, fw_high: ft.fw_high, srv_win: ft.servidor, srv_lin: 0,
                      sw_core: ft.sw_core, sw_acceso: ft.sw_acceso, consola: entero("otras"), agente: entero("agentes"), ot: 0 };
    for (const [id, v] of Object.entries(valores)) if ($(`epsN_${id}`)) $(`epsN_${id}`).value = v || 0;
    render();
  }

  /* Cálculo interno de la plataforma: cuota anual del SIEM, licencias de consumo con mínimos,
   * demás costos, cómo se llega al equilibrio por cliente y la economía de los colectores. */
  function renderPlataforma(p, q) {
    const c = p.costos;
    const s = modelo.supuestos;
    const n = p.clientes;
    const ent = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
    const usdF = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", currencyDisplay: "code", minimumFractionDigits: 2 });
    const nombres = { dispositivos: "Dispositivos/consolas fuente", agentes_avanzados: "Agentes avanzados", ueba: "UEBA", ha_dr: "HA/DR" };
    const contingencia = Number(s.contingencia_fraccion);
    const cuotaMes = c.cuotaProgramaAnual / 12; // sin redondear a centavos, para que el COP sea exacto
    $("feeSiem").innerHTML = `
      <div><b>${usdF.format(c.cuotaProgramaAnual)}</b>Cuota anual del programa FortiSIEM MSSP (SKU ${esc(c.cuotaProgramaSku)}), se paga por adelantado cada 12 meses = ${mon0.format(c.cuotaProgramaAnual)} al año</div>
      <div><b>${mon0.format(cuotaMes)}</b>Prorrateo mensual (${usdF.format(c.cuotaProgramaAnual)} ÷ 12 = ${usdF.format(c.cuotaProgramaMensual)}) que entra al costo del SOC</div>
      <div><b>${mon0.format(cuotaMes / n)}</b>Parte de la cuota por cliente con ${n} clientes</div>`;
    $("tablaLicencias").innerHTML = c.licencias.componentes.filter((l) => l.facturable || l.solicitada).map((l) => `<tr>
        <td>${nombres[l.categoria] || l.categoria}<small>${esc(l.sku || "")}</small></td>
        <td class="r num">${ent.format(l.solicitada)}</td>
        <td class="r num">${ent.format(l.facturable)}${l.facturable > l.solicitada ? `<small>mínimo ${l.minimo}</small>` : ""}</td>
        <td class="r num">${usdF.format(l.unitario)}</td>
        <td class="r num">${usdF.format(l.subtotal)}</td><td class="r num">${mon0.format(l.subtotal)}</td></tr>`).join("");
    $("pieLicencias").innerHTML = `<tr><td colspan="4">Licencias de consumo al mes (${n} clientes × plan base)</td>
        <td class="r num">${usdF.format(c.licencias.total)}</td><td class="r num">${mon0.format(c.licencias.total)}</td></tr>`;
    const filas = [
      ["Personal (incluye disponibilidad)", Object.values(c.personal).reduce((a, x) => a + x, 0) + c.disponibilidad],
      ...s.costos_fijos_mensuales.map((i) => [i.concepto, Number(i.importe)]),
      ["Cuota anual FortiSIEM MSSP ÷ 12", cuotaMes],
      ["Licencias FortiSIEM de consumo", c.licencias.total],
      ...s.costos_variables_por_cliente_mensuales.map((i) => [`${i.concepto} × ${n}`, Number(i.importe) * n]),
      [`Azure almacenamiento de logs en las VM FortiSIEM (${c.epsReferencia} EPS por cliente, retención base) × ${n}`, c.almacenamientoCliente * n],
      [`Contingencia (${Math.round(contingencia * 100)} %)`, c.contingencia],
    ];
    $("tablaCostos").innerHTML = filas.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${mon0.format(v)}</td></tr>`).join("");
    $("pieCostos").innerHTML = `
      <tr><td>Costo total del SOC al mes</td><td class="r num">${mon0.format(c.total)}</td></tr>
      <tr><td>− Equipo de vulnerabilidades con contingencia (lo paga el servicio por sede)</td><td class="r num">−${mon0.format(p.costoVulnerabilidades)}</td></tr>
      <tr><td>÷ ${n} clientes = equilibrio del SOC de incidentes por cliente</td><td class="r num">${mon0.format(p.equilibrioBase)}</td></tr>
      <tr><td>Con margen comercial de ${Math.round(p.margenComercial * 100)} % sobre el precio de venta: equilibrio ÷ (1 − ${Math.round(p.margenComercial * 100)} %)</td><td class="r num">${mon0.format(p.equilibrioBase / (1 - p.margenComercial))}</td></tr>
      <tr><td>Precio lista (redondeado hacia arriba a múltiplos de ${mon0.format(Number(s.redondeo_precio_lista))}) · margen real ${pct.format(1 - p.equilibrioBase / p.listaBase)}</td><td class="r num">${mon0.format(p.listaBase)}</td></tr>`;
    $("tablaFuentes").innerHTML = modelo.fuentesPorTipo().map((f) => `<tr>
        <td>${esc(f.nombre)}</td><td class="r num">${cop.format(f.competenciaCop)}</td><td class="r num">${cop.format(f.precioCop)}</td>
        <td class="r num">${pct.format(1 - f.precioCop / f.competenciaCop)}</td><td class="r num">${cop.format(f.costoCop)}</td>
        <td class="r num">${pct.format(f.margen)}</td></tr>`).join("") + `<tr>
        <td>Otra consola fuente (EDR, gestión, OT)</td><td class="r num">—</td><td class="r num">${mon0.format(p.precioDispositivo)}</td>
        <td class="r num">—</td><td class="r num">${mon0.format(p.costoDispositivo)}</td><td class="r num">${pct.format(1 - p.costoDispositivo / p.precioDispositivo)}</td></tr>`;
    $("economiaColectores").innerHTML = modelo.opcionesColector().filter((o) => o.precioMensual > 0).map((o) => {
      const linea = q.lineas.find((l) => l.concepto === `Colector: ${o.opcion}`);
      const cant = linea ? linea.cantidad : 0;
      if (o.mesesCobro) {
        const cobrado = o.precioMensual * o.mesesCobro;
        return `<div><b>${esc(o.opcion)}</b>Equipo de ${mon0.format(o.costoTotal)} · se cobran ${mon0.format(o.precioMensual)} × ${o.mesesCobro} meses = ${mon0.format(cobrado)} · margen ${mon0.format(cobrado - o.costoTotal)} por equipo${cant ? ` · en esta oferta: ${cant} = margen ${mon0.format((cobrado - o.costoTotal) * cant)}` : ""}</div>`;
      }
      return `<div><b>${esc(o.opcion)}</b>VM de colector dedicada, aparte de las 2 VM FortiSIEM y su almacenamiento · costo ${mon0.format(o.costoMensual)} al mes · se cobra ${mon0.format(o.precioMensual)} (traslado sin margen)${cant ? ` · en esta oferta: ${cant}` : ""}</div>`;
    }).join("");
  }

  function textoMoneda() {
    const iva = (modelo.supuestos.facturacion || {}).texto_oferta || "Excluido de IVA por ser servicio de computación en la nube.";
    return MONEDA === "COP"
      ? `Valores en COP. ${iva}`
      : `Valores en USD. ${iva}`;
  }

  function textoOferta() {
    const q = ultima;
    const lineas = q.lineas.map((l) => `- ${l.concepto}: ${l.cantidad} × ${mon.format(l.unitario)} = ${mon.format(l.subtotal)}/mes${l.meses ? ` (durante ${l.meses} meses)` : ""}`);
    return [
      `Propuesta SOC Netmask ${$("hNum").textContent}`,
      `Cliente: ${$("hClient").textContent}${$("hContact").textContent ? ` · ${$("hContact").textContent}` : ""}`,
      `Plazo: ${q.plazoMeses} meses`,
      ...textoIncluye(q).map((x) => x.replace(/<\/?b>/g, "")),
      q.sedes ? "No incluye la licencia de la sonda OT, que aporta el cliente." : null,
      "",
      ...lineas,
      q.descuentoMensual ? `- Descuento ${pct.format(q.descuento)} sobre servicios: −${mon.format(q.descuentoMensual)}/mes` : null,
      "",
      `Mensualidad: ${mon.format(q.mensualInicial)}` + (q.mensualInicial !== q.mensualRecurrente ? ` (desde el mes ${q.mesesConCargoTemporal + 1}: ${mon.format(q.mensualRecurrente)})` : ""),
      `Valor del contrato: ${mon.format(q.valorContrato)}`,
      textoMoneda(),
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
      datos.colectores = cantidadesColector();
      datos.eps = cantidadesEps();
      datos.fuentesTipo = cantidadesFuentes();
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
      for (const [id, n] of Object.entries(datos.eps || {})) {
        if ($(`epsN_${id}`)) $(`epsN_${id}`).value = n;
      }
      for (const [id, n] of Object.entries(datos.fuentesTipo || {})) {
        if ($(`ft_${id}`)) $(`ft_${id}`).value = n;
      }
      for (const [id, n] of Object.entries(datos.colectores || {})) {
        if ($(`colN${id}`)) $(`colN${id}`).value = n;
      }
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
    $("otras").value = 0;
    for (const id of Object.keys(cantidadesFuentes())) $(`ft_${id}`).value = 0;
    $("agentes").value = 0;
    $("ueba").value = 0;
    for (const id of Object.keys(cantidadesColector())) $(`colN${id}`).value = 0;
    $("descuento").value = 0;
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
      MONEDA = supuestos.moneda_presentacion || "USD";
      TRM = Number(supuestos.tasa_cambio_cop_por_usd);
    } catch (e) {
      $("error").textContent = e.message;
      $("error").hidden = false;
      return;
    }

    $("escenario").innerHTML = modelo.escenarios.map((n) =>
      `<option value="${esc(n)}"${n === modelo.supuestos.escenario_personal ? " selected" : ""}>${esc(n)}</option>`).join("");
    $("clientesEq").value = modelo.supuestos.clientes_punto_equilibrio;
    $("margenCom").value = Math.round(Number(modelo.supuestos.margen_comercial || 0) * 100);

    // Calculadora de EPS con un inventario de ejemplo de una planta.
    const ejemploEps = { fw_entry: 3, fw_mid: 1, srv_win: 4, srv_lin: 2, sw_core: 2, sw_acceso: 6, consola: 1, ot: 2 };
    $("epsTipos").innerHTML = modelo.supuestos.estimador_almacenamiento.calculadora_eps.tipos.map((x) => `
      <label class="eps-fila"><span>${esc(x.nombre)} <small>· ${x.eps} EPS c/u</small></span>
        <input id="epsN_${x.id}" type="number" min="0" step="1" value="${ejemploEps[x.id] || 0}" inputmode="numeric" aria-label="Cantidad de ${esc(x.nombre)}">
        <small id="epsTot_${x.id}">0</small></label>`).join("");
    $("epsDesdeOferta").addEventListener("click", epsDesdeOferta);
    $("epsAplicar").addEventListener("click", () => { $("eps").value = modelo.estimarEps(cantidadesEps()).promedio; render(); });

    // Fuentes adicionales por tipo (precio fijo en COP); ejemplo inicial: 1 firewall entry y 1 servidor.
    const ejemploFuentes = { fw_entry: 1, servidor: 1 };
    $("fuentesTipo").innerHTML = modelo.fuentesPorTipo().map((f) => `
      <div class="row tipo">
        <div class="what"><strong>${esc(f.nombre)}</strong><span>${f.detalle ? `${esc(f.detalle)} · ` : ""}<span class="num">${mon0.format(f.precioUsd)}</span>/mes c/u</span></div>
        <div class="stepper"><button type="button" data-step="ft_${f.id}" data-d="-1" aria-label="Quitar ${esc(f.nombre)}">−</button><input id="ft_${f.id}" type="number" min="0" step="1" value="${ejemploFuentes[f.id] || 0}" inputmode="numeric" aria-label="${esc(f.nombre)} adicionales"><button type="button" data-step="ft_${f.id}" data-d="1" aria-label="Agregar ${esc(f.nombre)}">+</button></div>
      </div>`).join("");

    // Ejemplo inicial: un NUC industrial.
    $("colectores").innerHTML = modelo.opcionesColector().map((o) => `
      <div class="opt" id="colCard${o.id}">
        <strong>${esc(o.opcion)}</strong>
        <span class="num">${o.precioMensual ? mon0.format(o.precioMensual) + "/mes c/u" : "Sin costo"}</span>
        <small>${o.mesesCobro ? `Durante ${o.mesesCobro} meses` : o.precioMensual ? "Recurrente" : "Aplica si no se cotizan colectores"}</small>
        ${o.precioMensual ? `<div class="stepper"><button type="button" data-step="colN${o.id}" data-d="-1" aria-label="Quitar ${esc(o.opcion)}">−</button><input id="colN${o.id}" type="number" min="0" step="1" value="${o.mesesCobro ? 1 : 0}" inputmode="numeric" aria-label="Cantidad de ${esc(o.opcion)}"><button type="button" data-step="colN${o.id}" data-d="1" aria-label="Agregar ${esc(o.opcion)}">+</button></div>` : ""}
      </div>`).join("");

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
