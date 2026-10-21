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
        p = self.modelo.personal_por_modulo("ajustado")
        # (3.3M + 3.78M) COP x 1.52 / 3500 (salarios base -40 %, TRM 3.500)
        self.assertEqual(round(p["incidentes"], 2), Decimal("3074.74"))
        # 3.36M x 1.52 / 3500
        self.assertEqual(round(p["vulnerabilidades"], 2), Decimal("1459.20"))

    def test_licencias_usan_motor_con_dispositivos_agregados(self):
        c = self.modelo.costos(4)
        self.assertEqual(c.dispositivos, 40)  # 4 clientes x 10; FortiSIEM factura el mínimo de 50
        self.assertEqual(c.licencias.consumo_total, Decimal("1655.00"))
        self.assertEqual(c.cuota_programa_mensual, Decimal("416.67"))

    def test_precio_equilibrio_cubre_costo_con_n_clientes(self):
        p = self.modelo.precio()
        self.assertEqual(p.clientes_equilibrio, 4)
        self.assertEqual(p.lista_base, Decimal("2950.00"))  # margen comercial por defecto 20 %
        self.assertEqual(self.modelo.precio(margen=Decimal("0")).lista_base, Decimal("2400.00"))
        # SOC de incidentes x 4 clientes + equipo de vulnerabilidades = costo total
        self.assertLessEqual(abs(p.equilibrio_base * 4 + p.costo_vulnerabilidades - p.costos.total), Decimal("0.03"))
        self.assertGreaterEqual(p.lista_base, p.equilibrio_base)
        self.assertEqual(p.lista_base % 50, 0)

    def test_vulnerabilidades_por_sede(self):
        p = self.modelo.precio()
        self.assertEqual(p.costo_vulnerabilidades, Decimal("1605.12"))  # 1459.20 x 1.10
        self.assertEqual(p.sedes_equilibrio, 8)  # 4 clientes x 2 sedes
        self.assertEqual(p.equilibrio_por_sede, Decimal("200.64"))
        self.assertEqual(p.precio_por_sede, Decimal("560.00"))
        self.assertEqual(p.sedes_minimas_con_precio_lista, 3)
        filas = self.modelo.sensibilidad_vulnerabilidades(12)
        self.assertLess(filas[1].utilidad, 0)
        self.assertGreater(filas[2].utilidad, 0)
        self.assertTrue(filas[10].excede_capacidad)

    def test_descuento_por_volumen_de_sedes(self):
        self.assertEqual(self.modelo.tramos_vulnerabilidades(10), [(10, Decimal("560.00"))])
        self.assertEqual(self.modelo.tramos_vulnerabilidades(13), [(10, Decimal("560.00")), (3, Decimal("280.00"))])
        self.assertEqual(self.modelo.tramos_vulnerabilidades(0), [])

    def test_sensibilidad_cruza_cero_en_punto_de_equilibrio(self):
        p = self.modelo.precio()
        filas = self.modelo.sensibilidad(p.lista_base, 5)
        self.assertLess(filas[2].utilidad, 0)
        self.assertGreaterEqual(filas[3].utilidad, 0)

    def test_margen_comercial_sobre_precio_de_venta(self):
        self.assertEqual(self.modelo.precio(margen=Decimal("0.20")).lista_base, Decimal("2950.00"))  # 2352.88 / 0.8 -> 2941.10
        self.assertEqual(self.modelo.precio(margen=Decimal("0.30")).lista_base, Decimal("3400.00"))
        with self.assertRaises(ErrorModelo):
            self.modelo.precio(margen=Decimal("1"))

    def test_escenario_unico_ajustado(self):
        self.assertEqual(list(self.modelo.s["escenarios_personal"]), ["ajustado"])
        roles = {r["rol"]: r for r in self.modelo.s["escenarios_personal"]["ajustado"]["roles"]}
        self.assertEqual((roles["Líder técnico SIEM"]["salario_mensual_cop"], roles["Líder técnico SIEM"]["dedicacion"]), ("6500000", "0.3"))
        self.assertEqual((roles["Líder de operaciones SOC"]["salario_mensual_cop"], roles["Líder de operaciones SOC"]["dedicacion"]), ("6500000", "0.5"))
        # (6.5M x 0.3 + 6.5M x 0.5) x 1.52 / 3500
        self.assertEqual(round(self.modelo.personal_por_modulo()["compartido"], 2), Decimal("2258.29"))
        self.assertEqual(self.modelo.precio().escenario, "ajustado")

    def test_adicionales_con_margen(self):
        p = self.modelo.precio()
        self.assertEqual(p.precio_dispositivo_adicional, Decimal("52.00"))  # 25.52 / 0.5 redondeado arriba
        self.assertEqual(p.precio_agente_adicional, Decimal("10.00"))
        self.assertEqual(p.precio_ueba_adicional, Decimal("11.00"))  # 5.22 / 0.5 redondeado arriba

    def test_fuentes_por_tipo_bajo_la_competencia(self):
        f = {x["id"]: x for x in self.modelo.fuentes_por_tipo()}
        self.assertEqual([f[k]["precio_cop"] for k in ("fw_entry", "fw_mid", "fw_high", "servidor", "sw_core", "sw_acceso")],
                         [280000, 440000, 560000, 260000, 170000, 100000])
        self.assertTrue(all(x["precio_cop"] < x["competencia_cop"] and x["margen"] > 0 for x in f.values()))

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

    def test_almacenamiento_por_eps_entra_al_equilibrio(self):
        # 600 EPS de referencia por cliente reemplazan el antiguo valor fijo de USD 200
        self.assertEqual(self.modelo.almacenamiento_por_cliente(), Decimal("43.16"))
        self.assertEqual(self.modelo.s["costos_variables_por_cliente_mensuales"], [])
        self.assertEqual(self.modelo.costos(4).variables, Decimal("172.64"))

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
            lambda s: s["escenarios_personal"]["ajustado"]["roles"][0].update(modulo="otro"),
            lambda s: s.pop("factor_prestacional"),
            lambda s: s.update(margen_comercial="1"),
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
        self.assertIn("punto de equilibrio con 4 clientes", texto)
        self.assertIn("Colector en Azure", texto)


if __name__ == "__main__":
    unittest.main()
