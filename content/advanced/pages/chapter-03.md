2026 年 8 月检索更新。本章严格区分三层信息：**官方公开机制**（有厂商文档或论文支撑，如 Anthropic 的 Agent 指南、Model Context Protocol 官方公告）、**通用工程模式**（可迁移、可推导的做法，如复合错误率估算与决策树）、**教学参考实现**（本书为讲清机制而构造的代码，不代表任何产品内部源码）。凡涉及价格、模型窗口、下载量等会变化的数字，以链接中的当前官方文档为准。

## 一个「PM 说要做 Agent」的真实早晨

某支付团队的产品经理在周会上抛出需求：「我们要做一个 Agent，自动处理上传的发票，抽取金额、日期、供应商，然后写进财务系统。」工程师小李兴奋地用开放式循环 Agent 实现了它：模型自己决定读哪个字段、调哪个工具、要不要再看一遍。Demo 里三张发票跑得漂亮。上线第一周，财务同事报告：一千张发票里有约一百七十张金额错位，其中十几张把「税额」填进了「总额」。复盘时小李发现，单张发票每一步的成功率其实高达 95%，可整个「抽取 → 校验 → 跨字段推理 → 写库」的链路一旦被模型自主拉长到七八步，复合成功率就掉到了 `0.95^8 ≈ 66%`。更糟的是，因为路径是模型即兴决定的，两次运行会走不同的顺序，出错时根本无法稳定复现。

这个故障不是「提示词不够好」，而是**选错了自主性等级**：一个流程完全可以画成流程图的任务，被硬做成了开放 Agent。本章要给你的，正是一套在写第一行代码之前就能做出的判断——「这件事到底该不该、该用多少 Agent」。

本章把这个判断拆成 7 个可独立加载的页面，并配一段完全可运行、无需 API Key 的纯 Python 代码，让你亲手算出决定成败的那个数字。

## 你将得到什么

- 能画出一条清晰的 Agent 思想史时间轴：CoT（Chain-of-Thought，思维链）→ ReAct（Reasoning and Acting，推理并行动）→ Reflexion（语言化反思）→ 框架与 MCP（Model Context Protocol，模型上下文协议）标准化，并说清每一跳「补」了什么能力。
- 能把「自主性」理解为一条从固定流水线到全自主 Agent 的连续光谱，而不是「是/否」的二元开关。
- 能用一份带布尔判据的决策清单，回答「什么时候该用 Agent」与「什么时候不该用」。
- 能亲手用纯 Python 算出复合错误率曲线与数值表，把「多给几轮循环又不会怎样」这句话摆到账本上。
- 能画出并走通一棵工作流 vs Agent 的决策树，并把它对应到 Claude Code、OpenAI Agents SDK（Software Development Kit，软件开发工具包）、LangGraph 等真实系统的公开机制。
- 能用多张「症状—根因—观测—修复—边界」表，把选型踩坑变成可复现、可预防的清单。

## 小节地图

1. [发展脉络：从 CoT 到 MCP](/advanced/chapter-03/s01/)
2. [自主性光谱：从固定流水线到全自主 Agent](/advanced/chapter-03/s02/)
3. [何时该用 Agent：三条任务特征信号](/advanced/chapter-03/s03/)
4. [何时不该用 Agent：复合错误与可预测流程](/advanced/chapter-03/s04/)
5. [复合错误率计算实战：把口号变成账本](/advanced/chapter-03/s05/)
6. [工作流 vs Agent 的选择：决策树与真实系统](/advanced/chapter-03/s06/)
7. [思考回答与生产建议：面试与上线的最后一公里](/advanced/chapter-03/s07/)

另有 资料来源 作为维护清单，不计入正文页面。

## 贯穿案例：一张发票如何决定架构

本章所有页面复用开头这条「发票处理」数据链，并与一条对照的「未知领域调研」数据链并列，形成一正一反的判断基准：
```text
案例 A（发票处理）:
  输入      : 上传的 PDF 发票扫描件
  字段      : 金额 amount / 日期 date / 供应商 vendor（固定三字段）
  流程      : 抽取 -> 校验 -> 格式化 -> 写库（可事先画成流程图）
  单步成功率: 约 0.95
  正确方案  : 确定性工作流（提示链 + 校验 gate）

案例 B（未知领域调研）:
  输入      : "帮我调研某新兴技术并写综述"
  流程      : 搜索次数与深入路径取决于中途发现（无法事先画成流程图）
  错误代价  : 可容忍（人工复核综述）
  正确方案  : 开放式循环 Agent
```
各小节会分别抽取这两条数据链的一部分做最小演示：第 05 节用案例 A 的 `0.95` 与步数算复合成功率；第 06 节把两条链丢进同一棵决策树对照；第 07 节把二者的失败模式汇成生产建议表。

## 最小环境核验程序

阅读正文前，先用这段不联网、不改动任何文件的程序确认解释器可用，并顺手把「自主性是成本」这句口号变成第一个可算的数字。
```python
import sys


def compound_success(step_success: float, steps: int) -> float:
    """整体成功率 = 单步成功率 的 步数次方（假设各步相互独立）。"""
    return step_success ** steps


def main() -> None:
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    for steps in (3, 8, 20):
        rate = compound_success(0.95, steps)
        print(f"单步95% × {steps:>2}步 -> 整体成功率 {rate:.0%}")


if __name__ == "__main__":
    main()
```
从任意目录保存为 `verify_chapter03.py`，运行 `python verify_chapter03.py`。预期输出（Python 小版本可能不同，但需不低于 3.8）：
```text
Python=3.10
单步95% ×  3步 -> 整体成功率 86%
单步95% ×  8步 -> 整体成功率 66%
单步95% × 20步 -> 整体成功率 36%
```
若输出的成功率与此一致，说明你已经握住了本章最硬的那个杠杆：**同样的单步 95%，步数从 3 涨到 20，整体成功率就从 86% 崩到 36%**。开头那张错位一百七十张的发票，根因就藏在这三行数字里。

## 阅读约定与来源

正文只使用可公开核验的一手资料：[Anthropic《Building Effective Agents》](https://www.anthropic.com/engineering/building-effective-agents)、[Anthropic 多智能体研究系统工程博客](https://www.anthropic.com/engineering/multi-agent-research-system)、[Chain-of-Thought 论文](https://arxiv.org/abs/2201.11903)、[ReAct 论文](https://arxiv.org/abs/2210.03629)、[Reflexion 论文](https://arxiv.org/abs/2303.11366)、[Tree of Thoughts 论文](https://arxiv.org/abs/2305.10601)、[Toolformer 论文](https://arxiv.org/abs/2302.04761)、[Lilian Weng《LLM Powered Autonomous Agents》](https://lilianweng.github.io/posts/2023-06-23-agent/)、[Model Context Protocol 官方公告](https://www.anthropic.com/news/model-context-protocol)、[MCP 官方文档](https://modelcontextprotocol.io/) 与 [MCP 加入 Agentic AI Foundation 公告](https://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/)。检索日期为 2026-08-24。

会变化的参数（模型窗口、SDK 下载量、价格）以上述官方链接的当前版本为准；本章讲的是稳定的判断方法与思想脉络，不把某次检索的数字写成永久承诺。仓库内另存 `资料来源.md` 作为维护清单，不计入 7 个正文页面。
