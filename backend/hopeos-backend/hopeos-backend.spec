# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for HopeOS Backend with AI (llama_cpp)

import os
import glob
import site
from pathlib import Path

block_cipher = None

# Find llama_cpp native shared library
def find_llama_lib():
    """Find libllama.so from llama_cpp package."""
    binaries = []

    # Search in common locations
    search_paths = [
        # Virtual environment site-packages
        '.venv/lib/python*/site-packages/llama_cpp',
        # System site-packages
        *[os.path.join(p, 'llama_cpp') for p in site.getsitepackages()],
        # User site-packages
        os.path.join(site.getusersitepackages(), 'llama_cpp') if site.getusersitepackages() else None,
    ]

    for pattern in search_paths:
        if pattern is None:
            continue
        matches = glob.glob(pattern)
        for match in matches:
            # Look for .so files in llama_cpp directory
            for so_file in glob.glob(os.path.join(match, '*.so*')):
                print(f"Found llama_cpp library: {so_file}")
                # Bundle into llama_cpp/ directory to match import path
                binaries.append((so_file, 'llama_cpp'))
            # Also check lib subdirectory
            for so_file in glob.glob(os.path.join(match, 'lib', '*.so*')):
                print(f"Found llama_cpp library: {so_file}")
                binaries.append((so_file, 'llama_cpp/lib'))

    # Also try to find via importlib
    try:
        import llama_cpp
        llama_cpp_path = Path(llama_cpp.__file__).parent
        for so_file in llama_cpp_path.glob('*.so*'):
            print(f"Found llama_cpp library via import: {so_file}")
            binaries.append((str(so_file), 'llama_cpp'))
        for so_file in llama_cpp_path.glob('lib/*.so*'):
            print(f"Found llama_cpp library via import: {so_file}")
            binaries.append((str(so_file), 'llama_cpp/lib'))
    except ImportError:
        print("Warning: llama_cpp not importable, searching file system only")

    return binaries

llama_binaries = find_llama_lib()

# Exclude large unused ML packages
excludes = [
    'torch',
    'torchvision',
    'torchaudio',
    'transformers',
    'tensorflow',
    'keras',
    'numpy.testing',
    'matplotlib',
    'PIL',
    'cv2',
    'scipy',
    'pandas',
    'sklearn',
]

hiddenimports = [
    # FastAPI and Starlette
    'fastapi',
    'fastapi.applications',
    'fastapi.routing',
    'fastapi.middleware',
    'fastapi.middleware.cors',
    'fastapi.responses',
    'fastapi.staticfiles',
    'starlette',
    'starlette.applications',
    'starlette.routing',
    'starlette.middleware',
    'starlette.responses',
    'starlette.requests',
    'starlette.websockets',
    'starlette.status',
    # Pydantic
    'pydantic',
    'pydantic.fields',
    'pydantic_settings',
    'pydantic_core',
    # Uvicorn
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.loops.uvloop',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.http.httptools_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.protocols.websockets.websockets_impl',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    # Database
    'sqlalchemy',
    'sqlalchemy.dialects.sqlite',
    'sqlalchemy.ext.asyncio',
    'aiosqlite',
    'greenlet',
    # Other deps
    'email_validator',
    'multipart',
    'python_multipart',
    'jose',
    'jose.jwt',
    'jose.jws',
    'jose.jwk',
    'jose.exceptions',
    'jose.constants',
    'jose.backends',
    'jose.backends.native',
    'jose.backends.cryptography_backend',
    'python_jose',
    'passlib',
    'passlib.hash',
    'passlib.context',
    'bcrypt',
    'cryptography',
    'cryptography.hazmat',
    'cryptography.hazmat.primitives',
    'cryptography.hazmat.backends',
    'httpx',
    'anyio',
    'sniffio',
    'h11',
    'httptools',
    'uvloop',
    'watchfiles',
    'websockets',
    'typing_extensions',
    'annotated_types',
    # AI/LLM
    'llama_cpp',
    'llama_cpp.llama',
    'llama_cpp.llama_cpp',
    'llama_cpp.llama_types',
    'huggingface_hub',
    'numpy',
    'diskcache',
]

a = Analysis(
    ['run_server.py'],
    pathex=[],
    binaries=llama_binaries,
    datas=[
        ('app', 'app'),
    ],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='hopeos-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
