/* Motor del cotizador SOC Netmask (navegador y Node).
 *
 * Replica en JavaScript core.py (licencias FortiSIEM MSSP) y precio_soc.py
 * (punto de equilibrio) a partir de los mismos JSON de data/:
 * precios.json, reglas.json y supuestos_soc.json.
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Cotizador = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MODULOS = ["incidentes", "vulnerabilidades", "compartido"];

  // Redondeo monetario a centavos, mitad hacia arriba (como ROUND_HALF_UP en Python).
  function dinero(x) {
    return Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-7) / 100;
  }

  function redondearArriba(x, paso) {
    return dinero(Math.ceil(x / paso - 1e-9) * paso);
  }

  function num(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`Valor numérico inválido: ${v}`);
    return n;
  }

  function crearModelo(precios, reglas, supuestos) {
    if (precios.catalogo_id !== reglas.catalogo_id_requerido) {
      throw new Error("El catálogo de precios y las reglas no coinciden");
    }
    const s = supuestos;
    const porSku = {};
    for (const grupo of Object.values(precios.productos)) {
      for (const p of Array.isArray(grupo) ? grupo : [grupo]) porSku[p.sku] = p;
    }

    function neto(producto) {
      return num(producto.precio_unitario_lista) * (1 - num(producto.descuento_fraccion_excel));
    }

    function licenciaCategoria(categoria, solicitada) {
      const variable = categoria === "ha_dr" ? "ha_dr_dispositivos" : categoria;
      const facturable = Math.max(solicitada, reglas.entradas[variable].cantidad_minima_facturable);
      if (categoria === "ha_dr" && facturable === 0) {
        return { categoria, sku: null, facturable: 0, unitario: 0, subtotal: 0 };
      }
      for (const r of reglas.seleccion_tarifas[categoria].rangos_ordenados_primera_coincidencia) {
        if (facturable >= r.desde_inclusive && (r.hasta_inclusive === null || facturable <= r.hasta_inclusive)) {
          const unitario = neto(porSku[r.sku]);
          return { categoria, sku: r.sku, facturable, unitario, subtotal: dinero(facturable * unitario) };
        }
      }
      throw new Error(`${categoria}: no hay tarifa para ${facturable} unidades`);
    }

    function licencias({ dispositivos = 0, agentes = 0, ueba = 0, haDr = 0 } = {}) {
      const componentes = [
        licenciaCategoria("dispositivos", dispositivos),
        licenciaCategoria("agentes_avanzados", agentes),
        licenciaCategoria("ueba", ueba),
        licenciaCategoria("ha_dr", haDr),
      ];
      return { componentes, total: dinero(componentes.reduce((a, c) => a + c.subtotal, 0)) };
    }

    const trm = num(s.tasa_cambio_cop_por_usd);
    const contingencia = num(s.contingencia_fraccion);
    const cuotaPrograma = neto(porSku[reglas.facturacion.cuota_programa.sku]);

    function escenario(nombre) {
      const e = s.escenarios_personal[nombre || s.escenario_personal];
      if (!e) throw new Error(`Escenario de personal desconocido: ${nombre}`);
      return e;
    }

    function personalPorModulo(nombre) {
      const factor = num(s.factor_prestacional);
      const totales = Object.fromEntries(MODULOS.map((m) => [m, 0]));
      for (const rol of escenario(nombre).roles) {
        totales[rol.modulo] += (num(rol.salario_mensual_cop) * rol.cantidad * num(rol.dedicacion) * factor) / trm;
      }
      return totales;
    }

    function costos(clientes, nombreEscenario) {
      const base = s.plan_base;
      const lic = licencias({
        dispositivos: clientes * base.dispositivos_incluidos,
        agentes: clientes * base.agentes_avanzados_incluidos,
      });
      const personal = personalPorModulo(nombreEscenario);
      const disponibilidad = num(s.disponibilidad_fuera_de_horario_cop) / trm;
      const fijos = s.costos_fijos_mensuales.reduce((a, i) => a + num(i.importe), 0);
      const variables = clientes * s.costos_variables_por_cliente_mensuales.reduce((a, i) => a + num(i.importe), 0);
      const subtotal = MODULOS.reduce((a, m) => a + personal[m], 0) + disponibilidad + fijos + cuotaPrograma / 12 + lic.total + variables;
      return {
        clientes,
        dispositivos: clientes * base.dispositivos_incluidos,
        personal: Object.fromEntries(MODULOS.map((m) => [m, dinero(personal[m])])),
        disponibilidad: dinero(disponibilidad),
        fijos: dinero(fijos),
        cuotaProgramaMensual: dinero(cuotaPrograma / 12),
        licencias: lic,
        variables: dinero(variables),
        contingencia: dinero(subtotal * contingencia),
        total: dinero(subtotal * (1 + contingencia)),
      };
    }

    function costoUnitarioPrimerNivel(categoria) {
      return licenciaCategoria(categoria, 1).unitario;
    }

    function precioAdicional(categoria, margen) {
      return redondearArriba(costoUnitarioPrimerNivel(categoria) / (1 - num(s.adicionales[margen])), 1);
    }

    function opcionesColector() {
      const cfg = s.opciones_colector;
      return cfg.opciones.map((op, i) => {
        if (op.costo_total !== undefined) {
          const total = num(op.costo_total);
          return { id: i, opcion: op.opcion, precioMensual: redondearArriba(total / op.divisor_mensual, 0.01),
                   mesesCobro: op.meses_cobro, costoTotal: total, costoMensual: total / op.meses_cobro };
        }
        const costo = num(op.costo_mensual);
        return { id: i, opcion: op.opcion, precioMensual: redondearArriba(costo / (1 - num(cfg.margen)), 0.01),
                 mesesCobro: null, costoTotal: null, costoMensual: costo };
      });
    }

    function precio(clientes, nombreEscenario) {
      const n = clientes || s.clientes_punto_equilibrio;
      if (!(n >= 1)) throw new Error("Se requiere al menos 1 cliente para el punto de equilibrio");
      const c = costos(n, nombreEscenario);
      const v = s.gestion_vulnerabilidades;
      const costoVuln = costoVulnerabilidades(nombreEscenario);
      const base = dinero((c.total - costoVuln) / n);
      const sedesEq = n * v.sedes_promedio_por_cliente;
      const precioSede = num(v.precio_por_sede_usd);
      const paso = num(s.redondeo_precio_lista);
      return {
        clientes: n,
        costos: c,
        equilibrioBase: base,
        listaBase: redondearArriba(base, paso),
        costoVulnerabilidades: costoVuln,
        sedesEquilibrio: sedesEq,
        equilibrioPorSede: dinero(costoVuln / sedesEq),
        precioPorSede: precioSede,
        sedesMinimas: Math.ceil(costoVuln / precioSede - 1e-9),
        descuentoVolumen: {
          desdeSede: v.descuento_volumen.desde_sede,
          fraccion: num(v.descuento_volumen.descuento_fraccion),
          precio: dinero(precioSede * (1 - num(v.descuento_volumen.descuento_fraccion))),
        },
        dispositivosIncluidos: s.plan_base.dispositivos_incluidos,
        agentesIncluidos: s.plan_base.agentes_avanzados_incluidos,
        precioDispositivo: precioAdicional("dispositivos", "margen_dispositivo_adicional"),
        uebaIncluidos: s.plan_base.ueba_incluidos || 0,
        precioAgente: precioAdicional("agentes_avanzados", "margen_agente_adicional"),
        precioUeba: precioAdicional("ueba", "margen_ueba_adicional"),
        costoDispositivo: costoUnitarioPrimerNivel("dispositivos"),
        costoAgente: costoUnitarioPrimerNivel("agentes_avanzados"),
        costoUeba: costoUnitarioPrimerNivel("ueba"),
        retencion: { enLineaDias: s.retencion_base.en_linea_dias, archivadoMeses: s.retencion_base.archivado_meses },
      };
    }

    /* Piso de costo de un contrato de `sedes`: su parte del equipo (equilibrio por sede, nunca más
     * que el equipo completo) y, por encima de la capacidad, el personal adicional que exigiría. */
    function pisoVulnerabilidades(sedes, p) {
      const cap = s.gestion_vulnerabilidades.capacidad_max_sedes;
      const dentro = Math.min(Math.min(sedes, cap) * p.equilibrioPorSede, p.costoVulnerabilidades);
      return dentro + Math.max(0, sedes - cap) * (p.costoVulnerabilidades / cap);
    }

    // Equipo de vulnerabilidades al mes (con contingencia): lo cubre el servicio por sede.
    function costoVulnerabilidades(nombreEscenario) {
      return dinero(personalPorModulo(nombreEscenario).vulnerabilidades * (1 + contingencia));
    }

    /* Oferta para un cliente. Los dos servicios se venden juntos o por separado.
     * seleccion: { soc: bool (SOC de incidentes; por defecto true), dispositivos, agentes,
     *              ueba (≤ agentes), colector: id, vulnerabilidades: bool, sedes,
     *              descuento: fracción sobre servicios, plazoMeses, clientesEquilibrio, escenario }
     * Sin SOC de incidentes no hay licencias FortiSIEM ni colector.
     */
    function cotizar(seleccion) {
      const p = precio(seleccion.clientesEquilibrio, seleccion.escenario);
      const soc = seleccion.soc !== false;
      const sedes = seleccion.vulnerabilidades ? Math.max(0, Math.floor(seleccion.sedes || 0)) : 0;
      const extraDisp = Math.max(0, (seleccion.dispositivos || 0) - p.dispositivosIncluidos);
      const extraAg = Math.max(0, (seleccion.agentes || 0) - p.agentesIncluidos);
      // UEBA se licencia por agente avanzado: nunca más que los agentes del cliente.
      const ueba = Math.min(Math.max(0, seleccion.ueba || 0), Math.max(seleccion.agentes || 0, 0));
      const extraUeba = Math.max(0, ueba - p.uebaIncluidos);
      const descuento = Math.min(Math.max(seleccion.descuento || 0, 0), 1);
      const plazo = seleccion.plazoMeses || 12;

      const lineas = [];
      if (soc) {
        lineas.push({ id: "base", concepto: `SOC de incidentes: plataforma FortiSIEM y ${p.dispositivosIncluidos} dispositivos/consolas fuente`,
                      cantidad: 1, unitario: p.listaBase, costo: p.equilibrioBase, descontable: true, meses: null });
      }
      if (sedes) {
        // Precio lista hasta la sede anterior a `desdeSede`; desde ahí, descuento por volumen.
        const dv = p.descuentoVolumen;
        const lista = Math.min(sedes, dv.desdeSede - 1);
        const extra = sedes - lista;
        lineas.push({ id: "vuln", concepto: extra ? `Gestión de vulnerabilidades OT, sedes 1 a ${lista}` : "Gestión de vulnerabilidades OT por sede",
                      cantidad: lista, unitario: p.precioPorSede, costo: pisoVulnerabilidades(lista, p) / lista, descontable: true, meses: null });
        if (extra) {
          lineas.push({ id: "vuln2", concepto: `Gestión de vulnerabilidades OT desde la sede ${dv.desdeSede} (${Math.round(dv.fraccion * 100)} % de descuento)`,
                        cantidad: extra, unitario: dv.precio, costo: (pisoVulnerabilidades(sedes, p) - pisoVulnerabilidades(lista, p)) / extra,
                        descontable: true, meses: null });
        }
      }
      if (soc && extraDisp) {
        lineas.push({ id: "disp", concepto: "Dispositivos/consolas fuente adicionales", cantidad: extraDisp,
                      unitario: p.precioDispositivo, costo: p.costoDispositivo, descontable: true, meses: null });
      }
      if (soc && extraAg) {
        lineas.push({ id: "agt", concepto: "Agentes avanzados FortiSIEM", cantidad: extraAg,
                      unitario: p.precioAgente, costo: p.costoAgente, descontable: true, meses: null });
      }
      if (soc && extraUeba) {
        lineas.push({ id: "ueba", concepto: "UEBA por agente avanzado", cantidad: extraUeba,
                      unitario: p.precioUeba, costo: p.costoUeba, descontable: true, meses: null });
      }
      const col = opcionesColector().find((o) => o.id === seleccion.colector);
      if (soc && col && col.precioMensual > 0) {
        lineas.push({ id: "col", concepto: `Colector: ${col.opcion}`, cantidad: 1, unitario: col.precioMensual,
                      costo: col.costoMensual, descontable: false, meses: col.mesesCobro });
      }

      for (const l of lineas) {
        l.subtotal = dinero(l.cantidad * l.unitario);
        l.descuento = l.descontable ? dinero(l.subtotal * descuento) : 0;
        l.neto = dinero(l.subtotal - l.descuento);
        l.costoTotal = dinero(l.cantidad * l.costo);
        l.mesesEnPlazo = l.meses === null ? plazo : Math.min(l.meses, plazo);
      }
      const suma = (f, filtro = () => true) => dinero(lineas.filter(filtro).reduce((a, l) => a + f(l), 0));
      const mensualInicial = suma((l) => l.neto);
      const mensualRecurrente = suma((l) => l.neto, (l) => l.meses === null);
      const piso = suma((l) => l.costoTotal);
      const valorContrato = suma((l) => l.neto * l.mesesEnPlazo);
      const mesesConCargoTemporal = Math.max(0, ...lineas.filter((l) => l.meses !== null).map((l) => l.mesesEnPlazo));
      return {
        precio: p,
        soc,
        sedes,
        vacia: lineas.length === 0,
        uebaAplicado: soc ? ueba : 0,
        lineas,
        descuento,
        plazoMeses: plazo,
        subtotalMensual: suma((l) => l.subtotal),
        descuentoMensual: suma((l) => l.descuento),
        mensualInicial,
        mensualRecurrente,
        mesesConCargoTemporal,
        valorContrato,
        pisoEquilibrio: piso,
        contribucion: dinero(mensualInicial - piso),
        margenSobrePiso: mensualInicial ? (mensualInicial - piso) / mensualInicial : 0,
      };
    }

    // SOC de incidentes por número de clientes; el equipo de vulnerabilidades queda fuera.
    function sensibilidad(precioMensual, hasta, nombreEscenario) {
      const capacidad = s.capacidad_max_clientes_sin_contratar;
      const costoVuln = costoVulnerabilidades(nombreEscenario);
      const filas = [];
      for (let n = 1; n <= hasta; n++) {
        const costo = dinero(costos(n, nombreEscenario).total - costoVuln);
        const ingreso = dinero(precioMensual * n);
        filas.push({ clientes: n, ingreso, costo, utilidad: dinero(ingreso - costo), excedeCapacidad: n > capacidad });
      }
      return filas;
    }

    // Servicio de vulnerabilidades por número de sedes vendidas.
    function sensibilidadVulnerabilidades(precioSede, hasta, nombreEscenario) {
      const costo = costoVulnerabilidades(nombreEscenario);
      const capacidad = s.gestion_vulnerabilidades.capacidad_max_sedes;
      const filas = [];
      for (let n = 1; n <= hasta; n++) {
        const ingreso = dinero(precioSede * n);
        filas.push({ clientes: n, ingreso, costo, utilidad: dinero(ingreso - costo), excedeCapacidad: n > capacidad });
      }
      return filas;
    }

    // Almacenamiento de un cliente con la retención base, en régimen estable (desde el mes 12).
    function estimarAlmacenamiento(eps) {
      const e = s.estimador_almacenamiento;
      const r = s.retencion_base;
      const gbDia = (Math.max(0, eps) * e.bytes_por_evento * 86400) / 1e9;
      const comprimido = gbDia * num(e.fraccion_tras_compresion);
      const enLinea = comprimido * r.en_linea_dias;
      const archivado = comprimido * r.archivado_meses * 30;
      const costo = enLinea * num(e.costo_gb_mes_en_linea_usd) + archivado * num(e.costo_gb_mes_archivado_usd);
      const presupuesto = s.costos_variables_por_cliente_mensuales.reduce((a, i) => a + num(i.importe), 0);
      return {
        gbDia, gbEnLinea: enLinea, gbArchivado: archivado, costo: dinero(costo), presupuesto,
        epsCubiertos: costo ? Math.round((presupuesto / costo) * eps) : 0,
      };
    }

    return {
      supuestos: s,
      estimarAlmacenamiento,
      escenarios: Object.keys(s.escenarios_personal),
      licencias,
      costos,
      precio,
      opcionesColector,
      cotizar,
      sensibilidadVulnerabilidades,
      sensibilidad,
    };
  }

  return { crearModelo, dinero, redondearArriba };
});
