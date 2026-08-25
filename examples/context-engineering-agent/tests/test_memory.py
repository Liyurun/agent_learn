from context_agent.memory import CheckpointStore
from context_agent.models import ContextInput, Message


def test_checkpoint_round_trip(tmp_path):
    original = ContextInput("任务", ["规则"], ["事实"], [Message("user", "消息")], "日志")
    store = CheckpointStore(tmp_path / "checkpoint.json")
    store.save(original, ["budget"])
    restored, completed = store.load()
    assert restored == original
    assert completed == ["budget"]


def test_checkpoint_rejects_unknown_version(tmp_path):
    path = tmp_path / "checkpoint.json"
    path.write_text('{"version": 99}', encoding="utf-8")
    try:
        CheckpointStore(path).load()
    except ValueError as error:
        assert "不支持的检查点版本" in str(error)
    else:
        raise AssertionError("未知版本必须失败")
