2026 年 8 月检索更新。本章严格区分三层可信度：**官方公开机制**指厂商文档或工程博客明确描述的外部行为（例如 Anthropic 多智能体研究系统、LangGraph 多智能体文档、AutoGen 团队 API、CrewAI 流程文档）；**通用工程模式**是从公开行为提炼、可迁移的做法；**教学参考实现**指本章为讲清机制而构造、可离线运行的示例代码，不代表任何产品内部源码。

本章大量使用缩写，首次出现给出英文全称：大语言模型（Large Language Model，LLM）、应用程序接口（Application Programming Interface，API）、检索增强生成（Retrieval-Augmented Generation，RAG）、模型上下文协议（Model Context Protocol，MCP）、命令行接口（Command-Line Interface，CLI）、软件开发工具包（Software Development Kit，SDK）、服务级目标（Service Level Objective，SLO）、个人可识别信息（Personally Identifiable Information，PII）。会变化的数字（价格、上下文窗口、并发上限）以链接中的当前官方文档为准。

## 一个真实任务：S&P 500 董事会名单为什么单 Agent 查不动

Anthropic 在其工程博客中给出一个具体案例：要求系统「找出标普 500 信息技术板块所有公司的董事会成员」。单 Agent（一个 LLM 在循环里顺序搜索）会陷入缓慢、串行的检索，最终没能给出答案；而采用编排者-工作者架构的多智能体系统，把任务分解成若干子任务分派给并行的 Subagent（子智能体），成功给出了正确名单 [来源](https://www.anthropic.com/engineering/multi-agent-research-system)。同一篇博客还公布了两个可核验的数字：以 Claude Opus 4 作为主导 Agent、Claude Sonnet 4 作为子 Agent 的多智能体系统，在其内部研究评测上比单体 Claude Opus 4 高出 90.2%；并行化把复杂查询的研究时间最多缩短了 90%。

这不是「模型不够聪明」，而是「单个上下文窗口装不下、单条时间线并行不起来」。本章要解释的，正是从「一个 Agent 拼命干」升级到「一群 Agent 分工干」时，拓扑怎么选、消息怎么传、结果怎么聚、失败怎么防。

## 你将得到什么

- 能判断一个任务**何时该上多智能体、何时不该**，并说清代价（token 成本、复合错误、调试难度）。
- 能画出三种主流协作拓扑：Supervisor/层级、Network/对等、Sequential/流水线，并说出各自的控制权流动方式。
- 能设计角色分工与三种通信机制（消息传递、共享黑板、handoff 交接），并给交接包一个显式契约。
- 能复述 Anthropic 编排者-工作者研究系统的公开机制：主导 Agent 规划、并行子 Agent 检索、CitationAgent 归因、记忆持久化。
- 能运行一个**完全离线、纯 Python、结果可复核**的 supervisor 分派 + 多 worker + 聚合 + 运行轨迹示例。
- 能识别多智能体特有的失败模式（上下文丢失、无限对话、成本爆炸），并对应到 AutoGen/CrewAI/LangGraph 的公开机制。
- 能拿出一张生产建议表和多个「思考+回答」，直接用于系统设计面试与生产复盘。

## 小节地图

1. [何时需要多智能体](/advanced/chapter-11/s01/)
2. [协作拓扑：Supervisor、Network、Sequential](/advanced/chapter-11/s02/)
3. [角色分工与通信机制](/advanced/chapter-11/s03/)
4. [编排者-工作者深入：Anthropic 研究系统案例](/advanced/chapter-11/s04/)
5. [多智能体实战：可运行的 supervisor 分派与聚合](/advanced/chapter-11/s05/)
6. [失败模式与真实系统](/advanced/chapter-11/s06/)
7. [多智能体协作的生产踩坑与思考回答](/advanced/chapter-11/s07/)

## 贯穿案例：一条可复核的数据链

后续小节复用同一条数据链，方便前后对照。用户提出一个可以并行分解的宽问题「多智能体协作的关键要点是什么」；编排者把它切成五个主题子任务：`supervisor`、`worker`、`cost`、`reliability`、`noise`；本地语料库有 10 篇带主题标签的短文档，其中 `noise` 主题的两篇被标记为 `relevant=False`（无关闲聊与过期版本）。预期结果是：四个有效主题各命中 2 条要点、置信度 1.0 被采纳，`noise` 主题命中 0 条、置信度 0.0 被自动丢弃；整轮运行留下 7 跳轨迹（1 次规划、5 次子任务检索、1 次聚合）、50 次工具调用。这条数据链在第 05 小节完整实现并实跑，在第 02、03、06、07 小节被反复引用。
```text
输入：宽问题 + 5 个主题子任务 + 10 篇本地文档（2 篇标记为无关）
预期聚合：采纳 = [supervisor, worker, cost, reliability]，丢弃 = [noise]
预期轨迹：hops = 7，total_tool_calls = 50
```
## 最小环境核验/热身

导读页先给一个不依赖网络、不需要 API Key 的热身脚本，用来确认解释器版本，并演示「工具越多、单 Agent 均匀选中正确工具的先验概率越低」这一多智能体动机的量化直觉。
```python
import sys


def uniform_pick_prob(tool_count: int) -> float:
    return round(1 / tool_count, 3)


def main() -> None:
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"精简工具集(2)选中先验概率={uniform_pick_prob(2)}")
    print(f"臃肿工具集(8)选中先验概率={uniform_pick_prob(8)}")


if __name__ == "__main__":
    main()
```
保存为 `warmup_ch11.py`，运行 `python warmup_ch11.py`，预期输出：
```text
Python=3.10
精简工具集(2)选中先验概率=0.5
臃肿工具集(8)选中先验概率=0.125
```
Python 小版本可能不同，但必须不低于 3.10。这个「先验概率」只是均匀假设下的直觉演示，真实模型的工具选择由描述质量与上下文决定，不是严格均匀分布；它想说明的是「把工具塞进一个 Agent 会稀释注意力」，这正是下一节讨论「何时拆分」的起点。

## 导读页故障定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 示例脚本报找不到模块 | 站错目录或解释器不一致 | 打印 `sys.executable` 与当前目录 | 先确认目录再运行，纯标准库示例无需安装 | 引入真实框架后仍需装依赖 |
| 以为多智能体一定更好 | 只看 90.2% 提升不看 15× 成本 | 同时记录 token 与任务价值 | 先证明单 Agent 不行再拆分 | 高价值可并行任务才值得 |
| 把教学示例当产品实现 | 忽略三层可信度边界 | 回查来源链接与边界声明 | 只陈述公开行为，推导明确标注 | 不反推厂商内部调度 |

## 阅读约定与来源

正文只引用可公开核验的一手资料：[Anthropic 多智能体研究系统](https://www.anthropic.com/engineering/multi-agent-research-system)、[Anthropic Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)、[LangGraph 多智能体概念文档](https://langchain-ai.github.io/langgraph/concepts/multi_agent/)、[AutoGen 团队教程](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html)、[CrewAI 流程文档](https://docs.crewai.com/en/concepts/processes)、[OpenAI 构建 Agent 实践指南](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)。检索日期为 2026-08-24。仓库内另有 `资料来源.md` 作维护清单，不计入正文页面。
