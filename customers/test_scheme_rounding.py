from django.test import SimpleTestCase
from customers.views import calculate_scheme_layer, scheme_quantity_totals


class ProjectQuantityTests(SimpleTestCase):
    def layer(self, length, price=600):
        return dict(length=length, width=1, thickness=1, dosagePercent=100,
                    density=1, unitPrice=price)

    def test_only_project_total_is_rounded_and_prices_remain_layer_specific(self):
        layers = [self.layer(1.2, 500), self.layer(1.2, 700)]
        self.assertEqual(scheme_quantity_totals(layers), {
            'totalExactQuantity': 2.4, 'totalQuantity': 3,
        })
        self.assertEqual([calculate_scheme_layer(layer)['totalPrice'] for layer in layers], [600, 840])

    def test_decimal_integer_and_tiny_positive_remainder(self):
        self.assertEqual(scheme_quantity_totals([self.layer(.1), self.layer(.2), self.layer(.7)])['totalQuantity'], 1)
        self.assertEqual(scheme_quantity_totals([self.layer(1.000000000001)])['totalQuantity'], 2)
        self.assertEqual(scheme_quantity_totals([])['totalQuantity'], 0)

    def test_money_uses_decimal_round_half_up(self):
        self.assertEqual(calculate_scheme_layer(self.layer(1.005, 1))['totalPrice'], 1.01)
        self.assertEqual(calculate_scheme_layer(self.layer(2.675, 1))['totalPrice'], 2.68)
