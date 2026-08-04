"""Divide o index.html monolítico em CSS e JavaScript externos.

O script preserva a ordem original dos blocos e só separa o script principal
em fronteiras de seção que já existem no código-fonte. Execute na raiz:

    python tools/split_monolith.py
"""

from __future__ import annotations

import re
import shutil
import unicodedata
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
ASSETS = ROOT / "assets"
CSS_DIR = ASSETS / "css"
JS_DIR = ASSETS / "js"
BACKUP = ROOT / "backup" / "codigo-antigo" / "index.monolith.backup.html"


MAIN_SECTIONS = [
    ("// ---- SUPABASE CLIENT ----", "01-core-supabase.js"),
    ("// ---- CONTROLE DE VERSAO / FORCAR ATUALIZACAO ----", "02-core-version.js"),
    ("// ---- STATE ----", "03-core-state.js"),
    ("// ---- NAVIGATION ----", "04-navigation.js"),
    ("// ---- HELPERS ----", "05-shared-helpers.js"),
    ("// DASHBOARD", "10-dashboard.js"),
    ("// CHECKLISTS", "20-checklists.js"),
    ("// FUNCIONÁRIOS", "21-employees.js"),
    ("// SOLICITACOES DE ACESSO", "22-access-requests.js"),
    ("// DESTINATARIOS DE E-MAIL", "23-email.js"),
    ("// FINANCEIRO", "30-finance.js"),
    ("// TELA PREFERIDA DE LOGIN", "40-login-preferences.js"),
    ("// CALENDÁRIO FINANCEIRO DO COFRE", "41-finance-vault-calendar.js"),
    ("// CONFIGURACOES DA LOJA", "42-store-settings.js"),
    ("// ADMINISTRAÇÃO SAAS - EMPRESAS E LOJAS", "43-saas-admin.js"),
    ("// PERFIS", "44-profiles.js"),
    ("// TAREFAS", "50-tasks.js"),
    ("// TAREFAS RÁPIDAS", "51-quick-alerts.js"),
    ("// MULTI-LOJA SEGURO PARA PONTO / AJUSTES", "60-timeclock.js"),
    ("// RELATÓRIO DE TAREFAS CADASTRADAS", "70-reports.js"),
    ("// EXECU-!", "71-executions.js"),
    ("// ---- INIT ----", "78-init.js"),
]


CSS_NAMES = {
    "design-enhancement-v2": "10-design-enhancements.css",
    "topbar-admin-panel-indicator": "11-topbar-admin.css",
    "obsidian-precision-design-system-v3": "12-design-system.css",
    "escala-plantoes-layout-fix": "20-schedule.css",
}


SCRIPT_NAMES = {
    "configurar-mascara-cep-loja": "00-cep-mask.js",
    "patch-calendario-real-zuqui-script": "80-calendar-patch.js",
    "patch-escala-modal-final-seguro-script": "81-schedule-modal-patch.js",
    "patch-escala-total-pago-plantao": "82-schedule-total-patch.js",
    "patch-escala-somente-adm-gerencia": "83-schedule-access-patch.js",
    "patch-relatorio-escala-administrador-final": "84-schedule-report-patch.js",
    "patch-feriados-loja-auto-zuqui": "85-holidays-auto-patch.js",
    "patch-botao-atualizar-feriados-loja-atual": "86-holidays-button-patch.js",
    "patch-feriados-definitivo-por-loja": "87-holidays-store-patch.js",
    "bloqueio-gerenciador-senhas": "88-password-manager-guard.js",
    "patch-ponto-atualizar-primeiro-clique": "89-timeclock-refresh-patch.js",
    "limpar-url-sensivel-passivo": "90-sensitive-url-cleanup.js",
    "patch-ponto-info-botao-3-1-57": "91-timeclock-info-patch.js",
    "patch-ponto-info-no-titulo-script": "92-timeclock-title-patch.js",
    "nc-sheet-js": "31-payable-sheet.js",
    "nr-sheet-js": "32-receivable-sheet.js",
}


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-") or "block"


def write_asset(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip("\n") + "\n", encoding="utf-8", newline="\n")


def split_main_script(body: str) -> list[tuple[str, str]]:
    boundaries: list[tuple[int, str]] = []
    for marker, filename in MAIN_SECTIONS:
        pos = body.find(marker)
        if pos < 0:
            if marker == "// EXECU-!":
                match = re.search(r"^// EXECU.*$", body, re.MULTILINE)
                pos = match.start() if match else -1
            if pos < 0:
                raise RuntimeError(f"Marcador do script principal não encontrado: {marker}")
        boundaries.append((pos, filename))
    if boundaries != sorted(boundaries):
        raise RuntimeError("Marcadores do script principal estão fora de ordem")

    result: list[tuple[str, str]] = []
    prefix = body[: boundaries[0][0]]
    if prefix.strip():
        result.append(("00-bootstrap.js", prefix))
    for idx, (start, filename) in enumerate(boundaries):
        end = boundaries[idx + 1][0] if idx + 1 < len(boundaries) else len(body)
        result.append((filename, body[start:end]))
    return result


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    if 'src="./assets/js/01-core-supabase.js"' in html:
        if not BACKUP.exists():
            raise RuntimeError("O index.html já está modularizado e o backup original não existe")
        html = BACKUP.read_text(encoding="utf-8")
    if not BACKUP.exists():
        BACKUP.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(INDEX, BACKUP)

    for directory in (CSS_DIR, JS_DIR):
        if directory.exists():
            for child in directory.iterdir():
                if child.is_file():
                    child.unlink()
                elif child.is_dir():
                    shutil.rmtree(child)
        directory.mkdir(parents=True, exist_ok=True)

    # Protege scripts inteiros antes de procurar CSS. O sistema contém templates
    # JavaScript com tags <style>; elas pertencem ao script e não podem ser
    # confundidas com folhas de estilo reais do documento.
    protected_scripts: list[str] = []

    def protect_script(match: re.Match[str]) -> str:
        token = f"___CHECKDIARIO_SCRIPT_{len(protected_scripts)}___"
        protected_scripts.append(match.group(0))
        return token

    html = re.sub(r"<script([^>]*)>(.*?)</script>", protect_script, html, flags=re.DOTALL | re.IGNORECASE)

    style_counter = 0

    def replace_style(match: re.Match[str]) -> str:
        nonlocal style_counter
        attrs, body = match.group(1), match.group(2)
        id_match = re.search(r'\bid=["\']([^"\']+)', attrs)
        element_id = id_match.group(1) if id_match else ""
        if style_counter == 0:
            filename = "00-base.css"
        elif element_id in CSS_NAMES:
            filename = CSS_NAMES[element_id]
        else:
            filename = f"{90 + style_counter:02d}-{slug(element_id or f'patch-{style_counter}')}.css"
        style_counter += 1
        write_asset(CSS_DIR / filename, body)
        id_attr = f' id="{element_id}"' if element_id else ""
        return f'<link{id_attr} rel="stylesheet" href="./assets/css/{filename}">'

    html = re.sub(r"<style([^>]*)>(.*?)</style>", replace_style, html, flags=re.DOTALL | re.IGNORECASE)

    for index, script_html in enumerate(protected_scripts):
        html = html.replace(f"___CHECKDIARIO_SCRIPT_{index}___", script_html, 1)

    inline_index = 0

    def replace_script(match: re.Match[str]) -> str:
        nonlocal inline_index
        attrs, body = match.group(1), match.group(2)
        if re.search(r"\bsrc\s*=", attrs, re.IGNORECASE):
            return match.group(0)
        id_match = re.search(r'\bid=["\']([^"\']+)', attrs)
        element_id = id_match.group(1) if id_match else ""

        if len(body) > 500_000:
            parts = split_main_script(body)
            tags = []
            for filename, content in parts:
                write_asset(JS_DIR / filename, content)
                tags.append(f'<script src="./assets/js/{filename}"></script>')
            inline_index += 1
            return "\n".join(tags)

        if element_id:
            filename = SCRIPT_NAMES.get(element_id, f"95-{slug(element_id)}.js")
        elif inline_index == 2:
            filename = "79-runtime-extensions.js"
        else:
            filename = f"{96 + inline_index:02d}-inline.js"
        inline_index += 1
        write_asset(JS_DIR / filename, body)
        id_attr = f' id="{element_id}"' if element_id else ""
        return f'<script{id_attr} src="./assets/js/{filename}"></script>'

    html = re.sub(r"<script([^>]*)>(.*?)</script>", replace_script, html, flags=re.DOTALL | re.IGNORECASE)
    INDEX.write_text(html, encoding="utf-8", newline="\n")

    css_files = list(CSS_DIR.glob("*.css"))
    js_files = list(JS_DIR.glob("*.js"))
    manifest = [
        *(f"./assets/css/{path.name}" for path in sorted(css_files)),
        *(f"./assets/js/{path.name}" for path in sorted(js_files)),
    ]
    (ASSETS / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Modularização concluída: {len(css_files)} CSS, {len(js_files)} JavaScript")
    print(f"Backup: {BACKUP.name}")


if __name__ == "__main__":
    main()
