## 真实问题

我们要实现一个可连续处理编程任务的上下文管理 Agent：输入项目规则、18 轮原始历史、高噪声测试日志和不可压缩事实；输出预算报告、清理结果、压缩摘要、隔离分析、最终消息和可恢复检查点。示例必须离线可跑，不能把关键代码留给读者。

## 工程边界

`examples/context-engineering-agent/` 是教学参考实现。默认 `MockProvider` 确定性运行；Anthropic 适配器只是基于公开 API 的可选客户端，不代表 Claude Code 内部架构。Token 计数器是离线估算，不用于核对账单。

## 工程结构
```text
examples/context-engineering-agent/
├── pyproject.toml                 # 包、pytest 与可选依赖
├── .env.example                  # 不含真实密钥
├── sample_data/                  # 规则、18 轮历史、高噪声日志
├── src/context_agent/
│   ├── models.py                 # 输入、消息、报告
│   ├── tokenizer.py              # 确定性估算器
│   ├── budget.py                 # 输出预留与硬预算
│   ├── compaction.py             # 原始历史压缩、日志清理
│   ├── memory.py                 # 原子检查点
│   ├── subagent.py               # 隔离分析契约
│   ├── assembler.py              # 阶段编排
│   ├── providers.py              # Mock 与可选 Anthropic
│   └── main.py                   # CLI（Command-Line Interface，命令行接口）
└── tests/                        # 10 个确定性单元测试
```
## 安装与运行
```bash
cd examples/context-engineering-agent
python -m pip install -e ".[dev]"
pytest -q
python -m context_agent.main --provider mock
```
CLI 入口的完整结构如下，实际文件还负责参数解析和 JSON 格式化：
```python
from context_agent.main import run

def main() -> None:
    report = run("mock")
    print(report["answer"])

if __name__ == "__main__":
    main()
```
保存为 `run_demo.py` 后运行 `python run_demo.py`。预期输出以 `MOCK_OK` 开头。

完整测试的预期输出摘要为 `10 passed`。CLI 的绝对 Token 数随示例文本变更，但以下不变量必须成立：
```text
raw_context_tokens = 508
final_tokens <= input_budget
output_reserve = 300
compressed_messages = 14
answer 以 MOCK_OK 开头
checkpoint 指向 .context-agent/checkpoint.json
```
## 阶段 1：数据与预算

`ContextInput` 明确区分任务、规则、固定事实、原始历史和工具结果。`Budget.input_limit = window - output_reserve - safety_margin`，必需块超限立即抛出可读错误。可选块只在剩余额度足够时整体加入，避免截断结构。
```python
budget = Budget(window=1200, output_reserve=300, safety_margin=50)
assert budget.input_limit == 850
budget.require(rules + pinned_facts + [task])
```
## 阶段 2：清理与压缩

`clean_tool_result` 从高噪声日志保留 `FAILED`、`ERROR`、异常、退出码和根因行，并说明省略量；`compact_history` 每次接收原始历史，保留最近四轮，摘要包含覆盖范围。
```python
cleaned = clean_tool_result(tool_result)
summary, recent, compacted = compact_history(history, keep_recent=4)
```
这避免两种常见错误：清理后只剩“失败”而没有原因；把上一版摘要作为下一版摘要的唯一来源。

## 阶段 3：隔离与组装

日志分析器只返回 `conclusion`、`evidence`、`confidence`、`open_questions`。组装器的优先顺序是规则、固定事实、当前任务，再加入摘要、近期原文、清理后的日志和子任务摘要。所有阶段写入 `ContextReport`。
```python
assembled = ContextAssembler().assemble(context)
assert assembled.report.final_tokens <= assembled.report.input_budget
assert set(assembled.subagent_summary) == {
    "conclusion", "evidence", "confidence", "open_questions"
}
```
## 阶段 4：Provider 与检查点

Mock 路径不访问网络。真实 Provider 只有用户显式选择时才导入 SDK（Software Development Kit，软件开发工具包），缺包或缺密钥会给安装提示。检查点先写临时文件再原子替换，加载时检查版本。
```bash
python -m context_agent.main --provider anthropic
```
未安装可选依赖时，预期错误包含：
```text
请运行 python -m pip install -e ".[anthropic]"
```
## 测试如何对应风险

| 测试 | 防止的回归 |
|---|---|
| 必需内容超预算失败 | 静默删除规则 |
| 输出预留不可侵占 | 回复被截断 |
| 固定事实始终存在 | 压缩丢硬约束 |
| 日志保留根因 | 无法排障 |
| 摘要读取原始消息 | 复利式失真 |
| 子智能体字段固定 | 主流程收到无界噪声 |
| 检查点往返一致 | 重启丢状态 |
| 未知版本拒绝 | 错误解释旧状态 |
| 阶段报告完整 | 优化不可观测 |
| Mock 结果稳定 | 文档示例无法复核 |

## 排错与优化

- `No module named pytest`：运行安装命令，或在已有虚拟环境安装开发依赖。
- “必需内容超过输入预算”：先缩短规则或动态减少工具，不得占用输出预留。
- 检查点版本错误：执行显式迁移，不要直接删除版本字段。
- 真实 Provider 缺密钥：通过受控环境变量注入；不要写入源码、日志或示例数据。
- 估算量与供应商账单不同：替换 `tokenizer.py` 为对应模型的官方计数方法，并保留消息包装余量。

## 思考：为什么示例默认必须使用 Mock？

### 回答

默认路径需要可重复、无密钥、无网络和无费用，才能让测试验证上下文管理本身。真实模型输出有随机性且 API 会变化，适合集成验证，不适合作为基础单元测试的唯一判据。

## 思考：为什么最终输入没有强行塞满预算？

### 回答

预算是上限，不是目标。低价值内容即使装得下也会增加成本和干扰；组装器应以任务证据充分为准，并保留安全余量。高利用率不等于高质量。

## 文件到运行阶段的完整映射

这个工程不隐藏“胶水代码”。`sample_data/conversation.json` 提供任务、三条固定事实和十八轮消息；`project_rules.md` 提供项目约束；`noisy_test_output.txt` 模拟长工具输出。`main.load_sample` 将三份文件转换成 `ContextInput`，随后 `ContextAssembler.assemble` 依次调用预算器、清理器、压缩器和隔离分析器。Provider 只消费最终消息，CheckpointStore 保存原始输入与已完成阶段。

| 文件 | 输入 | 核心处理 | 输出及下游 |
|---|---|---|---|
| `models.py` | Python 字段 | 定义 `Message`、`ContextInput`、`ContextReport` | 供全部模块共享的数据契约 |
| `tokenizer.py` | 文本、角色 | 中文字符与 ASCII 近似计数，增加消息开销 | `budget.py` 与 `assembler.py` 使用的估算值 |
| `budget.py` | 窗口、预留、余量、文本块 | 计算 850 输入上限，拒绝必需块超限 | 可选块选择依据 |
| `compaction.py` | 十八轮原始历史、完整日志 | 保留最近四轮，清理日志并记录省略量 | 摘要、近期消息、清理结果 |
| `subagent.py` | 完整测试日志 | 提取前三条失败证据并校验字段 | 四字段隔离摘要 |
| `assembler.py` | `ContextInput` | 按优先级组装并逐块计数 | `AssembledContext` 与阶段报告 |
| `providers.py` | 最终消息列表 | Mock 确定性回答；真实路径延迟导入 SDK | 最终文本 |
| `memory.py` | 原始输入、阶段名 | 临时文件写入后原子替换，加载时验版本 | `.context-agent/checkpoint.json` |
| `main.py` | CLI 参数与样例目录 | 串联加载、组装、调用、保存和打印 | 完整 JSON 报告 |

`__init__.py` 让目录成为可导入包；`pyproject.toml` 定义 Python 版本、开发依赖、可选 Anthropic 依赖和命令入口；`.env.example` 只列变量名，不保存密钥。四个测试文件分别覆盖预算、压缩、记忆和组装器，不依赖网络。

## 输入文件逐项展开

`conversation.json` 的任务是“定位预算测试失败原因，提出最小修复；不得修改生产服务”。固定事实包括禁止修改生产服务、三百 Token 输出预留不可侵占、修复后运行 `pytest -q`。十八轮历史从读取配置开始，依次确认窗口一千二、输出预留三百、安全余量五十、日志需隔离、错误根因不能删除、摘要须来自原始历史，最后要求给出可验证结果。

`project_rules.md` 作为系统规则进入必需块。`noisy_test_output.txt` 同时包含大量通过日志和以下关键行：
```text
FAILED tests/test_budget.py::test_output_reserve_is_never_consumed
ERROR input limit used window directly; expected window-reserve-margin
```
清理器按正则保留 `FAILED`、`ERROR`、`Exception`、`exit code` 和 `root cause`，最多八行；隔离分析器从同一原文提取前三条错误证据。两者职责不同：清理器生成可放入上下文的工具消息，隔离分析器生成有固定字段的结论。

## 从命令到输出的逐步运行

在工程目录执行：
```bash
python -m pip install -e ".[dev]"
pytest -q
python -m context_agent.main --provider mock
```
第一条命令把 `src/` 布局包以可编辑方式安装；第二条运行十个确定性测试；第三条进入 `main()`。参数解析选择 Mock，`load_sample()` 读取三份输入，组装器先构造未经处理的基线，再生成清理、压缩和隔离结果。完成 Provider 调用后，检查点通过临时文件原子替换写入。

以当前仓库样例实际运行，完整标准输出为：
```json
{
  "raw_context_tokens": 508,
  "input_budget": 850,
  "cleaned_tool_tokens": 79,
  "compressed_messages": 14,
  "subagent_summary": {
    "conclusion": "FAILED tests/test_budget.py::test_output_reserve_is_never_consumed",
    "evidence": [
      "FAILED tests/test_budget.py::test_output_reserve_is_never_consumed",
      "ERROR input limit used window directly; expected window-reserve-margin"
    ],
    "confidence": 1.0,
    "open_questions": []
  },
  "final_message_count": 10,
  "final_tokens": 535,
  "output_reserve": 300,
  "answer": "MOCK_OK：已依据 10 条消息制定只读修复计划；固定事实已保留=True",
  "checkpoint": "examples/context-engineering-agent/.context-agent/checkpoint.json"
}
```
不同启动位置可能让检查点显示为绝对路径，但字段内容一致。这里 `final_tokens` 为 535，反而高于 `raw_context_tokens` 508，因为参考实现增加了结构化标题、隔离摘要和消息包装；这不是错误。它仍低于 850 输入预算，并把高价值内容变得可观察。若要证明成本优化，应使用更大的真实日志和长历史做对照，不能用本样例断言压缩后总量必然下降。

## 每个数字是怎样产生的

`Budget(window=1200, output_reserve=300, safety_margin=50)` 得到八百五十输入额度。`compressed_messages=14` 来自十八轮历史减去最近四轮。`cleaned_tool_tokens=79` 是清理后工具消息连同角色包装的估算。最终十条消息由三条必需消息、摘要、四条近期原文、清理日志和隔离摘要组成。MockProvider 搜索包含“不可压缩事实”的消息，并在回答中报告消息数和事实是否存在。

估算器把每个非 ASCII 字符计作一个 Token，把每四个 ASCII 字符约计一个，再为消息角色与包装增加固定开销。这个规则使离线测试稳定，却不等于 Anthropic 账单计数。接入真实模型时应替换计数方法，并保留预算接口不变。

## 检查点内容与恢复

检查点版本为一，保存任务、规则、固定事实、十八轮历史、完整工具结果和五个已完成阶段。它保留原始输入，因此可重新压缩，不依赖上一版摘要。`CheckpointStore.load()` 遇到未知版本会拒绝解释，防止新代码误读旧结构。

当前 `main.py` 展示保存能力，但 CLI 没有暴露“从检查点继续”的参数。这是参考工程的明确边界：测试验证 `save/load` 往返一致，不应声称示例已经实现完整工作流续跑、分布式锁或副作用幂等。若扩展生产版本，恢复入口应先加载状态、校验任务输入，再从 `completed` 后的阶段继续。

## 真实 Provider 路径

选择 `--provider anthropic` 时，`AnthropicProvider` 才导入依赖并读取 `ANTHROPIC_API_KEY`。系统消息被合并到 `system`，其他消息映射为 API 消息，最大输出设为六百。缺包时会提示安装可选依赖，缺密钥时会明确报错。模型默认值来自环境变量回退，生产中应固定并记录经过验证的模型版本。

该适配器是最小演示，没有重试、超时、流式输出、速率限制、缓存配置、完整用量报告和工具调用循环。它说明如何替换 Provider，不是生产客户端。Anthropic API 的参数与模型可用性以当前官方文档为准。

## 一次完整排错

若运行出现“必需内容超过输入预算”，先打印三条必需消息的分类占用。规则本身过长时按作用域拆分；固定事实冲突时先治理来源；任务描述混入日志时把日志移到工具结果。禁止把 `output_reserve` 从三百降为零来让错误消失。

若 `compressed_messages` 不是十四，检查样例历史是否仍为十八轮及 `keep_recent` 是否为四；若隔离摘要没有 `ERROR` 行，检查原始日志和正则，而不是修改 Mock 答案；若检查点为空，检查父目录权限及临时文件替换。若测试通过但正文数字变化，应以实际 CLI 输出更新文档，避免示例与工程漂移。

## 优化前后对比

| 阶段 | 优化前的直接拼接 | 当前参考实现 | 仍需生产补强 |
|---|---|---|---|
| 预算 | 输入完成后才发现超限 | 先锁定输出与余量 | 使用官方计数和请求级告警 |
| 历史 | 十八轮全部常驻 | 早期十四轮摘要、最近四轮原文 | 摘要质量评估与源事件存储 |
| 日志 | 整份测试输出进入每轮 | 保留错误行和省略说明 | 工具类型 schema 与对象存储指针 |
| 探索 | 主上下文直接分析 | 四字段隔离摘要 | 真正隔离执行、超时和权限 |
| 恢复 | 无状态 | 原子 JSON 检查点 | 幂等动作、锁、迁移与加密 |
| 模型 | 网络输出不可重复 | Mock 确定性基线 | 真实模型集成评估 |

## 工程案例边界

工程证明的是各模块接口、错误路径和确定性运行，不证明这个启发式在所有任务上质量最佳。它没有实现 Claude Code，也没有复现 Anthropic 的压缩、缓存或子智能体内部逻辑。公开 API 只用于可选 Provider；预算、压缩、日志提取和检查点均为仓库自己的教学代码。

将它用于真实项目之前，需要补充模型对应 Token 计数、敏感数据脱敏、租户隔离、事件存储、状态迁移、并发控制、幂等副作用、在线评估和可观测性。最安全的迁移方式是保留 Mock 回归基线，再为真实 Provider 增加集成测试，而不是删除确定性测试。
