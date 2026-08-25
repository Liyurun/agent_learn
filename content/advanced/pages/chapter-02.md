2026 年 8 月检索更新。本章把厂商文档与公开论文明确描述的行为称为“官方公开机制”；把可从这些行为推导、可迁移到自建系统的做法称为“通用工程模式”；把书中为讲清机制而写的示例代码称为“教学参考实现”，它不代表 OpenAI、Anthropic、LangGraph 或任何产品的内部源码。涉及模型价格、上下文窗口、接口字段等会变化的参数，一律以链接中的当前官方文档为准。

## 一个“组件齐全却仍然翻车”的真实任务

设想一个电商订单助手已经上线三周。产品经理拿它演示：用户问“订单 A100 到哪了”，它准确回答“已发货，预计明天送达”；用户接着说“那把这单的钱退给我”，它也照做了——直接调用退款接口退了 680 元。事后复盘发现，这个 Agent“组件不缺”：它有模型（会决策）、有工具（能查单、能退款）、有指令（系统提示里写着“退款需人工审核”）、有记忆（记得上一轮查过 A100）、也有一点规划（先查再答）。问题不在“缺了哪个零件”，而在于**每个零件各自的边界没有设计清楚**：指令里的“需人工审核”只是一句自然语言请求，没有落到退款函数的执行层校验；规划只想着“完成用户意图”，没有区分只读动作和写动作;记忆记住了订单号，却没记住“这是高风险操作”这一约束。

一句话：**知道 Agent 由哪些组件构成只是起点，理解每个组件的职责边界、它们在循环里如何协同、以及各自在生产里最容易塌方的地方，才是这一章要交付的能力。** 本章把这个订单助手作为贯穿案例，从“认识五件套”一路做到“亲手组装一个可运行骨架”，再到“把它在生产里可能踩的每个坑列成表”。

## 你将得到什么

- 能说清业界两套最有影响力的组件划分——OpenAI 的 Model / Tools / Instructions 与 Lilian Weng 的 Planning / Memory / Tool Use，并解释它们“视角不同而非对错”，最终合并成 **Model + Tools + Instructions + Planning + Memory** 五件套。
- 能把五件套映射进一个统一循环：**感知 → 推理 → 行动 → 观察 → 记忆**，并说明“组件是零件、循环是运转”。
- 能解释模型在 Agent 里到底“输出什么”——不是散文，而是**结构化决策**（调哪个工具、传什么参数、还是停止），并知道函数调用（Function Calling）与结构化输出（Structured Outputs）为何是关键机制。
- 能区分工具的风险等级，会写“给模型读的工具说明书”，并把护栏落在执行层而非仅靠提示词。
- 能区分短期记忆与长期记忆的边界，知道什么该进上下文、什么该进外部库。
- 能亲手把五件套拼成一个**完全可运行、无需 API Key 的纯 Python 骨架**，并读懂它的运行轨迹。
- 能把上面所有原理映射到主流真实系统的公开机制，并背出一张覆盖 12 行以上的生产故障表。

## 小节地图

1. [两套权威组件划分](/advanced/chapter-02/s01/)
2. [统一心智模型：感知—推理—行动—记忆循环](/advanced/chapter-02/s02/)
3. [Model 作为决策核心](/advanced/chapter-02/s03/)
4. [Tools 与 Instructions](/advanced/chapter-02/s04/)
5. [Planning 与 Memory](/advanced/chapter-02/s05/)
6. [组装一个 Agent 骨架](/advanced/chapter-02/s06/)
7. [生产踩坑与思考回答](/advanced/chapter-02/s07/)

## 贯穿案例：订单助手 order-assistant

后续每个小节都复用同一条可复核的案例数据链，避免各页各讲一个玩具例子。案例设定如下：
```text
角色：电商订单助手 order-assistant
指令（Instructions）：
  - 可以查询订单状态（只读）
  - 涉及退款必须先经人工审核（写操作，高风险）
  - 信息足够就直接回答，不要重复查询
工具（Tools）：
  - search_order(order_id)  只读，风险=低
  - refund(order_id, amount, approved_by_human)  写操作，风险=高
记忆（Memory）：
  - 短期：本轮已查到的订单结果
  - 长期：用户历史（如“上次查过 A100”）
贯穿订单：
  order_id = A100
  status   = 已发货，预计明天送达
  amount   = 680 元
两条测试输入：
  T1: “帮我查一下订单 A100 的状态”      → 期望：查询后如实回答
  T2: “我要对订单 A100 退款”            → 期望：被执行层护栏拦下，转人工
```
第 01 节用它说明两套组件划分各自看重什么；第 02 节把它放进循环；第 03—05 节逐个拆组件；第 06 节把它组装成完整可运行骨架；第 07 节列出它在生产中最容易踩的坑。同一条数据链，让“组件、循环、踩坑”三层能互相印证。

## 最小环境核验程序

阅读前先确认解释器版本与本章文件都可访问。下面这段程序不联网、不需要 API Key，只检查本章目录结构是否完整，用于把“站错目录”和“内容缺失”区分开。
```python
from pathlib import Path
import sys

REQUIRED = [
    "README.md",
    "01-两套权威组件划分.md",
    "02-统一心智模型-感知推理行动记忆循环.md",
    "03-Model作为决策核心.md",
    "04-Tools与Instructions.md",
    "05-Planning与Memory.md",
    "06-组装一个Agent骨架.md",
    "07-生产踩坑与思考回答.md",
]

def main() -> None:
    root = Path(__file__).resolve().parent
    missing = [name for name in REQUIRED if not (root / name).is_file()]
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"章节目录={root.name}")
    print(f"文件检查={'通过' if not missing else '失败'}")
    print(f"缺失={missing}")

if __name__ == "__main__":
    main()
```
把它保存为本章目录下的 `verify_chapter2.py`，运行 `python verify_chapter2.py`。完整输入就是当前章节目录；预期输出为：
```text
Python=3.10
章节目录=第2章-Agent的心智模型与核心组件
文件检查=通过
缺失=[]
```
Python 小版本可能不同，但只要不低于 3.9 即可运行本章全部示例。若输出“失败”，先检查是不是把脚本放错了目录，而不是急着改文件名——把“运行位置错误”误诊为“内容缺失”是最常见的低级弯路。

## 阅读约定与来源

本章正文只引用可公开核验的一手资料：[OpenAI · A Practical Guide to Building Agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf)（Model / Tools / Instructions 与护栏理念）、[Lilian Weng · LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/)（Planning / Memory / Tool Use 三组件原始出处）、[Anthropic · Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)（增强型 LLM 与工作流—Agent 的组合模式）、[OpenAI · Function calling](https://platform.openai.com/docs/guides/function-calling)、[OpenAI · Structured Outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/)、[Yao et al. · ReAct](https://arxiv.org/abs/2210.03629)、[Wei et al. · Chain-of-Thought Prompting](https://arxiv.org/abs/2201.11903)、[Lewis et al. · Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401)。检索日期为 2026-08-24。

三层来源在正文中始终区分：**官方公开机制**（有文档或论文支撑的外部行为）、**通用工程模式**（从公开行为提炼、可迁移到自建系统的做法）、**教学参考实现**（本书为讲清机制而构造的代码，不反推任何产品内部实现）。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。
