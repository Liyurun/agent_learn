2026 年 8 月检索更新。本章只把厂商文档明确描述的行为称为「官方公开机制」；对模式动机与取舍的解释属于可迁移的「通用工程模式」；所有示例代码都是「教学参考实现」，用确定性 Mock（模拟器）替代真实模型，不代表 Claude Code、Anthropic API（Application Programming Interface，应用程序编程接口）或任何产品的内部源码。

本章的五种模式直接来自 Anthropic 的 [来源](https://www.anthropic.com/engineering/building-effective-agents)（Building Effective Agents，2024-12-19 发布）。这篇文章最关键的贡献不是罗列模式，而是先立一条边界：把「Agentic 系统」拆成两个世界——工作流（Workflows）与 Agent（Agents），并给出一句贯穿全书的工程判断：**能用自主性更低的方案满足需求，就别引入更高的自主性。**

## 一次「五分钟需求做成三天工程」的真实故障

某电商团队要给客服系统加一个能力：用户上传一段文字，系统判断是否违规、若合规就生成回复、再润色一遍。9:20，一位工程师认为这是「智能体的活」，直接上了一个开放循环 Agent，把「审查、生成、润色、发送」四个动作全交给模型自主编排；11:00，灰度上线后监控告警：单请求平均调用模型 9 次、P95 延迟从预期的 1.2 秒涨到 7.8 秒，当天多烧掉约 40% 的 Token（Token，模型计费与上下文的基本单位）；14:30，出现一次真实事故——模型在自主循环里「决定」先生成回复再审查，一条含辱骂的内容被发出去了；次日复盘发现，这个需求的四个动作顺序其实是**固定**的，根本不需要模型来决定流程。

把它重写成工作流后：审查与生成用**并行化**同时跑（审查不通过直接丢弃生成结果），润色用**评估-优化**兜质量，顶层用**路由**按内容类型分流。调用次数从 9 次降到 3 次，P95 回落到 1.5 秒，违规内容因为「审查是确定性前置闸门」而不可能被绕过。这不是模型变强了，而是**把可预测的流程写死在代码里，把不确定性关进最小的笼子**。

这次故障贯穿本章所有页面：每一种模式，我们都问同一组问题——它把哪部分交给代码、哪部分交给模型？它的失败模式是什么？它和相邻模式的唯一本质区别在哪？

## 你将得到什么

- 能一句话说清工作流与 Agent 的区别，并在系统设计题里判断该用哪个（可观察产出：白板上画出自主性光谱并定位五种模式）。
- 能手写五种模式的最小骨架：提示链、路由、并行化、编排者-工作者、评估-优化（可观察产出：无需 API Key 即可运行的纯 Python 代码 + 运行轨迹）。
- 能说清每种模式的适用条件、不适用边界与头号失败模式（可观察产出：每种模式的生产踩坑表）。
- 能分辨两组必考混淆题：并行化 vs 编排者-工作者、分段 vs 投票（可观察产出：用「改代码」和「审代码」两个例子讲透）。
- 能把五种模式当积木组合成真实系统，并识别「过度设计」（可观察产出：给一个需求画出组合流程并标注模式）。
- 能背出 Anthropic 三大设计原则（简单性、透明性、精心设计 ACI）并解释为什么简单性排第一。

## 小节地图

1. [Prompt Chaining 提示链](/advanced/chapter-10/s01/)
2. [Routing 路由](/advanced/chapter-10/s02/)
3. [Parallelization 并行化](/advanced/chapter-10/s03/)
4. [Orchestrator-Workers 编排者-工作者](/advanced/chapter-10/s04/)
5. [Evaluator-Optimizer 评估-优化](/advanced/chapter-10/s05/)
6. [五种模式实战：一套骨架跑通并对比](/advanced/chapter-10/s06/)
7. [模式选择与生产踩坑](/advanced/chapter-10/s07/)

## 章节贯穿案例与数据

后续页面统一复用同一条可复核的业务线索，方便横向对比五种模式：一个电商客服/研发系统，需要处理三类输入——退款咨询、技术报错、通用问答；一个待修复的缺陷「结算优惠券偶发少减金额」，事先不知道要改几个文件；一段用户评论「发货太慢了，不过客服态度不错」需要被多角度分析；一段英文说明需要反复润色到术语与流畅度达标。
```text
统一线索：
输入类型：refund（退款）/ technical（技术）/ general（通用）
待修缺陷：结算优惠券少减 —— 运行时才知道要改 checkout.py / coupon.py / tax.py
评论样本：发货太慢了，不过客服态度不错
润色目标：术语必须出现 connection pool，句式需简洁流畅

模式与线索的对应：
提示链      -> 大纲→正文→翻译（固定顺序）
路由        -> 三类输入分派到专门处理器
并行化      -> 评论三角度分析（分段）/ 代码漏洞多实例判断（投票）
编排者-工作者 -> 结算缺陷运行时分解为 N 个文件修改
评估-优化    -> 英文说明的生成-评估循环
```
每页会抽取其中一条线索做最小示例，第 6 页再把五种模式合并到同一套 `MockProvider`（确定性模型替身）里跑通并打印调用轨迹，用「调用次数」和「调用形状」直观区分五种模式。

## 最小环境核验：一段可运行的热身代码

导读页提供一个不依赖模型、不联网的热身程序，用来在阅读前确认解释器可用、并直观感受「工作流就是被代码编排的一串确定步骤」。
```python
import sys


def gate(text: str) -> bool:
    """程序化关卡：中间结果不达标就拦截，这是工作流可控性的来源。"""
    return text.count("\n") >= 2


def warmup() -> None:
    outline = "1. 根因\n2. 定位\n3. 修复"          # 假装这是第一步 LLM 的输出
    passed = gate(outline)
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"大纲要点数={outline.count(chr(10)) + 1}")
    print(f"gate 是否放行={passed}")


if __name__ == "__main__":
    warmup()
```
从任意目录保存为 `warmup_ch10.py`，运行 `python warmup_ch10.py`。预期输出（Python 小版本可不同，但需 3.8+）：
```text
Python=3.10
大纲要点数=3
gate 是否放行=True
```
这段代码没有调用任何模型，却已经包含工作流的灵魂：**在两次「昂贵步骤」之间插入一个廉价的程序化 gate**。若把 `outline` 改成只有一行的文本，`gate` 会返回 `False`，流程应提前止损——这正是第 1 页要展开的机制。

## 阅读约定与来源

正文只引用可公开核验的一手资料：[来源](https://www.anthropic.com/engineering/building-effective-agents)（Anthropic《Building Effective Agents》，五种模式与三大原则的权威出处）、[来源](https://platform.claude.com/cookbook/patterns-agents-basic-workflows)（Anthropic Cookbook 的模式示例实现）、[来源](https://docs.langchain.com/oss/python/langgraph/workflows-agents)（LangGraph 官方「Workflows and agents」文档，给出同名模式的图与代码）、[来源](https://huyenchip.com/2025/01/07/agents.html)（Chip Huyen《Agents》，工作流与规划的工程视角）、[来源](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)（OpenAI《A practical guide to building agents》，编排模式的实践建议）。检索日期 2026-08-24。

涉及价格、模型型号、上下文窗口、速率上限等会变化的参数，一律以链接中的当前官方文档为准；本章讲稳定机制，不把某次检索的数字写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入 7 个正文页面。
