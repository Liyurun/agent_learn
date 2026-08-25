from pathlib import Path

from context_agent.assembler import ContextAssembler
from context_agent.budget import Budget
from context_agent.main import run
from context_agent.models import ContextInput, Message
from context_agent.subagent import inspect_failures


def sample() -> ContextInput:
    return ContextInput(
        "修复测试",
        ["只读生产服务"],
        ["输出预留不可侵占"],
        [Message("user", f"原始消息 {index}") for index in range(8)],
        "noise\nFAILED test_budget\nERROR wrong limit\nnoise",
    )


def test_pinned_facts_always_remain():
    result = ContextAssembler(Budget(window=300, output_reserve=50, safety_margin=20)).assemble(sample())
    assert any("输出预留不可侵占" in item.content for item in result.messages)


def test_subagent_returns_only_contract_fields():
    result = inspect_failures(sample().tool_result)
    assert set(result) == {"conclusion", "evidence", "confidence", "open_questions"}


def test_assembler_reports_each_stage():
    result = ContextAssembler().assemble(sample())
    assert result.report.stages == ["budget", "clean", "compact", "isolate", "assemble"]
    assert result.report.final_tokens <= result.report.input_budget


def test_mock_run_is_deterministic(tmp_path):
    first = run("mock", tmp_path / "a.json")
    second = run("mock", tmp_path / "b.json")
    first.pop("checkpoint")
    second.pop("checkpoint")
    assert first == second
    assert first["answer"].startswith("MOCK_OK")
