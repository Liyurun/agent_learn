from .budget import Budget
from .compaction import clean_tool_result, compact_history
from .models import AssembledContext, ContextInput, ContextReport, Message
from .subagent import inspect_failures, validate_summary
from .tokenizer import message_tokens


class ContextAssembler:
    def __init__(self, budget: Budget | None = None):
        self.budget = budget or Budget()

    @staticmethod
    def _tokens(messages: list[Message]) -> int:
        return sum(message_tokens(item.role, item.content) for item in messages)

    def assemble(self, value: ContextInput) -> AssembledContext:
        raw = [
            Message("system", "\n".join(value.rules)),
            *value.history,
            Message("tool", value.tool_result),
            Message("user", value.task),
        ]
        cleaned = clean_tool_result(value.tool_result)
        summary, recent, compacted = compact_history(value.history)
        subagent_summary = inspect_failures(value.tool_result)
        validate_summary(subagent_summary)

        required = [
            Message("system", "项目规则：\n- " + "\n- ".join(value.rules)),
            Message("system", "不可压缩事实：\n- " + "\n- ".join(value.pinned_facts)),
            Message("user", value.task),
        ]
        optional = [
            Message("assistant", f"早期历史摘要：{summary}"),
            *recent,
            Message("tool", cleaned),
            Message("assistant", f"隔离分析摘要：{subagent_summary}"),
        ]
        required_text = [item.content for item in required]
        self.budget.require(required_text)
        messages = list(required)
        used = self._tokens(messages)
        for message in optional:
            size = message_tokens(message.role, message.content)
            if used + size <= self.budget.input_limit:
                messages.append(message)
                used += size
        report = ContextReport(
            raw_tokens=self._tokens(raw),
            input_budget=self.budget.input_limit,
            cleaned_tool_tokens=message_tokens("tool", cleaned),
            compressed_messages=compacted,
            final_tokens=used,
            output_reserve=self.budget.output_reserve,
            stages=["budget", "clean", "compact", "isolate", "assemble"],
        )
        return AssembledContext(messages, report, subagent_summary)
