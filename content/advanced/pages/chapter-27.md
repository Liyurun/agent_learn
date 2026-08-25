2026 年 8 月检索更新。本章只把厂商文档明确描述的行为称为“官方公开机制”；架构解释属于可迁移的通用工程模式；示例代码均是教学参考实现，不代表 Claude Code、Anthropic API 或其他产品的内部源码。

## 一个会“越做越差”的真实任务

设想编程 Agent 已运行 40 轮：它读过 60 个文件、执行过 12 次测试，窗口里混有旧需求、重复日志和过期计划。模型并没有宕机，却开始重复读文件、忘记用户禁止修改数据库的约束，还把 8000 行测试日志反复发送。问题不是“提示词不够漂亮”，而是每轮送入模型的信息失去了选择、排序、压缩和隔离。

本章把这个问题拆成 11 个可独立加载的页面，并最终实现一个无需网络即可运行的 `context-engineering-agent`。

## 你将得到什么

- 能区分 Prompt Engineering（提示工程）与 Context Engineering（上下文工程）。
- 能先预留输出，再按价值密度分配输入预算。
- 能识别长上下文中的位置退化、冲突、干扰与工具结果污染。
- 能用固定事实、近期原文、结构化摘要和外部原文协同压缩。
- 能判断何时把探索交给 Subagent（子智能体）隔离执行。
- 能设计稳定前缀，提高 Prompt Caching（提示缓存）复用机会。
- 能运行、测试、恢复一个带预算报告的长任务 Agent。

## 环境与最终效果

示例要求 Python 3.10+，默认 `MockProvider` 不访问网络、不需要 API Key。执行：
```bash
cd examples/context-engineering-agent
python -m pip install -e ".[dev]"
pytest -q
python -m context_agent.main --provider mock
```
预期看到预算、清理、压缩、子智能体摘要、最终消息与检查点六类报告，测试全部通过。同一份输入产生稳定结果；可选 Anthropic 适配器只有在用户主动选择并配置环境变量时才加载。

## 小节地图

1. [上下文工程解决什么问题](/advanced/chapter-27/context-problem/)
2. [上下文预算与动态组装](/advanced/chapter-27/context-budget/)
3. [Claude Code 的上下文管理](/advanced/chapter-27/claude-code/)
4. [长上下文退化与信息布局](/advanced/chapter-27/long-context-failures/)
5. [压缩、摘要与上下文编辑](/advanced/chapter-27/compaction/)
6. [子智能体与上下文隔离](/advanced/chapter-27/subagents/)
7. [外部记忆与状态卸载](/advanced/chapter-27/external-memory/)
8. [Prompt Caching 与成本](/advanced/chapter-27/prompt-caching/)
9. [完整实践：长任务编程 Agent](/advanced/chapter-27/project/)
10. [生产踩坑与思考回答](/advanced/chapter-27/production-guide/)

## 阅读约定与来源

正文只使用可公开核验的一手资料：[Anthropic Agent 指南](https://www.anthropic.com/research/building-effective-agents)、[Claude Code 记忆与规则](https://code.claude.com/docs/en/memory)、[Claude Code 子智能体](https://code.claude.com/docs/en/sub-agents)、[Claude Code Skills](https://code.claude.com/docs/en/skills)、[Anthropic Context Editing](https://docs.anthropic.com/en/docs/build-with-claude/context-editing)、[Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)、[Lost in the Middle 论文](https://arxiv.org/abs/2307.03172)、[LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)、[LangSmith Observability](https://docs.langchain.com/langsmith/observability) 与 [Microsoft AI Agents for Beginners 的 Context Engineering 课程](https://github.com/microsoft/ai-agents-for-beginners/tree/main/12-context-engineering)。检索日期为 2026-08-23。

涉及价格、缓存期限、模型窗口大小等会变化的参数，以链接中的当前官方文档为准；本章讲稳定机制，不把某次检索时的数字写成永久承诺。仓库内另保留 `资料来源.md` 作为维护清单，但不计入 11 个正文页面。

## 从一次四小时故障看完整生命周期

某电商团队让编程 Agent 修复“优惠券结算偶发少减五元”。上午九点，Agent 读取结算服务、规则引擎与二十余个测试；十点，它找到旧版满减规则，并在计划中写下“订单满一百减十”；十一点，业务人员补充“灰度租户已切换为满八十减十五”，Agent 却把这条消息压进一句“规则有调整”；中午再次执行时，它依据仍在窗口中的旧测试修改代码。单元测试全部通过，灰度订单却继续算错。值班同学只保存了最终回答，没有保存当轮实际输入，最终花了四小时才发现：正确规则被召回过，却在组装时被旧规则覆盖。

这个事故贯穿本章所有页面。第一步不是换模型，而是把每轮输入拆成可观测的类别：当前生效规则属于固定事实；旧规则只应留在外部审计记录；二十余个测试定义按任务动态选择；长日志在保留首个失败、退出码与原文指针后清理；规则比对可以交给隔离子智能体；每次写代码前保存代码提交、规则版本和检查点。这样，“模型答错了”会被拆成可以定位的事件：检索找到了什么、组装采用了什么、哪些内容被压缩、哪条工具结果触发了动作。

优化前，一轮请求包含约二万字符规则手册、全部工具定义、十六轮历史和完整测试日志；优化后，只发送当前租户规则、三个候选工具、最近四轮原文、结构化摘要以及两条可追溯证据。输入变短只是副产物，关键变化是每个决策都有来源，冲突不会被静默覆盖，失败后可以从检查点恢复。

## 章节贯穿数据

后续示例统一使用一条可复核的数据链。项目规则文件声明“禁止修改生产数据库”“提交前运行测试”；用户任务是定位连接池超时并给出补丁；十八轮历史包含需求澄清、文件读取、一次错误猜测和最终确认；测试日志包含一个失败测试、退出码与根因；固定事实记录只读边界和已确认接口。各页会抽取其中一个问题做最小示例，实践页再把它们组合成完整工程。
```text
输入文件：
project_rules.md        共享项目规则
conversation.json       18 轮原始事件
noisy_test_output.txt   高噪声测试输出

关键事实：
F-001 禁止写生产数据库，来源=project_rules.md，状态=active
F-002 连接池上限为 20，来源=用户第 16 轮确认，状态=active

目标输出：
预算报告 + 清理报告 + 压缩摘要 + 子任务证据 + 最终消息 + 检查点
```
完整运行前后可用同一组不变量比较。优化前把所有文本直接拼接，输入量随轮数单调增长，无法说明某条规则来自哪里；优化后，输出预留始终不被占用，固定事实带来源，摘要记录覆盖范围，清理后的日志保留根因，检查点记录下一动作。若最终答案相同，也不能据此断言两种方案等价，因为前一种无法稳定恢复和审计。

## 最小环境核验程序

导读页也提供一个可运行入口，用于在阅读前确认解释器、工程目录和样例文件都可访问。它不调用模型，也不修改工程文件。
```python
from pathlib import Path
import sys

REQUIRED = [
    "sample_data/project_rules.md",
    "sample_data/conversation.json",
    "sample_data/noisy_test_output.txt",
    "src/context_agent/main.py",
]

def main() -> None:
    root = Path("examples/context-engineering-agent")
    missing = [name for name in REQUIRED if not (root / name).is_file()]
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"工程目录={root}")
    print(f"文件检查={'通过' if not missing else '失败'}")
    print(f"缺失={missing}")

if __name__ == "__main__":
    main()
```
从仓库根目录保存为 `verify_chapter27.py`，运行 `python verify_chapter27.py`。完整输入就是当前仓库文件树；预期输出为：
```text
Python=3.10
工程目录=examples/context-engineering-agent
文件检查=通过
缺失=[]
```
Python 小版本可能不同，但必须不低于 3.10。若输出“失败”，先检查运行目录，不要立刻安装依赖；文件路径全部存在而导入失败时，再执行可编辑安装。这个区分能避免把“站错目录”误诊为“包损坏”。

## 公开案例边界与阅读方法

Claude Code 的 `CLAUDE.md`、范围规则、自动记忆、压缩、子智能体和技能均以官方文档描述为准；Anthropic API 的上下文编辑与提示缓存同样只引用公开接口。章节中的预算器、四层数据模型、边缘布局、返回字段和检查点 schema 是为了说明机制而构造的参考实现。它们可以移植到自己的 Agent，但不能反推厂商内部服务、存储方式、提示模板或优先级算法。

阅读每页时可以沿“输入—选择—变换—输出—证据”追踪。若某个优化只说“减少 Token”却没有说明删除了什么、如何恢复以及失败时看哪个指标，它还不足以进入生产。若某个官方能力只说明可用，却未公开内部算法，正文会把事实与推导分开，避免把合理猜测写成产品承诺。

## 导读页故障定位

| 症状 | 根因 | 如何定位 | 优化前 | 优化后 |
|---|---|---|---|---|
| 示例命令找不到模块 | 未在工程根目录安装，或解释器环境不同 | 打印 `sys.executable` 与当前目录 | 反复安装依赖 | 先确认目录，再执行可编辑安装 |
| Mock 结果每次变化 | 样例数据被改动或误用了真实 Provider | 核对参数与输入文件哈希 | 只看最终答案 | 同时记录 provider、输入哈希和报告 |
| 阅读后仍把缓存当记忆 | 没有按生命周期区分机制 | 对每类信息回答“何时失效、能否恢复” | 按产品名记概念 | 按信息所有者和生命周期建模 |
| 声称示例等同产品内部实现 | 忽略公开事实与教学推导边界 | 回查来源链接和边界段落 | 用推测补齐空白 | 只陈述可观察行为，推导明确标注 |
