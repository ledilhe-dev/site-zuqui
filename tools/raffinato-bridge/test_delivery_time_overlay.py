import copy
import unittest
from datetime import datetime

import raffinato_bridge as bridge


class DeliveryTimeOverlayTests(unittest.TestCase):
    def test_overlay_changes_only_delivery_time_dimensions(self):
        original = [
            {"id_documento_fiscal": 10, "modulo_venda": "DELIVERY", "data": "2026-11-01", "hora": "18:40:00", "valor_atribuido": 42.5, "quantidade_atribuida": 2},
            {"id_documento_fiscal": 20, "modulo_venda": "VENDA_RAPIDA", "data": "2026-11-01", "hora": "19:00:00", "valor_atribuido": 30.0, "quantidade_atribuida": 1},
        ]
        changed = copy.deepcopy(original)
        stats = bridge.apply_delivery_entry_times(changed, {"10": {"data": "2026-11-01", "hora": "18:05:00", "fonte": "INTEGRACAO_DELIVERY_ONLINE"}, "20": {"data": "2026-10-31", "hora": "23:00:00"}})

        self.assertEqual(changed[0]["hora"], "18:05:00")
        self.assertEqual(changed[1], original[1])
        self.assertEqual(sum(x["valor_atribuido"] for x in changed), sum(x["valor_atribuido"] for x in original))
        self.assertEqual(sum(x["quantidade_atribuida"] for x in changed), sum(x["quantidade_atribuida"] for x in original))
        self.assertEqual({x["id_documento_fiscal"] for x in changed}, {x["id_documento_fiscal"] for x in original})
        self.assertEqual(stats, {"enriched": 1, "fallback": 0})

    def test_missing_delivery_time_keeps_original_row(self):
        original = [{"id_documento_fiscal": 99, "modulo_venda": "DELIVERY", "data": "2026-11-01", "hora": "20:00:00", "valor_atribuido": 15.0}]
        changed = copy.deepcopy(original)
        stats = bridge.apply_delivery_entry_times(changed, {})
        self.assertEqual(changed[0]["data"], original[0]["data"])
        self.assertEqual(changed[0]["hora"], original[0]["hora"])
        self.assertTrue(changed[0]["delivery_time_fallback"])
        self.assertEqual(stats, {"enriched": 0, "fallback": 1})

    def test_reference_ifood_sales_keep_total_and_move_to_validated_hours(self):
        values = [100.00, 56.51, 100.00, 79.80, 61.02, 92.49, 100.00, 83.89, 51.22]
        hours = ["07:05:00", "07:45:00", "08:10:00", "08:55:00", "09:20:00", "15:15:00", "16:05:00", "16:50:00", "18:30:00"]
        original = [{
            "id_documento_fiscal": index,
            "modulo_venda": "DELIVERY",
            "data": "2026-10-31",
            "hora": "23:59:00",
            "valor_atribuido": value,
            "quantidade_atribuida": 1,
        } for index, value in enumerate(values, 1)]
        mappings = {str(index): {"data": "2026-10-31", "hora": hour} for index, hour in enumerate(hours, 1)}

        changed = copy.deepcopy(original)
        stats = bridge.apply_delivery_entry_times(changed, mappings)
        distribution = {}
        for item in changed:
            hour = item["hora"][:2]
            distribution[hour] = round(distribution.get(hour, 0) + item["valor_atribuido"], 2)

        self.assertEqual(len(changed), 9)
        self.assertEqual(round(sum(x["valor_atribuido"] for x in changed), 2), 724.93)
        self.assertEqual(distribution, {"07": 156.51, "08": 179.80, "09": 61.02, "15": 92.49, "16": 183.89, "18": 51.22})
        self.assertEqual({x["id_documento_fiscal"] for x in changed}, set(range(1, 10)))
        self.assertEqual(stats, {"enriched": 9, "fallback": 0})

    def test_cross_day_uses_received_time_only_for_linked_delivery(self):
        items = [
            {"id_documento_fiscal": 1, "modulo_venda": "DELIVERY", "data": "2026-11-01", "hora": "00:15:00", "valor_atribuido": 25.0},
            {"id_documento_fiscal": 2, "modulo_venda": "VENDA_RAPIDA", "data": "2026-11-01", "hora": "00:15:00", "valor_atribuido": 10.0},
        ]
        changed = copy.deepcopy(items)
        bridge.apply_delivery_entry_times(changed, {"1": {"data": "2026-10-31", "hora": "23:55:00"}})
        selected = bridge.filter_items_by_effective_period(changed, datetime(2026, 10, 31), datetime(2026, 11, 1))
        self.assertEqual([x["id_documento_fiscal"] for x in selected], [1])
        self.assertEqual(selected[0]["valor_atribuido"], 25.0)

    def test_unlinked_integration_records_cannot_add_financial_sales(self):
        original = [{"id_documento_fiscal": 1, "modulo_venda": "DELIVERY", "data": "2026-11-01", "hora": "12:00:00", "valor_atribuido": 20.0}]
        integration_only = {str(index): {"data": "2026-11-01", "hora": "13:00:00"} for index in range(100, 113)}
        changed = copy.deepcopy(original)
        stats = bridge.apply_delivery_entry_times(changed, integration_only)
        self.assertEqual(changed[0]["hora"], original[0]["hora"])
        self.assertTrue(changed[0]["delivery_time_fallback"])
        self.assertEqual(stats, {"enriched": 0, "fallback": 1})
        self.assertEqual(len(changed), 1)


if __name__ == "__main__":
    unittest.main()
