import importlib.util
import json
import unittest
from pathlib import Path
from unittest.mock import patch

SOURCE = Path(__file__).with_name("raffinato_bridge.py")
SPEC = importlib.util.spec_from_file_location("raffinato_bridge_api_test", SOURCE)
bridge = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bridge)

class Response:
    status = 200
    def __init__(self, payload): self.payload = json.dumps(payload).encode()
    def __enter__(self): return self
    def __exit__(self, *_args): return False
    def read(self): return self.payload

class RaffinatoApiTests(unittest.TestCase):
    def test_secret_is_header_only(self):
        captured = {}
        def open_request(request, timeout):
            captured.update(auth=request.get_header("Authorization"), identifier=request.get_header("Identifier"), url=request.full_url)
            return Response({"result":["1.2.3"]})
        client=bridge.RaffinatoApiClient({"raffinato_api_url":"http://127.0.0.1:10060/raffinato/api",
            "raffinato_api_auth":"Basic token-secreto","raffinato_api_identifier":"uuid"})
        with patch.object(bridge.urllib.request,"urlopen",open_request): client.get("integracao/versaosistema")
        self.assertEqual(captured["auth"],"Basic token-secreto"); self.assertEqual(captured["identifier"],"uuid")
        self.assertNotIn("token-secreto",captured["url"])

    def test_bad_basic_rejected(self):
        with self.assertRaises(ValueError): bridge.RaffinatoApiClient({"raffinato_api_auth":"sem-prefixo"})

    def test_public_profile_hides_secrets(self):
        public=bridge.profile_public({"pwd":"sql","relay_token":"relay","raffinato_api_auth":"Basic segredo","name":"Loja"})
        self.assertEqual(public,{"name":"Loja"})

    def test_preview_uses_api_data_without_post(self):
        class Client:
            def __init__(self,_config): pass
            def get(self,route):
                return {"integracao/garcom":{"result":[{"garcons":[{"id":20,"nome":"CardapioZuqui"}]}]},
                    "integracao/produto":{"result":[[{"id":2777,"valor":10.0}]]},
                    "integracao/cartaoconsumo":{"result":[[{"id":127,"codigovirtual":"3","bloqueado":False,"extratoimpresso":False}]]},
                    "integracao/pontoreferencia":{"result":[[{"nome":"MESA 01"}]]}}[route]
            def post(self,*_args): raise AssertionError("preview nao envia")
        body={"identificador":"11111111-1111-4111-8111-111111111111","identificador_pedido":"22222222-2222-4222-8222-222222222222"}
        with patch.object(bridge,"RaffinatoApiClient",Client): result=bridge.prepare_raffinato_test_order({},body)
        self.assertFalse(result["enviado"]); self.assertEqual(result["payload"]["pedido"]["itens"][0]["idgarcom"],20)

    def test_send_requires_confirmation_and_is_idempotent(self):
        with self.assertRaises(ValueError): bridge.send_raffinato_test_order({}, {"confirmation":"sim"})
        saved={"raffinato_test_order_preview":{"enviado":True,"resultado":{"gravado":True,"idvenda":9}}}
        self.assertTrue(bridge.send_raffinato_test_order(saved,{"confirmation":"ENVIAR PEDIDO TESTE"})["ja_enviado"])

if __name__ == "__main__": unittest.main()
