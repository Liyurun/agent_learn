2026 年 8 月检索更新。本章把所有内容严格分三层标注：**官方公开机制**（有厂商文档或权威新闻稿支撑的外部行为，如 Anthropic 的 Prompt Caching 计价、OpenAI 的 `seed`/`system_fingerprint`、LangSmith 的评估数据模型、OWASP 对提示注入的定义）、**通用工程模式**（可从公开行为推导、能迁移到任何自建系统的做法，如分层排查、置信度兜底、评估集回归）、**教学参考实现**（书内为讲清原理而构造、可离线运行、无需任何 API（Application Programming Interface，应用程序编程接口）Key 的 mock 代码）。三者始终分开标注，不把推导写成产品承诺，也不臆造厂商内部实现。会变化的参数（价格、上下文窗口、时限、模型标识）一律注明「以当前官方文档为准」。

面试里的「场景与实战题」不是考你背多少定义，而是考一件事：**当线上出问题时，你能不能像工程师一样定位、给方案、并用数据证明修好了**。本章把面试高频的 11 道场景题，按「一个真实故障板」串成一条可复核的排障链路。

## 一个真实的「故障板」开场

设想 2026 年 3 月，一家 3C（Computer、Communication、Consumer Electronics，消费电子）电商上线了智能客服 Agent「小蜜」。上线第 14 天，运营把一块「故障板」拍在你桌上，上面是过去 7 天的观测数据：
```text
【小蜜·上线第 14 天故障板（近 7 天）】
指标                     当前值      目标/预算     状态
P95 端到端延迟           8.2 s       ≤ 3.0 s       ✗ 超标 2.7 倍
幻觉率（无依据作答占比）  6.1%        ≤ 1.0%        ✗ 超标 6 倍
日均 Token 成本          ¥1,240      ≤ ¥600        ✗ 超预算
工具传参错误率           12%         ≤ 2%          ✗ 偏高
路由准确率（多 Agent）    83%         ≥ 95%         ✗ 偏低
同一问题两次作答一致率    71%         ≥ 90%         ✗ 飘忽
提示注入拦截率           未统计       建立基线       ✗ 无数据
评估集覆盖真实场景        0 条         ≥ 200 条      ✗ 从零
```
面试官指着这块板问你：「挑三个指标，说说你会怎么排查、怎么改、怎么证明改好了。」——这就是场景题的真实样貌：**模糊的现象、有限的数据、要求你给出可验证的行动**。本章每一节都对应这块板上的一到两个指标，给你一套「定位 → 分层给方案 → 验证与兜底」的通用骨架，并把 11 道原题各自加深到「分析 → 方案 → 用数据说话的验证」。

## 你将得到什么

- 能用「定位 → 分层方案 → 验证兜底」三段式回答任意场景题，并说清「我怎么知道是这层的问题」。
- 能把幻觉率从 6.1% 降到 1% 以下：分检索 / 融合 / Prompt / 输出四层排查，并把案例收进评估集防复发。
- 能把 P95 延迟从 8.2s 压到 3s 内、日成本从 ¥1,240 降到 ¥600 内：先归因再对症，用 Prompt Caching、模型分级、并发与流式组合出牌。
- 能把工具传参错误率从 12% 降到 2%、路由准确率从 83% 提到 95%：先改工具描述与 schema，再谈换模型。
- 能从零构建 200 条评估集：人工种子集 + 大模型扩充 + 线上回流，区分客观题规则判分与主观题 LLM-as-a-judge（Large Language Model as a Judge，用大模型当裁判）。
- 能设计提示注入的纵深防御与稳定性控制，并按「风险 × 可逆性」画出人机协作边界决策表。

## 小节地图

1. [场景题答题心法：从「急着给方案」到「先定位再验证」](/advanced/chapter-24/s01/)
2. [幻觉排查与治理：分层定位与引用溯源](/advanced/chapter-24/s02/)
3. [延迟与成本优化：先归因再对症的降本提速](/advanced/chapter-24/s03/)
4. [工具传参与路由错误：先改描述再怪模型](/advanced/chapter-24/s04/)
5. [评估从零构建：冷启动评估集与回归驱动](/advanced/chapter-24/s05/)
6. [提示注入与稳定性：纵深防御与非确定性控制](/advanced/chapter-24/s06/)
7. [冷启动与人机协作边界：飞轮启动与风险分级](/advanced/chapter-24/s07/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的数据链，围绕上面「小蜜」的故障板展开。会话固定为 `session_id=S-0314`；一个贯穿投诉样本固定为「订单 O-778 金额不对，我要投诉，再不解决就打 12315」；知识库固定三篇（退换货总则、3C 七天无理由、退款流程）。每一节抽取故障板上的一到两个指标，给出「优化前数值 → 分层措施 → 优化后数值」的闭环，第 5 节的评估集把这些真实失败样本沉淀为回归资产。约定的「优化前 → 优化后」目标如下，供各节引用：

| 指标 | 优化前 | 优化后目标 | 主责小节 |
|---|---|---|---|
| 幻觉率 | 6.1% | ≤ 1.0% | 第 2 节 |
| P95 延迟 | 8.2 s | ≤ 3.0 s | 第 3 节 |
| 日 Token 成本 | ¥1,240 | ≤ ¥600 | 第 3 节 |
| 工具传参错误率 | 12% | ≤ 2% | 第 4 节 |
| 路由准确率 | 83% | ≥ 95% | 第 4 节 |
| 评估集规模 | 0 条 | ≥ 200 条 | 第 5 节 |
| 注入拦截率 | 无基线 | 建立并 ≥ 99% | 第 6 节 |
| 两次作答一致率 | 71% | ≥ 90% | 第 6 节 |

这些数字是教学故障板，用来演示「用数据说话」的排障方式；不代表任何真实产品的基准。真正的判据不是「看起来正常了」，而是每一步优化都能在评估集上量化验证、都说清了代价（权衡）。这与 Anthropic《Building Effective Agents》的主张一致——能用简单可组合的模式就不要上复杂架构，复杂度必须由收益证明 [来源](https://www.anthropic.com/engineering/building-effective-agents)；也呼应 OpenAI《A practical guide to building agents》先量化再迭代的思路 [来源](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码，用来固化本章最核心的「答题骨架」——把一次排障拆成「定位 → 分层方案 → 验证」三段，并强制每段都要有数据支撑。它是后续每一节的通用模板。
```python
"""README 热身：场景题三段式排障骨架（纯 Python，无需 API Key）。"""
from dataclasses import dataclass, field


@dataclass
class Diagnosis:
    metric: str                 ## 要排查的指标（来自故障板）
    baseline: float             ## 优化前数值
    evidence: str               ## 定位依据：靠 Trace/日志，而非直觉
    layers: list = field(default_factory=list)   ## 分层方案（按优先级）
    verify: str = ""            ## 如何用数据证明改好了


def answer(d: Diagnosis) -> str:
    if not d.evidence:
        return f"[{d.metric}] 缺少定位依据：先看 Trace，别凭直觉猜"
    if not d.verify:
        return f"[{d.metric}] 缺少验证方式：改完必须跑评估集回归"
    plan = " → ".join(d.layers) if d.layers else "（未分层）"
    return f"[{d.metric}] 基线={d.baseline} | 定位={d.evidence} | 方案={plan} | 验证={d.verify}"


def run() -> None:
    demo = Diagnosis(
        metric="幻觉率", baseline=6.1,
        evidence="Trace 显示 40% 幻觉发生在'未召回却硬答'",
        layers=["检索层扩召回", "Prompt 层强制无依据不作答", "输出层加引用护栏"],
        verify="把 60 条幻觉样本收进评估集，改动后跑回归看幻觉率是否≤1%",
    )
    print(answer(demo))
    print(answer(Diagnosis(metric="延迟", baseline=8.2, evidence="")))


if __name__ == "__main__":
    run()
```
保存为 `warmup.py`，运行 `python warmup.py`。预期输出：
```text
[幻觉率] 基线=6.1 | 定位=Trace 显示 40% 幻觉发生在'未召回却硬答' | 方案=检索层扩召回 → Prompt 层强制无依据不作答 → 输出层加引用护栏 | 验证=把 60 条幻觉样本收进评估集，改动后跑回归看幻觉率是否≤1%
[延迟] 缺少定位依据：先看 Trace，别凭直觉猜
```
注意第二条输出：只要缺少「定位依据」或「验证方式」，这个骨架就拒绝给方案——这正是场景题的核心心法：**没有 Trace 数据支撑的方案是瞎猜，没有评估集回归的方案没法证明有效**。Python 版本需不低于 3.10（用到了 `dataclass` 与内置泛型标注）。

## 阅读约定与来源

正文只引用可公开核验的一手资料：OWASP 对提示注入的定义与「模型不区分指令与数据」的判断 [来源](https://owasp.org/www-project-top-10-for-large-language-model-applications/)、Anthropic 的 Prompt Caching 计价与降本机制 [来源](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)、Anthropic 的降低幻觉指南与 Citations 引用能力 [来源](https://docs.anthropic.com/en/docs/minimizing-hallucinations)[来源](https://www.anthropic.com/news/introducing-citations-api)、OpenAI 的 `seed`/`system_fingerprint` 可复现输出 [来源](https://developers.openai.com/api/docs/guides/advanced-usage.md)、LangSmith 的评估数据模型与 LLM-as-a-judge [来源](https://docs.smith.langchain.com/evaluation/concepts)、OpenAI 的 Guardrails 与 Human-in-the-Loop（HITL，人在环中）审批 [来源](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals.md)。检索日期为 2026-08-24。涉及价格、时限、字段名等会变化的细节，一律以链接中的当前官方文档为准；仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。
