"""Persistencia *por solicitud explícita* para FortiSIEM MSSP Calculator.

Sin directorios ni archivos automáticos: los cálculos y los catálogos externos
permanecen en memoria. Únicamente los métodos guardar_escenario() y
exportar_resumen_csv() escriben en la ruta indicada por el usuario.
La carga de JSON predeterminados es de solo lectura.
"""
from __future__ import annotations

import copy
import csv
import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Mapping, Sequence

from core import ErrorModelo, MotorLicenciamiento, a_dict

VERSION_ESQUEMA = "1.0.0"
ENTRADAS = ("dispositivos", "agentes_avanzados", "ueba", "ha_dr_dispositivos")


class ErrorAlmacenamiento(ValueError):
    """Error de archivo, formato o reproducibilidad del escenario."""


def _leer_json(ruta: str | Path) -> dict[str, Any]:
    try:
        with Path(ruta).open("r", encoding="utf-8-sig") as archivo:
            dato = json.load(archivo, parse_float=Decimal)
    except (OSError, UnicodeError, ValueError) as exc:
        raise ErrorAlmacenamiento(f"No se pudo leer {ruta}: {exc}") from exc
    if not isinstance(dato, dict):
        raise ErrorAlmacenamiento(f"{ruta}: la raíz debe ser un objeto JSON")
    return dato


def _ruta_de_guardado(destino: str | Path) -> Path:
    if not isinstance(destino, (str, Path)) or not str(destino).strip():
        raise ErrorAlmacenamiento("Debes seleccionar una ruta para guardar")
    ruta = Path(destino).expanduser()
    if not ruta.parent.is_dir():
        raise ErrorAlmacenamiento(f"No existe el directorio elegido: {ruta.parent}")
    if ruta.is_dir():
        raise ErrorAlmacenamiento("Selecciona un nombre de archivo, no un directorio")
    return ruta


def _escribir_atomico(ruta: Path, escritor) -> None:
    """Escribe solo tras solicitud expresa, con temporal en el destino elegido."""
    temporal = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="", dir=ruta.parent,
            prefix=f".{ruta.stem}-", suffix=".tmp", delete=False,
        ) as archivo:
            temporal = Path(archivo.name)
            escritor(archivo)
            archivo.flush()
            os.fsync(archivo.fileno())
        os.replace(temporal, ruta)
    except (OSError, UnicodeError, ValueError, TypeError) as exc:
        raise ErrorAlmacenamiento(f"No se pudo guardar {ruta}: {exc}") from exc
    finally:
        if temporal is not None:
            temporal.unlink(missing_ok=True)


def _normalizar_mes(entrada: Mapping[str, int]) -> dict[str, int]:
    if not isinstance(entrada, Mapping) or set(entrada) - set(ENTRADAS):
        raise ErrorModelo(f"Solo se admiten las entradas: {ENTRADAS}")
    normalizada = {}
    for clave in ENTRADAS:
        valor = entrada.get(clave, 0)
        if type(valor) is not int or valor < 0:
            raise ErrorModelo(f"{clave}: debe ser un entero no negativo")
        normalizada[clave] = valor
    return normalizada


def _preparar_entradas(entradas):
    if isinstance(entradas, Mapping):
        return "puntual", _normalizar_mes(entradas)
    if not isinstance(entradas, (tuple, list)) or not entradas:
        raise ErrorModelo("Se requiere un mes o una lista no vacía de meses")
    return "proyeccion", [_normalizar_mes(x) for x in entradas]


def _calcular(motor: MotorLicenciamiento, tipo: str, entradas, incluir_final: bool):
    if tipo == "puntual":
        return motor.calcular_mes(**entradas)
    return motor.proyectar(entradas, incluir_factura_final=incluir_final)


class Almacenamiento:
    """Cargas de solo lectura; escritura únicamente con ruta de destino explícita."""

    def cargar_motor(self, precios: str | Path | None = None,
                     reglas: str | Path | None = None) -> MotorLicenciamiento:
        if (precios is None) != (reglas is None):
            raise ErrorAlmacenamiento("Selecciona ambos archivos: precios y reglas")
        return MotorLicenciamiento.desde_archivos(precios=precios, reglas=reglas)

    def importar_catalogo(self, precios: str | Path,
                          reglas: str | Path) -> MotorLicenciamiento:
        """Valida y devuelve un motor en memoria. NO copia ni guarda los JSON."""
        return MotorLicenciamiento(_leer_json(precios), _leer_json(reglas))

    def crear_documento(self, nombre: str, entradas: Mapping[str, int] | Sequence[Mapping[str, int]],
                        motor: MotorLicenciamiento, *, incluir_factura_final: bool = True,
                        documento_anterior: Mapping[str, Any] | None = None) -> dict[str, Any]:
        """Construye y calcula el escenario COMPLETAMENTE EN MEMORIA."""
        if not isinstance(nombre, str) or not nombre.strip() or len(nombre.strip()) > 120:
            raise ErrorAlmacenamiento("El nombre debe contener entre 1 y 120 caracteres")
        if any(ord(c) < 32 for c in nombre.strip()):
            raise ErrorAlmacenamiento("El nombre no puede contener caracteres de control")
        if type(incluir_factura_final) is not bool:
            raise ErrorAlmacenamiento("incluir_factura_final debe ser booleano")
        if not isinstance(motor, MotorLicenciamiento):
            raise ErrorAlmacenamiento("Se requiere un motor de licenciamiento")
        tipo, entradas_normalizadas = _preparar_entradas(entradas)
        snapshot = {"precios": copy.deepcopy(motor.precios),
                    "reglas": copy.deepcopy(motor.reglas)}
        resultado = _calcular(MotorLicenciamiento(snapshot["precios"], snapshot["reglas"]),
                             tipo, entradas_normalizadas, incluir_factura_final)
        ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
        if documento_anterior is not None:
            uid = documento_anterior["escenario_id"]
            fecha_creacion = documento_anterior["creado_utc"]
        else:
            uid, fecha_creacion = str(uuid.uuid4()), ahora
        return {
            "schema_version": VERSION_ESQUEMA,
            "escenario_id": uid,
            "nombre": nombre.strip(),
            "creado_utc": fecha_creacion,
            "actualizado_utc": ahora,
            "tipo": tipo,
            "entradas": entradas_normalizadas,
            "incluir_factura_final": incluir_factura_final if tipo == "proyeccion" else None,
            "catalogo": snapshot,
            "resultado": a_dict(resultado),
        }

    def guardar_escenario(self, destino: str | Path, nombre: str,
                          entradas: Mapping[str, int] | Sequence[Mapping[str, int]],
                          motor: MotorLicenciamiento, *, incluir_factura_final: bool = True,
                          documento_anterior: Mapping[str, Any] | None = None) -> dict[str, Any]:
        """Escribe UN SOLO JSON en el destino indicado explícitamente."""
        ruta = _ruta_de_guardado(destino)
        documento = self.crear_documento(
            nombre, entradas, motor, incluir_factura_final=incluir_factura_final,
            documento_anterior=documento_anterior,
        )
        _escribir_atomico(ruta, lambda archivo: (
            json.dump(a_dict(documento), archivo, ensure_ascii=False,
                      indent=2, allow_nan=False), archivo.write("\n")
        ))
        return copy.deepcopy(documento)

    def cargar_escenario(self, origen: str | Path) -> dict[str, Any]:
        """Abre el JSON indicado y verifica todos los importes contra el snapshot."""
        documento = _leer_json(origen)
        try:
            if documento["schema_version"] != VERSION_ESQUEMA:
                raise ErrorAlmacenamiento("Versión de escenario no soportada")
            if str(uuid.UUID(documento["escenario_id"])) != documento["escenario_id"]:
                raise ErrorAlmacenamiento("ID de escenario inválido")
            if not isinstance(documento["nombre"], str) or not documento["nombre"].strip():
                raise ErrorAlmacenamiento("Nombre de escenario inválido")
            for campo in ("creado_utc", "actualizado_utc"):
                fecha = datetime.fromisoformat(documento[campo])
                if fecha.tzinfo is None or fecha.utcoffset() is None:
                    raise ErrorAlmacenamiento("Las fechas deben contener zona horaria")
            tipo, entradas = _preparar_entradas(documento["entradas"])
            if documento["tipo"] != tipo:
                raise ErrorAlmacenamiento("El tipo de escenario no coincide")
            incluir = documento["incluir_factura_final"]
            if (tipo == "proyeccion" and type(incluir) is not bool) or (tipo == "puntual" and incluir is not None):
                raise ErrorAlmacenamiento("Indicador de factura final inválido")
            snapshot = documento["catalogo"]
            motor = MotorLicenciamiento(snapshot["precios"], snapshot["reglas"])
            esperado = a_dict(_calcular(motor, tipo, entradas, bool(incluir)))
            if documento["resultado"] != esperado:
                raise ErrorAlmacenamiento("El resultado guardado no coincide con las entradas y tarifas originales")
        except (KeyError, TypeError, ValueError, AttributeError, ErrorModelo) as exc:
            if isinstance(exc, ErrorAlmacenamiento):
                raise
            raise ErrorAlmacenamiento(f"Escenario inválido en {origen}: {exc}") from exc
        return documento

    def motor_del_escenario(self, documento: Mapping[str, Any]) -> MotorLicenciamiento:
        """Reconstruye el motor a partir del documento YA ABIERTO; no accede al disco."""
        snapshot = documento["catalogo"]
        return MotorLicenciamiento(copy.deepcopy(snapshot["precios"]), copy.deepcopy(snapshot["reglas"]))

    def exportar_resumen_csv(self, destino: str | Path, nombre: str,
                             entradas: Mapping[str, int] | Sequence[Mapping[str, int]],
                             motor: MotorLicenciamiento, *, incluir_factura_final: bool = True) -> Path:
        """Exporta el cálculo EN MEMORIA; no crea ningún escenario JSON."""
        ruta = _ruta_de_guardado(destino)
        documento = self.crear_documento(nombre, entradas, motor,
                                         incluir_factura_final=incluir_factura_final)
        columnas = ["mes", *ENTRADAS, "consumo_total", "cuota_programa",
                    "consumo_mes_anterior", "factura", "moneda"]
        registros = []
        if documento["tipo"] == "puntual":
            registros.append({"mes": 1, **documento["entradas"],
                              "consumo_total": documento["resultado"]["consumo_total"],
                              "cuota_programa": "", "consumo_mes_anterior": "", "factura": "",
                              "moneda": documento["resultado"]["moneda"]})
        else:
            for periodo in documento["resultado"]["periodos"]:
                mes = periodo["mes"]
                entrada = (documento["entradas"][mes - 1] if mes <= len(documento["entradas"])
                           else {campo: "" for campo in ENTRADAS})
                registros.append({"mes": mes, **entrada,
                                  "consumo_total": (periodo["consumo"]["consumo_total"]
                                                    if periodo["consumo"] is not None else ""),
                                  "cuota_programa": periodo["cuota_programa"],
                                  "consumo_mes_anterior": periodo["consumo_mes_anterior"],
                                  "factura": periodo["factura"],
                                  "moneda": documento["resultado"]["moneda"]})

        def escribir_csv(archivo):
            archivo.write("\ufeff")
            escritor = csv.DictWriter(archivo, fieldnames=columnas, delimiter=";")
            escritor.writeheader()
            escritor.writerows(registros)

        _escribir_atomico(ruta, escribir_csv)
        return ruta
