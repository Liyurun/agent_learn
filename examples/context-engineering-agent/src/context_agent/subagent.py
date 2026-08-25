def inspect_failures(tool_result: str) -> dict:
    """隔离分析高噪声日志，只按固定契约返回。"""
    evidence = [
        line.strip() for line in tool_result.splitlines()
        if "FAILED" in line or "ERROR" in line or "Exception" in line
    ][:3]
    return {
        "conclusion": evidence[0] if evidence else "未发现明确失败",
        "evidence": evidence,
        "confidence": 1.0 if evidence else 0.5,
        "open_questions": [] if evidence else ["需要完整测试退出码"],
    }


def validate_summary(value: dict) -> None:
    required = {"conclusion", "evidence", "confidence", "open_questions"}
    if set(value) != required:
        raise ValueError(f"子智能体摘要字段必须为：{sorted(required)}")
