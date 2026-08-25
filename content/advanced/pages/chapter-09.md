2026 年 8 月检索更新。本章严格区分三层事实：凡引用官方规范或公告能核验的行为，标注为「官方公开机制」；对协议动机与工程价值的解释属于「通用工程模式」，可迁移但不等于任何厂商内部实现；所有代码均为「教学参考实现」，手写最小 JSON-RPC（JSON Remote Procedure Call，JSON 远程过程调用）骨架用于说明原理，不代表官方 SDK（Software Development Kit，软件开发工具包）或产品源码。涉及规范版本号、传输层细节、成员名单等会更新的信息，一律以链接中的当前官方文档为准。

## 一次「三端各写一遍」的真实集成故障

一家中型 SaaS 公司在 2025 年做过一次内部复盘：他们把同一个「查询内部工单系统」的能力，分别接进了三个不同的 AI 应用——桌面版助手、IDE（Integrated Development Environment，集成开发环境）插件、以及自研客服 Agent。三个团队各写了一套集成代码：桌面团队用 HTTP 直连、插件团队用一层 Node 适配、客服团队又封了一个 Python 客户端。三份代码把同一个工单接口的字段翻译成「模型能读的工具描述」翻译了三遍。三个月后工单系统改了一个字段名 `assignee` → `owner`，三处集成同时静默出错：桌面助手把工单派给了「空指派人」，IDE 插件直接抛异常，客服 Agent 则把旧字段当成有效值继续对话。事故本身只是一次字段改名，但它要在三个代码库里各修一次、各测一次、各发一次版。

这不是「谁代码写得差」的问题，而是集成方式本身出了结构性缺陷：**M 个应用 × N 个工具，需要 M×N 套彼此独立、各自维护的胶水代码**。MCP（Model Context Protocol，模型上下文协议）就是为消解这种组合爆炸而生的开放标准，被 Anthropic 和 Linux 基金会反复称作「AI 应用的 USB-C」[来源](https://www.anthropic.com/news/model-context-protocol)。本章从这个故障出发，把 MCP 拆成可独立加载的多页，最后你会亲手用纯标准库跑通一个最小 MCP-like server。

## 你将得到什么

- 能用「M×N → M+N」的数量级算例，说清 MCP 解决的到底是什么结构性问题，而不是背一句「USB-C」口号。
- 能画出并解释 Host、Client、Server 三方角色，说清为什么 Client 要从 Host 里单独拆出来（一对一连接 + 故障隔离）。
- 能区分 Tools、Resources、Prompts 三种原语的控制权归属，并知道 2025 年规范里新增的 sampling、elicitation、roots 各自解决什么。
- 能说清传输层从 2024-11-05 的 HTTP+SSE（Server-Sent Events，服务器发送事件）演进到 2025-03-26 Streamable HTTP 的原因与现状，并知道 stdio 的安全边界。
- 能读懂一条真实的 JSON-RPC 握手轨迹，并亲手运行一个不依赖任何第三方库的最小 MCP-like server（保存、运行、核对输出三件套）。
- 能列出 MCP 的真实采纳版图（谁在用、谁在治理）与生产环境的安全清单与踩坑表。

## 小节地图

1. [集成爆炸：M×N 困境与 USB-C 式的解法](/advanced/chapter-09/s01/)
2. [MCP 架构：Host、Client、Server 与 JSON-RPC](/advanced/chapter-09/s02/)
3. [三大原语：Tools、Resources、Prompts 与 sampling/elicitation](/advanced/chapter-09/s03/)
4. [传输层：stdio、Streamable HTTP 与 SSE 演进](/advanced/chapter-09/s04/)
5. [构建一个 MCP Server：纯 Python 手写 JSON-RPC over stdio](/advanced/chapter-09/s05/)
6. [生态与真实系统：从 Anthropic 到 Linux 基金会治理](/advanced/chapter-09/s06/)
7. [MCP 的生产踩坑与思考回答](/advanced/chapter-09/s07/)

（另有 `资料来源.md` 作为维护用来源清单，不计入正文页面。）

## 贯穿案例与贯穿数据

本章各小节复用同一条可复核的数据链：一个「工单查询」能力被三个 AI 应用接入，工单系统本身是一个只读的内存字典。我们始终用同一组固定输入，保证任何人在任何机器上运行示例都得到相同输出：
```text
工单数据（教学用固定值，无需网络/数据库）：
TICKET-101  title=登录超时          owner=alice   status=open
TICKET-102  title=报表导出乱码      owner=bob     status=closed

三个接入方：
Host-A = 桌面助手
Host-B = IDE 插件
Host-C = 自研客服 Agent

要暴露的能力：
list_tickets()            -> 列出全部工单（只读，适合做 Resource 或只读 Tool）
get_ticket(ticket_id)     -> 查单个工单（只读）
add_number(a, b)          -> 纯计算，无副作用（用于演示 tools/call）
```
第 1 节用它算「M×N → M+N」的账；第 2 节用它说明三方角色；第 5 节把它做成一个真正能跑起来的 MCP-like server，并录下 `initialize → tools/list → tools/call` 的完整轨迹；第 7 节再用它演示生产环境里的各类故障复现。

## 最小环境核验（热身代码）

阅读正文前，先用一段不依赖任何第三方库、也不访问网络的代码，确认你的 Python 解释器能收发 JSON-RPC 消息。它只做一件事：手工拼一条 `tools/call` 请求、序列化、再反序列化，验证「JSON 就是 MCP 的线格式」这句话。
```python
import json

def build_call(tool_id: int, name: str, arguments: dict) -> str:
    request = {
        "jsonrpc": "2.0",
        "id": tool_id,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    return json.dumps(request, ensure_ascii=False)

def main() -> None:
    line = build_call(1, "get_ticket", {"ticket_id": "TICKET-101"})
    print("发送:", line)
    parsed = json.loads(line)
    print("方法:", parsed["method"])
    print("目标工具:", parsed["params"]["name"])

if __name__ == "__main__":
    main()
```
保存为 `warmup.py`，运行 `python warmup.py`。预期输出：
```text
发送: {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_ticket", "arguments": {"ticket_id": "TICKET-101"}}}
方法: tools/call
目标工具: get_ticket
```
如果这段能跑通，说明第 5 节的完整 server/client 一定也能跑通——它们只是把「拼一条消息」扩展成「通过 stdio 收发多条消息」。Python 小版本可以不同，但需不低于 3.8。

## 阅读约定与一手来源

正文只引用可公开核验的一手资料：[Anthropic MCP 公告](https://www.anthropic.com/news/model-context-protocol)、[MCP 官方规范站 modelcontextprotocol.io](https://modelcontextprotocol.io/)、[规范 2025-11-25 传输层文档](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)、[规范 2025-11-25 Tools 文档](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)、[MCP 客户端概念文档](https://modelcontextprotocol.io/docs/learn/client-concepts)、[Linux 基金会 AAIF 成立公告](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation) 与 [JSON-RPC 2.0 规范](https://www.jsonrpc.org/specification)。检索日期为 2026-08-24。

规范版本会持续演进：撰写时可核验的时间线为 2024-11-05（首版，含 HTTP+SSE 传输）、2025-03-26（引入 Streamable HTTP）、2025-06-18（elicitation 提升为一等原语）、2025-11-25，以及标注为 latest 的 2026-07-28 修订。任何版本号、成员名单、server 数量都以官方页面当前值为准，本章不把某次检索时的数字写成永久承诺。`资料来源.md` 保留完整维护清单，但不计入正文页面。
