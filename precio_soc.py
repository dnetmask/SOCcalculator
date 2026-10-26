"""Precio del servicio SOC Netmask con punto de equilibrio en N clientes.

Usa el motor de licenciamiento FortiSIEM MSSP (core.py) para el costo de
licencias agregado de todos los clientes y data/supuestos_soc.json para
personal, Azure, colectores y contingencia.

Modelo:
    costo_mes(n) = (personal + fijos + cuota_programa/12 + licencias(n)
                    + n * variable_por_cliente) * (1 + contingencia)
    precio_equilibrio = costo_mes(N) / N

Se venden dos servicios, juntos o por separado:
  - SOC de incidentes (plan base): personal de incidentes y compartido,
    plataforma, licencias FortiSIEM y almacenamiento; equilibrio en N clientes.
  - Gestión de vulnerabilidades OT: precio por sede sin licencias; lo cubre el
    personal del módulo vulnerabilidades; equilibrio en N × sedes promedio.

Uso:
    python precio_soc.py                     # reporte Markdown con los supuestos por defecto
    python precio_soc.py --clientes 4 --escenario esbelto
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Mapping

from core import ErrorModelo, MotorLicenciamiento, ResultadoMensual, _decimal, _entero_no_negativo

MODULOS = ("incidentes", "vulnerabilidades", "compartido")
CENTAVO = Decimal("0.01")


def _dinero(valor: Decimal) -> Decimal:
    return valor.quantize(CENTAVO, rounding=ROUND_HALF_UP)


def _redondear_arriba(valor: Decimal, paso: Decimal) -> Decimal:
    return _dinero((valor / paso).to_integral_value(rounding=ROUND_CEILING) * paso)


@dataclass(frozen=True)
class CostosMensuales:
    clientes: int
    dispositivos: int
    agentes_avanzados: int
    personal_por_modulo: Mapping[str, Decimal]
    disponibilidad: Decimal
    fijos: Decimal
    cuota_programa_mensual: Decimal
    licencias: ResultadoMensual
    variables: Decimal
    contingencia: Decimal
    total: Decimal

    @property
    def personal(self) -> Decimal:
        return sum(self.personal_por_modulo.values(), Decimal(0)) + self.disponibilidad


@dataclass(frozen=True)
class PrecioSOC:
    clientes_equilibrio: int
    escenario: str
    costos: CostosMensuales
    equilibrio_base: Decimal
    lista_base: Decimal
    dispositivos_incluidos: int
    precio_dispositivo_adicional: Decimal
    precio_agente_adicional: Decimal
    precio_ueba_adicional: Decimal
    costo_vulnerabilidades: Decimal  # equipo de vulnerabilidades al mes, con contingencia
    sedes_equilibrio: int
    equilibrio_por_sede: Decimal
    precio_por_sede: Decimal
    esencial_equilibrio: Decimal | None = None  # SOC Esencial: cliente pequeño que ocupa 1/3 del cupo
    esencial_lista: Decimal | None = None

    @property
    def sedes_minimas_con_precio_lista(self) -> int:
        """Sedes que cubren el equipo de vulnerabilidades al precio por sede vigente."""
        return int((self.costo_vulnerabilidades / self.precio_por_sede).to_integral_value(rounding=ROUND_CEILING))


@dataclass(frozen=True)
class FilaSensibilidad:
    clientes: int  # clientes del SOC o sedes de vulnerabilidades, según la tabla
    ingreso: Decimal
    costo: Decimal
    utilidad: Decimal
    margen: Decimal
    excede_capacidad: bool


@dataclass(frozen=True)
class OpcionColector:
    opcion: str
    precio_mensual: Decimal
    meses_cobro: int | None  # None = cargo recurrente mientras dure el servicio
    costo_total: Decimal | None = None

    @property
    def total_cobrado(self) -> Decimal | None:
        return None if self.meses_cobro is None else self.precio_mensual * self.meses_cobro


class ModeloPrecioSOC:
    def __init__(self, motor: MotorLicenciamiento, supuestos: Mapping[str, Any]):
        self.motor = motor
        self.s = supuestos
        self._validar()

    @classmethod
    def desde_archivos(cls, supuestos: str | Path | None = None, **rutas_motor) -> "ModeloPrecioSOC":
        ruta = Path(supuestos) if supuestos else Path(__file__).resolve().parent / "data" / "supuestos_soc.json"
        try:
            datos = json.loads(ruta.read_text(encoding="utf-8"), parse_float=Decimal)
        except (OSError, json.JSONDecodeError) as exc:
            raise ErrorModelo(f"No se pudo cargar {ruta}: {exc}") from exc
        return cls(MotorLicenciamiento.desde_archivos(**rutas_motor), datos)

    def _validar(self) -> None:
        s = self.s
        try:
            if s["schema_version"] != "1.0.0":
                raise ErrorModelo("supuestos_soc.json: versión de esquema no soportada")
            if s["moneda"] != self.motor.moneda:
                raise ErrorModelo("La moneda de los supuestos no coincide con el catálogo de licencias")
            if _entero_no_negativo(s["clientes_punto_equilibrio"], "clientes_punto_equilibrio") < 1:
                raise ErrorModelo("clientes_punto_equilibrio debe ser al menos 1")
            if _decimal(s["tasa_cambio_cop_por_usd"], "tasa_cambio") <= 0:
                raise ErrorModelo("La tasa de cambio debe ser positiva")
            _entero_no_negativo(s["plan_base"]["dispositivos_incluidos"], "dispositivos_incluidos")
            _entero_no_negativo(s["plan_base"]["agentes_avanzados_incluidos"], "agentes_avanzados_incluidos")
            if "plan_esencial" in s:
                e = s["plan_esencial"]
                if _entero_no_negativo(e["clientes_por_cupo"], "clientes_por_cupo") < 1 or \
                        _entero_no_negativo(e["dispositivos_incluidos"], "plan_esencial.dispositivos_incluidos") < 1:
                    raise ErrorModelo("plan_esencial: clientes_por_cupo y dispositivos_incluidos deben ser al menos 1")
            for clave in ("costos_fijos_mensuales", "costos_variables_por_cliente_mensuales"):
                for item in s[clave]:
                    if _decimal(item["importe"], f"{clave}.{item['concepto']}") < 0:
                        raise ErrorModelo(f"{clave}: importe negativo en {item['concepto']!r}")
            for clave in ("factor_prestacional", "disponibilidad_fuera_de_horario_cop", "contingencia_fraccion"):
                if _decimal(s[clave], clave) < 0:
                    raise ErrorModelo(f"{clave} no puede ser negativo")
            if not Decimal(0) <= _decimal(s.get("margen_comercial", "0"), "margen_comercial") < 1:
                raise ErrorModelo("margen_comercial debe estar en [0, 1)")
            if _decimal(s["redondeo_precio_lista"], "redondeo_precio_lista") <= 0:
                raise ErrorModelo("redondeo_precio_lista debe ser positivo")
            for clave in ("margen_dispositivo_adicional", "margen_agente_adicional", "margen_ueba_adicional"):
                if not Decimal(0) <= _decimal(s["adicionales"][clave], clave) < 1:
                    raise ErrorModelo(f"{clave} debe estar en [0, 1)")
            if s["escenario_personal"] not in s["escenarios_personal"]:
                raise ErrorModelo("escenario_personal no existe en escenarios_personal")
            for nombre, escenario in s["escenarios_personal"].items():
                for rol in escenario["roles"]:
                    if rol["modulo"] not in MODULOS:
                        raise ErrorModelo(f"{nombre}: módulo inválido {rol['modulo']!r}")
                    _entero_no_negativo(rol["cantidad"], f"{nombre}.{rol['rol']}.cantidad")
                    if _decimal(rol["salario_mensual_cop"], "salario") < 0:
                        raise ErrorModelo(f"{nombre}: salario negativo en {rol['rol']!r}")
                    if not Decimal(0) <= _decimal(rol["dedicacion"], "dedicacion") <= 1:
                        raise ErrorModelo(f"{nombre}: dedicación fuera de [0, 1] en {rol['rol']!r}")
            if not Decimal(0) <= _decimal(s["opciones_colector"]["margen"], "margen_colector") < 1:
                raise ErrorModelo("opciones_colector.margen debe estar en [0, 1)")
            for op in s["opciones_colector"]["opciones"]:
                if ("costo_total" in op) == ("costo_mensual" in op):
                    raise ErrorModelo(f"Colector {op['opcion']!r}: indicar costo_total o costo_mensual")
                if "costo_total" in op and min(_entero_no_negativo(op["divisor_mensual"], "divisor_mensual"),
                                               _entero_no_negativo(op["meses_cobro"], "meses_cobro")) < 1:
                    raise ErrorModelo(f"Colector {op['opcion']!r}: divisor_mensual y meses_cobro deben ser al menos 1")
                if _decimal(op.get("costo_total", op.get("costo_mensual")), "costo_colector") < 0:
                    raise ErrorModelo(f"Colector {op['opcion']!r}: costo negativo")
            v = s["gestion_vulnerabilidades"]
            if _decimal(v["precio_por_sede_usd"], "precio_por_sede_usd") <= 0:
                raise ErrorModelo("gestion_vulnerabilidades.precio_por_sede_usd debe ser positivo")
            if _entero_no_negativo(v["descuento_volumen"]["desde_sede"], "descuento_volumen.desde_sede") < 2:
                raise ErrorModelo("gestion_vulnerabilidades.descuento_volumen.desde_sede debe ser al menos 2")
            if not Decimal(0) <= _decimal(v["descuento_volumen"]["descuento_fraccion"], "descuento_volumen") < 1:
                raise ErrorModelo("gestion_vulnerabilidades.descuento_volumen.descuento_fraccion debe estar en [0, 1)")
            if _entero_no_negativo(v["sedes_promedio_por_cliente"], "sedes_promedio_por_cliente") < 1:
                raise ErrorModelo("gestion_vulnerabilidades.sedes_promedio_por_cliente debe ser al menos 1")
            _entero_no_negativo(v["capacidad_max_sedes"], "capacidad_max_sedes")
            fuentes = s.get("fuentes_adicionales_por_tipo")
            if fuentes:
                if not Decimal(0) <= _decimal(fuentes["descuento_vs_competencia"], "descuento_vs_competencia") < 1:
                    raise ErrorModelo("fuentes_adicionales_por_tipo.descuento_vs_competencia debe estar en [0, 1)")
                if _entero_no_negativo(fuentes["redondeo_cop"], "redondeo_cop") < 1:
                    raise ErrorModelo("fuentes_adicionales_por_tipo.redondeo_cop debe ser al menos 1")
                for x in fuentes["tipos"]:
                    if _entero_no_negativo(x["competencia_cop"], f"{x['id']}.competencia_cop") <= 0:
                        raise ErrorModelo(f"Fuente {x['id']!r}: precio de competencia inválido")
            _entero_no_negativo(s["retencion_base"]["en_linea_dias"], "retencion_base.en_linea_dias")
            _entero_no_negativo(s["retencion_base"]["archivado_meses"], "retencion_base.archivado_meses")
            _entero_no_negativo(s["capacidad_max_clientes_sin_contratar"], "capacidad_max_clientes_sin_contratar")
        except (KeyError, TypeError, AttributeError) as exc:
            raise ErrorModelo(f"Falta una clave o tiene un tipo incorrecto en supuestos_soc.json: {exc}") from exc

    def _usd(self, cop: Decimal) -> Decimal:
        return cop / _decimal(self.s["tasa_cambio_cop_por_usd"], "tasa_cambio")

    def _escenario(self, escenario: str | None) -> str:
        nombre = escenario or self.s["escenario_personal"]
        if nombre not in self.s["escenarios_personal"]:
            raise ErrorModelo(f"Escenario de personal desconocido: {nombre!r}")
        return nombre

    def personal_por_modulo(self, escenario: str | None = None) -> dict[str, Decimal]:
        factor = _decimal(self.s["factor_prestacional"], "factor_prestacional")
        totales = {modulo: Decimal(0) for modulo in MODULOS}
        for rol in self.s["escenarios_personal"][self._escenario(escenario)]["roles"]:
            cop = _decimal(rol["salario_mensual_cop"], "salario") * rol["cantidad"] * _decimal(rol["dedicacion"], "dedicacion") * factor
            totales[rol["modulo"]] += self._usd(cop)
        return totales

    def costos(
        self,
        clientes: int,
        *,
        dispositivos_por_cliente: int | None = None,
        agentes_por_cliente: int | None = None,
        escenario: str | None = None,
    ) -> CostosMensuales:
        _entero_no_negativo(clientes, "clientes")
        base = self.s["plan_base"]
        dispositivos = clientes * (base["dispositivos_incluidos"] if dispositivos_por_cliente is None else dispositivos_por_cliente)
        agentes = clientes * (base["agentes_avanzados_incluidos"] if agentes_por_cliente is None else agentes_por_cliente)
        personal = self.personal_por_modulo(escenario)
        disponibilidad = self._usd(_decimal(self.s["disponibilidad_fuera_de_horario_cop"], "disponibilidad"))
        fijos = sum((_decimal(i["importe"], "fijo") for i in self.s["costos_fijos_mensuales"]), Decimal(0))
        cuota = self.motor._cuota_anual(1) / 12
        licencias = self.motor.calcular_mes(dispositivos=dispositivos, agentes_avanzados=agentes)
        variables = clientes * (sum((_decimal(i["importe"], "variable") for i in self.s["costos_variables_por_cliente_mensuales"]), Decimal(0))
                                + self.almacenamiento_por_cliente())
        subtotal = sum(personal.values(), Decimal(0)) + disponibilidad + fijos + cuota + licencias.consumo_total + variables
        contingencia = subtotal * _decimal(self.s["contingencia_fraccion"], "contingencia")
        return CostosMensuales(
            clientes, dispositivos, agentes,
            {k: _dinero(v) for k, v in personal.items()}, _dinero(disponibilidad), _dinero(fijos), _dinero(cuota),
            licencias, _dinero(variables), _dinero(contingencia), _dinero(subtotal + contingencia),
        )

    def _precio_adicional(self, categoria: str, margen: str) -> Decimal:
        # Primer nivel = tarifa unitaria más alta: el adicional queda cubierto aunque no se suba de nivel.
        mes = self.motor.calcular_mes(**{categoria: 1})
        unitario = next(c.precio_unitario_neto for c in mes.componentes if c.categoria == categoria)
        return _redondear_arriba(unitario / (1 - _decimal(self.s["adicionales"][margen], margen)), Decimal(1))

    def precio(self, clientes: int | None = None, escenario: str | None = None, margen: Decimal | None = None) -> PrecioSOC:
        """Precio con equilibrio en `clientes`; el plan SOC lleva el margen comercial sobre el precio de venta."""
        n = self.s["clientes_punto_equilibrio"] if clientes is None else clientes
        if _entero_no_negativo(n, "clientes") < 1:
            raise ErrorModelo("Se requiere al menos 1 cliente para el punto de equilibrio")
        nombre = self._escenario(escenario)
        costos = self.costos(n, escenario=nombre)
        v = self.s["gestion_vulnerabilidades"]
        costo_vuln = self.costo_vulnerabilidades(nombre)
        base = _dinero((costos.total - costo_vuln) / n)
        sedes = n * v["sedes_promedio_por_cliente"]
        paso = _decimal(self.s["redondeo_precio_lista"], "redondeo")
        m = _decimal(self.s.get("margen_comercial", "0"), "margen_comercial") if margen is None else Decimal(margen)
        if not Decimal(0) <= m < 1:
            raise ErrorModelo("El margen comercial debe estar en [0, 1)")
        return PrecioSOC(
            n, nombre, costos, base, _redondear_arriba(base / (1 - m), paso),
            self.s["plan_base"]["dispositivos_incluidos"],
            self._precio_adicional("dispositivos", "margen_dispositivo_adicional"),
            self._precio_adicional("agentes_avanzados", "margen_agente_adicional"),
            self._precio_adicional("ueba", "margen_ueba_adicional"),
            costo_vuln, sedes, _dinero(costo_vuln / sedes), _dinero(_decimal(v["precio_por_sede_usd"], "precio_por_sede")),
            *self._esencial(base, m, paso),
        )

    def _esencial(self, equilibrio_base: Decimal, m: Decimal, paso: Decimal) -> tuple[Decimal | None, Decimal | None]:
        """SOC Esencial: equilibrio por cliente / clientes_por_cupo, con el mismo margen y redondeo del plan base."""
        e = self.s.get("plan_esencial")
        if not e:
            return None, None
        equilibrio = _dinero(equilibrio_base / _entero_no_negativo(e["clientes_por_cupo"], "clientes_por_cupo"))
        return equilibrio, _redondear_arriba(equilibrio / (1 - m), paso)

    def tramos_vulnerabilidades(self, sedes: int) -> list[tuple[int, Decimal]]:
        """Precio de un contrato de `sedes`: [(cantidad, precio unitario)] a lista y con descuento por volumen."""
        v = self.s["gestion_vulnerabilidades"]
        precio = _decimal(v["precio_por_sede_usd"], "precio_por_sede")
        desde = v["descuento_volumen"]["desde_sede"]
        lista = min(_entero_no_negativo(sedes, "sedes"), desde - 1)
        tramos = [(lista, _dinero(precio))] if lista else []
        if sedes > lista:
            descuento = _decimal(v["descuento_volumen"]["descuento_fraccion"], "descuento_volumen")
            tramos.append((sedes - lista, _dinero(precio * (1 - descuento))))
        return tramos

    def costo_vulnerabilidades(self, escenario: str | None = None) -> Decimal:
        """Costo mensual del equipo de vulnerabilidades (con contingencia): no depende de clientes ni licencias."""
        contingencia = 1 + _decimal(self.s["contingencia_fraccion"], "contingencia")
        return _dinero(self.personal_por_modulo(escenario)["vulnerabilidades"] * contingencia)

    def fuentes_por_tipo(self) -> list[dict[str, Any]]:
        """Fuentes adicionales por tipo: precio fijo en COP = competencia x (1 - descuento), redondeado hacia abajo."""
        cfg = self.s.get("fuentes_adicionales_por_tipo")
        if not cfg:
            return []
        descuento = _decimal(cfg["descuento_vs_competencia"], "descuento_vs_competencia")
        paso = Decimal(cfg["redondeo_cop"])
        trm = _decimal(self.s["tasa_cambio_cop_por_usd"], "tasa_cambio")
        mes = self.motor.calcular_mes(dispositivos=1)
        costo_cop = next(c.precio_unitario_neto for c in mes.componentes if c.categoria == "dispositivos") * trm
        filas = []
        for x in cfg["tipos"]:
            competencia = Decimal(x["competencia_cop"])
            precio = (competencia * (1 - descuento) / paso).to_integral_value(rounding="ROUND_FLOOR") * paso
            filas.append({"id": x["id"], "nombre": x["nombre"], "detalle": x["detalle"], "competencia_cop": competencia,
                          "precio_cop": precio, "costo_cop": costo_cop, "margen": 1 - costo_cop / precio})
        return filas

    def opciones_colector(self) -> list[OpcionColector]:
        """Colector por cliente, cobrado aparte del plan: NUC (costo/divisor durante meses_cobro) o cargo mensual."""
        cfg = self.s["opciones_colector"]
        factor = 1 - _decimal(cfg["margen"], "margen_colector")
        opciones = []
        for op in cfg["opciones"]:
            if "costo_total" in op:
                total = _decimal(op["costo_total"], "costo_total")
                opciones.append(OpcionColector(op["opcion"], _redondear_arriba(total / op["divisor_mensual"], CENTAVO), op["meses_cobro"], total))
            else:
                mensual = _decimal(op["costo_mensual"], "costo_mensual")
                opciones.append(OpcionColector(op["opcion"], _redondear_arriba(mensual / factor, CENTAVO), None))
        return opciones

    def sensibilidad(self, precio_mensual: Decimal, hasta_clientes: int = 10, escenario: str | None = None) -> list[FilaSensibilidad]:
        """SOC de incidentes: resultado mensual si cada cliente paga `precio_mensual` (sin adicionales).

        El equipo de vulnerabilidades queda fuera: lo cubre su propio servicio por sede.
        """
        capacidad = self.s["capacidad_max_clientes_sin_contratar"]
        costo_vuln = self.costo_vulnerabilidades(escenario)
        filas = []
        for n in range(1, hasta_clientes + 1):
            costo = self.costos(n, escenario=escenario).total - costo_vuln
            ingreso = _dinero(precio_mensual * n)
            utilidad = ingreso - costo
            filas.append(FilaSensibilidad(n, ingreso, costo, utilidad, _dinero(utilidad / ingreso * 100), n > capacidad))
        return filas

    def sensibilidad_vulnerabilidades(self, hasta_sedes: int = 12, escenario: str | None = None) -> list[FilaSensibilidad]:
        """Servicio de vulnerabilidades: resultado mensual según las sedes vendidas al precio por sede."""
        v = self.s["gestion_vulnerabilidades"]
        precio_sede = _decimal(v["precio_por_sede_usd"], "precio_por_sede")
        costo = self.costo_vulnerabilidades(escenario)
        filas = []
        for sedes in range(1, hasta_sedes + 1):
            ingreso = _dinero(precio_sede * sedes)
            utilidad = ingreso - costo
            filas.append(FilaSensibilidad(sedes, ingreso, costo, utilidad, _dinero(utilidad / ingreso * 100), sedes > v["capacidad_max_sedes"]))
        return filas

    def almacenamiento_por_cliente(self) -> Decimal:
        """Costo mensual de almacenamiento de logs de un cliente a la EPS de referencia (entra al equilibrio)."""
        return self.estimar_almacenamiento(self.s["estimador_almacenamiento"]["eps_referencia"])["costo_mensual"]

    def estimar_almacenamiento(self, eps: int) -> dict[str, Decimal]:
        """Costo mensual de almacenamiento de un cliente con la retención base (régimen estable, mes 12+)."""
        e = self.s["estimador_almacenamiento"]
        r = self.s["retencion_base"]
        gb_dia = Decimal(_entero_no_negativo(eps, "eps")) * e["bytes_por_evento"] * 86400 / Decimal(10) ** 9
        comprimido = gb_dia * _decimal(e["fraccion_tras_compresion"], "compresion")
        en_linea = comprimido * r["en_linea_dias"]
        archivado = comprimido * r["archivado_meses"] * 30
        costo = en_linea * _decimal(e["costo_gb_mes_en_linea_usd"], "costo_en_linea") + archivado * _decimal(e["costo_gb_mes_archivado_usd"], "costo_archivado")
        return {
            "gb_dia_crudo": gb_dia.quantize(Decimal("0.1")),
            "gb_en_linea": en_linea.quantize(Decimal(1)),
            "gb_archivado": archivado.quantize(Decimal(1)),
            "costo_mensual": _dinero(costo),
        }


def _m(valor: Decimal) -> str:
    return f"${valor:,.2f}"


def reporte_markdown(modelo: ModeloPrecioSOC, clientes: int | None = None, escenario: str | None = None) -> str:
    p = modelo.precio(clientes, escenario)
    c = p.costos
    s = modelo.s
    lin = [
        f"# Precio SOC Netmask — punto de equilibrio con {p.clientes_equilibrio} clientes",
        "",
        f"Escenario de personal: **{p.escenario}** — {s['escenarios_personal'][p.escenario]['descripcion']}",
        f"Plan base por cliente: {p.dispositivos_incluidos} dispositivos/consolas fuente, "
        f"{s['plan_base']['agentes_avanzados_incluidos']} agentes avanzados. TRM supuesta: {s['tasa_cambio_cop_por_usd']} COP/USD.",
        f"Retención base de eventos: {s['retencion_base']['en_linea_dias']} días en línea + {s['retencion_base']['archivado_meses']} meses archivados.",
        "",
        "## Precio propuesto (mensual por cliente, USD)",
        "",
        "| Componente | Equilibrio | Precio lista |",
        "|---|---:|---:|",
        f"| SOC de incidentes, plan base (plataforma + {p.dispositivos_incluidos} dispositivos/consolas fuente) | {_m(p.equilibrio_base)} | {_m(p.lista_base)} |",
        *([f"| {s['plan_esencial']['nombre']} (hasta {s['plan_esencial']['dispositivos_incluidos']} dispositivos/consolas fuente, "
            f"1/{s['plan_esencial']['clientes_por_cupo']} del cupo de un cliente) | {_m(p.esencial_equilibrio)} | {_m(p.esencial_lista)} |"]
          if p.esencial_lista is not None else []),
        f"| Gestión de vulnerabilidades OT, por sede (sin licencia de sonda) | {_m(p.equilibrio_por_sede)} | {_m(p.precio_por_sede)} |",
        f"| Vulnerabilidades desde la sede {s['gestion_vulnerabilidades']['descuento_volumen']['desde_sede']} del contrato "
        f"({Decimal(s['gestion_vulnerabilidades']['descuento_volumen']['descuento_fraccion']) * 100:.0f} % de descuento) | — | "
        f"{_m(modelo.tramos_vulnerabilidades(s['gestion_vulnerabilidades']['descuento_volumen']['desde_sede'])[-1][1])} |",
        f"| Otra consola fuente adicional (EDR, gestión, OT) | — | {_m(p.precio_dispositivo_adicional)} |",
        f"| Agente avanzado adicional | — | {_m(p.precio_agente_adicional)} |",
        f"| UEBA por agente avanzado (opcional) | — | {_m(p.precio_ueba_adicional)} |",
        "",
        f"Los dos servicios se venden juntos o por separado. El equilibrio por sede supone "
        f"{s['gestion_vulnerabilidades']['sedes_promedio_por_cliente']} sedes por cliente ({p.sedes_equilibrio} sedes con "
        f"{p.clientes_equilibrio} clientes). El equipo de vulnerabilidades cuesta {_m(p.costo_vulnerabilidades)}/mes: "
        f"a {_m(p.precio_por_sede)} por sede se cubre desde {p.sedes_minimas_con_precio_lista} sedes.",
        "",
        f"## Costos mensuales con {c.clientes} clientes ({c.dispositivos} dispositivos/consolas fuente agregados en FortiSIEM)",
        "",
        "| Concepto | USD/mes |",
        "|---|---:|",
    ]
    for modulo in MODULOS:
        lin.append(f"| Personal — {modulo} | {_m(c.personal_por_modulo[modulo])} |")
    lin += [
        f"| Disponibilidad fuera de horario | {_m(c.disponibilidad)} |",
        *[f"| {i['concepto']} | {_m(_decimal(i['importe'], 'fijo'))} |" for i in s["costos_fijos_mensuales"]],
        f"| Cuota anual programa FortiSIEM MSSP (prorrateada /12) | {_m(c.cuota_programa_mensual)} |",
        *[f"| Licencia FortiSIEM {d.categoria} ({d.cantidad_facturable} facturables × {_m(d.precio_unitario_neto)}) | {_m(d.subtotal)} |"
          for d in c.licencias.componentes if d.subtotal],
        *[f"| {i['concepto']} × {c.clientes} | {_m(_decimal(i['importe'], 'variable') * c.clientes)} |" for i in s["costos_variables_por_cliente_mensuales"]],
        f"| Azure almacenamiento de logs ({s['estimador_almacenamiento']['eps_referencia']} EPS por cliente) × {c.clientes} | {_m(modelo.almacenamiento_por_cliente() * c.clientes)} |",
        f"| Contingencia ({Decimal(s['contingencia_fraccion']) * 100:.0f}%) | {_m(c.contingencia)} |",
        f"| **Total** | **{_m(c.total)}** |",
        "",
        f"## SOC de incidentes: sensibilidad al número de clientes (plan base {_m(p.lista_base)})",
        "",
        "Costo sin el equipo de vulnerabilidades, que lo cubre su propio servicio.",
        "",
        "| Clientes | Ingreso | Costo | Utilidad | Margen |",
        "|---:|---:|---:|---:|---:|",
    ]
    for f in modelo.sensibilidad(p.lista_base, escenario=p.escenario):
        nota = " ⚠️ requiere ampliar equipo" if f.excede_capacidad else ""
        lin.append(f"| {f.clientes}{nota} | {_m(f.ingreso)} | {_m(f.costo)} | {_m(f.utilidad)} | {f.margen}% |")
    lin += [
        "",
        f"## Gestión de vulnerabilidades: sensibilidad al número de sedes ({_m(p.precio_por_sede)} por sede)",
        "",
        "| Sedes | Ingreso | Costo equipo | Utilidad | Margen |",
        "|---:|---:|---:|---:|---:|",
    ]
    for f in modelo.sensibilidad_vulnerabilidades(escenario=p.escenario):
        nota = " ⚠️ requiere ampliar equipo" if f.excede_capacidad else ""
        lin.append(f"| {f.clientes}{nota} | {_m(f.ingreso)} | {_m(f.costo)} | {_m(f.utilidad)} | {f.margen}% |")
    fuentes = modelo.fuentes_por_tipo()
    if fuentes:
        cop = lambda v: f"COP {v:,.0f}".replace(",", ".")
        lin += [
            "",
            "## Fuentes adicionales por tipo (precio fijo en COP frente a la competencia)",
            "",
            "| Tipo | Competencia | Netmask | Costo licencia | Margen |",
            "|---|---:|---:|---:|---:|",
            *[f"| {f['nombre']} | {cop(f['competencia_cop'])} | {cop(f['precio_cop'])} | {cop(f['costo_cop'])} | {f['margen'] * 100:.1f}% |" for f in fuentes],
        ]
    lin += [
        "",
        "## Colector FortiSIEM (opcional, se cobra aparte del plan)",
        "",
        "| Opción | Cargo adicional mensual | Duración del cargo | Total cobrado vs costo |",
        "|---|---:|---|---|",
        *[f"| {o.opcion} | {_m(o.precio_mensual)} | "
          f"{f'{o.meses_cobro} meses' if o.meses_cobro else 'recurrente'} | "
          f"{f'{_m(o.total_cobrado)} vs {_m(o.costo_total)}' if o.costo_total is not None else '—'} |"
          for o in modelo.opciones_colector()],
    ]
    e = s["estimador_almacenamiento"]
    alm = modelo.estimar_almacenamiento(e["eps_referencia"])
    lin += [
        "",
        "## Referencia: almacenamiento con la retención base",
        "",
        f"Un cliente con {e['eps_referencia']} EPS promedio genera ~{alm['gb_dia_crudo']} GB/día crudos. Con compresión al "
        f"{Decimal(e['fraccion_tras_compresion']) * 100:.0f}% mantiene ~{alm['gb_en_linea']} GB en línea "
        f"({_m(Decimal(e['costo_gb_mes_en_linea_usd']))}/GB-mes) y ~{alm['gb_archivado']} GB archivados "
        f"({_m(Decimal(e['costo_gb_mes_archivado_usd']))}/GB-mes): {_m(alm['costo_mensual'])}/mes. "
        "Ese costo por cliente entra al punto de equilibrio. El colector en Azure es una VM aparte y se cobra como opción de colector.",
        "",
    ]
    return "\n".join(lin)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--supuestos", help="Ruta a supuestos_soc.json alternativo")
    parser.add_argument("--clientes", type=int, help="Clientes para el punto de equilibrio")
    parser.add_argument("--escenario", help="Escenario de personal (p. ej. completo, esbelto)")
    args = parser.parse_args(argv)
    try:
        print(reporte_markdown(ModeloPrecioSOC.desde_archivos(args.supuestos), args.clientes, args.escenario))
    except ErrorModelo as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    raise SystemExit(main())
