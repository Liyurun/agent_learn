import argparse
import json
from pathlib import Path

from .assembler import ContextAssembler
from .memory import CheckpointStore
from .models import ContextInput, Message
from .providers import AnthropicProvider, MockProvider


def load_sample(root: Path) -> ContextInput:
    raw = json.loads((root / "sample_data/conversation.json").read_text(encoding="utf-8"))
    return ContextInput(
        task=raw["task"],
        rules=(root / "sample_data/project_rules.md").read_text(encoding="utf-8").splitlines(),
        pinned_facts=raw["pinned_facts"],
        history=[Message(**item) for item in raw["history"]],
        tool_result=(root / "sample_data/noisy_test_output.txt").read_text(encoding="utf-8"),
    )


def run(provider_name: str, checkpoint: Path | None = None) -> dict:
    root = Path(__file__).resolve().parents[2]
    value = load_sample(root)
    assembled = ContextAssembler().assemble(value)
    provider = MockProvider() if provider_name == "mock" else AnthropicProvider()
    answer = provider.complete(assembled.messages)
    checkpoint = checkpoint or root / ".context-agent/checkpoint.json"
    CheckpointStore(checkpoint).save(value, assembled.report.stages)
    return {
        "raw_context_tokens": assembled.report.raw_tokens,
        "input_budget": assembled.report.input_budget,
        "cleaned_tool_tokens": assembled.report.cleaned_tool_tokens,
        "compressed_messages": assembled.report.compressed_messages,
        "subagent_summary": assembled.subagent_summary,
        "final_message_count": len(assembled.messages),
        "final_tokens": assembled.report.final_tokens,
        "output_reserve": assembled.report.output_reserve,
        "answer": answer,
        "checkpoint": str(checkpoint),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="上下文工程 Agent 教学参考实现")
    parser.add_argument("--provider", choices=["mock", "anthropic"], default="mock")
    parser.add_argument("--checkpoint", type=Path)
    args = parser.parse_args()
    print(json.dumps(run(args.provider, args.checkpoint), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
