"""Verifica referências, sintaxe e manifesto da versão modular atual."""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
import json
from pathlib import Path

from split_monolith import CSS_DIR, INDEX, JS_DIR


def fail(message: str) -> None:
    print(f"ERRO: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    modular = INDEX.read_text(encoding="utf-8")

    inline_styles = re.findall(r"<style(?:\s[^>]*)?>", modular, re.IGNORECASE)
    inline_scripts = [
        match.group(0)
        for match in re.finditer(r"<script([^>]*)>", modular, re.IGNORECASE)
        if not re.search(r"\bsrc\s*=", match.group(1), re.IGNORECASE)
    ]
    if inline_styles or inline_scripts:
        fail(f"Ainda existem blocos inline: {len(inline_styles)} style, {len(inline_scripts)} script")

    css_refs = re.findall(r'href="(\./assets/css/[^"]+)"', modular)
    js_refs = re.findall(r'src="(\./assets/js/[^"]+)"', modular)
    for ref in css_refs + js_refs:
        path = INDEX.parent / ref.split("?", 1)[0].removeprefix("./")
        if not path.is_file():
            fail(f"Referência inexistente no HTML: {ref}")

    syntax_failures: list[str] = []
    with tempfile.TemporaryDirectory(prefix="checkdiario-js-") as temp_dir:
        for path in sorted(JS_DIR.glob("*.js")):
            result = subprocess.run(
                ["node", "--check", str(path)],
                capture_output=True,
                text=True,
                cwd=INDEX.parent,
            )
            if result.returncode:
                syntax_failures.append(f"{path.name}: {result.stderr.strip()}")
    if syntax_failures:
        fail("Falhas de sintaxe:\n" + "\n".join(syntax_failures))

    normalized_css_refs = {ref.split("?", 1)[0] for ref in css_refs}
    normalized_js_refs = {ref.split("?", 1)[0] for ref in js_refs}
    orphan_css = sorted(path.name for path in CSS_DIR.glob("*.css") if f"./assets/css/{path.name}" not in normalized_css_refs)
    orphan_js = sorted(path.name for path in JS_DIR.glob("*.js") if f"./assets/js/{path.name}" not in normalized_js_refs)
    if orphan_css or orphan_js:
        fail(f"Arquivos órfãos: CSS={orphan_css}, JS={orphan_js}")

    manifest_path = INDEX.parent / "assets" / "manifest.json"
    if not manifest_path.is_file():
        fail("Manifesto de módulos não encontrado")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected_manifest = sorted(normalized_css_refs) + sorted(normalized_js_refs)
    if len(manifest) != len(expected_manifest) or set(manifest) != set(expected_manifest):
        fail("O manifesto de módulos não corresponde às referências do index.html")

    worker_result = subprocess.run(
        ["node", "--check", str(INDEX.parent / "service-worker-v4.js")],
        capture_output=True,
        text=True,
        cwd=INDEX.parent,
    )
    if worker_result.returncode:
        fail("Service worker inválido: " + worker_result.stderr.strip())

    print("OK: modularização íntegra")
    print(f"  CSS: {len(css_refs)} arquivos")
    print(f"  JavaScript: {len(js_refs)} arquivos")
    print(f"  index.html: {len(modular.encode('utf-8'))} bytes")


if __name__ == "__main__":
    main()
