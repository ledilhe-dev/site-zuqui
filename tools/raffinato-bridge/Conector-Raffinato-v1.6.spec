# -*- mode: python ; coding: utf-8 -*-

a = Analysis(
    ['raffinato_bridge.py'],
    pathex=[], binaries=[],
    # O despachante do cardápio precisa estar dentro do executável. Sem este
    # arquivo o conector principal fica online, mas nunca consulta a fila.
    datas=[('../../../cardapio-digital/tools/raffinato-catalog-sync/catalog_sync.py', '.')],
    hiddenimports=['pystray', 'pystray._win32', 'PIL.Image', 'PIL.ImageDraw'], hookspath=[],
    hooksconfig={}, runtime_hooks=[], excludes=[], noarchive=False, optimize=0,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, a.binaries, a.datas, [],
    name='Conector-Raffinato-v2.0.23', debug=False, bootloader_ignore_signals=False,
    strip=False, upx=True, upx_exclude=[], runtime_tmpdir=None, console=False,
    disable_windowed_traceback=False, argv_emulation=False, target_arch=None,
    icon='connector.ico', codesign_identity=None, entitlements_file=None,
)
