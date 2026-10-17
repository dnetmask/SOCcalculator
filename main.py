"""Punto de entrada de la calculadora FortiSIEM MSSP (PySide6)."""
import sys

# Evita que la ejecución normal genere __pycache__ en la carpeta del proyecto.
sys.dont_write_bytecode = True

from ui import ejecutar

if __name__ == "__main__":
    raise SystemExit(ejecutar())
