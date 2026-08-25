from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class Message:
    role: str
    content: str


@dataclass
class ContextInput:
    task: str
    rules: list[str]
    pinned_facts: list[str]
    history: list[Message]
    tool_result: str = ""


@dataclass
class ContextReport:
    raw_tokens: int
    input_budget: int
    cleaned_tool_tokens: int
    compressed_messages: int
    final_tokens: int
    output_reserve: int
    stages: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AssembledContext:
    messages: list[Message]
    report: ContextReport
    subagent_summary: dict
