def estimate_tokens(text: str) -> int:
    """确定性近似计数；真实调用应换成目标模型对应的 tokenizer。"""
    if not text:
        return 0
    ascii_count = sum(ch.isascii() for ch in text)
    non_ascii_count = len(text) - ascii_count
    return non_ascii_count + (ascii_count + 3) // 4


def message_tokens(role: str, content: str) -> int:
    return 4 + estimate_tokens(role) + estimate_tokens(content)
