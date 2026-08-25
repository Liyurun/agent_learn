2026 年 8 月检索更新。本章把 LangGraph 官方文档明确描述的接口与语义称为「官方公开机制」（如 `StateGraph`、`add_conditional_edges`、reducer 通道、checkpointer、`interrupt`），把可从公开行为推导、能迁移到任何框架的做法称为「通用工程模式」（如「先分层再归因」的排障法、组合式选型），把书内为讲清原理而构造、可离线运行且无需 API Key 的代码称为「教学参考实现」。三者在正文里始终分层标注：教学代码用纯 Python 复刻 LangGraph 的节点/边/状态/检查点/中断语义，让每一步输出都能逐字复核，但它不是 LangGraph 源码，真实字段名与参数以当前官方文档为准 [来源](https://docs.langchain.com/oss/python/langgraph/overview)。

## 一次「跑了两小时、崩在最后一步」的真实故障

设想一个合规资料审核 Agent，任务是把上千页的尽调材料抽取成结构化档案，再走人工复核后入库。它的流程是一张五节点的图：`加载文档 → 抽取字段 → 风险打分 → 人工复核 → 写入档案`。周二下午两点零七分启动，跑到第 1 分钟就把前四个节点走完，卡在「人工复核」等合规同事点「批准」。合规同事三点半才处理完，可这台机器三点二十因为运维例行重启挂掉了——**整个内存里的中间状态（已抽取的字段、已算好的风险分）一起蒸发**。四点重启后，Agent 只能从头再跑一遍：重新加载上千页、重新抽取、重新打分，又烧掉一遍模型调用的钱和两小时。事后复盘，团队发现三处独立缺陷：图的中间状态只存在内存里、没有落到检查点（checkpoint）；「等人审批」这个暂停点是用一个 `while True: sleep` 硬等出来的、进程一死就丢；风险分和抽取字段没有「按线程持久化」的机制，无法从断点恢复。这三处都不是「模型不聪明」，而是**没有把这条长时、需人工介入的流程建模成一张可持久化、可暂停、可恢复的状态机**——而这，恰恰是 LangGraph 存在的理由。

这个故障贯穿本章。它把一句模糊的「长任务不稳定」拆成图状态机里可定位的机制：状态（State）该放哪些字段、通道（channel）用什么 reducer 合并、检查点在每个超步（superstep）后怎么存、`interrupt` 如何把「等人」变成一个可存档的断点、进程崩了怎么用同一个 `thread_id` 从最近检查点恢复。把这条链路走通，你不仅能修好这个故障，还能回答面试里最高频的那道题——「LangGraph 和普通 Agent 循环最本质的区别是什么」。

## 你将得到什么

- 能凭记忆默画 LangGraph 的执行模型：节点（Node）是纯函数、边（Edge）决定跳转、状态（State）是节点间唯一的通信载体，并说清「条件边由运行时状态动态选路」这条铁律。
- 能解释「状态更新为什么要走 reducer」：默认覆盖、`operator.add` 追加、`add_messages` 按消息 `id` 归并，并说清「谁在一个超步里写同一个键」会决定要不要 reducer。
- 能说清 checkpointer 的三件事：每个超步后存一次快照、用 `thread_id` 区分会话、`get_state_history` 能列出全部历史快照用于时间旅行（time travel）。
- 能实现一个「等人审批」的断点：用 `interrupt` 暂停、把待办抛给外部、进程重启后用 `Command(resume=...)` 从断点继续，中间状态一点不丢。
- 能把卷三学过的 ReAct（Reasoning and Acting，推理并行动）循环、路由、编排者-工作者、反思循环，一一画成 LangGraph 的图结构，验证「原理不变、换框架只是换语法」。
- 能横向对照 CrewAI、OpenAI Agents SDK（Software Development Kit，软件开发工具包）、LlamaIndex 的定位与边界，并在「控制粒度 vs 上手速度」轴上给出选型判断。
- 能开出一张覆盖图状态机各层的生产建议清单，并回答与 LangGraph、框架选型相关的多道思考题。

## 小节地图

1. [把 Agent 建模成一张图：节点、边、状态与条件路由](/advanced/chapter-15/s01/)
2. [状态是图的灵魂：通道、Reducer 与并发写入](/advanced/chapter-15/s02/)
3. [检查点、持久化与时间旅行：让长任务可暂停可恢复](/advanced/chapter-15/s03/)
4. [人工介入：用 interrupt 把「等人」变成可存档的断点](/advanced/chapter-15/s04/)
5. [把工作流模式画成图：ReAct、路由、编排者-工作者、反思](/advanced/chapter-15/s05/)
6. [横向对照：CrewAI、OpenAI Agents SDK、LlamaIndex](/advanced/chapter-15/s06/)
7. [选型、组合与生产踩坑：框架不是单选题](/advanced/chapter-15/s07/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的业务链，围绕开头「合规资料审核」故障展开。这条链固定为一张五节点图，状态字段固定，路由规则固定，检查点按 `thread_id=T1` 存取。这样任意一节抽取其中一个机制做最小演示，最后能拼成完整的「可暂停、可恢复、可人工介入」的图。
```text
图结构（5 节点，固定）：
START ─▶ load(加载文档) ─▶ extract(抽取字段) ─▶ score(风险打分)
                                                    │ add_conditional_edges(route)
                          风险分 > 60 ────────────▶ review(人工复核·可暂停)
                          风险分 ≤ 60 ────────────▶ ingest(写入档案) ─▶ END
                                        review ──(批准)──▶ ingest ─▶ END
                                        review ──(驳回)──▶ END

共享状态 State（固定字段）：
{
  "docs": ["尽调材料#1", ...],   # 输入文档，只读
  "fields": {},                  # 抽取结果，extract 写
  "risk_score": 0,               # 风险分，score 写
  "approved": None,              # 人工结论，review 写（interrupt 收人类输入）
  "log": []                      # 事件轨迹，用 operator.add 追加（见第 2 节）
}

一条固定输入触发的执行轨迹（thread_id=T1）：
超步1 load  -> {"docs":[...3 篇...]}                            存检查点c1
超步2 extract-> {"fields":{"amount":120000,"party":"甲公司"}}   存检查点c2
超步3 score -> {"risk_score":82}                               存检查点c3
超步4 route -> 82>60 -> 进 review；interrupt 暂停，抛出待办     存检查点c4（暂停态）
       （进程可在此崩溃/重启，状态稳稳存在 c4）
超步5 resume(approved=True) -> review 写 approved=True          存检查点c5
超步6 ingest-> {"log":[...,"已入库"]}                          存检查点c6 -> END
```
优化前，这条流程的中间状态只在内存里、暂停靠 `sleep` 硬等，进程一死全丢；优化后，每个超步结束都落一次检查点，暂停用 `interrupt` 把待办抛给人、状态存进 `c4`，进程重启后用 `thread_id=T1` 从 `c4` 恢复、`Command(resume=True)` 一步续跑。输出「看起来一样」不是判据——关键是**崩溃可恢复、暂停可续跑、每一步走向都可审计**。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key、也不依赖安装 LangGraph 的热身代码。它用纯 Python 复刻图状态机最核心的三条不变量，把它们固化成断言：节点只通过状态通信；条件边的下一步由运行时状态决定；检查点让「暂停后从断点恢复」成为可能。
```python
import sys


def reducer_add(old: list, new: list) -> list:
    """复刻 operator.add 通道：把节点返回的增量追加到旧值上。"""
    return old + new


def route(state: dict) -> str:
    """复刻条件边：下一步由运行时状态动态决定，而不是写死。"""
    return "review" if state["risk_score"] > 60 else "ingest"


def run() -> None:
    ## ① 状态是节点间唯一的通信载体：score 写入 risk_score，route 只读它
    state = {"risk_score": 0, "log": []}
    state["risk_score"] = 82                       ## score 节点写状态
    state["log"] = reducer_add(state["log"], ["score=82"])  ## log 走追加型 reducer
    nxt = route(state)                             ## 条件边读状态、动态选路

    ## ② 检查点：把当前状态深拷贝存档，模拟进程崩溃后从断点恢复
    import copy
    checkpoint = copy.deepcopy(state)
    state = None                                   ## 假装进程崩了，内存清空
    state = copy.deepcopy(checkpoint)              ## 用检查点恢复

    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"条件边选路（risk_score=82>60）-> {nxt}")
    print(f"追加型 reducer 的 log -> {state['log']}")
    print(f"从检查点恢复后 risk_score={state['risk_score']}（未丢失）")
    print("热身通过：可以开始阅读本章")


if __name__ == "__main__":
    run()
```
保存为 `warmup_ch15.py`，运行 `python warmup_ch15.py`。预期输出：
```text
Python=3.10
条件边选路（risk_score=82>60）-> review
追加型 reducer 的 log -> ['score=82']
从检查点恢复后 risk_score=82（未丢失）
热身通过：可以开始阅读本章
```
Python 小版本可能不同，但需不低于 3.10（本章多处用到 `X | Y` 类型标注与 `match` 语法风格的写法）。若「从检查点恢复后」丢失了 `risk_score`，说明你没有真正深拷贝存档，这正是开头故障里「状态只在内存、进程一死就丢」的最小复现。

## 阅读约定与来源

正文只引用可公开核验的一手资料：[来源](https://docs.langchain.com/oss/python/langgraph/overview)（LangGraph 官方概览，含图/状态/持久化/人工介入的总览）、[来源](https://langchain-ai.github.io/langgraph/concepts/low_level/)（Low Level 概念：`StateGraph`、通道与 reducer、`START`/`END`、条件边）、[来源](https://langchain-ai.github.io/langgraph/concepts/persistence/)（Persistence：checkpointer、`thread_id`、`get_state`/`get_state_history`、`update_state`）、[来源](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)（Human-in-the-loop：`interrupt`、`Command(resume=...)`、`interrupt_before/after`）、[来源](https://github.com/langchain-ai/langgraph)（LangGraph 官方仓库）、[来源](https://docs.crewai.com/)（CrewAI 文档：Crews 与 Flows）、[来源](https://openai.github.io/openai-agents-python/)（OpenAI Agents SDK：Agents/Handoffs/Guardrails/Tracing/Sessions）、[来源](https://docs.llamaindex.ai/en/stable/)（LlamaIndex 文档：数据连接与 AgentWorkflow）与 [来源](https://www.anthropic.com/engineering/building-effective-agents)（Anthropic 工作流模式的权威梳理）。检索日期为 2026-08-24。

涉及具体类名、参数名、默认值、价格与模型窗口等会变化的细节，一律以链接中的当前官方文档为准；本章讲稳定的图状态机机制与选型方法论，不把某次检索到的拼写或数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。

## 导读页故障定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 长任务崩溃后只能从头再跑 | 中间状态只在内存、无检查点 | 跑到一半 `kill -9` 进程再重启 | 编译时传 checkpointer，按 thread_id 恢复 | 秒级完成的短任务无需持久化 |
| 「等人审批」进程一死就丢 | 用 sleep 硬等而非 interrupt 断点 | 审批期间重启进程即复现丢失 | 用 interrupt 暂停 + Command(resume) 续跑 | 无人工关口的全自动流程不涉及 |
| 简单任务被硬套图、样板爆炸 | 无暂停/审计需求却上 LangGraph | 数一下代码里几行是真业务逻辑 | 无暂停/恢复需求时改用更轻框架 | 复杂长时流程样板是必要成本 |
| 换个框架就以为要从头学 | 只记框架名、不做原理映射 | 让其复述路由=条件边分叉 | 把新框架特性映射回已学原理 | 全新范式确需补概念 |
