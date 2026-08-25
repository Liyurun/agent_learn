2026 年 8 月检索更新。本章把三类内容严格分层标注：**官方公开机制**（有厂商文档或论文支撑的外部行为，如 OpenAI Function Calling 的 `tool_calls` 协议、流式响应里参数分片按 index 累积、Anthropic 的 tool use 循环、smolagents / PydanticAI / LangGraph 的公开定位）、**通用工程模式**（可从公开行为推导、能迁移到任何自建系统的做法，如「决策与执行分离」「异常即观察」「置信度/规则双兜底」「滑动窗口 + 摘要」）、**教学参考实现**（书内为讲清原理而构造、可离线运行、无需任何 API（Application Programming Interface，应用程序编程接口）Key 的 mock 代码）。三者始终分开标注，不把推导写成产品承诺，也不臆造任何厂商内部实现。会变化的参数（模型标识、上下文窗口、价格、字段名）一律注明「以当前官方文档为准」。

## 一场「白板 45 分钟」的真实面试

设想 2026 年 6 月的一场资深 Agent 工程师面试，时间线是这样的：**第 5 分钟**，面试官擦掉白板说「不用任何框架，写一个 ReAct（Reasoning and Acting，推理与行动）Agent 的核心循环」；**第 15 分钟**，他贴出一段自己「随手写」的 Agent 代码，问「这段有几个问题」；**第 25 分钟**，追问「smolagents、PydanticAI、LangGraph 你会怎么选」；**第 35 分钟**，加码「给你一个查订单的需求，工具怎么定义、模型传错参数怎么兜」；**第 42 分钟**，最后一击「要支持多轮追问，还要边流式输出边调工具，你怎么写」。整场面试没有一道题需要背诵 SDK（Software Development Kit，软件开发工具包）的精确字段名，却几乎每一道都能一眼看出：**你到底真写过 Agent，还是只读过文档**。

很多候选人栽在同一处：最小循环写成了 `while True` 没有上限；找茬只看出「死循环」一个问题；选型张口就是「LangGraph 最好」；工具定义只写「查订单」三个字；多轮对话每轮只发当前问题、模型完全失忆。这些都不是「不够聪明」，而是**没有把 Demo 与生产的差距刻进肌肉记忆**。本章就是把这场 45 分钟攻防拆成七个可复核、可运行的关卡，逐个补齐。

## 你将得到什么

- 能在白板上手写一个**完全可运行**的最小 ReAct 循环，并说清循环上限、决策与执行分离、异常即观察、兜底返回四个拿分点。
- 能对一段有缺陷的 Agent 代码一口气指出十处问题（三大致命 + 七条隐藏），并给出可运行的修复版。
- 能用一棵「选型决策树」按场景给出 smolagents / PydanticAI / LangGraph 的选择与理由，并讲清「框架内核都是同一个循环」。
- 能用纯 Python 写出带 description、schema 校验与失败兜底的工具定义，回答「模型老传错参怎么办」的标准链路。
- 能实现一个带滑动窗口与摘要压缩的多轮会话对象，并说清 user/assistant/tool 三类消息为什么都要存。
- 能写出「流式输出 + 工具调用」的正确骨架：delta 判空、`tool_calls` 按 index 分片拼接、执行后喂回、再发起第二轮。
- 能用一个「自我 review 清单脚本」在写完后自查终止条件、异常、幂等与可观测，把面试的「心理战」变成可复用的检查表。

## 小节地图

1. [手写最小 Agent：把 ReAct 循环写到能跑](/advanced/chapter-23/s01/)
2. [代码找茬：一段 Agent 循环里的十处缺陷](/advanced/chapter-23/s02/)
3. [框架选型对比：给场景给理由的决策树](/advanced/chapter-23/s03/)
4. [工具定义与参数校验：description 与 schema 的双保险](/advanced/chapter-23/s04/)
5. [多轮对话状态管理：history 累积、裁剪与隔离](/advanced/chapter-23/s05/)
6. [流式输出与工具调用：分片拼接与第二轮](/advanced/chapter-23/s06/)
7. [实操题通用技巧：把代码讲明白比写对更重要](/advanced/chapter-23/s07/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的「白板任务」：**实现一个能查天气、能做算术、必要时转人工的最小 Agent**，随关卡逐层加难。固定的教学工具箱与固定的一条任务贯穿全章，任意一节抽取其中一个环节做最小演示，第 7 节再把「自查」能力叠上去。
```text
贯穿工具箱（教学 mock，纯 Python、确定性、无需 API Key）：
  look_up_weather(city)  -> 返回固定假数据，如 {"city":"北京","temp_c":34}
  add(a, b)              -> 返回 a + b
  ask_human(reason)      -> 返回一句“已转人工：<reason>”

贯穿任务：
  “北京今天多少度？如果超过 30 度，帮我把 25 和 5 相加算出备用金。”
  预期决策链：look_up_weather(北京)=34 -> 34>30 成立 -> add(25,5)=30 -> 汇总回答

贯穿的“坏代码”（第 2 节找茬复用）：
  while True:                 ## 无上限
      action = model.decide(task)
      if action.is_done: ...  ## 轻信模型
      tools[action.tool](**action.args)  ## 无异常、无存在性检查
```
优化前，白板上的循环往往是 `while True` + 直接信任模型 + 工具裸调用；优化后，循环有硬上限、模型只出请求代码来执行、异常转成可读观察喂回、工具名先做存在性检查、参数先过 schema 校验、多轮有滑动窗口、流式按 index 拼片。判据不是「输出看起来正常」，而是**每个决策可解释、越界能被拦、失败可定位、重试不产生重复副作用**。这与 Anthropic《Building Effective Agents》的主张一致——能用简单可组合的模式就不要上复杂自治架构 [来源](https://www.anthropic.com/engineering/building-effective-agents)；也呼应 OpenAI《A practical guide to building agents》：先从单 Agent 起步，真正需要时再引入编排 [来源](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码，用来确认解释器可用，并把本章最核心的抽象——**「模型只出请求、代码来执行」的最小骨架**——固化下来。这里的 `MockModel` 不调用任何真实接口，只按关键词返回决策，确保确定性、可逐字复核。
```python
"""README 热身：最小 ReAct 骨架自检（纯 Python，无需 API Key）。"""
from dataclasses import dataclass


@dataclass
class Decision:
    kind: str            ## "tool" 或 "final"
    tool: str = ""
    args: dict = None
    answer: str = ""


class MockModel:
    """教学用假模型：按关键词决定下一步，绝不联网。"""
    def decide(self, task: str, history: list) -> Decision:
        if not history:                       ## 第一步：先查天气
            return Decision("tool", tool="look_up_weather", args={"city": "北京"})
        return Decision("final", answer="热身通过：模型出请求、代码来执行")


def run() -> None:
    model = MockModel()
    history = []
    step1 = model.decide("北京今天多少度", history)
    print(f"第 1 步决策：kind={step1.kind} tool={step1.tool} args={step1.args}")
    history.append(step1)
    step2 = model.decide("北京今天多少度", history)
    print(f"第 2 步决策：kind={step2.kind} answer={step2.answer}")


if __name__ == "__main__":
    run()
```
保存为 `warmup.py`，运行 `python warmup.py`。预期输出：
```text
第 1 步决策：kind=tool tool=look_up_weather args={'city': '北京'}
第 2 步决策：kind=final answer=热身通过：模型出请求、代码来执行
```
Python 版本需不低于 3.7（用到 `dataclass`）。这段热身刻意把「决策」做成一个数据对象而不是直接执行——这正是全章反复强调的第一性原理：**模型只负责「决定调什么」，真正「执行」永远由你的代码做**。把这一点想透，后面六节的所有代码都只是它的加厚版。

## 阅读约定与来源

正文只引用可公开核验的一手资料：ReAct 的循环范式出自论文《ReAct: Synergizing Reasoning and Acting in Language Models》[来源](https://arxiv.org/abs/2210.03629)；工具调用协议与流式分片以 OpenAI Function Calling 官方指南为准 [来源](https://platform.openai.com/docs/guides/function-calling)、跨供应商可对照 Anthropic Tool use 文档 [来源](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)；参数校验的做法参考 Pydantic 官方 validators 文档 [来源](https://docs.pydantic.dev/latest/concepts/validators/)；三个候选框架的定位见各自官方仓库 [来源](https://github.com/huggingface/smolagents) [来源](https://github.com/pydantic/pydantic-ai) [来源](https://github.com/langchain-ai/langgraph)。检索日期为 2026-08-24。

涉及模型标识、上下文窗口、价格、SDK 方法名、框架 Star 数与版本特性等会变化的细节，一律以链接中的当前官方文档为准；面试时对这类硬数据要坦承「具体记不准」，讲清**结构与逻辑**远比硬编一个错字段更能得分。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。
