2026 年 8 月检索更新。本章把厂商文档明确描述的行为称为「官方公开机制」；把可从公开行为推导、能迁移到自建系统的做法称为「通用工程模式」；把书内为讲清原理而构造、可离线运行的代码称为「教学参考实现」。三者在正文里始终分层标注，不把推导写成产品承诺，也不臆造任何厂商内部实现。会变化的参数（模型标识、分辨率上限、价格、beta 状态）一律以链接中的当前官方文档为准。

## 一个「批量补录报销单」的真实任务

设想一个财务共享中心接到任务：把 320 张扫描报销单，录入一个 2011 年上线、没有任何应用程序接口（Application Programming Interface，API）的老旧内部系统。这个系统只有网页表单，改造它要走三个月的立项流程。人怎么干？看屏幕、点「新建」、在字段里敲金额、点「保存」，一张两分钟，320 张约 11 小时，还容易敲错。

工程团队想用自动化。第一反应是传统的机器人流程自动化（Robotic Process Automation，RPA）：录一遍点击脚本回放。但这个系统每周都在小改版，按钮位置一变脚本就点空，维护成本高得离谱。于是他们试了另一条路——**让一个能看屏幕、能动鼠标的 Agent 去操作**：每一步先截图，让多模态模型看懂「现在在哪一页、下一步该点哪」，再把「点保存按钮」翻译成像素坐标去执行。这就是 Computer Use（计算机操作，也叫 GUI Agent，图形界面智能体）。

这个任务贯穿全章。它把「让 Agent 像人一样用电脑」这句口号，拆成可定位的工程环节：模型怎么从截图里认出「金额输入框」（视觉两层）、怎么把语义意图落成像素坐标（grounding 与缩放）、循环怎么转（观察→决策→定位→动作→再观察）、Anthropic 和 OpenAI 的官方接口长什么样、浏览器场景为什么更稳、320 步的长任务为什么会崩、点错了会不会真删库、以及这东西到底怎么评估。把这条链路走通，你就能在面试里讲清「Computer Use 和 RPA 有什么本质区别」「让 Agent 操作真实系统你会加哪些护栏」这两道高频题。

## 你将得到什么

- 能说清多模态视觉的两个层次——视觉理解（Visual Understanding，被动看懂）与 GUI grounding（Graphical User Interface Grounding，主动精确定位可交互元素），并解释为什么后者是 Computer Use 落地的瓶颈。
- 能凭记忆默画 Computer Use 的操作循环，指出最脆弱的一环，并说清「等待页面稳定」为什么是真实工程难题。
- 能解释坐标缩放（screenshot 缩小后模型坐标必须回缩）这一高分屏杀手级 bug，并会用 set-of-mark（标记集提示）与 DOM（Document Object Model，文档对象模型）结构化定位规避它。
- 能读懂 Anthropic Computer Use 工具（`left_click`/`type`/`key`/`screenshot`）与 OpenAI `computer_use_preview` 工具（`computer_call`/`computer_call_output` 循环）两套官方机制，并说明各自边界。
- 能用误差累积公式量化长任务成功率下滑（0.95¹⁰≈60%），并给出缩短链路、关键步校验重试、结构化定位三条提升手段。
- 能列出操作真实系统的五道护栏，并解释提示注入（Prompt Injection）为何是 Computer Use 特有的新型攻击面。
- 能用「沙箱 + 关键检查点」设计一套 Computer Use 评估方案，并开出一张覆盖各环节的生产建议清单。

## 小节地图

1. [多模态视觉的两个层次：从看懂图到看懂界面](/advanced/chapter-29/s01/)
2. [Computer Use 的核心：截图—理解—决策—定位—执行循环](/advanced/chapter-29/s02/)
3. [坐标动作：缩放回缩、set-of-mark 与结构化定位](/advanced/chapter-29/s03/)
4. [与传统 RPA 的本质区别：从背剧本到随机应变](/advanced/chapter-29/s04/)
5. [官方机制：Anthropic Computer Use 与 OpenAI computer-use](/advanced/chapter-29/s05/)
6. [浏览器自动化：DOM 优先、纯视觉兜底](/advanced/chapter-29/s06/)
7. [可靠性、延迟与成本：冷静的现实](/advanced/chapter-29/s07/)
8. [安全护栏、提示注入与评估难点](/advanced/chapter-29/s08/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的场景链，围绕开头「批量补录报销单」展开，并配一组可公开核验的基准数字作为「现实标尺」：
```text
贯穿任务：把一张报销单录入无 API 的老旧网页系统
一条最小操作序列（每步都可能失败）：
  step1 截图 -> 认出「新建报销单」按钮  -> click(x1,y1)
  step2 截图 -> 认出「金额」输入框       -> click(x2,y2) + type("880.00")
  step3 截图 -> 认出「保存」按钮         -> click(x3,y3)   ← 高危：写操作，需护栏
  step4 截图 -> 认出「保存成功」提示      -> done

现实标尺（公开基准，随模型迭代变化，以官方为准）：
  OSWorld 人类基线            ≈ 72.4%
  OpenAI CUA 在 OSWorld       ≈ 38.1%（发布时）
  OpenAI CUA 在 WebArena      ≈ 58.1%（发布时）
  Simular Agent S3 在 OSWorld ≈ 72.6%（宣称首次超过人类基线）
```
这些数字来自各家公开材料 [来源](https://openai.com/index/computer-using-agent/) [来源](https://www.simular.ai/articles/agent-s3)。它们说明一个关键事实：**到 2026 年，通用桌面操作（OSWorld）刚摸到人类水平的门槛，且高度依赖「多次采样择优」等工程手段，离「闭眼交给它」还很远。** 全章的工程建议都围绕这个现实展开。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码，把本章三条不变量固化成断言：循环每一步都要重新截图观察；语义意图必须落成像素坐标才可执行；必须有硬步数上限防死循环。
```python
from __future__ import annotations
import sys


def loop_reobserves(states_seen: list[str]) -> bool:
    """不变量①：每一步都重新截图，观察到的状态会随动作变化。"""
    return len(set(states_seen)) > 1


def grounding_needs_pixel(intent: str, resolved) -> bool:
    """不变量②：语义意图必须落成具体像素坐标才可执行。"""
    return isinstance(resolved, tuple) and len(resolved) == 2


def has_step_limit(max_steps: int) -> bool:
    """不变量③：必须有硬步数上限，防 GUI 死循环。"""
    return isinstance(max_steps, int) and max_steps > 0


def run() -> None:
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"循环每步重新观察={loop_reobserves(['empty', 'typed', 'logged_in'])}")
    print(f"grounding落像素={grounding_needs_pixel('点结算', (1160, 640))}")
    print(f"存在步数上限={has_step_limit(20)}")
    print("热身通过：可以开始阅读第 29 章")


if __name__ == "__main__":
    run()
```
保存为 `warmup_ch29.py`，运行 `python warmup_ch29.py`。预期输出：
```text
Python=3.10
循环每步重新观察=True
grounding落像素=True
存在步数上限=True
热身通过：可以开始阅读第 29 章
```
Python 小版本可能不同，但需不低于 3.10。若「循环每步重新观察」为 False，说明你把 Computer Use 误解成了「截一次图执行到底」——它恰恰相反，界面状态每步都在变，必须重新观察。

## 阅读约定与来源

正文只引用可公开核验的一手资料：[来源](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)（Anthropic Computer use tool，含 `left_click`/`type`/`key`/`scroll` 动作、坐标语义、分辨率建议、提示注入风险提示）、[来源](https://platform.openai.com/docs/guides/tools-computer-use)（OpenAI Computer use，含 `computer_use_preview` 工具、`computer_call`/`computer_call_output` 五步循环、Playwright/Docker 环境、pending_safety_checks）、[来源](https://openai.com/index/computer-using-agent/)（Computer-Using Agent / Operator，含 OSWorld / WebArena 基准）、[来源](https://playwright.dev/)（Playwright 浏览器自动化框架）、[来源](https://www.anthropic.com/engineering/building-effective-agents)（Anthropic Building Effective Agents，Agent 设计原则）与 [来源](https://modelcontextprotocol.io/)（MCP，Model Context Protocol，模型上下文协议）。检索日期为 2026-08-24。

涉及价格、模型标识、上下文窗口、分辨率上限、beta/preview 状态、SDK（Software Development Kit，软件开发工具包）方法名等会变化的细节，以链接中的当前官方文档为准；本章讲稳定的机制与工程模式，不把某次检索到的数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。

## 导读页边界与常见误解

| 误解 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 以为「截一次图就能执行到底」 | 不理解界面状态每步都变 | 让热身脚本状态列表去重后只剩 1 项 | 每步重新截图观察 | 纯静态页面单步任务可简化 |
| 以为模型「直接操作了软件」 | 混淆「模型输出坐标」与「执行器点击」 | 分别打印模型输出与执行器调用 | 记住动作只在执行器发生 | 服务端内置工具由厂商执行属另一类 |
| 把基准分当「已能生产」 | 只看榜单不看采样/步数条件 | 对照 OSWorld 人类基线与模型分 | 分场景评估、留人工兜底 | 稳定窄任务成功率可更高 |
| 以为它能替代所有 RPA | 忽略成本与稳定性差异 | 对同一高频任务算单次成本 | 稳定高频用 RPA、长尾多变用 Computer Use | 二者互补而非替代 |
