2026 年 8 月检索更新。本章把三类内容严格分层：**官方公开机制**（有厂商文档或权威新闻稿支撑的外部行为，如 OpenAI Agents SDK（Software Development Kit，软件开发工具包）的 handoffs 与 manager 编排、Anthropic 的 Contextual Retrieval、OpenAI 的 SWE-bench Verified 评测、Code Interpreter 沙箱、LangGraph 的 supervisor 与 Send/map-reduce）、**通用工程模式**（可从公开行为推导、能迁移到任何自建系统的做法，如澄清清单、无依据不作答、只读副本、幂等键、置信度兜底）、**教学参考实现**（书内为讲清原理而构造、可离线运行、无需任何 API（Application Programming Interface，应用程序编程接口）Key 的 mock 代码）。三者始终分开标注，不把推导写成产品承诺，也不臆造任何厂商内部实现。会变化的参数（价格、上下文窗口、解析率、评测分数）一律注明「以当前官方文档为准」。

## 一次「系统设计题被问崩」的真实复盘

设想 2026 年 2 月的一场高级 Agent 工程师终面。候选人技术底子不差，但面试官只抛了一句：「请你设计一个企业内部知识库问答系统。」他没问任何问题，直接在白板上画起了向量库、Embedding 模型、Rerank，20 分钟画得密密麻麻。面试官打断三次追问都指向同一处空白：「不同部门的文档，普通员工都能搜到吗？」「答不出来的时候它会怎么说？」「你怎么知道它上线后没在乱编？」这三问，候选人全部卡壳——因为他把整整 20 分钟花在了「用什么组件」，却没花 30 秒在「这个系统的红线是什么」。面试结束时评价栏写着一句话：「像看过教程，但没做过系统。」

这场复盘会贯穿全章。它把一句模糊的「他系统设计答得不好」，拆成可定位的答题工程：**没澄清需求就动手**（跳过了权限、防幻觉这两条会决定架构的约束）、**只堆组件不谈流程**（说不清一次请求怎么活起来）、**完全不提工程化**（评估、可观测、护栏一字未提）、**声称方案完美**（没有任何权衡取舍）。这四处失分点，恰好对应本章五步法要逐个补齐的能力。把这套答题法走通，你就能稳稳接住系统设计题里分量最重的那类开放问题。

## 你将得到什么

- 能把任意开放式 Agent 设计题，用**五步法**（澄清需求 → 顶层架构 → 核心流程 → 工程考量 → 权衡取舍）拆成一条可作答、可追问、可评分的骨架。
- 能背下一张「六问澄清清单」，并把每一个澄清出来的约束显式挂钩到后续的一个架构决策上。
- 能按「接入—编排—能力—数据」四层套路快速画出任意系统的顶层架构图，并一句话说清每层职责。
- 能对五道高频真题（知识库问答、AI 编程助手、会议纪要、多 Agent 客服、数据分析）分别给出「澄清 → 架构 → 流程 → 工程 → 权衡」的完整作答与架构图。
- 能把「防幻觉、护栏分层、map-reduce 长文本、路由准确率、只读沙箱」等设计细节，映射到 Anthropic、OpenAI、LangGraph 的公开机制上，说清边界。
- 能在收尾时主动亮出加分项、规避红旗，让面试官看到「做过系统的人」的判断力。

## 小节地图

1. [系统设计题五步法：把开放问题拆成可作答的骨架](/advanced/chapter-22/s01/)
2. [五步法各步骤要点详解：澄清清单、分层架构与权衡三轴](/advanced/chapter-22/s02/)
3. [例题一·企业知识库问答 Agent：Agentic RAG 与引用溯源](/advanced/chapter-22/s03/)
4. [例题二·AI 编程助手 Agent：工具沙箱与五层护栏](/advanced/chapter-22/s04/)
5. [例题三与例题四·会议纪要工作流与多 Agent 智能客服](/advanced/chapter-22/s05/)
6. [例题五·数据分析 Agent：先看 schema 再写只读 SQL](/advanced/chapter-22/s06/)
7. [系统设计题的加分项与红旗规避：五题横向选型光谱](/advanced/chapter-22/s07/)

## 贯穿案例与贯穿数据

本章七个小节复用同一套可复核的「五道例题参数」，便于横向对比不同题目的选型判断。每道例题固定一个具体场景、一组数字、一条主链路：
```text
例题一 知识库问答：全公司 3000 员工，日请求约 1.5 万次，峰值 QPS 个位数；
              红线=绝不编造、答不了如实说未找到；约束=按部门权限过滤文档
例题二 编程助手：帮开发者修 bug / 跑测试 / 提 PR；红线=高危命令必须沙箱 + 人工确认；
              评测=真实 bug 修复任务集通过率（对应 SWE-bench 思路）
例题三 会议纪要：一场 90 分钟会议转写约 3 万字，超单次上下文；时效=会后几分钟即可（可异步）
例题四 多 Agent 客服：C 端电商，峰值 QPS 上千，秒级延迟；退款/改地址=高危写操作
例题五 数据分析：业务人员用自然语言查结构化库；红线=只读、防注入、结果可核验
共用输出物：每题给出 澄清清单 → 架构图 → 带失败分支的核心流程 → 工程四件套 → 一条权衡
```
判据不是「答案看起来对不对」，而是四条可观察信号：**每个澄清都挂到了一个设计决策上**、**核心流程带了失败分支**、**工程化四件套（评估/可观测/护栏/成本延迟）主动提出**、**权衡诚实说清牺牲了什么**。这与 Anthropic《Building Effective Agents》的主张一致：能用简单可组合的模式就不要上复杂自治架构，多 Agent 的复杂度必须由收益证明 [来源](https://www.anthropic.com/engineering/building-effective-agents)；也呼应 OpenAI《A practical guide to building agents》——先确认是否真的需要 Agent、先从单 Agent 起步，真正需要时再引入多 Agent 编排 [来源](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码，用来确认解释器可用，并把本章最核心的方法论——**五步法骨架**——固化成一个可打印的清单。它承载一条不变量：**任何设计题都先过澄清清单，再谈架构**。
```python
"""README 热身：五步法骨架自检（纯 Python，无需 API Key）。"""
from dataclasses import dataclass, field


@dataclass
class DesignAnswer:
    step1_clarify: list = field(default_factory=list)   ## 澄清需求
    step2_arch: str = ""                                ## 顶层架构
    step3_flow: str = ""                                ## 核心流程
    step4_eng: list = field(default_factory=list)       ## 工程考量
    step5_tradeoff: str = ""                            ## 权衡取舍


def is_complete(a: DesignAnswer) -> bool:
    ## 五步缺一不可：澄清与权衡最易被跳过，这里显式检查
    return bool(a.step1_clarify and a.step2_arch and a.step3_flow
                and a.step4_eng and a.step5_tradeoff)


def run() -> None:
    a = DesignAnswer(
        step1_clarify=["谁用", "规模QPS", "延迟", "质量红线", "安全权限", "边界"],
        step2_arch="接入-编排-能力-数据 四层",
        step3_flow="一条主链路 + 失败分支",
        step4_eng=["评估", "可观测", "护栏", "成本延迟"],
        step5_tradeoff="准确优先，牺牲部分成本与延迟",
    )
    print(f"澄清清单条数={len(a.step1_clarify)}")
    print(f"工程四件套={a.step4_eng}")
    print(f"五步完整={is_complete(a)}")
    print("热身通过：可以开始阅读本章")


if __name__ == "__main__":
    run()
```
保存为 `warmup.py`，运行 `python warmup.py`。预期输出：
```text
澄清清单条数=6
工程四件套=['评估', '可观测', '护栏', '成本延迟']
五步完整=True
热身通过：可以开始阅读本章
```
Python 需不低于 3.10（用到了 `dataclass` 与内置泛型标注）。如果你把 `step1_clarify` 置空再跑，`is_complete` 会返回 `False`——这正是本章反复强调的：**跳过澄清的设计答案，在结构上就是不完整的**。

## 思考：为什么把「五步法」做成不可跳步的流水线，而不是可选清单？

### 回答

因为这五步对应了一个真实项目从立项到上线的缩影，前一步的产物正是后一步的输入，缺一环后面就没有落脚点。先搞清「要做什么、边界在哪」（澄清），才知道「大盘子怎么搭」（架构）；定了架构，才谈得上「主流程怎么活起来」（流程）；主流程能跑通，才轮到「上线要扛住什么」（工程）；最后诚实交代「我妥协了什么」（权衡）。顺序一旦打乱就会出问题：没澄清就画架构，等于闭卷答题，本章开头那位候选人正是栽在这里；没定架构就谈工程，等于空中楼阁，评估和护栏挂不到任何组件上。面试官顺着这五步听，能非常清晰地判断你是「做过系统的人」还是「只看过教程的人」——而这恰恰是高级岗位分水岭要考的东西。所以五步法不是一张可勾可不勾的清单，而是一条有依赖关系、不可逆推进的流水线。

### 面试精简表达

五步法是「立项到上线」的缩影：前一步产物是后一步输入，跳步就会闭卷答题或空中楼阁。澄清与权衡最易被跳、也最拉分，所以要当成不可跳步的流水线，而非可选清单。

## 阅读约定与来源

正文只引用可公开核验的一手资料：[来源](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)（OpenAI 构建 Agent 实践指南）、[来源](https://www.anthropic.com/engineering/building-effective-agents)（Anthropic 有效 Agent 编排模式）、[来源](https://github.com/openai/openai-agents-python/blob/main/docs/agents.md)（OpenAI Agents SDK 的 handoffs 与 manager 两种编排）、[来源](https://www.anthropic.com/engineering/contextual-retrieval)（Anthropic Contextual Retrieval 提升检索召回）、[来源](https://www.openai.com/index/introducing-swe-bench-verified/)（OpenAI SWE-bench Verified 编码评测子集）、[来源](https://developers.openai.com/api/docs/guides/tools-code-interpreter)（OpenAI Code Interpreter 沙箱容器）、[来源](https://langchain-ai.github.io/langgraph/concepts/multi_agent/)（LangGraph 多智能体 supervisor 拓扑）、[来源](https://docs.langchain.com/oss/python/langchain/sql-agent)（LangChain SQL Agent 官方指南）。检索日期为 2026-08-24。涉及会变化的细节，一律以链接中的当前官方文档为准；本章讲稳定的答题工程与设计机制，不把某次检索到的数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。
