import importlib.util
import json
import tempfile
import unittest
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
            patch.object(bridge, "CONFIG_PATH", root / "credentials.json"),
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

    def test_legacy_migration_backs_up_and_preserves_values(self):
        legacy = {"server": "srv\\sql", "database": "Raffinato", "uid": "user", "pwd": "secret", "id_filial": 1}
        bridge.CONFIG_PATH.write_text(json.dumps(legacy), encoding="utf-8")
        bridge.migrate_legacy_configuration()
        state = bridge.load_profile_state()
        profile = next(iter(state["profiles"].values()))
        self.assertEqual(profile["server"], legacy["server"])
        self.assertEqual(profile["pwd"], legacy["pwd"])
        self.assertTrue((bridge.BACKUP_DIR / "credentials.json.pre-1.7.0.bak").exists())

    def test_clean_install_has_stable_identity_and_no_zuqui_fallback(self):
        bridge.migrate_legacy_configuration()
        first = bridge.load_profile_state()["connector_instance_id"]
        second = bridge.load_profile_state()["connector_instance_id"]
        self.assertEqual(first, second)
        self.assertFalse(bridge.connector_is_paired())
        with self.assertRaisesRegex(RuntimeError, "Nenhum perfil Raffinato configurado"):
            bridge.get_store_config("gustare-store")

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


if __name__ == "__main__":
    unittest.main()
