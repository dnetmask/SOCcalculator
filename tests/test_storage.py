"""Pruebas de persistencia exclusivamente explícita; ejecutar desde raíz o tests/."""
from __future__ import annotations

import copy
import csv
import json
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core import ErrorModelo, MotorLicenciamiento, TarifaNoDefinida
from storage import Almacenamiento, ErrorAlmacenamiento


class TestStorage(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.alm = Almacenamiento()
        self.motor = self.alm.cargar_motor()

    def _externos(self):
        p = json.loads((ROOT / "data" / "precios.json").read_text(encoding="utf-8"))
        r = json.loads((ROOT / "data" / "reglas.json").read_text(encoding="utf-8"))
        a, b = self.root / "precios.json", self.root / "reglas.json"
        a.write_text(json.dumps(p), encoding="utf-8")
        b.write_text(json.dumps(r), encoding="utf-8")
        return p, r, a, b

    def test_inicializacion_y_calculos_no_generan_archivos(self):
        self.assertEqual(list(self.root.iterdir()), [])
        self.assertEqual(self.motor.calcular_mes().consumo_total, Decimal("1655.00"))
        _ = self.alm.crear_documento("En memoria", {"dispositivos": 50}, self.motor)
        self.assertEqual(list(self.root.iterdir()), [])
        self.assertFalse(hasattr(self.alm, "directorio"))
        self.assertFalse(hasattr(self.alm, "listar_escenarios"))

    def test_catalogo_externo_lee_sin_copiar(self):
        p, r, a, b = self._externos()
        motor = self.alm.importar_catalogo(a, b)
        self.assertEqual(motor.calcular_mes().consumo_total, Decimal("1655.00"))
        p["productos"]["dispositivos"][0]["precio_unitario_lista"] = "30.00"
        a.write_text(json.dumps(p), encoding="utf-8")
        self.assertEqual(motor.calcular_mes().consumo_total, Decimal("1655.00"))
        self.assertEqual(self.alm.importar_catalogo(a, b).calcular_mes().consumo_total,
                         Decimal("1879.00"))
        self.assertEqual({x.name for x in self.root.iterdir()}, {"precios.json", "reglas.json"})

    def test_rechazar_catalogo_incompatible(self):
        _, r, a, b = self._externos()
        r["catalogo_id_requerido"] = "incompatible"
        b.write_text(json.dumps(r), encoding="utf-8")
        with self.assertRaises(ErrorModelo):
            self.alm.importar_catalogo(a, b)

    def test_guardado_solo_en_ruta_elegida_y_reapertura(self):
        ruta = self.root / "mi_escenario.json"
        documento = self.alm.guardar_escenario(ruta, "Costo global", {"dispositivos": 50}, self.motor)
        self.assertEqual({x.name for x in self.root.iterdir()}, {ruta.name})
        self.assertEqual(documento["resultado"]["consumo_total"], "1655.00")
        self.assertEqual(self.alm.cargar_escenario(ruta), documento)
        motor = self.alm.motor_del_escenario(documento)
        self.assertEqual(motor.calcular_mes().consumo_total, Decimal("1655.00"))

    def test_proyeccion_mes_posterior_y_csv_sin_json(self):
        csv_ruta = self.root / "simulacion.csv"
        self.alm.exportar_resumen_csv(csv_ruta, "Simulación", [{"dispositivos": 50}] * 2,
                                      self.motor)
        self.assertEqual({x.name for x in self.root.iterdir()}, {"simulacion.csv"})
        with csv_ruta.open(encoding="utf-8-sig", newline="") as stream:
            registros = list(csv.DictReader(stream, delimiter=";"))
        self.assertEqual([r["factura"] for r in registros], ["5000.00", "1655.00", "1655.00"])
        self.assertEqual([r["consumo_total"] for r in registros], ["1655.00", "1655.00", ""])

    def test_csv_de_cambio_en_memoria_no_requiere_guardar_escenario(self):
        ruta = self.root / "cambio.csv"
        self.alm.exportar_resumen_csv(ruta, "Cambios", {"dispositivos": 151}, self.motor)
        with ruta.open(encoding="utf-8-sig", newline="") as stream:
            registros = list(csv.DictReader(stream, delimiter=";"))
        self.assertEqual(registros[0]["dispositivos"], "151")
        self.assertEqual(registros[0]["factura"], "")
        self.assertEqual({x.name for x in self.root.iterdir()}, {"cambio.csv"})

    def test_guardar_como_no_modifica_archivo_anterior(self):
        primero, segundo = self.root / "uno.json", self.root / "dos.json"
        anterior = self.alm.guardar_escenario(primero, "Inicial", {}, self.motor)
        posterior = self.alm.guardar_escenario(segundo, "Segundo", {"dispositivos": 151}, self.motor)
        self.assertNotEqual(anterior["escenario_id"], posterior["escenario_id"])
        self.assertEqual(self.alm.cargar_escenario(primero), anterior)
        self.assertEqual(self.alm.cargar_escenario(segundo), posterior)

    def test_guardar_actualiza_misma_ruta_sin_cambiar_id(self):
        destino = self.root / "mismo.json"
        original = self.alm.guardar_escenario(destino, "Inicial", {}, self.motor)
        editado = self.alm.guardar_escenario(destino, "Editado", {"dispositivos": 151},
                                            self.motor, documento_anterior=original)
        self.assertEqual(original["escenario_id"], editado["escenario_id"])
        self.assertEqual(original["creado_utc"], editado["creado_utc"])
        self.assertEqual(len(list(self.root.iterdir())), 1)

    def test_snapshot_no_depende_de_cambio_de_precios(self):
        destino = self.root / "original.json"
        original = self.alm.guardar_escenario(destino, "Antes", {}, self.motor)
        nuevos = copy.deepcopy(self.motor.precios)
        nuevos["productos"]["dispositivos"][0]["precio_unitario_lista"] = "30.00"
        self.assertEqual(MotorLicenciamiento(nuevos, self.motor.reglas).calcular_mes().consumo_total,
                         Decimal("1879.00"))
        antiguo = self.alm.motor_del_escenario(self.alm.cargar_escenario(destino))
        self.assertEqual(antiguo.calcular_mes().consumo_total, Decimal("1655.00"))
        self.assertEqual(original, self.alm.cargar_escenario(destino))

    def test_tamper_detectado(self):
        ruta = self.root / "escenario.json"
        self.alm.guardar_escenario(ruta, "Original", {}, self.motor)
        dato = json.loads(ruta.read_text(encoding="utf-8"))
        dato["resultado"]["consumo_total"] = "1.00"
        ruta.write_text(json.dumps(dato), encoding="utf-8")
        with self.assertRaisesRegex(ErrorAlmacenamiento, "no coincide"):
            self.alm.cargar_escenario(ruta)

    def test_sin_tarifa_no_se_escribe(self):
        ruta = self.root / "no.json"
        with self.assertRaises(TarifaNoDefinida):
            self.alm.guardar_escenario(ruta, "No aplica", {"ha_dr_dispositivos": 150}, self.motor)
        self.assertFalse(ruta.exists())

    def test_no_se_crean_directorios_ni_rutas_implicitas(self):
        with self.assertRaises(ErrorAlmacenamiento):
            self.alm.guardar_escenario(self.root / "no_existe" / "escenario.json", "Prueba", {}, self.motor)
        with self.assertRaises(ErrorAlmacenamiento):
            self.alm.exportar_resumen_csv("", "Prueba", {}, self.motor)
        self.assertEqual(list(self.root.iterdir()), [])

    def test_rechazar_entradas_invalidas(self):
        for entrada in ({"dispositivos": -1}, {"dispositivos": 1.5}, {"dispositivos": True},
                        {"cliente": 100}):
            with self.subTest(entrada=entrada):
                with self.assertRaises(ErrorModelo):
                    self.alm.crear_documento("Prueba", entrada, self.motor)
        with self.assertRaises(ErrorAlmacenamiento):
            self.alm.crear_documento(" ", {}, self.motor)


if __name__ == "__main__":
    unittest.main()
