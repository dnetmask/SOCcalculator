"""Interfaz de escritorio para el costeo GLOBAL de licencias FortiSIEM MSSP.

Requiere: pip install PySide6
Dependencias locales: core.py, storage.py y data/{precios,reglas}.json.
Ejecutar desde la carpeta raíz: python main.py (o python ui.py).

No implementa fórmulas de precios. Los resultados proceden de core.py y los
escenarios/catálogos se administran mediante storage.py, sin guardado automático.
"""
from __future__ import annotations

import sys

# También al ejecutar directamente `python ui.py`.
sys.dont_write_bytecode = True

from decimal import Decimal
from pathlib import Path

from PySide6.QtCore import Qt, QRect, QSignalBlocker, QTimer
from PySide6.QtGui import QColor, QPainter, QPen
from PySide6.QtWidgets import (
    QApplication, QAbstractItemView, QCheckBox, QComboBox, QDialog,
    QDialogButtonBox, QFileDialog, QFormLayout, QFrame, QGridLayout,
    QGroupBox, QHBoxLayout, QHeaderView, QLabel, QLineEdit, QMainWindow,
    QMessageBox, QPushButton, QScrollArea, QSpinBox, QTabWidget,
    QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget,
)

from core import ErrorModelo, MotorLicenciamiento, ResultadoProyeccion
from storage import Almacenamiento, ErrorAlmacenamiento

CAMPOS = ("dispositivos", "agentes_avanzados", "ueba", "ha_dr_dispositivos")
TITULOS = ("Dispositivos", "Agentes avanzados", "Agentes UEBA", "Dispositivos HA/DR")
CATEGORIAS = {
    "programa_mssp": "Programa MSSP", "dispositivos": "Dispositivos",
    "agentes_avanzados": "Agentes avanzados", "ueba": "UEBA", "ha_dr": "HA/DR",
}
CATALOGO_INSTALADO = "instalado"


def dinero(cantidad: Decimal | str | int, moneda: str = "USD") -> str:
    """Presentación local; no redondea valores empleados por el motor."""
    agrupado = f"{Decimal(cantidad):,.2f}"
    return f"{moneda} {agrupado.replace(',', '@').replace('.', ',').replace('@', '.')}"


def _spin(valor: int = 0, *, minimo: int = 0, maximo: int = 2_000_000_000) -> QSpinBox:
    control = QSpinBox()
    control.setRange(minimo, maximo)
    control.setValue(valor)
    control.setGroupSeparatorShown(True)
    control.setMinimumWidth(115)
    return control


def _item(valor: object, *, derecha: bool = False) -> QTableWidgetItem:
    celda = QTableWidgetItem(str(valor))
    if derecha:
        celda.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
    return celda


def _tabla(encabezados: list[str]) -> QTableWidget:
    tabla = QTableWidget(0, len(encabezados))
    tabla.setHorizontalHeaderLabels(encabezados)
    tabla.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
    tabla.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
    tabla.setAlternatingRowColors(True)
    tabla.verticalHeader().setVisible(False)
    tabla.horizontalHeader().setStretchLastSection(True)
    tabla.setWordWrap(False)
    return tabla


class GraficaCostos(QWidget):
    """Gráfico ligero sin dependencia adicional de QtCharts/matplotlib."""

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self._puntos: list[tuple[int, float, float | None]] = []
        self.setMinimumHeight(220)

    def mostrar(self, resultado: ResultadoProyeccion | None) -> None:
        self._puntos = [] if resultado is None else [
            (p.mes, float(p.consumo.consumo_total) if p.consumo else 0.0,
             float(p.factura)) for p in resultado.periodos
        ]
        self.update()

    def paintEvent(self, event) -> None:  # noqa: N802 (convención Qt)
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        r = self.rect()
        painter.fillRect(r, QColor("#ffffff"))
        if not self._puntos:
            painter.setPen(QColor("#64748b"))
            painter.drawText(r, Qt.AlignmentFlag.AlignCenter,
                             "La gráfica aparecerá al calcular una proyección válida.")
            return
        margen_izq, margen_der, margen_sup, margen_inf = 80, 26, 30, 42
        ancho = max(1, r.width() - margen_izq - margen_der)
        alto = max(1, r.height() - margen_sup - margen_inf)
        max_y = max(1.0, max(max(p[1], p[2] or 0.0) for p in self._puntos) * 1.12)
        n = len(self._puntos)

        def xy(i: int, y: float):
            x_px = margen_izq + (i / max(1, n - 1)) * ancho
            y_px = margen_sup + alto * (1 - y / max_y)
            return int(x_px), int(y_px)

        painter.setPen(QPen(QColor("#e2e8f0"), 1))
        for i in range(5):
            y = margen_sup + alto * i / 4
            painter.drawLine(margen_izq, int(y), margen_izq + ancho, int(y))
            painter.setPen(QColor("#475569"))
            painter.drawText(QRect(2, int(y) - 11, margen_izq - 9, 22),
                             Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter,
                             f"{max_y * (4 - i) / 4:,.0f}")
            painter.setPen(QPen(QColor("#e2e8f0"), 1))
        painter.setPen(QColor("#475569"))
        marcas = sorted({0, n - 1, *(round(i * (n - 1) / 5) for i in range(1, 5))})
        for i in marcas:
            x, _ = xy(i, 0)
            painter.drawText(QRect(x - 21, margen_sup + alto + 5, 42, 22),
                             Qt.AlignmentFlag.AlignCenter, str(self._puntos[i][0]))
        for indice, (campo, color) in enumerate(((1, "#2563eb"), (2, "#16a34a"))):
            painter.setPen(QPen(QColor(color), 2.4))
            for i in range(1, n):
                painter.drawLine(*xy(i - 1, self._puntos[i - 1][campo] or 0.0),
                                 *xy(i, self._puntos[i][campo] or 0.0))
            # Con un único periodo, dibujamos un punto visible.
            if n == 1:
                x, y = xy(0, self._puntos[0][campo] or 0.0)
                painter.setBrush(QColor(color))
                painter.drawEllipse(x - 3, y - 3, 6, 6)
        painter.setPen(QColor("#2563eb"))
        painter.drawText(margen_izq, 17, "● Consumo")
        painter.setPen(QColor("#16a34a"))
        painter.drawText(margen_izq + 112, 17, "● Factura")
        painter.setPen(QColor("#475569"))
        painter.drawText(QRect(margen_izq, r.height() - 19, ancho, 18),
                         Qt.AlignmentFlag.AlignCenter, "Mes / importe en moneda del catálogo")


class VentanaPrincipal(QMainWindow):
    def __init__(self, almacenamiento: Almacenamiento | None = None):
        super().__init__()
        self.storage = almacenamiento or Almacenamiento()
        self.motor: MotorLicenciamiento = self.storage.cargar_motor()
        # El archivo actual existe únicamente si el usuario lo abrió/guardó.
        self._ruta_escenario: Path | None = None
        self._documento_escenario: dict | None = None
        self._tipo_cargado: str | None = None
        self._motor_externo: MotorLicenciamiento | None = None
        self._motor_historico: MotorLicenciamiento | None = None
        self._seleccion_activa = (CATALOGO_INSTALADO, None)
        self._ultima_pestana_costeo = 0
        self._restaurando = False
        self._sucio = True
        self._ultimo_mes = None
        self._ultima_proyeccion: ResultadoProyeccion | None = None
        self._timer_proyeccion = QTimer(self)
        self._timer_proyeccion.setSingleShot(True)
        self._timer_proyeccion.setInterval(160)
        self._timer_proyeccion.timeout.connect(self._calcular_proyeccion)
        self.setWindowTitle("FortiSIEM MSSP | Costos globales de licenciamiento")
        self.resize(1160, 830)
        self.setMinimumSize(850, 610)
        self._construir_interfaz()
        self._actualizar_catalogos()
        self._generar_meses()
        self._calcular_puntual()
        self._calcular_proyeccion()
        self._sucio = False  # abrir la aplicación no constituye una edición de usuario

    def _construir_interfaz(self) -> None:
        raiz = QWidget()
        self.setCentralWidget(raiz)
        contenedor = QVBoxLayout(raiz)
        contenedor.setContentsMargins(18, 16, 18, 16)
        contenedor.setSpacing(12)

        encabezado = QHBoxLayout()
        izquierda = QVBoxLayout()
        titulo = QLabel("FortiSIEM MSSP  ·  Calculadora de licenciamiento")
        titulo.setObjectName("titulo")
        subtitulo = QLabel("Costos agregados del proveedor  |  Sin distribución por cliente ni costos de personal")
        subtitulo.setObjectName("muted")
        izquierda.addWidget(titulo)
        izquierda.addWidget(subtitulo)
        encabezado.addLayout(izquierda, 1)
        btn_abrir = QPushButton("Abrir escenario")
        btn_abrir.clicked.connect(self._abrir_escenario)
        btn_guardar = QPushButton("Guardar")
        btn_guardar.setObjectName("primary")
        btn_guardar.clicked.connect(lambda: self._guardar_actual())
        btn_nuevo = QPushButton("Guardar como...")
        btn_nuevo.clicked.connect(lambda: self._guardar_actual(como_nuevo=True))
        btn_csv = QPushButton("Exportar CSV")
        btn_csv.clicked.connect(self._exportar_csv)
        for b in (btn_abrir, btn_guardar, btn_nuevo, btn_csv):
            encabezado.addWidget(b)
        contenedor.addLayout(encabezado)

        barra = QHBoxLayout()
        barra.addWidget(QLabel("Catálogo activo:"))
        self.selector_catalogo = QComboBox()
        self.selector_catalogo.setMinimumWidth(260)
        self.selector_catalogo.currentIndexChanged.connect(self._cambiar_catalogo)
        barra.addWidget(self.selector_catalogo, 1)
        self.etiqueta_catalogo = QLabel()
        self.etiqueta_catalogo.setObjectName("muted")
        barra.addWidget(self.etiqueta_catalogo)
        contenedor.addLayout(barra)

        self.pestanas = QTabWidget()
        self.pestanas.addTab(self._construir_puntual(), "Calculadora")
        self.pestanas.addTab(self._construir_proyecciones(), "Proyecciones")
        self.pestanas.addTab(self._construir_catalogo(), "Catálogo")
        self.pestanas.currentChanged.connect(self._cambio_pestana)
        contenedor.addWidget(self.pestanas, 1)

        self.estado = QLabel("Listo.")
        self.estado.setObjectName("muted")
        self.estado.setWordWrap(True)
        contenedor.addWidget(self.estado)
        self.setStyleSheet("""
            QMainWindow, QWidget { font-size: 12px; }
            QLabel#titulo { font-size: 20px; font-weight: 700; color: #19324d; }
            QLabel#muted { color: #64748b; }
            QGroupBox { font-weight: 600; border: 1px solid #dae3ec;
                        border-radius: 7px; margin-top: 12px; padding-top: 13px; }
            QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 5px; }
            QPushButton { padding: 6px 11px; }
            QPushButton#primary { background: #2563eb; color: white; border-radius: 4px; }
            QTableWidget { gridline-color: #e2e8f0; }
        """)

    @staticmethod
    def _etiqueta_grande() -> QLabel:
        label = QLabel("—")
        label.setStyleSheet("font-size: 19px; font-weight: 700; color: #1d4ed8;")
        label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        return label

    def _construir_puntual(self) -> QWidget:
        pagina = QWidget()
        lay = QVBoxLayout(pagina)
        formulario = QGroupBox("Escenario de consumo global mensual")
        f = QGridLayout(formulario)
        self.nombre_puntual = QLineEdit("Estimación de licenciamiento MSSP")
        f.addWidget(QLabel("Nombre:"), 0, 0)
        f.addWidget(self.nombre_puntual, 0, 1, 1, 3)
        self.controles_puntuales: dict[str, QSpinBox] = {}
        for i, (clave, titulo) in enumerate(zip(CAMPOS, TITULOS)):
            fila = 1 + i // 2
            columna = (i % 2) * 2
            f.addWidget(QLabel(titulo + ":"), fila, columna)
            control = _spin(50 if clave == "dispositivos" else 0)
            control.valueChanged.connect(self._cambio_puntual)
            self.controles_puntuales[clave] = control
            f.addWidget(control, fila, columna + 1)
        nota = QLabel("El mínimo obligatorio se factura aunque se indique 0. "
                      "HA/DR se expresa como una cantidad independiente de dispositivos.")
        nota.setObjectName("muted")
        nota.setWordWrap(True)
        f.addWidget(nota, 3, 0, 1, 4)
        for i in (1, 3):
            f.setColumnStretch(i, 1)
        self.nombre_puntual.textChanged.connect(self._marcar_sucio)
        lay.addWidget(formulario)

        totales = QGroupBox("Resultado de consumo (no es la factura del primer mes)")
        t = QGridLayout(totales)
        self.lbl_total_puntual = self._etiqueta_grande()
        self.lbl_cuota_puntual = QLabel("—")
        t.addWidget(QLabel("Consumo mensual:"), 0, 0)
        t.addWidget(self.lbl_total_puntual, 0, 1)
        t.addWidget(QLabel("Cuota anual del programa (cargo separado):"), 1, 0)
        t.addWidget(self.lbl_cuota_puntual, 1, 1)
        t.setColumnStretch(1, 1)
        lay.addWidget(totales)
        self.tabla_puntual = _tabla(["Concepto", "SKU", "Solicitada", "Facturable",
                                     "Precio lista", "Descuento", "Precio neto", "Subtotal mensual"])
        self.tabla_puntual.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        lay.addWidget(self.tabla_puntual, 1)
        self.aviso_puntual = QLabel("")
        self.aviso_puntual.setWordWrap(True)
        lay.addWidget(self.aviso_puntual)
        return pagina

    def _construir_proyecciones(self) -> QWidget:
        pagina = QWidget()
        lay = QVBoxLayout(pagina)
        controles = QGroupBox("Parámetros de la proyección")
        b = QGridLayout(controles)
        self.nombre_proyeccion = QLineEdit("Proyección global MSSP")
        b.addWidget(QLabel("Nombre:"), 0, 0)
        b.addWidget(self.nombre_proyeccion, 0, 1, 1, 5)
        b.addWidget(QLabel("Meses de consumo:"), 1, 0)
        self.meses = _spin(12, minimo=1, maximo=120)
        self.meses.setMaximumWidth(120)
        b.addWidget(self.meses, 1, 1)
        aplicar = QPushButton("Aplicar cantidad de meses")
        aplicar.clicked.connect(self._generar_meses)
        b.addWidget(aplicar, 1, 2)
        repetir = QPushButton("Repetir valores de Calculadora")
        repetir.clicked.connect(self._repetir_puntual)
        b.addWidget(repetir, 1, 3)
        self.factura_final = QCheckBox("Incluir factura del mes posterior al último consumo")
        self.factura_final.setChecked(True)
        b.addWidget(self.factura_final, 2, 0, 1, 6)
        b.addWidget(QLabel("Edite en la tabla las cantidades de cada mes. "
                           "La cuota anual se aplica según las reglas del catálogo."), 3, 0, 1, 6)
        self.nombre_proyeccion.textChanged.connect(self._marcar_sucio)
        self.factura_final.toggled.connect(self._cambio_proyeccion)
        lay.addWidget(controles)

        self.tabla_proyeccion = _tabla(["Mes", *TITULOS, "Consumo mensual", "Cuota programa", "Factura"])
        self.tabla_proyeccion.setMinimumHeight(195)
        self.tabla_proyeccion.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        for col in range(1, 5):
            self.tabla_proyeccion.horizontalHeader().setSectionResizeMode(col, QHeaderView.ResizeMode.Stretch)
        lay.addWidget(self.tabla_proyeccion, 3)
        datos = QHBoxLayout()
        self.lbl_total_consumido = QLabel("Consumo: —")
        self.lbl_total_cuotas = QLabel("Cuotas: —")
        self.lbl_total_facturado = self._etiqueta_grande()
        self.lbl_pendiente = QLabel("Pendiente: —")
        for widget in (self.lbl_total_consumido, self.lbl_total_cuotas,
                       self.lbl_total_facturado, self.lbl_pendiente):
            datos.addWidget(widget)
        lay.addLayout(datos)
        self.grafica = GraficaCostos()
        lay.addWidget(self.grafica, 2)
        self.aviso_proyeccion = QLabel("")
        self.aviso_proyeccion.setWordWrap(True)
        lay.addWidget(self.aviso_proyeccion)
        return pagina

    def _construir_catalogo(self) -> QWidget:
        pagina = QWidget()
        lay = QVBoxLayout(pagina)
        acciones = QHBoxLayout()
        self.descripcion_catalogo = QLabel("")
        self.descripcion_catalogo.setWordWrap(True)
        self.descripcion_catalogo.setObjectName("muted")
        acciones.addWidget(self.descripcion_catalogo, 1)
        importar = QPushButton("Importar precios.json + reglas.json")
        importar.clicked.connect(self._importar_catalogo)
        acciones.addWidget(importar)
        lay.addLayout(acciones)
        self.tabla_catalogo = _tabla(["Categoría", "SKU", "Descripción del Excel", "Precio lista",
                                      "Descuento", "Periodicidad", "Fila de origen"])
        self.tabla_catalogo.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.tabla_catalogo.setHorizontalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        lay.addWidget(self.tabla_catalogo, 1)
        nota = QLabel("Tarifas extraídas del Excel de referencia. La vigencia comercial y sus condiciones "
                      "deben verificarse antes de utilizar una estimación como cotización.")
        nota.setWordWrap(True)
        nota.setObjectName("muted")
        lay.addWidget(nota)
        return pagina

    def _entradas_puntuales(self) -> dict[str, int]:
        return {clave: self.controles_puntuales[clave].value() for clave in CAMPOS}

    def _entradas_proyeccion(self) -> list[dict[str, int]]:
        entradas = []
        for fila in range(self.tabla_proyeccion.rowCount()):
            entradas.append({clave: self.tabla_proyeccion.cellWidget(fila, i + 1).value()
                             for i, clave in enumerate(CAMPOS)})
        return entradas

    def _marcar_sucio(self, *_args) -> None:
        if not self._restaurando:
            self._sucio = True

    def _cambio_puntual(self, *_args) -> None:
        if self._restaurando:
            return
        self._marcar_sucio()
        self._calcular_puntual()

    def _cambio_proyeccion(self, *_args) -> None:
        if self._restaurando:
            return
        self._marcar_sucio()
        self._timer_proyeccion.start()

    def _calcular_puntual(self) -> None:
        try:
            resultado = self.motor.calcular_mes(**self._entradas_puntuales())
            cuota = self.motor.proyectar([self._entradas_puntuales()],
                                        incluir_factura_final=False).periodos[0].cuota_programa
        except ErrorModelo as exc:
            self._ultimo_mes = None
            self.lbl_total_puntual.setText("No disponible")
            self.lbl_cuota_puntual.setText("—")
            self.tabla_puntual.setRowCount(0)
            self.aviso_puntual.setText(f"No se puede calcular este escenario: {exc}")
            self.aviso_puntual.setStyleSheet("color: #b91c1c;")
            self.estado.setText(str(exc))
            return
        self._ultimo_mes = resultado
        self.lbl_total_puntual.setText(dinero(resultado.consumo_total, resultado.moneda))
        self.lbl_cuota_puntual.setText(dinero(cuota, resultado.moneda))
        self.tabla_puntual.setRowCount(len(resultado.componentes))
        for fila, componente in enumerate(resultado.componentes):
            valores = (CATEGORIAS[componente.categoria], componente.sku or "Sin cargo",
                       componente.cantidad_solicitada, componente.cantidad_facturable,
                       dinero(componente.precio_unitario_lista, componente.moneda),
                       f"{componente.descuento_fraccion * 100:g}%",
                       dinero(componente.precio_unitario_neto, componente.moneda),
                       dinero(componente.subtotal, componente.moneda))
            for col, valor in enumerate(valores):
                self.tabla_puntual.setItem(fila, col, _item(valor, derecha=col in (2, 3, 4, 5, 6, 7)))
        self.aviso_puntual.setStyleSheet("color: #64748b;")
        self.aviso_puntual.setText("El total muestra solo consumo mensual. La cuota del programa se "
                                  "factura por separado; la facturación del consumo es a mes vencido.")
        self.estado.setText("Estimación mensual calculada.")

    def _generar_meses(self) -> None:
        anteriores = self._entradas_proyeccion()
        base = self._entradas_puntuales()
        cantidad = self.meses.value()
        restaurando_antes = self._restaurando
        self._restaurando = True
        try:
            self.tabla_proyeccion.setRowCount(0)
            self.tabla_proyeccion.setRowCount(cantidad)
            for fila in range(cantidad):
                entrada = anteriores[fila] if fila < len(anteriores) else (anteriores[-1] if anteriores else base)
                self.tabla_proyeccion.setItem(fila, 0, _item(fila + 1, derecha=True))
                for i, clave in enumerate(CAMPOS):
                    control = _spin(entrada[clave])
                    control.valueChanged.connect(self._cambio_proyeccion)
                    self.tabla_proyeccion.setCellWidget(fila, i + 1, control)
                for col in (5, 6, 7):
                    self.tabla_proyeccion.setItem(fila, col, _item("—", derecha=True))
        finally:
            self._restaurando = restaurando_antes
        if not self._restaurando:
            self._marcar_sucio()
            self._calcular_proyeccion()

    def _repetir_puntual(self) -> None:
        base = self._entradas_puntuales()
        self._restaurando = True
        try:
            for fila in range(self.tabla_proyeccion.rowCount()):
                for i, clave in enumerate(CAMPOS):
                    self.tabla_proyeccion.cellWidget(fila, i + 1).setValue(base[clave])
        finally:
            self._restaurando = False
        self._marcar_sucio()
        self._calcular_proyeccion()

    def _calcular_proyeccion(self) -> None:
        self._timer_proyeccion.stop()
        try:
            resultado = self.motor.proyectar(self._entradas_proyeccion(),
                              incluir_factura_final=self.factura_final.isChecked())
        except ErrorModelo as exc:
            self._ultima_proyeccion = None
            for fila in range(self.tabla_proyeccion.rowCount()):
                for col in (5, 6, 7):
                    self.tabla_proyeccion.item(fila, col).setText("—")
            for col in (self.lbl_total_consumido, self.lbl_total_cuotas,
                        self.lbl_total_facturado, self.lbl_pendiente):
                col.setText("No disponible")
            self.grafica.mostrar(None)
            self.aviso_proyeccion.setStyleSheet("color: #b91c1c;")
            self.aviso_proyeccion.setText(f"No se puede calcular la proyección: {exc}")
            self.estado.setText(str(exc))
            return
        self._ultima_proyeccion = resultado
        for fila in range(self.tabla_proyeccion.rowCount()):
            periodo = resultado.periodos[fila]
            assert periodo.consumo is not None
            cantidades = (periodo.consumo.consumo_total, periodo.cuota_programa, periodo.factura)
            for col, importe in zip((5, 6, 7), cantidades):
                self.tabla_proyeccion.item(fila, col).setText(dinero(importe, resultado.moneda))
        self.lbl_total_consumido.setText("Consumo: " + dinero(resultado.total_consumido, resultado.moneda))
        self.lbl_total_cuotas.setText("Cuotas: " + dinero(resultado.total_cuotas_programa, resultado.moneda))
        self.lbl_total_facturado.setText("Facturado: " + dinero(resultado.total_facturado, resultado.moneda))
        self.lbl_pendiente.setText("Pendiente: " + dinero(resultado.saldo_consumo_pendiente, resultado.moneda))
        self.grafica.mostrar(resultado)
        if len(resultado.periodos) > self.tabla_proyeccion.rowCount():
            final = resultado.periodos[-1]
            nota = (f"La última factura (mes {final.mes}) es {dinero(final.factura, resultado.moneda)}; "
                    "incluye el consumo del último mes y, si corresponde, una nueva cuota anual. "
                    "Aparece en el total y la gráfica, no como un mes adicional de consumo en la tabla.")
        else:
            nota = "Sin factura posterior: el último consumo puede quedar pendiente de facturación."
        self.aviso_proyeccion.setStyleSheet("color: #64748b;")
        self.aviso_proyeccion.setText(nota)
        self.estado.setText("Proyección calculada.")

    def _actualizar_catalogos(self, seleccionar: tuple | None = None) -> None:
        """Selector de motores disponibles EN LA SESIÓN; no consulta el disco."""
        seleccionado = seleccionar or self._seleccion_activa
        with QSignalBlocker(self.selector_catalogo):
            self.selector_catalogo.clear()
            self.selector_catalogo.addItem("Catálogo instalado (data/)", (CATALOGO_INSTALADO, None))
            if self._motor_externo is not None:
                self.selector_catalogo.addItem(
                    f"Externo · {self._motor_externo.catalogo_id}", ("externo", None))
            if self._motor_historico is not None:
                self.selector_catalogo.addItem(
                    f"Del escenario abierto · {self._motor_historico.catalogo_id}", ("historico", None))
            indice = self.selector_catalogo.findData(seleccionado)
            self.selector_catalogo.setCurrentIndex(indice if indice >= 0 else 0)
        self._mostrar_catalogo()

    def _cambiar_catalogo(self, _indice: int) -> None:
        seleccion = self.selector_catalogo.currentData()
        if seleccion is None or seleccion == self._seleccion_activa:
            return
        if not self._confirmar_descartar("cambiar el catálogo"):
            self._actualizar_catalogos(self._seleccion_activa)
            return
        try:
            if seleccion[0] == CATALOGO_INSTALADO:
                nuevo = self.storage.cargar_motor()
            elif seleccion[0] == "externo":
                nuevo = self._motor_externo
            else:
                nuevo = self._motor_historico
            if nuevo is None:
                raise ErrorAlmacenamiento("El catálogo no está disponible en esta sesión")
        except (ErrorModelo, ErrorAlmacenamiento, OSError) as exc:
            self._error("No se puede cargar el catálogo", exc)
            self._actualizar_catalogos(self._seleccion_activa)
            return
        self.motor = nuevo
        self._seleccion_activa = seleccion
        self._ruta_escenario = None  # impedir sobrescribir un escenario bajo otro catálogo
        self._documento_escenario = None
        self._tipo_cargado = None
        self._sucio = True
        self._mostrar_catalogo()
        self._calcular_puntual()
        self._calcular_proyeccion()

    def _mostrar_catalogo(self) -> None:
        p = self.motor.precios
        vigencia = p.get("vigente_desde") or "No documentada"
        self.etiqueta_catalogo.setText(f"{self.motor.moneda} · {self.motor.catalogo_id}")
        self.descripcion_catalogo.setText(
            f"Catálogo: {self.motor.catalogo_id}  |  Reglas: {self.motor.reglas_id}\n"
            f"Vigencia desde: {vigencia}  |  Origen: {p.get('fuente', {}).get('nombre', 'No documentado')}"
        )
        lista = []
        for categoria, productos in p["productos"].items():
            for producto in productos if isinstance(productos, list) else [productos]:
                lista.append((categoria, producto))
        self.tabla_catalogo.setRowCount(len(lista))
        for fila, (categoria, producto) in enumerate(lista):
            valores = (CATEGORIAS[categoria], producto["sku"], producto.get("descripcion_excel", ""),
                       dinero(producto["precio_unitario_lista"], self.motor.moneda),
                       f"{Decimal(producto['descuento_fraccion_excel']) * 100:g}%",
                       producto["periodicidad"], producto.get("referencia_excel", {}).get("fila", ""))
            for col, valor in enumerate(valores):
                self.tabla_catalogo.setItem(fila, col, _item(valor, derecha=col in (3, 4, 6)))

    def _importar_catalogo(self) -> None:
        precios, _ = QFileDialog.getOpenFileName(self, "Seleccionar precios.json", "", "JSON (*.json)")
        if not precios:
            return
        reglas, _ = QFileDialog.getOpenFileName(self, "Seleccionar reglas.json", str(Path(precios).parent),
                                                  "JSON (*.json)")
        if not reglas:
            return
        try:
            nuevo = self.storage.importar_catalogo(precios, reglas)
        except (ErrorModelo, ErrorAlmacenamiento, OSError) as exc:
            self._error("No se pudo importar el catálogo", exc)
            return
        if not self._confirmar_descartar("activar el nuevo catálogo"):
            return
        self._motor_externo = nuevo  # exclusivamente RAM
        self.motor = nuevo
        self._seleccion_activa = ("externo", None)
        self._ruta_escenario = None
        self._documento_escenario = None
        self._tipo_cargado = None
        self._sucio = True
        self._actualizar_catalogos(self._seleccion_activa)
        self._calcular_puntual()
        self._calcular_proyeccion()
        self.estado.setText("Catálogo externo activo en esta sesión (no se ha guardado ninguna copia).")

    def _tipo_actual(self) -> str:
        return "proyeccion" if self.pestanas.currentIndex() == 1 else "puntual"

    def _datos_actuales(self):
        if self._tipo_actual() == "proyeccion":
            return (self.nombre_proyeccion.text(), self._entradas_proyeccion(),
                    self.factura_final.isChecked())
        return (self.nombre_puntual.text(), self._entradas_puntuales(), True)

    def _guardar_actual(self, *, como_nuevo: bool = False):
        """Escribe únicamente cuando el usuario elige Guardar/Guardar como."""
        if self.pestanas.currentIndex() == 2:
            self.pestanas.setCurrentIndex(self._ultima_pestana_costeo)
        self._timer_proyeccion.stop()
        if self._tipo_actual() == "proyeccion":
            self._calcular_proyeccion()
            if self._ultima_proyeccion is None:
                self._error("No se pudo guardar el escenario", ErrorModelo(self.aviso_proyeccion.text()))
                return None
        elif self._ultimo_mes is None:
            self._error("No se pudo guardar el escenario", ErrorModelo(self.aviso_puntual.text()))
            return None
        nombre, entradas, incluir_final = self._datos_actuales()
        tipo = self._tipo_actual()
        ruta = None if como_nuevo or self._tipo_cargado != tipo else self._ruta_escenario
        if ruta is None:
            seleccionado, _ = QFileDialog.getSaveFileName(
                self, "Guardar estimación", "estimacion_mssp.json", "Escenarios JSON (*.json)")
            if not seleccionado:
                return None
            ruta = Path(seleccionado)
            if ruta.suffix.lower() != ".json":
                ruta = ruta.with_suffix(".json")
        anterior = (self._documento_escenario if not como_nuevo and
                    self._tipo_cargado == tipo else None)
        try:
            guardado = self.storage.guardar_escenario(
                ruta, nombre, entradas, self.motor, incluir_factura_final=incluir_final,
                documento_anterior=anterior,
            )
        except (ErrorModelo, ErrorAlmacenamiento, OSError) as exc:
            self._error("No se pudo guardar el escenario", exc)
            return None
        self._ruta_escenario = ruta
        self._documento_escenario = guardado
        self._tipo_cargado = tipo
        self._sucio = False
        self.estado.setText(f"Escenario guardado en: {ruta}")
        return guardado

    def _confirmar_descartar(self, accion: str) -> bool:
        """Nunca guarda sin una elección expresa del usuario."""
        if not self._sucio:
            return True
        respuesta = QMessageBox.question(
            self, "Cambios sin guardar",
            f"Hay cambios no guardados. ¿Quieres guardarlos antes de {accion}?",
            QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard |
            QMessageBox.StandardButton.Cancel,
            QMessageBox.StandardButton.Cancel,
        )
        if respuesta == QMessageBox.StandardButton.Cancel:
            return False
        if respuesta == QMessageBox.StandardButton.Save:
            return self._guardar_actual() is not None
        return respuesta == QMessageBox.StandardButton.Discard

    def _abrir_escenario(self) -> None:
        ruta, _ = QFileDialog.getOpenFileName(
            self, "Abrir estimación", "", "Escenarios JSON (*.json)")
        if ruta:
            self._cargar_escenario(ruta)

    def _cargar_escenario(self, ruta: str | Path) -> None:
        """La ruta procede del selector de archivos (o se inyecta explícitamente)."""
        try:
            guardado = self.storage.cargar_escenario(ruta)
            motor = self.storage.motor_del_escenario(guardado)
        except (ErrorModelo, ErrorAlmacenamiento, OSError) as exc:
            self._error("No se pudo abrir el escenario", exc)
            return
        if not self._confirmar_descartar("abrir otro escenario"):
            return
        self._restaurando = True
        self._timer_proyeccion.stop()
        try:
            self.motor = motor
            self._motor_historico = motor
            self._seleccion_activa = ("historico", None)
            self._actualizar_catalogos(self._seleccion_activa)
            self._ruta_escenario = Path(ruta)
            self._documento_escenario = guardado
            self._tipo_cargado = guardado["tipo"]
            if guardado["tipo"] == "puntual":
                self.nombre_puntual.setText(guardado["nombre"])
                for campo in CAMPOS:
                    self.controles_puntuales[campo].setValue(guardado["entradas"][campo])
                self.pestanas.setCurrentIndex(0)
            else:
                self.nombre_proyeccion.setText(guardado["nombre"])
                valores = guardado["entradas"]
                self.meses.setValue(len(valores))
                self._generar_meses()
                for fila, entrada in enumerate(valores):
                    for col, campo in enumerate(CAMPOS, 1):
                        self.tabla_proyeccion.cellWidget(fila, col).setValue(entrada[campo])
                self.factura_final.setChecked(guardado["incluir_factura_final"])
                self.pestanas.setCurrentIndex(1)
        finally:
            self._restaurando = False
        self._calcular_puntual()
        self._calcular_proyeccion()
        self._sucio = False
        self.estado.setText(f"Escenario abierto desde {ruta}; catálogo original activo.")

    def _exportar_csv(self) -> None:
        """Exporta la sesión actual sin generar ni actualizar ningún escenario JSON."""
        if self.pestanas.currentIndex() == 2:
            self.pestanas.setCurrentIndex(self._ultima_pestana_costeo)
        self._timer_proyeccion.stop()
        if self._tipo_actual() == "proyeccion":
            self._calcular_proyeccion()
            if self._ultima_proyeccion is None:
                self._error("No se pudo exportar", ErrorModelo(self.aviso_proyeccion.text()))
                return
        elif self._ultimo_mes is None:
            self._error("No se pudo exportar", ErrorModelo(self.aviso_puntual.text()))
            return
        destino, _ = QFileDialog.getSaveFileName(
            self, "Exportar estimación", "estimacion_mssp.csv", "Archivos CSV (*.csv)")
        if not destino:
            return
        ruta = Path(destino)
        if ruta.suffix.lower() != ".csv":
            ruta = ruta.with_suffix(".csv")
        nombre, entradas, incluir_final = self._datos_actuales()
        try:
            self.storage.exportar_resumen_csv(
                ruta, nombre, entradas, self.motor, incluir_factura_final=incluir_final)
        except (ErrorModelo, ErrorAlmacenamiento, OSError) as exc:
            self._error("No se pudo exportar el CSV", exc)
            return
        self.estado.setText(f"CSV exportado en: {ruta} (escenario JSON no guardado).")

    def _cambio_pestana(self, indice: int) -> None:
        if self._restaurando:
            return
        if indice == 0:
            self._ultima_pestana_costeo = 0
            self._calcular_puntual()
        elif indice == 1:
            self._ultima_pestana_costeo = 1
            self._calcular_proyeccion()

    def closeEvent(self, evento) -> None:  # noqa: N802 - Qt
        if self._confirmar_descartar("cerrar la aplicación"):
            evento.accept()
        else:
            evento.ignore()

    def _error(self, titulo: str, exc: Exception) -> None:
        self.estado.setText(f"{titulo}: {exc}")
        QMessageBox.warning(self, titulo, str(exc))


def ejecutar() -> int:
    app = QApplication.instance() or QApplication(sys.argv)
    try:
        ventana = VentanaPrincipal()
    except (ErrorModelo, ErrorAlmacenamiento, OSError) as exc:
        QMessageBox.critical(None, "Error al iniciar FortiSIEM MSSP", str(exc))
        return 1
    ventana.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(ejecutar())
