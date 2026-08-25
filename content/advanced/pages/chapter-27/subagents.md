## 真实问题

主 Agent 为回答“哪个测试失败”读取了 40 个文件和 9000 行日志。最终只需要一个测试名与根因，但所有探索痕迹都留在主上下文，后续实现阶段反复受旧猜测干扰。

## 现象与输入

高噪声、边界清楚、可压缩为短结果的任务适合隔离，例如代码搜索、日志归因、文档比对。需要频繁共享细节、强顺序依赖或权限不可分割的任务，不宜为了“多 Agent”而拆分。

## 原理

主 Agent 发送任务契约而非整段对话：
```text
目标：定位第一个失败测试
允许资源：tests/ 与最近一次日志
禁止操作：修改文件、访问网络
返回格式：结论、证据、置信度、未决问题
```
Subagent（子智能体）在独立上下文探索，只返回有界摘要和证据引用。隔离减少噪声，不是安全沙箱；权限仍由执行环境控制。

## 最小可运行演示
```python
def run_subagent(lines: list[str]) -> dict:
    errors = [line for line in lines if "FAILED" in line or "ERROR" in line]
    first = errors[0] if errors else "未发现失败"
    return {
        "conclusion": first,
        "evidence": errors[:2],
        "confidence": 1.0 if errors else 0.5,
        "open_questions": [],
    }

def main() -> None:
    result = run_subagent(["collecting", "FAILED test_budget.py::test_reserve", "9000 lines omitted"])
    print(result)

if __name__ == "__main__":
    main()
```
运行 `python subagent_demo.py`，预期输出的 `conclusion` 为：
```text
FAILED test_budget.py::test_reserve
```
主上下文只接收结构化结果，不接收“9000 lines omitted”。

## 真实系统对应

Claude Code 官方文档说明子智能体拥有独立上下文、可配置提示与工具，并将结果返回主会话。这里的返回 Schema（结构约束）和路由条件是教学参考实现。Microsoft AI Agents for Beginners 公开课程也把隔离列为上下文工程策略之一，可迁移原则是限制任务输入与结果形状。

## 生产踩坑

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 子任务结论不可验证 | 只返回结论不返回证据 | 检查响应 schema | 强制证据 ID、置信度和未决项 | 敏感证据需脱敏或授权 |
| 并行结果互相矛盾 | 任务边界和版本不同 | 记录输入快照与代码提交 ID | 主 Agent 做冲突合并，不静默选一条 | 强顺序依赖任务改为串行 |

## 思考：何时不应该使用子智能体？

### 回答

任务很小、拆分成本大于节省；子任务需要持续访问主会话细节；步骤强顺序依赖；或结果无法用短契约表达时，都不应拆。子智能体增加调用、延迟和合并风险，价值来自隔离高噪声工作，而非数量。

## 思考：隔离为什么不是权限控制？

### 回答

独立上下文只限制可见信息，不一定限制工具能力。若子智能体仍拥有写生产库或读取密钥的工具，它仍可造成影响。权限应由最小权限令牌、沙箱、审批和执行策略强制落实。

## 真实场景：三条探索支线拖垮主任务

一个升级支付 SDK 的任务同时需要搜索调用点、分析失败日志和核对迁移文档。主 Agent 依次打开四十七个源码文件，读入九千行测试输出，又复制了二十页发布说明。真正用于修改的事实只有五条：两个调用点、一个参数重命名、一项行为变化和首个失败测试。由于探索过程全部留在主窗口，早期“可能是重试次数”的猜测不断干扰后续计划。

团队把三条支线改为隔离任务。代码搜索子任务只读指定提交的源码，并返回路径和行号；日志子任务只接收当前测试产物，返回首个失败及根因；文档子任务只比较两个明确版本，返回破坏性变更和官方链接。主 Agent 得到三张短卡片后先检查提交 ID、版本与结论冲突，再决定修改。九千行日志仍在外部产物中，需要时可追溯，却不再占据后续每轮输入。

## 拆分判断与成本模型

适合隔离的任务具备三个条件：输入边界可以描述，过程噪声远大于结果，返回结果可用有限 schema 表达。代码库搜索、日志归因和资料比对通常满足。若子任务每一步都要询问主任务的最新决定，或结果必须共享大量中间推理，拆分会增加往返和信息损失。

隔离收益可粗略看成“主会话避免的重复 Token”减去“任务契约、子调用和结果合并成本”。只运行一次的小搜索可能不值得启动子智能体；会产生大量工具输出、且结果会在后续二十轮重复携带的探索更有价值。并行也不是默认答案：三个任务若依赖同一工作树的连续修改，快照不同会导致互相矛盾。

返回契约必须包含证据身份，而不只是自然语言结论。`path:line`、测试节点 ID、文档版本和 URL 能让主 Agent 验证；置信度用于表达不确定性，不能取代证据。若两个子任务冲突，主 Agent应请求补充证据或运行确定性检查，而不是按置信度高低静默表决。

## 可运行的契约校验器
```python
REQUIRED = {"conclusion", "evidence", "confidence", "open_questions", "snapshot"}

def validate(result: dict, expected_snapshot: str) -> dict:
    missing = sorted(REQUIRED - result.keys())
    if missing:
        raise ValueError(f"缺少字段：{missing}")
    if result["snapshot"] != expected_snapshot:
        raise ValueError("输入快照不一致")
    if not result["evidence"]:
        raise ValueError("结论缺少证据")
    return result

def main() -> None:
    result = {
        "conclusion": "首个失败来自连接池超时",
        "evidence": ["test_pool.py::test_timeout", "log:line-18"],
        "confidence": 0.96,
        "open_questions": [],
        "snapshot": "commit-a31f",
    }
    checked = validate(result, "commit-a31f")
    print(checked["conclusion"])
    print(",".join(checked["evidence"]))
    print(f"snapshot={checked['snapshot']}")

if __name__ == "__main__":
    main()
```
保存为 `subagent_contract.py`，执行 `python subagent_contract.py`。完整预期输出：
```text
首个失败来自连接池超时
test_pool.py::test_timeout,log:line-18
snapshot=commit-a31f
```
将期望快照改为 `commit-b72e` 会明确失败，避免主任务合并过期代码结论。示例没有启动真实模型，重点是验证输入边界和输出形状；真实子任务还需要超时、取消、重试上限和权限配置。

## 官方案例边界

Claude Code 官方文档说明子智能体使用独立上下文，可以配置提示和工具，并把结果返回主会话。这支持隔离探索的用法，但不意味着子智能体天然无网络、无写权限或只能返回本页字段。任务路由、五字段 schema、快照检查及合并策略都是教学实现。

Microsoft 的上下文工程课程把隔离列为一种策略，也不能据此推断不同产品具有相同调度器。生产选型需要实测调用成本、延迟和错误传播。对于敏感数据，主 Agent 不应仅通过一句“不要泄露”限制子任务，而应从输入裁剪和凭证权限两侧控制。

## 失败定位与优化前后

| 症状 | 优化前 | 优化后 | 定位方法 |
|---|---|---|---|
| 主任务反复引用旧猜测 | 探索过程全部常驻 | 只返回结论与证据 | 检查主请求是否含探索日志 |
| 并行结论互相矛盾 | 子任务读取不同提交 | 契约携带快照 ID | 比较 `snapshot` 后拒绝合并 |
| 结论无法复核 | 只返回一句总结 | 强制证据 ID 和未决项 | 按 ID 打开原始产物 |
| 成本反而上升 | 小任务也拆分，多次往返 | 仅隔离高噪声、有界任务 | 对比主会话节省与子调用开销 |
| 子任务误写文件 | 把隔离当权限 | 工具白名单与只读沙箱 | 审计实际工具调用和凭证 |

升级案例中，优化前主输入在三次探索后增长到两万余 Token；优化后每个子任务最多返回五百 Token，原文留在可访问工件中。即使总调用 Token 没有立刻下降，主会话的决策信号更稳定，后续十轮不再重复携带探索噪声。是否值得采用应以端到端成功率、总成本和延迟共同判断。
