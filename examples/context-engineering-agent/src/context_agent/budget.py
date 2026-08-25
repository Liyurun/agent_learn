from dataclasses import dataclass

from .tokenizer import estimate_tokens


@dataclass(frozen=True)
class Budget:
    window: int = 1200
    output_reserve: int = 300
    safety_margin: int = 50

    @property
    def input_limit(self) -> int:
        return self.window - self.output_reserve - self.safety_margin

    def require(self, blocks: list[str]) -> int:
        used = sum(estimate_tokens(block) for block in blocks)
        if used > self.input_limit:
            raise ValueError(f"必需内容超过输入预算：{used}/{self.input_limit}")
        return used

    def select(self, required: list[str], optional: list[str]) -> tuple[list[str], int]:
        used = self.require(required)
        selected = list(required)
        for block in optional:
            size = estimate_tokens(block)
            if used + size <= self.input_limit:
                selected.append(block)
                used += size
        return selected, used
