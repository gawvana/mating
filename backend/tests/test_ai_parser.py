"""Unit tests for AI deterministic hybrid parser enforcing Mating Bare Number Rule and canonical normalization."""

import pytest
from backend.services.ai_service import fast_deterministic_parser


def test_bare_number_rule_thousands():
    """Bare number under 1000 without unit defaults to price in thousands (10 to 10,000 UZS)."""
    items = fast_deterministic_parser("Pomidor 10")
    assert items is not None and len(items) == 1
    assert items[0].name == "Pomidor"
    assert items[0].quantity == 1.0
    assert items[0].unit == "\u0448\u0442"
    assert items[0].estimated_price == 10000.0

    items_5 = fast_deterministic_parser("Qalamir 5")
    assert items_5 is not None and len(items_5) == 1
    assert items_5[0].name == "Qalamir"
    assert items_5[0].estimated_price == 5000.0


def test_unit_attached_numbers_are_quantities_not_price():
    """Numbers attached to units must be parsed as quantity and unit, NOT price."""
    # 2kg
    items_2kg = fast_deterministic_parser("Pomidor 2kg")
    assert items_2kg is not None and len(items_2kg) == 1
    assert items_2kg[0].quantity == 2.0
    assert items_2kg[0].unit == "\u043a\u0433"
    assert items_2kg[0].estimated_price is None

    # 2 kg (with space)
    items_2_kg = fast_deterministic_parser("Pomidor 2 kg")
    assert items_2_kg is not None and len(items_2_kg) == 1
    assert items_2_kg[0].quantity == 2.0
    assert items_2_kg[0].unit == "\u043a\u0433"

    # 500g
    items_500g = fast_deterministic_parser("Pomidor 500g")
    assert items_500g is not None and len(items_500g) == 1
    assert items_500g[0].quantity == 500.0
    assert items_500g[0].unit == "\u0433"

    # 2l
    items_2l = fast_deterministic_parser("Suv 2l")
    assert items_2l is not None and len(items_2l) == 1
    assert items_2l[0].quantity == 2.0
    assert items_2l[0].unit == "\u043b"

    # 4 dona
    items_4dona = fast_deterministic_parser("Yogurt 4 dona")
    assert items_4dona is not None and len(items_4dona) == 1
    assert items_4dona[0].quantity == 4.0
    assert items_4dona[0].unit == "\u0448\u0442"


def test_explicit_large_price_and_k_notation():
    """Numbers over 1000 or with k represent exact price."""
    items_18000 = fast_deterministic_parser("Pomidor 18000")
    assert items_18000 is not None and len(items_18000) == 1
    assert items_18000[0].estimated_price == 18000.0

    items_18k = fast_deterministic_parser("Pomidor 18k")
    assert items_18k is not None and len(items_18k) == 1
    assert items_18k[0].estimated_price == 18000.0

    items_18_sum = fast_deterministic_parser("Pomidor 18 000 \u0441\u0443\u043c")
    assert items_18_sum is not None and len(items_18_sum) == 1
    assert items_18_sum[0].estimated_price == 18000.0


def test_quantity_plus_price_combination():
    """Input with both quantity/unit and price."""
    items = fast_deterministic_parser("Pomidor 2kg 18000")
    assert items is not None and len(items) == 1
    assert items[0].name == "Pomidor"
    assert items[0].quantity == 2.0
    assert items[0].unit == "\u043a\u0433"
    assert items[0].estimated_price == 18000.0


def test_leading_quantity_syntax():
    """Inputs like '10 eggs', '10kg pomidor', '2 milk'."""
    items_eggs = fast_deterministic_parser("10 \u044f\u0438\u0446")
    assert items_eggs is not None and len(items_eggs) == 1
    assert items_eggs[0].name == "\u042f\u0439\u0446\u0430"
    assert items_eggs[0].quantity == 10.0
    assert items_eggs[0].unit == "\u0448\u0442"

    items_kg = fast_deterministic_parser("10kg pomidor")
    assert items_kg is not None and len(items_kg) == 1
    assert items_kg[0].name == "Pomidor"
    assert items_kg[0].quantity == 10.0
    assert items_kg[0].unit == "\u043a\u0433"

    items_milk = fast_deterministic_parser("2 \u043c\u043e\u043b\u043e\u043a\u0430")
    assert items_milk is not None and len(items_milk) == 1
    assert items_milk[0].name == "\u041c\u043e\u043b\u043e\u043a\u043e"
    assert items_milk[0].quantity == 2.0


def test_multiline_uzbek_shopping_list():
    """Test full multi-line shopping list from prompt:
    Pomidor 10
    bodring 10
    Baqlajon 10
    Qalamir 5
    """
    raw = "Pomidor 10\nbodring 10\nBaqlajon 10\nQalamir 5"
    items = fast_deterministic_parser(raw)
    assert items is not None and len(items) == 4

    assert items[0].name == "Pomidor"
    assert items[0].estimated_price == 10000.0

    assert items[1].name == "Bodring"
    assert items[1].estimated_price == 10000.0

    assert items[2].name == "Baqlajon"
    assert items[2].estimated_price == 10000.0

    assert items[3].name == "Qalamir"
    assert items[3].estimated_price == 5000.0


def test_space_delimited_batch_uzbek():
    """Test space-delimited batch parsing without newlines:
    'Pomidor 10 bodring 10 Baqlajon 10 Qalamir 5' -> 4 items.
    """
    raw = "Pomidor 10 bodring 10 Baqlajon 10 Qalamir 5"
    items = fast_deterministic_parser(raw)
    assert items is not None and len(items) == 4

    assert items[0].name == "Pomidor"
    assert items[0].estimated_price == 10000.0
    assert items[0].category == "Овощи и фрукты"

    assert items[1].name == "Bodring"
    assert items[1].estimated_price == 10000.0

    assert items[2].name == "Baqlajon"
    assert items[2].estimated_price == 10000.0

    assert items[3].name == "Qalamir"
    assert items[3].estimated_price == 5000.0


def test_qalampir_typo_and_correct_variants():
    """Verify both Qalampir and Qalamir are recognized with 5000 UZS price and correct category."""
    items_correct = fast_deterministic_parser("Qalampir 5")
    assert items_correct is not None and len(items_correct) == 1
    assert items_correct[0].name == "Qalampir"
    assert items_correct[0].estimated_price == 5000.0
    assert items_correct[0].category == "Овощи и фрукты"

    items_typo = fast_deterministic_parser("Qalamir 5")
    assert items_typo is not None and len(items_typo) == 1
    assert items_typo[0].name == "Qalamir"
    assert items_typo[0].estimated_price == 5000.0
    assert items_typo[0].category == "Овощи и фрукты"


def test_uzbek_cyrillic_unicode_support():
    """Verify Uzbek Cyrillic letters (ў, қ, ғ, ҳ) and space-batch parsing."""
    raw = "Помидор 10 бодринг 10 бақлажон 10 қалампир 5"
    items = fast_deterministic_parser(raw)
    assert items is not None and len(items) == 4

    assert items[0].name == "Помидор"
    assert items[0].estimated_price == 10000.0

    assert items[1].name == "Бодринг"
    assert items[1].estimated_price == 10000.0

    assert items[2].name == "Бақлажон"
    assert items[2].estimated_price == 10000.0

    assert items[3].name == "Қалампир"
    assert items[3].estimated_price == 5000.0

    # Test Uzbek Cyrillic units: 'дона', 'та'
    items_dona = fast_deterministic_parser("қатиқ 3 дона")
    assert items_dona is not None and len(items_dona) == 1
    assert items_dona[0].name == "Қатиқ"
    assert items_dona[0].quantity == 3.0
    assert items_dona[0].unit == "шт"

    items_ta = fast_deterministic_parser("2 та нон")
    assert items_ta is not None and len(items_ta) == 1
    assert items_ta[0].name == "Нон"
    assert items_ta[0].quantity == 2.0
    assert items_ta[0].unit == "шт"

