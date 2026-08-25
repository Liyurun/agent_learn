2026 年 8 月检索更新。本章把内容严格分三层标注：**官方公开机制**（有厂商文档、规范或论文支撑的外部行为，如 Anthropic《Building Effective Agents》对 Workflow 与 Agent 的区分、Model Context Protocol（模型上下文协议，缩写 MCP）规范的 Host/Client/Server 架构、OpenAI Function Calling 文档里「模型只返回调用请求、由应用执行」的定义）、**通用工程模式**（可从公开行为推导、能迁移到任何自建系统的做法，如分层记忆、置信度兜底、答案附引用）、**教学参考实现**（书内为讲清原理而构造、可离线运行、无需任何 API（Application Programming Interface，应用程序编程接口）Key 的示例代码）。三者始终分开标注，不把推导写成产品承诺，也不臆造任何厂商内部实现。会变化的参数（模型窗口、价格、时限、SDK（Software Development Kit，软件开发工具包）方法名）一律注明「以当前官方文档为准」。

## 一场「背了 30 道题却挂在第一问」的真实面试

设想 2026 年 3 月一位候选人参加某大厂 Agent 岗的二面。面试官第一句就问「你说说什么是 AI Agent，它和普通的大模型（Large Language Model，LLM）调用有什么区别」。候选人张口就来：「Agent 就是能感知、能决策、能调用工具的智能体，有记忆、有规划、有反思……」——名词堆得又快又满，面试官却皱起了眉。接着追问：「那我写一段代码，先让模型总结文档、再调翻译接口、最后发邮件，这算不算 Agent？」候选人愣住了，答「算吧，它调了工具」。面试官摇头，这道题就此定调：**这位候选人背下了所有名词，却没想清一个概念的边界在哪、对立面是什么。** 面试结束的复盘只有一句话：「知识点全会，但一追问就散架。」

这场面试会贯穿全章。它把「概念题准备」这件事，从「背标准答案」拆成了一串可训练的工程动作：怎么用一句话压缩定义、怎么把概念拆成正交维度、怎么主动点出代价与边界、怎么用一个 30 秒能讲清的例子落地、被连环追问时怎么顺着「定义→原理→边界→实践」四层往下走。把这条链路走通，你面对的就不再是「11 道孤立的题」，而是「一套能应对任何概念追问的答题引擎」。

## 你将得到什么

- 能说清概念题背后考的三种能力信号（压缩、结构、边界），并用「一句话定义 → 展开维度 → 例子或对比」的结构组织任何一道概念题的回答。
- 能把 Agent 与 Workflow（工作流）、ReAct（Reasoning and Acting，推理与行动）与 Chain-of-Thought（思维链，缩写 CoT）的关系讲成一条「控制权归属」的光谱，而不是非黑即白的二分。
- 能画出 Function Calling（函数调用）的端到端时序，讲透「模型只请求、应用才执行」这个最高频的失分点，并说清参数校验与执行容错。
- 能用「M×N → M+N」的复杂度变化解释 MCP 的价值，并把它和 Function Calling 定位成不同层次而非竞争关系。
- 能给出单 Agent 优先、何时才拆多 Agent 的决策路径，并列出多 Agent 的代价清单。
- 能对比 ReAct 与 Plan-and-Execute（先规划后执行）、Agentic RAG（Retrieval-Augmented Generation，检索增强生成）与传统 RAG、上下文工程与 Prompt Engineering（提示工程）的本质区别。
- 能讲清 Agent 幻觉的三种特有形态（内容幻觉、行动幻觉、错误累积）与四层治理，并从容应对连环追问。

## 小节地图

1. [答题方法论：概念题背后考的三种能力信号](/advanced/chapter-21/s01/)
2. [Agent 本质与 ReAct：控制权归属与推理行动闭环](/advanced/chapter-21/s02/)
3. [记忆系统与 Function Calling：分层记忆与工具调用边界](/advanced/chapter-21/s03/)
4. [MCP 与多 Agent：标准化协议与架构克制](/advanced/chapter-21/s04/)
5. [规划与上下文工程：从目标分解到上下文装配](/advanced/chapter-21/s05/)
6. [Agentic RAG 与反思：自主检索与自我批评](/advanced/chapter-21/s06/)
7. [幻觉成因与连环追问应对：错误累积与四层治理](/advanced/chapter-21/s07/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的「一问到底」案例链，围绕开头那场面试展开。固定一位候选人 `C-0312`、一位面试官、一道开场题「什么是 AI Agent」，以及一条固定的连环追问链：**定义 → 与 Workflow 的界限 → 是不是都该用 Agent → 自主性的代价 → 举个例子**。每一节都从这条追问链里抽取一个环节做深挖：第 2 节深挖「Agent 与 Workflow 的界限」，第 3 节深挖「Function Calling 里谁执行函数」，第 4 节深挖「MCP 和 Function Calling 什么关系」，第 5 节深挖「ReAct 和 Plan-and-Execute 怎么选」，第 6 节深挖「传统 RAG 什么时候就够了」，第 7 节把所有追问收敛到「连环追问四层应答链」。这样 11 道题不再孤立，而是同一条「压缩—结构—边界」训练线上的不同切片。
```text
候选人 C-0312 的连环追问链（贯穿全章）：
  Q  「什么是 AI Agent？」                          -> 第 2 节：一句话定义 + 控制权光谱
  ├─ 追问1「和 Workflow 界限在哪？」                -> 第 2 节：谁决定下一步
  ├─ 追问2「Function Calling 里谁执行函数？」        -> 第 3 节：模型只请求、应用才执行
  ├─ 追问3「MCP 和 Function Calling 什么关系？」     -> 第 4 节：不同层次不冲突
  ├─ 追问4「ReAct 和 Plan-and-Execute 怎么选？」     -> 第 5 节：边做边规划 vs 先规划后执行
  ├─ 追问5「传统 RAG 什么时候就够？」                -> 第 6 节：单跳准确优先场景
  └─ 追问6「Agent 为什么会幻觉、怎么治？」            -> 第 7 节：三形态 + 四层治理
目标输出：每个环节都能讲到「定义→原理→边界→实践」四层，被连续追问也不散架
```
优秀回答和背题回答的差别，不在于「知不知道名词」，而在于**能不能沿着这条链往深走**。背题的人只有第一层（定义），一追问就卡；真懂的人能自然走到第三层（边界）和第四层（实践）。本章每道题的分层解析，都会刻意训练「往下走一层」的能力。这与 Anthropic 在《Building Effective Agents》里反复强调的取舍观一致——**能用简单模式解决就别上复杂自治架构，自主性的复杂度必须由收益证明** [来源](https://www.anthropic.com/engineering/building-effective-agents)；也呼应 OpenAI《A practical guide to building agents》建议的「先从单 Agent 起步，真正需要时再引入多 Agent 编排」[来源](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码，用来确认解释器可用，并把本章最核心的心智模型——**「一句话定义 + 三个维度 + 一个边界」的答题骨架**——固化成一个可打印的结构。它承载本章的中心不变量：任何概念题，第一句必须能压缩成一句话；随后必须能拆成正交维度；最后必须主动点出边界。
```python
"""README 热身：概念题答题骨架（纯 Python，无需 API Key）。"""
from dataclasses import dataclass, field


@dataclass
class ConceptAnswer:
    term: str
    one_liner: str                     ## 压缩：一句话定义
    dimensions: list = field(default_factory=list)  ## 结构：正交维度
    boundary: str = ""                 ## 边界：代价 / 不适用场景
    example: str = ""                  ## 实践：30 秒能讲清的例子

    def is_layered(self) -> bool:
        ## 一个「有层次」的回答至少要同时具备定义、维度、边界
        return bool(self.one_liner) and len(self.dimensions) >= 2 and bool(self.boundary)


def run() -> None:
    ans = ConceptAnswer(
        term="AI Agent",
        one_liner="以 LLM 为大脑、能自主决策并循环迭代来完成目标的系统",
        dimensions=["控制权归属", "感知-决策-行动循环", "工具调用时机由模型定"],
        boundary="自主性带来灵活也带来不可控，能用固定流程就别上 Agent",
        example="查实时天气：普通 LLM 只能瞎猜，Agent 会自主判断该调天气工具",
    )
    print(f"概念={ans.term}")
    print(f"一句话定义={ans.one_liner}")
    print(f"维度数={len(ans.dimensions)} 有无边界={bool(ans.boundary)}")
    print(f"是否有层次={ans.is_layered()}")
    print("热身通过：可以开始阅读本章")


if __name__ == "__main__":
    run()
```
保存为 `warmup.py`，运行 `python warmup.py`。预期输出：
```text
概念=AI Agent
一句话定义=以 LLM 为大脑、能自主决策并循环迭代来完成目标的系统
维度数=3 有无边界=True
是否有层次=True
热身通过：可以开始阅读本章
```
Python 小版本可能不同，但需不低于 3.10（用到了 `dataclass` 与内置泛型标注）。若你把 `boundary` 留空，`is_layered()` 会返回 `False`——这正是本章想训练的直觉：**一个说不出边界的回答，无论名词堆得多满，都还没到「有层次」。**

## 阅读约定与来源

正文只引用可公开核验的一手资料，正文用 `[来源](url)` 内联标注：Anthropic《Building Effective Agents》[来源](https://www.anthropic.com/engineering/building-effective-agents)、Anthropic《Effective context engineering for AI agents》[来源](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)、Lilian Weng《LLM Powered Autonomous Agents》[来源](https://lilianweng.github.io/posts/2023-06-23-agent/)、ReAct 论文 [来源](https://arxiv.org/abs/2210.03629)、Chain-of-Thought 论文 [来源](https://arxiv.org/abs/2201.11903)、OpenAI Function calling 文档 [来源](https://developers.openai.com/api/docs/guides/function-calling)、MCP 架构规范 [来源](https://modelcontextprotocol.io/specification/2025-06-18/architecture)、Claude Code Subagents 文档 [来源](https://docs.anthropic.com/en/docs/claude-code/sub-agents)。检索日期为 2026-08-24。会变化的细节一律以链接中的当前官方文档为准；本章讲稳定的概念与答题方法，不把某次检索到的数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。
