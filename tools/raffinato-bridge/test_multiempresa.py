import importlib.util
import http.client
import json
import tempfile
import threading
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch


SOURCE = Path(__file__).with_name("raffinato_bridge.py")
SPEC = importlib.util.spec_from_file_location("raffinato_bridge_test", SOURCE)
bridge = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bridge)


class MultiempresaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.patchers = [
            patch.object(bridge, "PROFILE_CONFIG_PATH", root / "perfis.dat"),
            patch.object(bridge, "STORE_CONFIG_PATH", root / "integracoes.dat"),
            patch.object(bridge, "BACKUP_DIR", root / "backup"),
            patch.object(bridge, "protect_bytes", lambda value: value),
            patch.object(bridge, "unprotect_bytes", lambda value: value),
        ]
        for item in self.patchers:
            item.start()

    def tearDown(self):
        for item in reversed(self.patchers):
            item.stop()
        self.temp.cleanup()

    def test_master_hash_rejects_invalid_password(self):
        state = bridge.load_profile_state()
        self.assertFalse(bridge.verify_master_password("senha-errada", state))

    def test_profile_mapping_is_independent_from_raffinato_id(self):
        state = bridge.load_profile_state()
        profile_id = "97aa20f3-f874-47fb-b0d9-dc81db8b867f"
        store_id = "3ebc1a0e-327f-4a86-bcf4-9189161cbf7a"
        state["profiles"][profile_id] = {"id": profile_id, "name": "Matriz", "server": "sql", "database": "db", "uid": "u", "pwd": "p", "active": True}
        state["mappings"][store_id] = {"checkdiario_filial_id": store_id, "connection_profile_id": profile_id, "raffinato_filial_id": 5, "active": True}
        bridge.save_profile_state(state)
        resolved = bridge.mapped_config(store_id)
        self.assertEqual(resolved["id_filial"], 5)
        self.assertNotEqual(store_id, str(resolved["id_filial"]))

    def test_background_sync_uses_mapping_instead_of_stale_legacy_filial(self):
        store_id = "gustare-delivery"
        profile_id = "gustare-sql"
        bridge.save_store_configs({store_id: {
            "server":"old-server", "database":"old-db", "uid":"old", "pwd":"old",
            "id_filial":1, "empresa_id":"gustare-company", "relay_token":"legacy-token",
        }})
        state = bridge.load_profile_state()
        state["paired_empresa_id"] = "gustare-company"
        state["connector_credential"] = "installation-token"
        state["profiles"][profile_id] = {
            "id":profile_id, "active":True, "server":"current-server", "database":"current-db",
            "uid":"current", "pwd":"current-secret",
        }
        state["mappings"][store_id] = {
            "checkdiario_empresa_id":"gustare-company", "checkdiario_filial_id":store_id,
            "connection_profile_id":profile_id, "raffinato_filial_id":2, "active":True,
        }
        bridge.save_profile_state(state)

        config = bridge.load_mapped_store_configs()[store_id]

        self.assertEqual(config["id_filial"], 2)
        self.assertEqual(config["server"], "current-server")
        self.assertEqual(config["relay_token"], "installation-token")
        self.assertEqual(config["empresa_id"], "gustare-company")
        self.assertEqual(config["connection_profile_id"], profile_id)

    def test_two_stores_keep_distinct_profiles_and_filiais(self):
        state = bridge.load_profile_state()
        state["paired_empresa_id"] = "gustare-company"
        state["connector_credential"] = "installation-token"
        for suffix, filial in (("salao", 1), ("delivery", 2)):
            profile_id = f"profile-{suffix}"
            store_id = f"store-{suffix}"
            state["profiles"][profile_id] = {"id":profile_id,"active":True,"server":"sql","database":"gustare","uid":"u","pwd":"p"}
            state["mappings"][store_id] = {"checkdiario_empresa_id":"gustare-company","connection_profile_id":profile_id,"raffinato_filial_id":filial,"active":True}
        bridge.save_profile_state(state)
        configs = bridge.load_mapped_store_configs()
        self.assertEqual((configs["store-salao"]["connection_profile_id"], configs["store-salao"]["id_filial"]), ("profile-salao", 1))
        self.assertEqual((configs["store-delivery"]["connection_profile_id"], configs["store-delivery"]["id_filial"]), ("profile-delivery", 2))

    def test_sync_failure_in_one_dataset_does_not_block_other_datasets(self):
        sent = []
        config = {"_store_id":"store-salao","id_filial":1,"connection_profile_id":"profile-salao","relay_token":"token",
                  "server":"sql","database":"gustare","uid":"u","pwd":"p","driver":"{ODBC Driver 17 for SQL Server}"}
        def relay(payload, timeout=30):
            sent.append(payload["action"]); return {"ok":True}
        class Cursor:
            description = True
            def execute(self, *args): return None
            def fetchall(self): return []
            def nextset(self): return False
        class Connection:
            timeout = 0
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def cursor(self): return Cursor()
        with patch.object(bridge,"query_sangrias",side_effect=RuntimeError("falha isolada")), \
             patch.object(bridge,"query_faturamento_diario",return_value=[]), \
             patch.object(bridge,"query_deliveries_abertos",return_value=[]), \
             patch.object(bridge,"query_curva_abc_sync",return_value=[]), \
             patch.object(bridge,"query_mandatory_v2_rows",return_value=[]), \
             patch.object(bridge,"sync_pizza_mandatory_v1",side_effect=lambda *args: sent.append("pizza_mandatory_sync_v1")), \
             patch.object(bridge,"rows_as_dicts",return_value=[]), \
             patch.object(bridge.pyodbc,"connect",return_value=Connection()), \
             patch.object(bridge,"relay_post",side_effect=relay):
            bridge.sync_period(config,datetime(2026,8,1),datetime(2026,8,2,23,59,59))
        self.assertIn("pizza_mandatory_sync_v1",sent)
        self.assertIn("products_sync",sent)
        self.assertIn("canonical_sync",sent)
        self.assertNotIn("sync",sent)

    def test_background_sync_does_not_fallback_to_unmapped_legacy_store(self):
        bridge.save_store_configs({"legacy-only": {
            "server":"sql", "database":"db", "uid":"u", "pwd":"p", "id_filial":1,
        }})
        self.assertEqual(bridge.load_mapped_store_configs(), {})

    def test_mandatory_v2_sql_uses_parent_group_and_real_required_rows(self):
        sql = bridge.SQL_MANDATORY_V2
        self.assertIn("PP.IdAgrupamento", sql)
        self.assertIn("VI.IdTipoRegistro=3", sql)
        self.assertIn("VI.IdAgrupamentoItemObrigatorio IS NOT NULL", sql)
        self.assertIn("PAI.Id=VI.IdItemPai", sql)
        self.assertNotIn("IdFilial=1", sql)

    def test_gustare_filial_two_metadata_fixture_has_44_groups(self):
        groups = [{"id": value, "nome": f"Grupo {value}"} for value in range(1, 45)]
        self.assertEqual(len(groups), 44)
        self.assertEqual(bridge.resolve_raffinato_filial({"id_filial": 2}, {"id_filial": 1}), 2)

    def test_legacy_migration_backs_up_and_preserves_values(self):
        legacy = {"server": "srv\\sql", "database": "Raffinato", "uid": "user", "pwd": "secret", "id_filial": 1}
        bridge.save_store_configs({"zuqui-store":legacy})
        bridge.migrate_legacy_configuration()
        state = bridge.load_profile_state()
        profile = next(iter(state["profiles"].values()))
        self.assertEqual(profile["server"], legacy["server"])
        self.assertEqual(profile["pwd"], legacy["pwd"])
        self.assertTrue((bridge.BACKUP_DIR / "integracoes.dat.pre-1.7.0.bak").exists())

    def test_source_has_no_credentials_json_or_fixed_parent_lookup(self):
        source = SOURCE.read_text(encoding="utf-8")
        self.assertNotIn("credentials.json", source)
        self.assertNotIn("parents[", source)

    def test_clean_install_has_stable_identity_and_no_zuqui_fallback(self):
        bridge.migrate_legacy_configuration()
        first = bridge.load_profile_state()["connector_instance_id"]
        second = bridge.load_profile_state()["connector_instance_id"]
        self.assertEqual(first, second)
        self.assertFalse(bridge.connector_is_paired())
        with self.assertRaisesRegex(PermissionError, "nao esta vinculada"):
            bridge.get_store_config("gustare-store")

    def test_tenant_mismatch_is_blocked_before_sql(self):
        state = bridge.load_profile_state()
        state["paired_empresa_id"] = "gustare-company"
        state["profiles"]["profile"] = {"id":"profile", "active":True, "server":"sql", "database":"db", "uid":"u", "pwd":"p"}
        state["mappings"]["gustare-store"] = {"connection_profile_id":"profile", "raffinato_filial_id":2, "active":True}
        bridge.save_profile_state(state)
        with self.assertRaisesRegex(PermissionError, "nao esta vinculada"):
            bridge.validate_request_tenant({"empresa_id":"patrick-company"}, "gustare-store")
        with self.assertRaisesRegex(PermissionError, "nao esta vinculada"):
            bridge.validate_request_tenant({"empresa_id":"gustare-company"}, "patrick-store")
        bridge.validate_request_tenant({"empresa_id":"gustare-company"}, "gustare-store")

    def test_request_cannot_override_mapped_filial(self):
        config = {"id_filial":2}
        self.assertEqual(bridge.resolve_raffinato_filial(config, {"id_filial":1}), 2)

    def test_instance_credential_is_dpapi_state_not_sql_profile(self):
        bridge.migrate_legacy_configuration()
        state = bridge.load_profile_state()
        state["paired_empresa_id"] = "gustare-company"
        state["connector_credential"] = "installation-secret"
        bridge.save_profile_state(state)
        loaded = bridge.load_profile_state()
        self.assertTrue(bridge.connector_is_paired())
        self.assertEqual(loaded["connector_credential"], "installation-secret")
        self.assertNotIn("connector_credential", loaded["profiles"])

    def test_local_pairing_origins_are_explicitly_allowed(self):
        self.assertEqual(bridge.HOST, "127.0.0.1")
        self.assertIn("http://127.0.0.1:8766", bridge.DEFAULT_ALLOWED_ORIGINS)
        self.assertIn("http://localhost:8766", bridge.DEFAULT_ALLOWED_ORIGINS)
        self.assertNotIn("*", bridge.DEFAULT_ALLOWED_ORIGINS)

    def test_local_ui_origin_reaches_router_instead_of_cors_rejection(self):
        server = bridge.ThreadingHTTPServer(("127.0.0.1", 0), bridge.Handler)
        server.config = {"allowed_origins": bridge.DEFAULT_ALLOWED_ORIGINS}
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=3)
            connection.request("POST", "/rota-inexistente", "{}", {
                "Content-Type":"application/json", "Origin":"http://127.0.0.1:8766",
            })
            response = connection.getresponse()
            self.assertEqual(response.status, 404)
            self.assertEqual(response.getheader("Access-Control-Allow-Origin"), "http://127.0.0.1:8766")
            connection.close()
        finally:
            server.shutdown(); server.server_close(); worker.join(timeout=3)

    def test_local_pairing_request_persists_identity_and_starts_paired(self):
        bridge.migrate_legacy_configuration()
        server = bridge.ThreadingHTTPServer(("127.0.0.1", 0), bridge.Handler)
        server.config = {"allowed_origins": bridge.DEFAULT_ALLOWED_ORIGINS}
        worker = threading.Thread(target=server.serve_forever, daemon=True); worker.start()
        try:
            with patch.object(bridge, "relay_post", return_value={"empresa_id":"zuqui-id", "empresa_nome":"ZUQUI LTDA"}):
                connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=3)
                payload = json.dumps({"code":"ZUQ-TEST-0001"})
                connection.request("POST", "/api/connector/pair", payload, {
                    "Content-Type":"application/json", "Origin":"http://127.0.0.1:8766",
                })
                response = connection.getresponse(); body = json.loads(response.read())
                self.assertEqual(response.status, 200); self.assertTrue(body["ok"])
                state = bridge.load_profile_state()
                self.assertEqual(state["paired_empresa_nome"], "ZUQUI LTDA")
                self.assertGreaterEqual(len(state["connector_credential"]), 40)
                self.assertTrue(bridge.connector_is_paired())
                connection.close()
        finally:
            server.shutdown(); server.server_close(); worker.join(timeout=3)


if __name__ == "__main__":
    unittest.main()
