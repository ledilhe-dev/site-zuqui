"""Verifica integridade da versão modular contra o backup monolítico."""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
import json
from pathlib import Path

from split_monolith import BACKUP, CSS_DIR, INDEX, JS_DIR, split_main_script


def normalized_asset(content: str) -> str:
    return content.strip("\n") + "\n"


def fail(message: str) -> None:
    print(f"ERRO: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not BACKUP.exists():
        fail(f"Backup não encontrado: {BACKUP}")

    original = BACKUP.read_text(encoding="utf-8")
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
        path = INDEX.parent / ref.removeprefix("./")
        if not path.is_file():
            fail(f"Referência inexistente no HTML: {ref}")

    # Retira scripts antes de procurar estilos: há tags <style> legítimas dentro
    # de templates JavaScript para impressão e janelas auxiliares.
    original_without_scripts = re.sub(
        r"<script([^>]*)>(.*?)</script>",
        "",
        original,
        flags=re.DOTALL | re.IGNORECASE,
    )
    original_styles = re.findall(
        r"<style([^>]*)>(.*?)</style>",
        original_without_scripts,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if len(original_styles) != len(css_refs):
        fail(f"Quantidade CSS divergiu: original={len(original_styles)}, modular={len(css_refs)}")
    for index, ((_, body), ref) in enumerate(zip(original_styles, css_refs, strict=True)):
        extracted = (INDEX.parent / ref.removeprefix("./")).read_text(encoding="utf-8")
        if extracted != normalized_asset(body):
            fail(f"Conteúdo CSS divergente no bloco {index}: {ref}")

    original_inline_scripts = []
    for match in re.finditer(r"<script([^>]*)>(.*?)</script>", original, re.DOTALL | re.IGNORECASE):
        if not re.search(r"\bsrc\s*=", match.group(1), re.IGNORECASE):
            original_inline_scripts.append(match.group(2))

    expected_scripts: list[str] = []
    for body in original_inline_scripts:
        if len(body) > 500_000:
            expected_scripts.extend(content for _, content in split_main_script(body))
        else:
            expected_scripts.append(body)
    if len(expected_scripts) != len(js_refs):
        fail(f"Quantidade JS divergiu: esperado={len(expected_scripts)}, modular={len(js_refs)}")
    for index, (body, ref) in enumerate(zip(expected_scripts, js_refs, strict=True)):
        extracted = (INDEX.parent / ref.removeprefix("./")).read_text(encoding="utf-8")
        if extracted != normalized_asset(body):
            fail(f"Conteúdo JavaScript divergente no bloco {index}: {ref}")

    # O HTML de interface deve permanecer idêntico. Remove apenas código e
    # folhas de estilo das duas versões e compara toda a marcação restante.
    original_markup = re.sub(r"<script([^>]*)>(.*?)</script>", "", original, flags=re.DOTALL | re.IGNORECASE)
    original_markup = re.sub(r"<style([^>]*)>(.*?)</style>", "", original_markup, flags=re.DOTALL | re.IGNORECASE)
    modular_markup = re.sub(r"<script([^>]*)>(.*?)</script>", "", modular, flags=re.DOTALL | re.IGNORECASE)
    modular_markup = re.sub(r'<link(?:\s+id="[^"]+")?\s+rel="stylesheet"\s+href="\./assets/css/[^"]+">', "", modular_markup, flags=re.IGNORECASE)
    # Scripts externos preexistentes (Supabase e config.js) existem nas duas
    # versões; após a remoção geral, só diferenças reais de HTML permanecem.
    canonical = lambda value: re.sub(r"\s+", " ", value).strip()
    if canonical(original_markup) != canonical(modular_markup):
        fail("A marcação HTML da interface divergiu do backup original")

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

    orphan_css = sorted(path.name for path in CSS_DIR.glob("*.css") if f"./assets/css/{path.name}" not in css_refs)
    orphan_js = sorted(path.name for path in JS_DIR.glob("*.js") if f"./assets/js/{path.name}" not in js_refs)
    if orphan_css or orphan_js:
        fail(f"Arquivos órfãos: CSS={orphan_css}, JS={orphan_js}")

    manifest_path = INDEX.parent / "assets" / "manifest.json"
    if not manifest_path.is_file():
        fail("Manifesto de módulos não encontrado")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected_manifest = sorted(css_refs) + sorted(js_refs)
    if manifest != expected_manifest:
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
