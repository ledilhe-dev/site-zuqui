import copy
import unittest

import raffinato_bridge as bridge


class DeliveryTimeOverlayTests(unittest.TestCase):
    def test_overlay_changes_only_delivery_time_dimensions(self):
        original = [
            {"id_documento_fiscal": 10, "modulo_venda": "DELIVERY", "data": "2026-11-01", "hora": "18:40:00", "valor_atribuido": 42.5, "quantidade_atribuida": 2},
            {"id_documento_fiscal": 20, "modulo_venda": "VENDA_RAPIDA", "data": "2026-11-01", "hora": "19:00:00", "valor_atribuido": 30.0, "quantidade_atribuida": 1},
        ]
        changed = bridge.apply_delivery_entry_times(copy.deepcopy(original), {"10": {"data": "2026-11-01", "hora": "18:05:00"}, "20": {"data": "2026-10-31", "hora": "23:00:00"}})

        self.assertEqual(changed[0]["hora"], "18:05:00")
        self.assertEqual(changed[1], original[1])
        self.assertEqual(sum(x["valor_atribuido"] for x in changed), sum(x["valor_atribuido"] for x in original))
        self.assertEqual(sum(x["quantidade_atribuida"] for x in changed), sum(x["quantidade_atribuida"] for x in original))
        self.assertEqual({x["id_documento_fiscal"] for x in changed}, {x["id_documento_fiscal"] for x in original})

    def test_missing_delivery_time_keeps_original_row(self):
        original = [{"id_documento_fiscal": 99, "modulo_venda": "DELIVERY", "data": "2026-11-01", "hora": "20:00:00", "valor_atribuido": 15.0}]
        self.assertEqual(bridge.apply_delivery_entry_times(copy.deepcopy(original), {}), original)


if __name__ == "__main__":
    unittest.main()
