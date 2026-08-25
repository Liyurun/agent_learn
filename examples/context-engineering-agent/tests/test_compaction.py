from context_agent.compaction import clean_tool_result, compact_history
from context_agent.models import Message


def test_tool_cleaning_preserves_root_cause():
    text = "\n".join(["noise"] * 20 + ["FAILED test_x", "root cause: timeout"])
    cleaned = clean_tool_result(text)
    assert "FAILED test_x" in cleaned
    assert "root cause: timeout" in cleaned
    assert "已清理" in cleaned


def test_compaction_uses_raw_messages_and_keeps_recent():
    history = [Message("user", f"原始-{index}") for index in range(8)]
    summary, recent, count = compact_history(history, keep_recent=2)
    assert "原始-0" in summary
    assert [item.content for item in recent] == ["原始-6", "原始-7"]
    assert count == 6
