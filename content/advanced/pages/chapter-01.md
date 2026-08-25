2026 年 8 月检索更新。本章严格区分三层信息：**官方公开机制**指 Anthropic、OpenAI、LangChain 等在公开文档或论文里明确描述的外部行为；**通用工程模式**是从这些公开行为里提炼、可迁移到自己系统的做法；**教学参考实现**是本书为讲清原理而构造的可运行代码，不代表任何厂商的内部源码、私有算法或未公开数字。凡涉及模型窗口、价格、限流等会变化的参数，一律以链接中的当前官方文档为准。

## 一个「越接越乱」的真实对话

某公司的技术评审会上，产品经理说「我们要上一个 Agent，帮用户自动处理退款」；后端同学理解成「接一个大模型问答接口」；算法同学理解成「一个能自己规划、调用多个工具、自己判断是否完成的自主系统」；测试同学理解成「一段带 if-else 的自动化脚本」。四个人用同一个词开了两小时会，散会后各写各的设计文档，两周后集成时才发现：后端交付的是一次性问答接口，算法期待的是带循环的执行器，测试写的验收用例假设流程是固定的。返工三天，根因不是技术难题，而是**「Agent」这个词在四个人脑子里指的不是同一个东西**。

这不是段子，而是 2023 年以后几乎每个团队都踩过的坑。本章要解决的第一个问题，就是把「Agent」这个被严重滥用的词，收敛成一个**可判定、可观察、能一刀切开争论**的工程定义，并让你亲手跑通一个最小 Agent，从代码层面看清它和普通脚本的分界线。

## 你将得到什么

- 能用一句权威定义说清 Agent 是什么，并用「控制流归属」这把尺子当场判断任何系统算不算 Agent（可观察产出：一张逐项打勾的体检表）。
- 能列举 Chatbot（聊天机器人）、Copilot（副驾驶助手）、RPA（Robotic Process Automation，机器人流程自动化）与 Agent 的差异，并解释它们只是自主性光谱上的不同位置（可观察产出：一张对比表 + 一句面试表达）。
- 能亲手写出一个**完全可运行、无需 API Key** 的纯 Python ReAct（Reasoning and Acting，推理与行动）循环，并读懂它的完整运行轨迹（可观察产出：一段可复现的控制台输出）。
- 能解释「循环为什么不可省略」——从真实世界的部分可观测性与闭环控制角度（可观察产出：一次性规划 vs 循环式规划的对照）。
- 能画出「增强型 LLM = 基础模型 + 检索 + 工具 + 记忆」的构建块，并说明三种增强各自弥补基础模型的哪个短板（可观察产出：短板—补丁映射表）。
- 能用「四个可观察判据」给任意系统做体检，并给出面试级的精简表达（可观察产出：四判据体检表）。

## 小节地图

1. [一个被滥用的词：Agent 的词义膨胀与两套期待](/advanced/chapter-01/s01/)
2. [什么不是 Agent：用控制流归属这把尺子丈量边界](/advanced/chapter-01/s02/)
3. [Agent 的本质：LLM 在循环中基于反馈使用工具](/advanced/chapter-01/s03/)
4. [最小 Agent 循环实战：一个纯 Python 的 ReAct 骨架](/advanced/chapter-01/s04/)
5. [增强型 LLM：Agent 的基本构建块](/advanced/chapter-01/s05/)
6. [何时配称 Agent：四个可观察判据的体检表](/advanced/chapter-01/s06/)

## 贯穿案例：值班扩容问答 Agent

本章从 01 到 06 复用同一条**可复核的数据链**，避免每节换例子造成断裂。场景是一个站点可靠性工程（Site Reliability Engineering）值班助手：夜间收到告警，值班同学问 Agent「结算服务 `checkout-api` 现在扛不住流量，扩容到目标 QPS（Queries Per Second，每秒查询数）需要新增几个副本？」。这条任务需要两步：先查当前副本数与单副本处理能力，再做一次计算。它的关键数据固定如下，后续代码与轨迹都以此为准：
```text
服务名：checkout-api
当前副本数：4
单副本处理能力：120 QPS
目标 QPS：960
推导：需要副本 = ceil(960 / 120) = 8，需新增 8 - 4 = 4 个副本
```
选它当贯穿案例有三个好处：第一，它天然需要「查询→计算」两步，正好演示循环与工具；第二，数据是确定的，任何人跑代码都得到同一结果，便于复现；第三，它能干净地映射到真实系统——查询对应可观测性平台的指标接口，计算对应一个函数工具，这正是主流 Agent 框架里最常见的「工具调用」形态。

## 最小环境核验与热身程序

阅读正文前，先用一段**不依赖网络、不需要 API Key** 的程序确认你的环境可用，并顺手感受一次「循环直到判定完成才停」的最小骨架。它只用标准库，任何 Python 3.8 及以上版本都能跑。
```python
import sys


def warmup_loop(target: int, per_step: int = 3) -> int:
    steps = 0
    total = 0
    while total < target:
        total += per_step
        steps += 1
        if steps > 100:
            raise RuntimeError("超过安全上限，强制停止")
    return steps


def main() -> None:
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"标准库可用={'是' if sys is not None else '否'}")
    print(f"循环热身：累加到 10 需要 {warmup_loop(10)} 步")


if __name__ == "__main__":
    main()
```
保存为 `verify_chapter01.py`，在任意目录运行 `python verify_chapter01.py`。预期输出为：
```text
Python=3.10
标准库可用=是
循环热身：累加到 10 需要 4 步
```
Python 小版本可能不同（3.8、3.11、3.12 都可以），只要不低于 3.8。这里的 `warmup_loop` 就是一个「循环 + 停止条件 + 安全上限」的极简样板：`while total < target` 是**由状态判定何时停**，`steps > 100` 是**防失控的安全阀**。第 04 节的真正 Agent 循环，结构与它一模一样，只是把「累加」换成了「模型决策 + 工具执行」。若输出报错，先确认 Python 版本，不要急着装任何库——本章所有代码都只用标准库。

## 阅读约定与来源

正文只引用可公开核验的一手资料，正文内用 `[来源](url)` 内联标注。核心来源：[Anthropic《Building Effective Agents》](https://www.anthropic.com/engineering/building-effective-agents)、[OpenAI《A Practical Guide to Building Agents》](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)、[Lilian Weng《LLM Powered Autonomous Agents》](https://lilianweng.github.io/posts/2023-06-23-agent/)、[Chip Huyen《Agents》](https://huyenchip.com/2025/01/07/agents.html)、[ReAct 论文（Yao et al., 2022）](https://arxiv.org/abs/2210.03629) 与 [LangGraph 官方文档](https://langchain-ai.github.io/langgraph/)。检索日期为 2026-08-24。

阅读每一节时，建议沿「定义→反例→尺子→代码→判据」这条主线追踪：任何关于「这算不算 Agent」的争论，最终都能落到「控制流在谁手里、谁决定何时停」这两个可观察问题上。仓库内另存 `资料来源.md` 作为维护用清单，不计入正文页面。
