2026 年 8 月检索更新。本章把厂商与项目官方文档明确描述的行为称为"官方公开机制"；把可从公开行为推导、能迁移到自建系统的做法称为"通用工程模式"；把书内为讲清选型方法而构造、可离线运行的代码称为"教学参考实现"。三者在正文里始终分层标注。会变化的参数（Star 数、版本号、许可、价格、上下文窗口）一律以各仓库与官方文档的实时页面为准，本章只把它们当作"量级"和"趋势"的证据，不当作永久承诺。

## 一次"按 Star 数选型，三个月返工"的真实故障

2026 年 2 月，一家做企业报销的 SaaS（Software as a Service，软件即服务）公司要上线一个"发票合规审查 Agent"。需求其实很朴素：把上传的发票抽取成结构化字段、按公司报销规则逐条校验、给出"通过/驳回/需人工复核"的打分与理由。负责选型的工程师打开 GitHub，按 Star 数从高到低排了一遍，选了当时"人气顶流"、Star 量级最高的 AutoGen，理由是"这么多人用，肯定错不了"。团队照着多 Agent 对话（Multi-Agent Conversation）范式，花了六周搭出一个"审查员 Agent 和复核员 Agent 互相对话"的原型。

四月，事情崩了两次。第一次：Microsoft 把 AutoGen 与 Semantic Kernel 合并为 Microsoft Agent Framework（MAF），1.0 版本 GA（General Availability，正式可用），AutoGen 官方 README 挂出"进入维护模式、建议新项目从 MAF 开始"的迁移信号，而 AutoGen v0.2 不经改造无法在 MAF 1.0 上原样运行 [来源](https://github.com/microsoft/autogen) [来源](https://github.com/microsoft/agent-framework)。团队相当于把地基盖在了正在拆迁的地皮上。第二次，也是更根本的：复盘时才发现，这个"抽取+校验+打分"的任务是**中等复杂度的单 Agent 结构化输出**，根本不需要多个 Agent 围坐对话——多 Agent 范式带来的全是不必要的复杂度和 token 开销。

事后归因，三处独立错误都不是"技术不行"，而是**选型方法**没做扎实：其一，唯人气论——按 Star 数选框架；其二，没做"活跃度体检"——官方早有迁移动向却没去查；其三，范式不匹配——把一个单 Agent 任务硬塞进多 Agent 对话范式。这三处错误贯穿本章。它把一句模糊的"我们选错框架了"，拆成可复用的选型决策链：先问"要不要 Agent"、再问"什么范式匹配业务"、再看"框架活不活、退出成本高不高"、最后叠加"MCP 这类正交能力"。走通这条链，你就能回答面试和技术评审里最高频的那道题——"你们为什么选这个框架，而不是别的、或者干脆不用框架"。

## 你将得到什么

- 能拆开任意 Agent 框架的"黑箱"，说清它替你封装的七层重复劳动，并判断"这个需求到底要不要上框架"。
- 能凭记忆复述 2026 年八大主流框架（smolagents / PydanticAI / LangGraph / CrewAI / OpenAI Agents SDK / LlamaIndex / AutoGen / MCP）的定位、范式、成熟度与官方动向。
- 能把八个框架归到三大范式流派，并解释每一派在"表达力 vs 可控性"上的取舍——记范式而非记框架名。
- 能把选型整理成一棵**可落地的决策树**，用"先排除、再匹配"的顺序对一个模糊业务描述现场收敛出答案。
- 能给任意框架做一次"活跃度体检"，并用"薄适配器层"的写法把退出成本压到最低。
- 能解释 MCP（Model Context Protocol，模型上下文协议）为什么与框架"正交"而非"竞争"，以及它带来的工具复用与降低锁定两大好处。
- 能开出一张覆盖选型全流程的生产建议清单，并回答与框架选型相关的多道思考题。

## 小节地图

1. [框架的价值与代价：拆开"黑箱"与判断要不要上框架](/advanced/chapter-12/s01/)
2. [八大主流框架全景对比（2026 年 8 月）](/advanced/chapter-12/s02/)
3. [三种范式流派与"一步动作"的表达方式](/advanced/chapter-12/s03/)
4. [选型决策树：先排除，再匹配](/advanced/chapter-12/s04/)
5. [框架成熟度、活跃度体检与退出成本](/advanced/chapter-12/s05/)
6. [MCP 与框架的正交关系](/advanced/chapter-12/s06/)
7. [框架选型的生产踩坑与思考回答](/advanced/chapter-12/s07/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的选型故障链，围绕开头"发票合规审查 Agent"的返工展开。业务画像、错误归因与决策路径在各节保持一致：
```text
业务画像（贯穿全章）：
任务       上传发票 → 抽取结构化字段 → 按报销规则逐条校验 → 输出 通过/驳回/需复核 + 理由
复杂度     中等：单 Agent、需要结构化输出与业务校验、暂不需要多角色/长时状态机
数据       以结构化字段为主，规则库不大，非"海量文档问答"

一次错误的选型路径（第 4 节会用决策树纠正它）：
step_1  按 GitHub Star 数排序，选中当时量级最高的 AutoGen        ← 唯人气论
step_2  照多 Agent 对话范式搭原型，投入约 6 周                    ← 范式不匹配
step_3  2026-04 AutoGen 进入维护模式（官方引导迁移到 MAF）        ← 没做活跃度体检
step_4  返工：范式其实只需单 Agent 结构化输出 → PydanticAI 更匹配

目标输出：
一条"要不要 Agent → 什么范式 → 框架活不活 → 叠加什么正交能力"的可复用决策链，
以及每一步"为什么这么选"的可复核理由。
```
优化前，团队用"Star 数"这一个维度就拍板了；优化后，团队用"范式匹配度 + 活跃度体检 + 退出成本"三个维度层层追问。输出的原型"能不能跑"不是判据——关键是每个选型决策都有可复核的理由、框架的生命力经过体检、将来换框架的代价被压到最低。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key（Application Programming Interface Key，应用程序接口密钥）的热身代码，用来确认解释器可用，并把本章两条核心信念固化成断言：**Star 数不能单独决定选型**；**先判断"要不要 Agent"再谈选哪个框架**。
```python
def should_use_agent(task: dict) -> bool:
    ## 只有"需要模型自主决策"且"复杂度配得上框架抽象成本"时，才上 Agent 框架
    return task["needs_autonomy"] and task["complexity"] != "trivial"


def pick_by_stars_is_enough(candidates: list[dict]) -> bool:
    ## 仅按 Star 数选型是否足够？只要存在"高 Star 但已维护模式"的框架，答案就是否
    hottest = max(candidates, key=lambda c: c["stars"])
    return not hottest["maintenance_mode"]


def run() -> None:
    task = {"needs_autonomy": True, "complexity": "medium"}
    candidates = [
        {"name": "AutoGen", "stars": 50000, "maintenance_mode": True},
        {"name": "PydanticAI", "stars": 19000, "maintenance_mode": False},
    ]
    print(f"这个任务要上 Agent 框架吗？{should_use_agent(task)}")
    print(f"只看 Star 数就够了吗？{pick_by_stars_is_enough(candidates)}")
    print("热身通过：选型是方法论，不是排行榜")


if __name__ == "__main__":
    run()
```
保存为 `warmup_ch12.py`，运行 `python warmup_ch12.py`。预期输出：
```text
这个任务要上 Agent 框架吗？True
只看 Star 数就够了吗？False
热身通过：选型是方法论，不是排行榜
```
若"只看 Star 数就够了吗"返回 True，说明你的候选列表里没有"高人气但已维护模式"的反例——而这恰恰是本章开头 AutoGen 故障要提醒你警惕的情形。

## 阅读约定与来源

正文只引用可公开核验的一手资料：[来源](https://www.anthropic.com/engineering/building-effective-agents)（Anthropic《Building Effective Agents》，"许多模式几行 API 即可实现""先分清 workflow 与 Agent"）、[来源](https://github.com/huggingface/smolagents)（smolagents 仓库与 CodeAgent 代码即动作范式）、[来源](https://github.com/pydantic/pydantic-ai)（PydanticAI 仓库，类型安全与结构化输出）、[来源](https://docs.langchain.com/oss/python/releases/langgraph-v1)（LangGraph v1 发布说明，持久化执行与检查点）、[来源](https://github.com/crewAIInc/crewAI)（CrewAI 仓库，Crews + Flows）、[来源](https://github.com/openai/openai-agents-python)（OpenAI Agents SDK 仓库，Agents/Handoffs/Guardrails/Sessions/Tracing）、[来源](https://github.com/run-llama/llama_index)（LlamaIndex 仓库，RAG（Retrieval-Augmented Generation，检索增强生成）与数据连接器）、[来源](https://github.com/microsoft/autogen)（AutoGen 仓库维护模式声明）与 [来源](https://modelcontextprotocol.io/)（MCP 官方规范）。检索日期为 2026-08-24。

涉及 Star 数、版本号、许可、价格、上下文窗口、SDK（Software Development Kit，软件开发工具包）方法名等会变化的细节，一律以链接中的实时页面为准；本章讲稳定的**选型方法论与范式判断**，不把某次检索到的数字写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。

## 导读页故障定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 选了框架三个月后被迫返工 | 按 Star 数单一维度拍板 | 回看当初选型文档只有"人气"一条理由 | 用范式匹配+活跃度+退出成本三维评估 | 一次性玩具项目容错高，影响可忽略 |
| 框架突然进入维护模式 | 选型前没做活跃度体检 | 查仓库最近发版与官方 README 迁移声明 | 选型清单固定加"官方动向"一项 | 内部自维护框架不受上游影响 |
| 简单任务被套上重型框架 | 没先问"要不要 Agent" | 数一下流程里模型自主决策的分支数 | 固定流程改写确定性 workflow | 确需自主决策的复杂任务另算 |
| 换框架时发现要重写全部业务 | 业务逻辑深度耦合框架私有 API | 统计业务代码里 import 框架的行数 | 核心逻辑纯 Python + 薄适配器层 | 一次性脚本无需考虑退出成本 |
