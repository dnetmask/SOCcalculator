"""Motor de costos GLOBALES de licenciamiento FortiSIEM MSSP.

Fuentes: data/precios.json y data/reglas.json, extraídos de
"FortiSIEM MSSP Graph v4.xlsx", hojas "FortiSIEM MSSP" y "Costo vs usuarios".

No hay precios, SKU ni límites de tarifa incrustados en este módulo.
No realiza distribución por clientes, costeo de personal ni valoración de EPS.

API básica:
    motor = MotorLicenciamiento.desde_archivos()
    mes = motor.calcular_mes(dispositivos=50, agentes_avanzados=0, ueba=0)
    proyeccion = motor.proyectar([{"dispositivos": 50}, {"dispositivos": 150}])
    print(a_dict(mes))  # Dict serializable a JSON; Decimal como cadena.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, fields, is_dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Mapping, Sequence


class ErrorModelo(ValueError):
    """Catálogo, reglas o escenario inválidos o incompatibles."""


class TarifaNoDefinida(ErrorModelo):
    """No existe una rama aritmética para la cantidad facturable indicada."""


def _decimal(valor: Any, contexto: str) -> Decimal:
    """Evita introducir floats binarios en operaciones monetarias."""
    if isinstance(valor, bool) or isinstance(valor, float):
        raise ErrorModelo(f"{contexto}: se requiere un decimal exacto (cadena o entero), no float/bool")
    try:
        resultado = Decimal(valor)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ErrorModelo(f"{contexto}: valor decimal inválido: {valor!r}") from exc
    if not resultado.is_finite():
        raise ErrorModelo(f"{contexto}: el valor debe ser finito")
    return resultado


def _entero_no_negativo(valor: Any, contexto: str) -> int:
    if type(valor) is not int or valor < 0:
        raise ErrorModelo(f"{contexto}: se requiere un número entero no negativo")
    return valor


def _datos_objeto(valor: Any, contexto: str) -> Mapping[str, Any]:
    if not isinstance(valor, Mapping):
        raise ErrorModelo(f"{contexto}: se esperaba un objeto JSON")
    return valor


def _leer_json(ruta: str | Path) -> dict[str, Any]:
    try:
        with Path(ruta).open("r", encoding="utf-8") as archivo:
            data = json.load(archivo, parse_float=Decimal)
    except (OSError, json.JSONDecodeError) as exc:
        raise ErrorModelo(f"No se pudo cargar {ruta}: {exc}") from exc
    if not isinstance(data, dict):
        raise ErrorModelo(f"{ruta}: se esperaba un objeto JSON en la raíz")
    return data


@dataclass(frozen=True)
class DetalleLicencia:
    categoria: str
    sku: str | None
    cantidad_solicitada: int
    cantidad_facturable: int
    precio_unitario_lista: Decimal
    descuento_fraccion: Decimal
    precio_unitario_neto: Decimal
    subtotal: Decimal
    periodicidad: str
    moneda: str


@dataclass(frozen=True)
class ResultadoMensual:
    """Consumo de un mes (sin incluir la cuota anual del programa)."""
    componentes: tuple[DetalleLicencia, ...]
    consumo_total: Decimal
    moneda: str
    catalogo_id: str
    reglas_id: str


@dataclass(frozen=True)
class PeriodoProyeccion:
    mes: int
    consumo: ResultadoMensual | None
    cuota_programa: Decimal
    consumo_mes_anterior: Decimal
    factura: Decimal


@dataclass(frozen=True)
class ResultadoProyeccion:
    """Incluye factura del mes posterior al último consumo si se solicita."""
    periodos: tuple[PeriodoProyeccion, ...]
    total_consumido: Decimal
    total_cuotas_programa: Decimal
    total_facturado: Decimal
    saldo_consumo_pendiente: Decimal
    moneda: str
    catalogo_id: str
    reglas_id: str


def a_dict(objeto: Any) -> Any:
    """Convierte los resultados del motor a tipos estándar serializables por JSON."""
    if isinstance(objeto, Decimal):
        return str(objeto)
    if is_dataclass(objeto) and not isinstance(objeto, type):
        return {campo.name: a_dict(getattr(objeto, campo.name)) for campo in fields(objeto)}
    if isinstance(objeto, (list, tuple)):
        return [a_dict(elemento) for elemento in objeto]
    if isinstance(objeto, Mapping):
        return {clave: a_dict(valor) for clave, valor in objeto.items()}
    return objeto


class MotorLicenciamiento:
    """Calcula licenciamiento del conjunto de clientes del MSSP."""

    def __init__(self, precios: Mapping[str, Any], reglas: Mapping[str, Any]):
        self.precios = _datos_objeto(precios, "precios")
        self.reglas = _datos_objeto(reglas, "reglas")
        self._validar_configuracion()
        self.moneda = self.precios["moneda"]
        self.catalogo_id = self.precios["catalogo_id"]
        self.reglas_id = self.reglas["reglas_id"]
        self._centavo = _decimal(self.reglas["calculo_monetario"]["redondeo_presentacion"], "redondeo_presentacion")
        self._catalogo_por_sku = {
            producto["sku"]: producto
            for grupo in self.precios["productos"].values()
            for producto in (grupo if isinstance(grupo, list) else [grupo])
        }

    @classmethod
    def desde_archivos(
        cls,
        precios: str | Path | None = None,
        reglas: str | Path | None = None,
    ) -> "MotorLicenciamiento":
        base = Path(__file__).resolve().parent / "data"
        return cls(_leer_json(precios or base / "precios.json"), _leer_json(reglas or base / "reglas.json"))

    def _validar_configuracion(self) -> None:
        p, r = self.precios, self.reglas
        try:
            if p["schema_version"] != "1.0.0" or r["schema_version"] != "1.0.0":
                raise ErrorModelo("Versión de esquema no soportada; se esperaba 1.0.0")
            if p["catalogo_id"] != r["catalogo_id_requerido"]:
                raise ErrorModelo("Los ID del catálogo y las reglas no coinciden")
            if not isinstance(p["moneda"], str) or not p["moneda"].strip():
                raise ErrorModelo("El catálogo debe declarar una moneda")
            if r["unidad_de_calculo"]["ambito"] != "mssp_global" or r["unidad_de_calculo"]["costeo_por_cliente"] is not False:
                raise ErrorModelo("Este motor admite exclusivamente costeo global MSSP")
            if r["calculo_monetario"]["modelo_niveles"].split(";")[0].strip() != "una_sola_tarifa_para_todas_las_unidades":
                raise ErrorModelo("Modelo de niveles no soportado")
            if r["calculo_monetario"]["precio_base"] != "precio_unitario_lista" or r["calculo_monetario"]["descuento"] != "descuento_fraccion_excel":
                raise ErrorModelo("Campos de precio y descuento no soportados")
            if _decimal(r["calculo_monetario"]["redondeo_presentacion"], "redondeo_presentacion") <= 0:
                raise ErrorModelo("La unidad de redondeo debe ser positiva")
            productos = _datos_objeto(p["productos"], "productos")
            entradas = _datos_objeto(r["entradas"], "entradas")
            tarifas = _datos_objeto(r["seleccion_tarifas"], "seleccion_tarifas")
            categorias = ("dispositivos", "agentes_avanzados", "ueba", "ha_dr")
            if set(productos) != set(categorias) | {"programa_mssp"} or set(tarifas) != set(categorias):
                raise ErrorModelo("Las categorías del catálogo y las reglas deben coincidir")
            if set(entradas) != {"dispositivos", "agentes_avanzados", "ueba", "ha_dr_dispositivos"}:
                raise ErrorModelo("Entradas requeridas no coinciden con el modelo")
            skus: set[str] = set()
            for categoria, grupo in productos.items():
                items = grupo if isinstance(grupo, list) else [grupo]
                if not items:
                    raise ErrorModelo(f"{categoria}: catálogo vacío")
                for item in items:
                    sku = item["sku"]
                    if not isinstance(sku, str) or not sku or sku in skus or item["categoria"] != categoria:
                        raise ErrorModelo(f"SKU duplicado, vacío o con categoría incorrecta: {sku!r}")
                    skus.add(sku)
                    precio = _decimal(item["precio_unitario_lista"], f"{sku}.precio")
                    descuento = _decimal(item["descuento_fraccion_excel"], f"{sku}.descuento")
                    if precio < 0 or not Decimal(0) <= descuento <= Decimal(1):
                        raise ErrorModelo(f"{sku}: precio o descuento fuera de rango")
                    if item["periodicidad"] != ("anual" if categoria == "programa_mssp" else "mensual"):
                        raise ErrorModelo(f"{sku}: periodicidad incompatible")
            if productos["programa_mssp"]["sku"] != r["facturacion"]["cuota_programa"]["sku"]:
                raise ErrorModelo("La cuota del programa debe referir al SKU del catálogo")
            for nombre, info in entradas.items():
                minimo = _entero_no_negativo(info["cantidad_minima_facturable"], f"{nombre}.minimo")
                if nombre == "ha_dr_dispositivos" and minimo != 0:
                    raise ErrorModelo("HA/DR no debe aplicar un mínimo automático")
            for categoria, config in tarifas.items():
                if config["variable"] != ("ha_dr_dispositivos" if categoria == "ha_dr" else categoria):
                    raise ErrorModelo(f"{categoria}: variable mal definida")
                if config["evaluar_con"] != "cantidad_facturable":
                    raise ErrorModelo(f"{categoria}: evaluación no soportada")
                rangos = config["rangos_ordenados_primera_coincidencia"]
                if not isinstance(rangos, list) or not rangos:
                    raise ErrorModelo(f"{categoria}: no hay niveles")
                grupo_skus = {producto["sku"] for producto in productos[categoria]}
                anterior = -1
                for rango in rangos:
                    inicio = _entero_no_negativo(rango["desde_inclusive"], f"{categoria}.desde")
                    hasta = rango["hasta_inclusive"]
                    if hasta is not None:
                        _entero_no_negativo(hasta, f"{categoria}.hasta")
                    if inicio <= anterior or (hasta is not None and hasta < inicio):
                        raise ErrorModelo(f"{categoria}: intervalos inválidos o superpuestos")
                    if rango["sku"] not in grupo_skus:
                        raise ErrorModelo(f"{categoria}: SKU {rango['sku']!r} inexistente")
                    if anterior == float("inf"):
                        raise ErrorModelo(f"{categoria}: niveles después de un intervalo abierto")
                    anterior = float("inf") if hasta is None else hasta
                # Las discontinuidades HA/DR se conservan porque son parte de la fórmula original.
                if categoria != "ha_dr":
                    if rangos[0]["desde_inclusive"] != 0 or rangos[-1]["hasta_inclusive"] is not None:
                        raise ErrorModelo(f"{categoria}: los niveles deben cubrir desde cero hasta infinito")
                    for previo, siguiente in zip(rangos, rangos[1:]):
                        if siguiente["desde_inclusive"] != previo["hasta_inclusive"] + 1:
                            raise ErrorModelo(f"{categoria}: hay una discontinuidad entre niveles")
            fact = r["facturacion"]
            periodo = fact["cuota_programa"]["periodicidad_meses"]
            mes_inicial = fact["cuota_programa"]["primer_mes"]
            desfase = fact["consumo"]["desfase_facturacion_meses"]
            if not isinstance(periodo, int) or periodo <= 0 or type(mes_inicial) is not int or mes_inicial < 1:
                raise ErrorModelo("Periodicidad o primer mes de la cuota anual inválidos")
            if desfase != 1 or fact["consumo"]["mes_1_sin_consumo_previo"] is not True:
                raise ErrorModelo("Este motor implementa la facturación del consumo a mes vencido")
        except (KeyError, TypeError, AttributeError) as exc:
            raise ErrorModelo(f"Falta una clave o tiene un tipo incorrecto en los JSON: {exc}") from exc

    def _moneda(self, importe: Decimal) -> Decimal:
        return importe.quantize(self._centavo, rounding=ROUND_HALF_UP)

    def _calcular_categoria(self, categoria: str, solicitada: int) -> DetalleLicencia:
        variable = "ha_dr_dispositivos" if categoria == "ha_dr" else categoria
        minimo = self.reglas["entradas"][variable]["cantidad_minima_facturable"]
        facturable = max(solicitada, minimo)
        if categoria == "ha_dr" and facturable == 0:
            return DetalleLicencia(categoria, None, solicitada, 0, Decimal(0), Decimal(0), Decimal(0), self._moneda(Decimal(0)), "mensual", self.moneda)
        for rango in self.reglas["seleccion_tarifas"][categoria]["rangos_ordenados_primera_coincidencia"]:
            if facturable >= rango["desde_inclusive"] and (rango["hasta_inclusive"] is None or facturable <= rango["hasta_inclusive"]):
                producto = self._catalogo_por_sku[rango["sku"]]
                precio = _decimal(producto["precio_unitario_lista"], "precio")
                descuento = _decimal(producto["descuento_fraccion_excel"], "descuento")
                neto = precio * (Decimal(1) - descuento)
                subtotal = self._moneda(Decimal(facturable) * neto)
                return DetalleLicencia(categoria, producto["sku"], solicitada, facturable, precio, descuento, neto, subtotal, producto["periodicidad"], self.moneda)
        raise TarifaNoDefinida(
            f"{categoria}: no hay tarifa numérica para {facturable} unidades según reglas.json "
            "(discontinuidad de la fórmula original del Excel)."
        )

    def calcular_mes(
        self,
        dispositivos: int = 0,
        agentes_avanzados: int = 0,
        ueba: int = 0,
        ha_dr_dispositivos: int = 0,
    ) -> ResultadoMensual:
        """Calcula consumo de licencias de UN mes, sin cuota anual ni desfase de factura."""
        valores = {
            "dispositivos": dispositivos,
            "agentes_avanzados": agentes_avanzados,
            "ueba": ueba,
            "ha_dr": ha_dr_dispositivos,
        }
        detalles = tuple(
            self._calcular_categoria(categoria, _entero_no_negativo(cantidad, categoria))
            for categoria, cantidad in valores.items()
        )
        return ResultadoMensual(detalles, self._moneda(sum((item.subtotal for item in detalles), Decimal(0))), self.moneda, self.catalogo_id, self.reglas_id)

    def _cuota_anual(self, mes: int) -> Decimal:
        cfg = self.reglas["facturacion"]["cuota_programa"]
        if mes < cfg["primer_mes"] or (mes - cfg["primer_mes"]) % cfg["periodicidad_meses"] != 0:
            return self._moneda(Decimal(0))
        prod = self._catalogo_por_sku[cfg["sku"]]
        precio = _decimal(prod["precio_unitario_lista"], "cuota_programa.precio")
        descuento = _decimal(prod["descuento_fraccion_excel"], "cuota_programa.descuento")
        return self._moneda(precio * (Decimal(1) - descuento))

    def proyectar(
        self,
        consumos_mensuales: Sequence[Mapping[str, int]],
        *,
        incluir_factura_final: bool = True,
    ) -> ResultadoProyeccion:
        """Calcula n consumos y n+1 facturas por defecto (último consumo a mes vencido).

        Cada periodo admite dispositivos, agentes_avanzados, ueba y ha_dr_dispositivos;
        las claves omitidas valen cero (con mínimos obligatorios para las 3 primeras).
        La factura n incluye cuota anual del mes n + consumo del mes n-1.
        """
        if isinstance(consumos_mensuales, (str, bytes)) or not isinstance(consumos_mensuales, Sequence) or not consumos_mensuales:
            raise ErrorModelo("La proyección requiere una secuencia no vacía de meses")
        nombres = {"dispositivos", "agentes_avanzados", "ueba", "ha_dr_dispositivos"}
        calculados: list[ResultadoMensual] = []
        for mes, entrada in enumerate(consumos_mensuales, 1):
            if not isinstance(entrada, Mapping) or set(entrada) - nombres:
                raise ErrorModelo(f"Mes {mes}: se esperaba un objeto con las entradas admitidas: {sorted(nombres)}")
            try:
                calculados.append(self.calcular_mes(**entrada))
            except ErrorModelo as exc:
                raise type(exc)(f"Mes {mes}: {exc}") from exc
        n_facturas = len(calculados) + (1 if incluir_factura_final else 0)
        periodos: list[PeriodoProyeccion] = []
        for mes in range(1, n_facturas + 1):
            consumo = calculados[mes - 1] if mes <= len(calculados) else None
            anterior = calculados[mes - 2].consumo_total if mes > 1 else self._moneda(Decimal(0))
            cuota = self._cuota_anual(mes)
            periodos.append(PeriodoProyeccion(mes, consumo, cuota, anterior, self._moneda(anterior + cuota)))
        total_consumido = self._moneda(sum((m.consumo_total for m in calculados), Decimal(0)))
        total_cuotas = self._moneda(sum((m.cuota_programa for m in periodos), Decimal(0)))
        total_facturado = self._moneda(sum((m.factura for m in periodos), Decimal(0)))
        pendiente = self._moneda(total_consumido - sum((m.consumo_mes_anterior for m in periodos), Decimal(0)))
        return ResultadoProyeccion(tuple(periodos), total_consumido, total_cuotas, total_facturado, pendiente, self.moneda, self.catalogo_id, self.reglas_id)

    def comparar_meses(self, actual: Mapping[str, int], futuro: Mapping[str, int]) -> Decimal:
        """Diferencia del costo mensual GLOBAL (futuro - actual); no asigna costos a clientes."""
        try:
            return self._moneda(self.calcular_mes(**futuro).consumo_total - self.calcular_mes(**actual).consumo_total)
        except TypeError as exc:
            raise ErrorModelo(f"Parámetros del escenario inválidos: {exc}") from exc
