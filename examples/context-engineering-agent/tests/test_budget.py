import pytest

from context_agent.budget import Budget


def test_required_content_over_budget_fails():
    with pytest.raises(ValueError, match="必需内容超过输入预算"):
        Budget(window=20, output_reserve=8, safety_margin=2).require(["x" * 100])


def test_output_reserve_is_never_consumed():
    budget = Budget(window=100, output_reserve=30, safety_margin=10)
    selected, used = budget.select(["必须"], ["a" * 400])
    assert used <= 60
    assert selected == ["必须"]
    assert budget.window - budget.input_limit == 40
