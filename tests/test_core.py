"""Pruebas del motor vs. valores/fórmulas de FortiSIEM MSSP Graph v4.xlsx."""
import copy
import json
import unittest
from decimal import Decimal
from pathlib import Path

from core import ErrorModelo, MotorLicenciamiento, TarifaNoDefinida, a_dict


DATA = Path(__file__).resolve().parents[1] / "data"


def cargar(nombre):
    return json.loads((DATA / nombre).read_text(encoding="utf-8"))


class TestLicenciamiento(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.motor = MotorLicenciamiento.desde_archivos()

    def detalle(self, mes, categoria):
        return next(c for c in mes.componentes if c.categoria == categoria)

    def test_escenario_inicial_excel(self):
        mes = self.motor.calcular_mes(dispositivos=50, agentes_avanzados=0, ueba=0)
        self.assertEqual(mes.consumo_total, Decimal('1655.00'))
        self.assertEqual([c.subtotal for c in mes.componentes], list(map(Decimal, ['1276.00', '248.50', '130.50', '0.00'])))
        self.assertEqual([c.cantidad_facturable for c in mes.componentes], [50, 50, 25, 0])
        self.assertIsNone(self.detalle(mes, 'ha_dr').sku)

    def test_mensual_no_incluye_cuota_anual(self):
        self.assertEqual(self.motor.calcular_mes().consumo_total, Decimal('1655.00'))

    def test_limites_dispositivos_150_y_151(self):
        c150 = self.detalle(self.motor.calcular_mes(dispositivos=150), 'dispositivos')
        c151 = self.detalle(self.motor.calcular_mes(dispositivos=151), 'dispositivos')
        self.assertEqual((c150.sku, c150.subtotal), ('FSM-MSSP-LIC-001-BILL', Decimal('3828.00')))
        self.assertEqual((c151.sku, c151.subtotal), ('FSM-MSSP-LIC-150-BILL', Decimal('3021.51')))

    def test_limites_agentes_y_ueba(self):
        a150 = self.detalle(self.motor.calcular_mes(agentes_avanzados=150), 'agentes_avanzados')
        a151 = self.detalle(self.motor.calcular_mes(agentes_avanzados=151), 'agentes_avanzados')
        u500 = self.detalle(self.motor.calcular_mes(ueba=500), 'ueba')
        u501 = self.detalle(self.motor.calcular_mes(ueba=501), 'ueba')
        self.assertEqual([x.precio_unitario_lista for x in (a150, a151, u500, u501)], list(map(Decimal, ['4.97', '4.50', '5.22', '5.00'])))

    def test_minimos_en_todos_los_componentes_basicos(self):
        mes = self.motor.calcular_mes(dispositivos=0, agentes_avanzados=1, ueba=1)
        self.assertEqual([(d.cantidad_solicitada, d.cantidad_facturable) for d in mes.componentes[:3]], [(0, 50), (1, 50), (1, 25)])

    def test_ha_dr_es_cantidad_independiente_y_0_es_gratis(self):
        mes = self.motor.calcular_mes(dispositivos=1000, ha_dr_dispositivos=0)
        self.assertEqual(self.detalle(mes, 'ha_dr').subtotal, Decimal('0.00'))
        mes = self.motor.calcular_mes(dispositivos=50, ha_dr_dispositivos=149)
        self.assertEqual((self.detalle(mes, 'ha_dr').sku, self.detalle(mes, 'ha_dr').subtotal), ('FSM-MSSP-DR-LIC-001-BILL', Decimal('1521.29')))

    def test_ha_dr_intervalos_sin_tarifa_son_errores_explicitos(self):
        for cantidad in [150, 15000, 19998]:
            with self.subTest(cantidad=cantidad):
                with self.assertRaisesRegex(TarifaNoDefinida, str(cantidad)):
                    self.motor.calcular_mes(ha_dr_dispositivos=cantidad)

    def test_ha_dr_rama_20k_inalcanzable_se_conserva(self):
        for cantidad in [19999, 20000, 50000]:
            with self.subTest(cantidad=cantidad):
                d = self.detalle(self.motor.calcular_mes(ha_dr_dispositivos=cantidad), 'ha_dr')
                self.assertEqual(d.sku, 'FSM-MSSP-DR-LIC-15K-BILL')
                self.assertEqual(d.precio_unitario_lista, Decimal('3.07'))

    def test_dispositivos_mas_de_20k_usa_tarifa_ultimo_nivel(self):
        d = self.detalle(self.motor.calcular_mes(dispositivos=20001), 'dispositivos')
        self.assertEqual(d.sku, 'FSM-MSSP-LIC-20K-BILL')

    def test_proyeccion_primera_factura_y_meses_siguientes(self):
        p = self.motor.proyectar([{'dispositivos': 50}] * 2)
        self.assertEqual([f.factura for f in p.periodos], [Decimal('5000.00'), Decimal('1655.00'), Decimal('1655.00')])
        self.assertEqual(p.total_consumido, Decimal('3310.00'))
        self.assertEqual(p.total_facturado, Decimal('8310.00'))
        self.assertEqual(p.saldo_consumo_pendiente, Decimal('0.00'))
        self.assertIsNone(p.periodos[-1].consumo)

    def test_factura_de_renovacion_en_mes_13(self):
        p = self.motor.proyectar([{}] * 12)
        self.assertEqual((p.periodos[12].cuota_programa, p.periodos[12].factura), (Decimal('5000.00'), Decimal('6655.00')))
        self.assertEqual(p.total_cuotas_programa, Decimal('10000.00'))

    def test_36_meses_generan_37_facturas(self):
        p = self.motor.proyectar([{}] * 36)
        self.assertEqual(len(p.periodos), 37)
        self.assertEqual([per.mes for per in p.periodos if per.cuota_programa], [1, 13, 25, 37])
        self.assertEqual(p.total_cuotas_programa, Decimal('20000.00'))

    def test_horizonte_sin_factura_final_informa_pendiente(self):
        p = self.motor.proyectar([{}] * 2, incluir_factura_final=False)
        self.assertEqual(len(p.periodos), 2)
        self.assertEqual(p.saldo_consumo_pendiente, Decimal('1655.00'))
        self.assertEqual(p.total_facturado, Decimal('6655.00'))

    def test_delta_es_costo_global_no_asignacion_individual(self):
        antes, despues = {'dispositivos': 500}, {'dispositivos': 650}
        esperado = self.motor.calcular_mes(**despues).consumo_total - self.motor.calcular_mes(**antes).consumo_total
        self.assertEqual(self.motor.comparar_meses(antes, despues), esperado)

    def test_precios_editables_sin_cambiar_codigo(self):
        precios = copy.deepcopy(cargar('precios.json'))
        reglas = cargar('reglas.json')
        precios['productos']['dispositivos'][0]['precio_unitario_lista'] = '30.00'
        precios['productos']['dispositivos'][0]['descuento_fraccion_excel'] = '0.10'
        m = MotorLicenciamiento(precios, reglas)
        d = self.detalle(m.calcular_mes(dispositivos=50), 'dispositivos')
        self.assertEqual((d.precio_unitario_neto, d.subtotal), (Decimal('27.0000'), Decimal('1350.00')))

    def test_validaciones_de_entrada(self):
        for invalido in (-1, 1.3, True, '50', None):
            with self.subTest(entrada=invalido):
                with self.assertRaises(ErrorModelo):
                    self.motor.calcular_mes(dispositivos=invalido)
        with self.assertRaises(ErrorModelo):
            self.motor.proyectar([])
        with self.assertRaises(ErrorModelo):
            self.motor.proyectar([{'usuarios_finales': 5}])

    def test_rechazar_catalogo_y_reglas_incompatibles(self):
        precios = cargar('precios.json')
        reglas = cargar('reglas.json')
        reglas['catalogo_id_requerido'] = 'otro-catalogo'
        with self.assertRaisesRegex(ErrorModelo, 'no coinciden'):
            MotorLicenciamiento(precios, reglas)

    def test_rechazar_precio_invalido_y_sku_inexistente(self):
        p = cargar('precios.json')
        r = cargar('reglas.json')
        p['productos']['ueba'][0]['precio_unitario_lista'] = '-5'
        with self.assertRaises(ErrorModelo):
            MotorLicenciamiento(p, r)
        p = cargar('precios.json')
        r['seleccion_tarifas']['dispositivos']['rangos_ordenados_primera_coincidencia'][0]['sku'] = 'INEXISTENTE'
        with self.assertRaisesRegex(ErrorModelo, 'inexistente'):
            MotorLicenciamiento(p, r)

    def test_serializacion_decimal(self):
        valores = a_dict(self.motor.calcular_mes())
        self.assertEqual(valores['consumo_total'], '1655.00')
        self.assertEqual(valores['componentes'][0]['cantidad_facturable'], 50)
        self.assertEqual(json.loads(json.dumps(valores))['consumo_total'], '1655.00')


if __name__ == '__main__':
    unittest.main()
