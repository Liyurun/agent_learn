# context-engineering-agent

本工程是上下文工程的教学参考实现，不代表 Claude Code、Anthropic API、LangGraph 或其他产品的内部实现。

## 能力

- 为输出和安全余量预留预算。
- 固定不可压缩事实。
- 从原始历史生成结构化摘要并保留近期原文。
- 清理工具噪声但保留错误根因。
- 以固定契约返回隔离分析摘要。
- 原子保存与恢复 JSON 检查点。
- 默认确定性 Mock；真实 Anthropic Provider 为可选依赖。

## 运行

```bash
python -m pip install -e ".[dev]"
pytest -q
python -m context_agent.main --provider mock
```

默认检查点写入 `.context-agent/checkpoint.json`。输出中的 Token 数是教学估算，不对应任何模型账单。

## 可选真实模型

```bash
python -m pip install -e ".[anthropic]"
cp .env.example .env
# 安全地把变量加载到当前 shell 后运行：
python -m context_agent.main --provider anthropic
```

模型名、价格、限额和 API 行为会变化，请以 Anthropic 当前官方文档为准。程序不会自动读取 `.env`，避免读者误以为示例内置了密钥管理；请使用受控的环境变量注入方式。
