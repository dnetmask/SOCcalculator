"""Pruebas del modelo de precio SOC con punto de equilibrio."""
import copy
import json
import unittest
from decimal import Decimal
from pathlib import Path

from core import ErrorModelo, MotorLicenciamiento
from precio_soc import ModeloPrecioSOC, reporte_markdown


DATA = Path(__file__).resolve().parents[1] / "data"


def supuestos():
    return json.loads((DATA / "supuestos_soc.json").read_text(encoding="utf-8"))


class TestPrecioSOC(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.motor = MotorLicenciamiento.desde_archivos()
        cls.modelo = ModeloPrecioSOC(cls.motor, supuestos())

    def test_personal_por_modulo_en_usd(self):
        p = self.modelo.personal_por_modulo("completo")
        # (2 x 5.5M + 9M) COP x 1.52 / 4000
        self.assertEqual(p["incidentes"], Decimal("7600"))
        self.assertEqual(p["vulnerabilidades"], Decimal("3040"))

    def test_licencias_usan_motor_con_dispositivos_agregados(self):
        c = self.modelo.costos(3)
        self.assertEqual(c.dispositivos, 75)
        self.assertEqual(c.licencias.consumo_total, Decimal("2293.00"))
        self.assertEqual(c.cuota_programa_mensual, Decimal("416.67"))

    def test_precio_equilibrio_cubre_costo_con_n_clientes(self):
        p = self.modelo.precio()
        self.assertEqual(p.clientes_equilibrio, 3)
        # SOC de incidentes x 3 clientes + equipo de vulnerabilidades = costo total
        self.assertLessEqual(abs(p.equilibrio_base * 3 + p.costo_vulnerabilidades - p.costos.total), Decimal("0.03"))
        self.assertGreaterEqual(p.lista_base, p.equilibrio_base)
        self.assertEqual(p.lista_base % 50, 0)

    def test_vulnerabilidades_por_sede(self):
        p = self.modelo.precio()
        self.assertEqual(p.costo_vulnerabilidades, Decimal("3344.00"))  # 3040 x 1.10
        self.assertEqual(p.sedes_equilibrio, 6)  # 3 clientes x 2 sedes
        self.assertEqual(p.equilibrio_por_sede, Decimal("557.33"))
        self.assertEqual(p.precio_por_sede, Decimal("560.00"))
        self.assertEqual(p.sedes_minimas_con_precio_lista, 6)
        filas = self.modelo.sensibilidad_vulnerabilidades(12)
        self.assertLess(filas[4].utilidad, 0)
        self.assertGreater(filas[5].utilidad, 0)
        self.assertTrue(filas[10].excede_capacidad)

    def test_descuento_por_volumen_de_sedes(self):
        self.assertEqual(self.modelo.tramos_vulnerabilidades(10), [(10, Decimal("560.00"))])
        self.assertEqual(self.modelo.tramos_vulnerabilidades(13), [(10, Decimal("560.00")), (3, Decimal("280.00"))])
        self.assertEqual(self.modelo.tramos_vulnerabilidades(0), [])

    def test_sensibilidad_cruza_cero_en_punto_de_equilibrio(self):
        p = self.modelo.precio()
        filas = self.modelo.sensibilidad(p.lista_base, 4)
        self.assertLess(filas[1].utilidad, 0)
        self.assertGreaterEqual(filas[2].utilidad, 0)

    def test_escenario_esbelto_es_mas_barato(self):
        esbelto, completo = self.modelo.precio(escenario="esbelto"), self.modelo.precio()
        self.assertLess(esbelto.lista_base, completo.lista_base)
        self.assertLess(esbelto.equilibrio_por_sede, completo.equilibrio_por_sede)

    def test_adicionales_con_margen(self):
        p = self.modelo.precio()
        self.assertEqual(p.precio_dispositivo_adicional, Decimal("52.00"))  # 25.52 / 0.5 redondeado arriba
        self.assertEqual(p.precio_agente_adicional, Decimal("10.00"))
        self.assertEqual(p.precio_ueba_adicional, Decimal("11.00"))  # 5.22 / 0.5 redondeado arriba

    def test_opciones_colector(self):
        ops = {o.opcion: o for o in self.modelo.opciones_colector()}
        nuc = next(o for nombre, o in ops.items() if nombre.startswith("NUC"))
        self.assertEqual((nuc.precio_mensual, nuc.meses_cobro, nuc.total_cobrado), (Decimal("250.00"), 12, Decimal("3000.00")))
        self.assertEqual(ops["Colector en Azure"].precio_mensual, Decimal("200.00"))
        self.assertIsNone(ops["Colector en Azure"].meses_cobro)

    def test_colector_no_entra_al_punto_de_equilibrio(self):
        s = supuestos()
        s["opciones_colector"]["opciones"][2]["costo_mensual"] = "999"
        self.assertEqual(ModeloPrecioSOC(self.motor, s).precio().costos.total, self.modelo.precio().costos.total)

    def test_estimador_almacenamiento(self):
        r = self.modelo.estimar_almacenamiento(200)
        # 200 EPS x 500 B x 86400 = 8.64 GB/día; x 0.15 = 1.296 GB/día; 30 días en línea y 330 archivados
        self.assertEqual((r["gb_en_linea"], r["gb_archivado"]), (Decimal("39"), Decimal("428")))
        self.assertEqual(r["costo_mensual"], Decimal("14.39"))

    def test_validaciones(self):
        for mutar in (
            lambda s: s.update(clientes_punto_equilibrio=0),
            lambda s: s.update(escenario_personal="inexistente"),
            lambda s: s["adicionales"].update(margen_dispositivo_adicional="1"),
            lambda s: s["opciones_colector"]["opciones"][1].update(meses_cobro=0),
            lambda s: s["escenarios_personal"]["completo"]["roles"][0].update(modulo="otro"),
            lambda s: s.pop("factor_prestacional"),
            lambda s: s["gestion_vulnerabilidades"].update(precio_por_sede_usd="0"),
            lambda s: s["gestion_vulnerabilidades"].update(sedes_promedio_por_cliente=0),
            lambda s: s["gestion_vulnerabilidades"]["descuento_volumen"].update(descuento_fraccion="1"),
        ):
            s = copy.deepcopy(supuestos())
            mutar(s)
            with self.assertRaises(ErrorModelo):
                ModeloPrecioSOC(self.motor, s)

    def test_reporte_markdown(self):
        texto = reporte_markdown(self.modelo)
        self.assertIn("punto de equilibrio con 3 clientes", texto)
        self.assertIn("Colector en Azure", texto)


if __name__ == "__main__":
    unittest.main()
