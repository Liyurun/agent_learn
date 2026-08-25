2026 年 8 月检索更新。本章严格区分三层来源：厂商文档明确描述的能力称为「官方公开机制」；从公开行为提炼、可迁移的做法称为「通用工程模式」；书内为讲清机制而写的代码称为「教学参考实现」，不代表 ChatGPT、Claude、LangGraph 或任何产品的内部源码。涉及模型窗口、embedding 维度、价格、缓存期限等会变化的参数，一律以链接中的当前官方文档为准。

embedding（嵌入，将文本映射为高维稠密向量的表示）、RAG（Retrieval-Augmented Generation，检索增强生成）、TTL（Time To Live，生存时间）、MemGPT（Memory-GPT，一种把大模型上下文当作操作系统内存分层管理的系统）这些术语会在下文首次出现处再展开，这里先给出全称，后续小节直接使用。

## 一个「昨天说过、今天忘光」的真实故障

某三甲医院的用药咨询 Agent 上线第 11 天出现一次险情。患者在周一的会话里明确写道「我对青霉素过敏，正在长期服用华法林抗凝」；助手当时回答正确。周三，同一患者换了入口再次咨询「头痛能吃什么药」，助手推荐了含阿莫西林（青霉素类）的复方制剂，还建议叠加阿司匹林缓解疼痛——两条建议都踩中禁忌。事后复盘发现：模型没有变笨，问题出在记忆。周一的过敏信息只存在于那一条会话的上下文里，会话一结束就随窗口丢弃；周三是一条全新线程，模型看不到任何既往事实。团队最初的反应是「把系统提示写得更严厉」，但下一位长期用药患者又踩了同样的坑。真正的修复不是润色提示词，而是补上一套记忆系统：把「过敏、正在服用的药」这类跨会话事实抽取出来、带来源写进长期存储，并在每轮回答前按语义检索回填。

这个故障贯穿本章所有页面。它把「记忆」从一个抽象名词，拆成了四个可以分别定位的工程问题：**该不该记（写入策略）、记在哪（短期窗口还是长期存储）、怎么取回（向量语义检索）、什么时候忘（遗忘与淘汰）**。每一环都可能独立出错，也需要独立设计。

## 你将得到什么

- 能说清 Agent 为什么必须有记忆，以及「无记忆」在真实产品里制造的具体故障，而不是停留在「金鱼脑」这个比喻。
- 能区分短期记忆（上下文窗口内的工作记忆）与长期记忆（外部存储 + 检索），并解释长窗口为何没有取消记忆系统。
- 能手写一个纯 Python、无需 API Key 的语义记忆：从 embedding、余弦相似度到综合打分检索，看清向量库内部到底发生了什么。
- 能设计记忆的写入闸门、摘要压缩、TTL 与淘汰策略，回答「什么该记、什么该忘」。
- 能把原理映射到 MemGPT、Generative Agents、LangGraph/LangMem、ChatGPT 记忆、Claude memory tool 等真实系统的**公开机制**，并守住不臆造内部实现的边界。
- 能拿出一张生产踩坑表和一组面试级「思考+回答」，在系统设计题里把记忆讲成可观测、可恢复的系统。

## 小节地图

1. [为什么 Agent 需要记忆](/advanced/chapter-05/s01/)
2. [短期记忆与上下文窗口](/advanced/chapter-05/s02/)
3. [长期记忆与向量检索](/advanced/chapter-05/s03/)
4. [记忆的写入与遗忘策略](/advanced/chapter-05/s04/)
5. [向量记忆实战](/advanced/chapter-05/s05/)
6. [记忆架构与真实系统](/advanced/chapter-05/s06/)
7. [生产踩坑与思考回答](/advanced/chapter-05/s07/)

## 贯穿案例与可复核数据

后续每个小节都复用同一条数据链：一位长期用药患者的记忆条目。它足够小，可以在纸上手算，又覆盖了「高风险硬事实、时效性偏好、噪声闲聊」三类信息：
```text
记忆条目（统一贯穿全章）：
M1 用户对青霉素过敏，正在服用华法林抗凝   importance=9  hours_ago=1560  类型=硬事实
M2 用户最近开始跑马拉松，每周三次          importance=5  hours_ago=840   类型=偏好
M3 用户喜欢清淡口味，不吃辣                importance=4  hours_ago=600   类型=偏好
M4 用户今天出现头痛，问该吃什么药          importance=6  hours_ago=0     类型=本轮意图

当前查询 Q：头痛能吃阿司匹林或含青霉素的药吗？
期望：M1 必须进入上下文（安全硬事实），即便它的字面相关度不是最高。
```
这条数据的关键张力在于：纯语义相似度会把「本轮头痛」排在最前，而把「青霉素过敏」这条救命事实排在后面。第 03、05 节会用它演示为什么「相关度检索」不够，必须叠加重要度；第 04 节用它演示写入闸门和淘汰；第 06、07 节用它对照真实系统与生产事故。

## 最小环境核验

阅读前先确认解释器可用、目录结构正确。下面这段代码只做自检，不联网、不调用模型：
```python
import sys
from pathlib import Path

def main() -> None:
    here = Path(__file__).resolve().parent
    expected = ["README.md", "01-为什么Agent需要记忆.md", "05-向量记忆实战.md"]
    missing = [name for name in expected if not (here / name).is_file()]
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"章节目录={here.name}")
    print(f"文件检查={'通过' if not missing else '失败'}")
    print(f"缺失={missing}")

if __name__ == "__main__":
    main()
```
把它保存为章节目录下的 `verify_chapter5.py`，运行 `python verify_chapter5.py`。预期输出：
```text
Python=3.10
章节目录=第5章-记忆系统
文件检查=通过
缺失=[]
```
Python 小版本可能不同，但不应低于 3.10。若显示「失败」，先检查运行目录是否为本章目录，而不是急着改代码。这个区分能避免把「站错目录」误诊为「文件缺失」。

## 阅读约定与来源

正文只引用可公开核验的一手资料：[MemGPT 论文](https://arxiv.org/abs/2310.08560)、[Generative Agents 论文](https://arxiv.org/abs/2304.03442)、[Lilian Weng：LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/)、[Lost in the Middle 论文](https://arxiv.org/abs/2307.03172)、[Anthropic Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)、[Anthropic Memory tool 文档](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool)、[Anthropic 上下文管理公告](https://www.anthropic.com/news/context-management)、[LangGraph 记忆概念](https://docs.langchain.com/oss/python/langgraph/persistence)、[OpenAI Embeddings 指南](https://platform.openai.com/docs/guides/embeddings) 与 [OpenAI ChatGPT 记忆说明](https://help.openai.com/en/articles/8590148-memory-faq)。检索日期为 2026-08-24。仓库内另保留 `资料来源.md` 作为维护清单，不计入正文页面。

## 从一次会话到跨会话：本章的主线

第 01 节先证明「记忆是必需品」：无记忆的 Agent 无法积累经验、无法跨会话服务同一用户，也无法在长任务里守住早期约束。第 02 节把「短期记忆」落到上下文窗口这个具体载体，讲清窗口的硬截断、二次方成本与「lost in the middle（中间遗忘）」。第 03 节引出「长期记忆」，把语义检索拆成 embedding、余弦相似度、近似最近邻与分块四个环节。第 04 节回答「什么该记、什么该忘」，把写入闸门、摘要、TTL 与淘汰做成可运行代码。第 05 节是完整实战，从零手写一个带综合打分的向量记忆，并给出运行轨迹。第 06 节把这些原理对到 MemGPT、Generative Agents、LangGraph、ChatGPT、Claude 的公开机制上。第 07 节收束到生产踩坑表与面试思考回答。每一节都以「真实问题」开场，以「思考+回答」收尾，中间夹一段完全可运行、无需联网的代码。
