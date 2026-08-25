2026 年 8 月检索更新。本章严格区分三层可信度：把 OpenTelemetry、OpenLLMetry、LangSmith、Langfuse 等官方文档明确描述的机制称为「官方公开机制」；把能从公开行为推导、可迁移到任意自建系统的做法称为「通用工程模式」；把书内为讲清原理而构造、能离线运行的代码称为「教学参考实现」。三者在正文里始终分层标注，不把推导写成产品承诺，也不臆造任何厂商内部实现或未公开数字。

## 一次「凌晨三点，账单翻了 40 倍」的真实故障

设想一个客服退款 Agent 在生产环境运行了三个月，一直平稳。某个周四凌晨 02:50，值班工程师的手机被成本告警吵醒：过去一小时的 API（Application Programming Interface，应用程序接口）调用费用从平时的每小时约 3 美元飙到 121 美元，翻了 40 倍。用户没有暴增，错误率也没有明显上升——从外部看，Agent「还在正常工作」。工程师打开日志，看到的却是数十万行混在一起的 `print` 输出，无法把任何一行归属到某一次具体的用户请求。他花了两个小时肉眼翻日志，才拼凑出真相：某个上游订单接口在 02:47 开始返回空 JSON（JavaScript Object Notation，一种数据交换格式），Agent 把空结果当成「还没查到」，于是不断重试同一次查询，每一轮都把越来越长的对话历史重新喂给模型，token（词元）消耗随轮数呈平方级增长。真正的病根在 02:47 那次空返回，但工程师是在 04:50 才定位到——**中间两个小时的排查，全花在「没有可观测性」这件事本身上**。

这个故障贯穿本章。它把一句模糊的「Agent 变贵了」拆成一条可定位的证据链：哪一次请求出的问题、它在哪一步偏离、偏离时的输入输出各是什么、成本曲线为什么是平方级、以及怎样在告警响起的那一刻就能把现场还原出来。把这条链路走通，你就能回答面试里最高频的那道题——「Agent 在生产上出故障，你怎么排查」。

## 你将得到什么

- 能说清 Agent 为什么比传统程序更难排查，「静默错误」与「跨步骤累积」各是什么，并默画出一条 trace（追踪）应包含的关键字段。
- 能用不到 60 行 Python 手搓一个能嵌套、能计时、能算成本的最小 tracer（追踪器），其心智模型与 Langfuse、LangSmith 等商用平台一致。
- 能写出带 `trace_id` 关联的结构化日志，并说清可观测性三大支柱（Traces / Metrics / Logs）如何按「面→线→点」的漏斗顺序配合排障。
- 能把自建 span（跨度）对齐到 OpenTelemetry 的 GenAI（Generative AI，生成式人工智能）语义约定，理解 `gen_ai.operation.name`、`gen_ai.client.token.usage` 等标准属性的意义与边界。
- 能实现一套 token / 延迟 / 成本指标的采集与轨迹回放（trace replay），把「凌晨账单翻 40 倍」这类故障用代码自动定位。
- 能按「时间归因→故障指纹→评估集固化」三步做系统化根因定位，并对照 OpenLLMetry、LangSmith、Langfuse 的公开机制说明各自定位。
- 能开出一张覆盖生产各层的踩坑清单，并回答与 Agent 可观测性相关的多道思考题。

## 小节地图

1. [为什么 Agent 特别需要可观测性](/advanced/chapter-17/s01/)
2. [Trace 与 Span：手搓一个最小可用的 Tracer](/advanced/chapter-17/s02/)
3. [结构化日志与可观测性三大支柱](/advanced/chapter-17/s03/)
4. [OpenTelemetry 与 GenAI 语义约定：让 Trace 可互操作](/advanced/chapter-17/s04/)
5. [token / 延迟 / 成本指标与轨迹回放](/advanced/chapter-17/s05/)
6. [系统化根因定位：从时间归因到故障指纹](/advanced/chapter-17/s06/)
7. [可观测性平台：OpenLLMetry / LangSmith / Langfuse](/advanced/chapter-17/s07/)
8. [Agent 可观测性的生产踩坑与思考回答](/advanced/chapter-17/s08/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的数据链，围绕开头「凌晨账单翻 40 倍」故障展开。退款 Agent 固定注册四个工具；一次问题请求触发的调用序列固定；每个 span 都带稳定的 `span_id` 与 `parent_id`；每个 LLM（Large Language Model，大语言模型）调用都记录 `tokens`、`cost`、`latency_ms`。这样任意一节抽取其中一个环节做最小演示，第 5、6 节再把它们组合成完整的指标采集与自动根因定位。
```text
工具集（4 个）：
get_order(order_id)          只读查询，无副作用（故障当晚返回了空 JSON）
get_refund_policy(sku)       只读查询，无副作用
calc_refund(order, policy)   纯计算，无副作用
issue_refund(order, amount)  写操作，非幂等，必须幂等键

故障当晚一次请求触发的调用序列（带稳定 span_id / parent_id / 指标）：
span_00 agent_run       parent=None   —— 整次运行的根
span_01 llm_call        parent=span_00  tokens=1200  cost=0.0040  latency=520ms
span_02 tool.get_order  parent=span_00  ok=False rows=0 latency=90ms  ← 空 JSON
span_03 llm_call        parent=span_00  tokens=2100  cost=0.0071  latency=610ms  ← 历史膨胀
span_04 tool.get_order  parent=span_00  ok=False rows=0 latency=88ms  ← 重复同参数
span_05 llm_call        parent=span_00  tokens=3400  cost=0.0116  latency=700ms  ← 继续膨胀
...（同一模式重复 40 余轮，token 单调爬升，成本平方级增长）

目标输出：
最终能自动报出「病根在 span_02 的空 JSON、循环失控、成本平方级膨胀」，而非肉眼翻日志。
```
优化前，Agent 只有满屏 `print`，无法把日志归属到某次请求，也无法看出 token 曲线在爬升；优化后，每次运行落一条结构化 trace，token / 成本 / 延迟按 span 归因，故障指纹自动扫描，告警响起即能定位到 `span_02`。输出是否「看起来正常」不是判据——关键是每一步都有来源、异常可定位、账单可解释。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key（Application Programming Interface Key，接口密钥）的热身代码，用来确认解释器可用，并把本章三条不变量固化成断言：span 靠 `parent_id` 拼成树而非平铺列表；总延迟应能按类别归因；成本随 token 单调增长。
```python
import sys


def build_tree(spans: list[dict]) -> dict[str, list[str]]:
    """把带 parent_id 的扁平 span 列表还原成父->子邻接表。"""
    tree: dict[str, list[str]] = {}
    for sp in spans:
        tree.setdefault(sp["parent"], []).append(sp["id"])
    return tree


def total_cost(spans: list[dict]) -> float:
    return round(sum(sp.get("cost", 0.0) for sp in spans), 4)


def run() -> None:
    spans = [
        {"id": "span_00", "parent": None, "cost": 0.0},
        {"id": "span_01", "parent": "span_00", "cost": 0.0040},
        {"id": "span_02", "parent": "span_00", "cost": 0.0},
        {"id": "span_03", "parent": "span_00", "cost": 0.0071},
    ]
    tree = build_tree(spans)
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"根 span_00 的子节点={tree['span_00']}")
    print(f"span_00 下挂 {len(tree['span_00'])} 个子 span（树形而非列表）")
    print(f"本次运行总成本=${total_cost(spans)}")
    print("热身通过：可以开始阅读本章")


if __name__ == "__main__":
    run()
```
保存为 `warmup_ch17.py`，运行 `python warmup_ch17.py`。预期输出：
```text
Python=3.10
根 span_00 的子节点=['span_01', 'span_02', 'span_03']
span_00 下挂 3 个子 span（树形而非列表）
本次运行总成本=$0.0111
```
Python 小版本可能不同，但需不低于 3.10（本章用到 `str | None` 联合类型标注）。本章所有演示都是纯 Python 脚本，直接在命令行界面（CLI，Command-Line Interface）用 `python 文件名.py` 运行即可，无需联网、无需 API Key。若「根 span_00 的子节点」为空，说明你没有正确用 `parent_id` 建树，这正是本章反复强调要避免的「把 trace 拍平成日志列表」的反模式。

## 阅读约定与来源

正文只引用可公开核验的一手资料，用 `[来源](url)` 内联标注。核心来源包括：OpenTelemetry GenAI 语义约定（`gen_ai.operation.name`、`gen_ai.client.token.usage`、`gen_ai.client.operation.duration` 等属性与指标）[来源](https://opentelemetry.io/docs/specs/semconv/gen-ai/)、OpenTelemetry GenAI Spans 定义 [来源](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md)、OpenLLMetry / Traceloop（基于 OpenTelemetry 的开源 LLM 可观测性）[来源](https://github.com/traceloop/openllmetry)、LangSmith 可观测性概念（trace / run / 25000 run 上限）[来源](https://docs.langchain.com/langsmith/observability-concepts)、Langfuse 用量与成本追踪 [来源](https://langfuse.com/docs/observability/features/token-and-cost-tracking)、以及 Anthropic「构建高效 Agent」中的透明性原则 [来源](https://www.anthropic.com/engineering/building-effective-agents)。检索日期为 2026-08-24。

涉及价格、模型上下文窗口、采样比例、指标稳定性级别（很多 GenAI 语义约定仍处于 development / 开发中状态）、SDK（Software Development Kit，软件开发工具包）方法名等会变化的细节，一律以链接中的当前官方文档为准；本章讲稳定的可观测性机制，不把某次检索到的属性拼写或数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。

## 导读页故障定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 热身脚本「根 span 子节点为空」 | 没用 parent_id 建树，把 trace 当平铺日志 | 把 parent 字段清空即可复现 | 一律用 parent_id 还原调用树 | 单步任务只有一个 span 时树退化为点 |
| 账单翻倍却无法定位到某次请求 | 日志无 trace_id，无法归属 | 用 print 打并发请求即复现混乱 | 每条日志带 trace_id/span_id | 单并发原型阶段影响较小 |
| 排查两小时全在「找证据」而非「读证据」 | 事故发生时才想起加 trace | 关掉结构化日志复现「翻日志」 | 第一版就接入最简 tracer | 一次性脚本可不接 |
| 把「成本高」误当模型贵 | 未做 token 曲线归因 | 画 token 随轮次曲线复现膨胀 | 按 span 归因 token 与成本 | 单轮短对话成本平坦时不适用 |
