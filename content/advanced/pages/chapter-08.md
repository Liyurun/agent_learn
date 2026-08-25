2026 年 8 月检索更新。本章只把厂商文档明确描述的行为称为“官方公开机制”；把可从公开行为推导、能迁移到自建系统的做法称为“通用工程模式”；把书内为讲清原理而构造、可离线运行的代码称为“教学参考实现”。三者在正文里始终分层标注，不把推导写成产品承诺，也不臆造任何厂商内部实现。

## 一次“少减五元”的真实故障

设想一个电商结算 Agent 接到任务：修复“优惠券偶发少减五元”。它注册了 `get_order`、`get_coupon_rule`、`apply_discount`、`charge_customer` 四个工具。上午九点，模型返回一个工具调用 `get_coupon_rule(coupon_id="C-88")`，运行时执行后把规则文本回填；十点，模型基于旧规则文本调用 `apply_discount`，参数里把 `rule_version` 写成了并不存在的 `"v0"`；运行时没有校验这个字段，直接放行；中午重试时网络抖动，`charge_customer` 被调了两次，同一订单扣款两笔。事后复盘发现三处独立缺陷：运行时没有按 Schema 校验模型伪造的 `rule_version`；并行调用里一个失败没有做部分降级；有副作用的扣款工具没有幂等键。这三处都不是“模型不聪明”，而是 Function Calling（函数调用，又称工具调用 Tool Calling）端到端协议的工程环节没有做扎实。

这个故障贯穿本章。它把一句模糊的“Agent 又出错了”，拆成协议五阶段里可定位的事件：工具怎么定义、模型返回了什么结构、运行时校验了没有、结果怎么带 `id` 回填、循环何时终止、错误如何变成模型能纠错的信号。把这条链路走通，你就能回答面试里最高频的那道题——“Function Calling 端到端到底是怎么工作的”。

## 你将得到什么

- 能凭记忆默画一次工具调用的端到端时序，并说清“模型只说不做、副作用全在运行时”这条铁律对应的可观察产出。
- 能读懂并归一化 OpenAI 与 Anthropic 两套消息协议：`tool_calls` / `tool_call_id` 与 `tool_use` / `tool_result`、`role=tool` 与 `tool_result` 块的差异。
- 能实现并行工具调用的并发执行、按 `id` 乱序配对、以及“五个里一个失败”的部分降级。
- 能在流式（streaming）场景下增量累积 `input_json_delta` 分片，并解释为什么半截 JSON 不能提前执行。
- 能运行一个完全离线、无需 API Key 的多轮协议状态机，看到含校验拒绝与自我纠错的完整运行轨迹。
- 能把超时、无效参数、拒绝三类错误统一成带 `is_error` 的结构化结果，并对照 OpenAI/Anthropic 公开机制说明边界。
- 能开出一张生产建议清单，并回答与 Function Calling 端到端相关的多道思考题。

## 小节地图

1. [一次工具调用的完整生命周期](/advanced/chapter-08/s01/)
2. [工具 Schema 与消息协议](/advanced/chapter-08/s02/)
3. [并行工具调用](/advanced/chapter-08/s03/)
4. [流式与增量解析](/advanced/chapter-08/s04/)
5. [端到端实现实战：多轮工具调用协议状态机](/advanced/chapter-08/s05/)
6. [错误恢复与真实系统](/advanced/chapter-08/s06/)
7. [Function Calling 端到端的生产踩坑与思考回答](/advanced/chapter-08/s07/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的数据链，围绕开头“少减五元”故障展开。工具集固定为四个；一条问题触发的调用序列固定；每个调用都带一个稳定的 `id`；结果回填时严格按 `id` 配对。这样任意一节抽取其中一个环节做最小演示，第 5 节再把它们组合成完整状态机。
```text
工具集（4 个）：
get_order(order_id)                 只读查询，无副作用
get_coupon_rule(coupon_id)          只读查询，无副作用
apply_discount(order_id, rule_ver)  写操作，幂等（重复设置结果一致）
charge_customer(order_id, amount)   写操作，非幂等，必须幂等键

一条问题触发的调用序列（带稳定 id）：
call_001 get_order(order_id="A-2026")          -> {"total": 105.0}
call_002 get_coupon_rule(coupon_id="C-88")     -> "满100减5，rule_version=v3"
call_003 apply_discount(order_id, rule_ver=v0) -> 参数非法（v0 不存在），被关口2 拦下
call_004 apply_discount(order_id, rule_ver=v3) -> {"discounted": 100.0}

目标输出：
最终文本答案 + 每一步的协议事件轨迹（谁在何时做了什么、结果靠 id 配对）
```
优化前，运行时直接信任模型给的参数并串行执行，扣款没有幂等键；优化后，运行时按 Schema 校验、并行独立调用、扣款带幂等键、错误带 `is_error` 回传。输出是否“看起来一样”不是判据——关键是每个决策都有来源、失败可定位、重试不产生重复副作用。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码，用来确认解释器可用，并把本章三条不变量固化成断言：调用与结果靠 `id` 配对而非顺序；无 `tool_use` 即自然终止；模型无状态、每轮都要重发历史。
```python
import sys


def pair_by_id(calls: list[dict], results: list[dict]) -> bool:
    ## 把乱序回传的结果按 id 配回调用，验证配对正确
    by_id = {r["tool_use_id"]: r["content"] for r in results}
    return all(by_id.get(c["id"]) is not None for c in calls)


def is_final(resp: dict) -> bool:
    return not any(b.get("type") == "tool_use" for b in resp["content"])


def run() -> None:
    calls = [{"id": "a"}, {"id": "b"}]
    results = [{"tool_use_id": "b", "content": "2"},   ## 顺序被打乱
               {"tool_use_id": "a", "content": "1"}]
    final_resp = {"content": [{"type": "text", "text": "done"}]}
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"按 id 配对成功={pair_by_id(calls, results)}")
    print(f"纯文本响应=自然终止={is_final(final_resp)}")
    print("热身通过：可以开始阅读本章")


if __name__ == "__main__":
    run()
```
保存为 `warmup_ch8.py`，运行 `python warmup_ch8.py`。预期输出：
```text
Python=3.10
按 id 配对成功=True
纯文本响应=自然终止=True
热身通过：可以开始阅读本章
```
Python 小版本可能不同，但需不低于 3.10。若“按 id 配对成功”为 False，说明你在用返回顺序而非 `id` 配对，这正是本章反复强调要避免的反模式。

## 阅读约定与来源

正文只引用可公开核验的一手资料：[来源](https://platform.openai.com/docs/guides/function-calling)（OpenAI Function calling 指南，含五步流程、`strict` 模式、`parallel_tool_calls` 参数）、[来源](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)（Anthropic Tool use 概览，含 `tool_use` / `tool_result` 往返与 `stop_reason`）、[来源](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)（Handle tool calls，含 `tool_use_id` 配对、`is_error` 与消息顺序约束）、[来源](https://docs.anthropic.com/en/docs/build-with-claude/streaming)（Streaming Messages，含 `input_json_delta` 与事件流）、[来源](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/parallel-tool-use)（Parallel tool use）、[来源](https://json-schema.org/)（JSON Schema，JavaScript Object Notation Schema）与 [来源](https://modelcontextprotocol.io/)（MCP，Model Context Protocol，模型上下文协议）。检索日期为 2026-08-24。

涉及价格、模型窗口、缓存期限、`tool_choice` 可选值、SDK（Software Development Kit，软件开发工具包）方法名等会变化的细节，以链接中的当前官方文档为准；本章讲稳定的协议机制，不把某次检索到的字段拼写或数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。

## 导读页故障定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 热身脚本报“配对失败” | 用返回顺序而非 id 配对 | 打乱 results 顺序即可复现 | 一律用 tool_use_id/tool_call_id 配对 | 单调用场景顺序恰好一致会掩盖问题 |
| 示例每次输出不同 | 误用真实模型或改动脚本 | 固定 ScriptedModel 后比对输出哈希 | 教学演示只用确定性假模型 | 真实模型集成测试本就允许波动 |
| 把两家协议当成同一套 | 未区分 role=tool 与 tool_result 块 | 分别打印两家消息形状 | 用归一化层折叠差异 | 具体字段以当前官方文档为准 |
| 读完仍以为模型自己调 API | 没建立“说 / 做”分离心智 | 复述时序图四条泳道 | 记住副作用只在运行时发生 | 服务端内置工具由厂商执行，属另一类 |
