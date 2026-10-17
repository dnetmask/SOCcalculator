"""Pruebas de UI: sin almacenamiento implícito y selectores de ruta explícitos."""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

try:
    from PySide6.QtWidgets import QApplication, QFileDialog, QMessageBox
    from ui import VentanaPrincipal
except ImportError:
    QApplication = None


@unittest.skipUnless(QApplication is not None, "PySide6 no instalado: pip install PySide6")
class TestInterfaz(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.ventana = VentanaPrincipal()
        # No activar preguntas durante limpieza de la prueba.
        self.addCleanup(lambda: (setattr(self.ventana, "_sucio", False), self.ventana.close()))

    def test_inicio_y_estimaciones_no_escriben(self):
        self.assertEqual(str(self.ventana._ultimo_mes.consumo_total), "1655.00")
        self.assertFalse(self.ventana._sucio)
        self.ventana.controles_puntuales["dispositivos"].setValue(151)
        self.assertEqual(str(self.ventana._ultimo_mes.componentes[0].sku), "FSM-MSSP-LIC-150-BILL")
        self.assertTrue(self.ventana._sucio)
        self.assertIsNone(self.ventana._ruta_escenario)
        self.assertEqual(list(self.root.iterdir()), [])

    def test_proyeccion(self):
        self.ventana.meses.setValue(2)
        self.ventana._generar_meses()
        self.assertEqual([str(p.factura) for p in self.ventana._ultima_proyeccion.periodos],
                         ["5000.00", "1655.00", "1655.00"])

    def test_guardar_solo_si_se_elije_ruta_y_abrir_manual(self):
        ruta = self.root / "escenario.json"
        with patch.object(QFileDialog, "getSaveFileName", return_value=("", "")):
            self.assertIsNone(self.ventana._guardar_actual())
        self.assertEqual(list(self.root.iterdir()), [])
        with patch.object(QFileDialog, "getSaveFileName", return_value=(str(ruta), "")):
            documento = self.ventana._guardar_actual()
        self.assertEqual(documento["resultado"]["consumo_total"], "1655.00")
        self.assertEqual([x.name for x in self.root.iterdir()], [ruta.name])
        self.ventana.controles_puntuales["dispositivos"].setValue(151)
        with patch.object(QMessageBox, "question", return_value=QMessageBox.StandardButton.Discard):
            self.ventana._cargar_escenario(ruta)
        self.assertEqual(self.ventana.controles_puntuales["dispositivos"].value(), 50)
        self.assertFalse(self.ventana._sucio)

    def test_exportar_sesion_editada_no_guarda_json(self):
        self.ventana.controles_puntuales["dispositivos"].setValue(151)
        destino = self.root / "en_vivo.csv"
        with patch.object(QFileDialog, "getSaveFileName", return_value=(str(destino), "")):
            self.ventana._exportar_csv()
        self.assertEqual([x.name for x in self.root.iterdir()], ["en_vivo.csv"])
        self.assertIsNone(self.ventana._ruta_escenario)
        self.assertTrue(self.ventana._sucio)

    def test_importar_catalogo_sin_copias(self):
        datos = self.ventana.motor
        import copy
        precios = copy.deepcopy(datos.precios)
        precios["productos"]["dispositivos"][0]["precio_unitario_lista"] = "30.00"
        a, b = self.root / "precios.json", self.root / "reglas.json"
        a.write_text(json.dumps(precios), encoding="utf-8")
        b.write_text(json.dumps(datos.reglas), encoding="utf-8")
        with patch.object(QFileDialog, "getOpenFileName", side_effect=[(str(a), ""), (str(b), "")]):
            self.ventana._importar_catalogo()
        self.assertEqual(str(self.ventana._ultimo_mes.consumo_total), "1879.00")
        self.assertEqual({x.name for x in self.root.iterdir()}, {a.name, b.name})

    def test_cierre_se_puede_cancelar(self):
        self.ventana.controles_puntuales["dispositivos"].setValue(151)
        with patch.object(QMessageBox, "question", return_value=QMessageBox.StandardButton.Cancel):
            self.assertFalse(self.ventana.close())
        with patch.object(QMessageBox, "question", return_value=QMessageBox.StandardButton.Discard):
            self.assertTrue(self.ventana.close())


if __name__ == "__main__":
    unittest.main()
