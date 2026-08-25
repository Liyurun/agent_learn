## 真实问题

Agent 在发布流程第 14 步崩溃。重启后只有聊天摘要，无法确认迁移是否执行，于是重复运行不可逆步骤。将内容移出窗口能节省 Token，但没有检查点、幂等键和原始记录就无法安全恢复。

## 现象与输入

应区分三类“窗外信息”：

- 工作记忆：当前目标、计划、固定事实，可频繁读取。
- 任务状态：步骤、状态、输入哈希、产物 ID，用于恢复。
- 原始记录：消息、工具全文、追踪事件，用于审计和重建。

RAG（Retrieval-Augmented Generation，检索增强生成）负责按查询取回相关知识；检查点负责恢复确定状态。两者用途不同。

## 原理

每个检查点包含版本、任务 ID、已完成步骤、固定事实、摘要、原始事件指针和待执行动作。写入采用临时文件后原子替换；恢复时验证 schema 版本与输入哈希。不可逆动作还需独立幂等键，不能只相信自然语言摘要。

## 最小可运行演示
```python
import json
from pathlib import Path

def save(path: Path, state: dict) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, sort_keys=True), encoding="utf-8")
    tmp.replace(path)

def main() -> None:
    path = Path("checkpoint.json")
    save(path, {"version": 1, "task": "release-42", "completed": ["test"], "next": "deploy"})
    restored = json.loads(path.read_text(encoding="utf-8"))
    print(restored["task"], restored["next"])

if __name__ == "__main__":
    main()
```
运行 `python checkpoint_demo.py`，预期输出：
```text
release-42 deploy
```
示例展示原子替换；生产还需锁、备份、权限、过期与迁移策略。

## 真实系统对应

LangGraph 官方文档公开 Checkpoint（检查点）和持久化状态能力，可用于线程级恢复与人机协作。其具体语义以版本文档为准。本章文件实现仅展示通用模式，不声称与 LangGraph 存储器等价。

## 生产踩坑

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 重启后重复副作用 | 只恢复“下一步”，没记录动作结果 | 在动作提交后故障注入 | 幂等键、动作日志、提交后检查点 | 外部服务不支持幂等时需人工确认 |
| 能检索却不能恢复 | 把向量库当状态库 | 删除会话进程后恢复演练 | 状态用强 schema 检查点，知识用检索 | 无状态问答无需检查点 |

## 思考：摘要加文件指针就足以恢复吗？

### 回答

不足。恢复还需要版本、步骤状态、输入标识、动作结果和幂等信息；否则只能恢复“理解”，不能安全恢复“执行”。指针还必须可访问、未过期并受权限保护。

## 思考：什么时候应永久删除原始记录？

### 回答

由数据最小化、合规保留期和用户删除要求决定。删除后要同步失效索引与摘要中的敏感派生信息，并承认某些审计或重建能力随之消失；不能以“上下文工程需要”为由无限期保存。

## 真实场景：部署成功后进程崩溃

发布 Agent 的流程包含构建、测试、上传制品、创建发布、切流和验证。它完成“创建发布”后、写下一轮聊天摘要前进程崩溃。重启实例只读到“下一步执行发布”，于是再次调用接口，产生两个发布记录。聊天内容足以恢复讨论，却不足以恢复事务：系统不知道外部动作是否已提交，也没有可查询的幂等键。

正确设计在调用前生成动作 ID，在外部 API 支持时作为幂等键发送；调用成功后记录返回的发布 ID，再原子写入检查点。恢复时先查询动作日志：若已有成功结果，跳过副作用并进入验证；若状态未知且接口不支持幂等，停止自动执行并请求人工确认。不能因为摘要写着“可能已发布”就猜测。

## 工作记忆、状态与记录的读写协议

工作记忆面向模型理解，允许重建和压缩；任务状态面向程序恢复，要求 schema、版本和确定性；原始记录面向审计与重放，通常追加写入且受保留策略约束。三者可以存于同一技术平台，但语义不能混用。向量数据库擅长相似检索，却不提供“步骤五已提交且只能执行一次”的事务保证。

检查点至少包含任务 ID、schema 版本、输入哈希、当前步骤、已完成步骤、动作记录、产物引用和固定事实版本。恢复器先验证版本，再核对输入是否仍是同一任务，最后处理处于 `started` 但无 `committed` 的动作。仅保存 `next_step` 会丢掉最危险的提交边界。

外部指针也不是永远有效。日志对象可能到期，文件可能被移动，访问令牌可能失效。检查点需要记录对象标识而非临时下载 URL，并在恢复时区分“对象不存在”“无权限”和“暂时不可用”。三种情况对应的数据丢失、授权和重试策略不同。

## 可运行的幂等恢复示例
```python
import json
from pathlib import Path

def commit_once(path: Path, action_id: str) -> str:
    state = json.loads(path.read_text("utf-8")) if path.exists() else {"actions": {}}
    if action_id in state["actions"]:
        return f"复用结果:{state['actions'][action_id]}"
    external_result = "release-9001"
    state["actions"][action_id] = external_result
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, sort_keys=True), "utf-8")
    tmp.replace(path)
    return f"首次提交:{external_result}"

def main() -> None:
    path = Path("release_checkpoint.json")
    if path.exists():
        path.unlink()
    print(commit_once(path, "deploy:sha-a31f"))
    print(commit_once(path, "deploy:sha-a31f"))
    print(path.read_text("utf-8"))

if __name__ == "__main__":
    main()
```
保存为 `resume_once.py`，运行 `python resume_once.py`。完整预期输出：
```text
首次提交:release-9001
复用结果:release-9001
{"actions": {"deploy:sha-a31f": "release-9001"}}
```
程序为保持示例自包含而在首次运行前删除旧文件，生产系统绝不能这样清空检查点。它也只模拟外部调用；真实场景要处理“外部提交成功、但本地写入前崩溃”的缝隙，最好由外部服务支持同一幂等键查询与重放。

## LangGraph 案例及边界

LangGraph 官方持久化文档公开线程、检查点与状态恢复能力，适合构建可中断和可恢复流程。具体 checkpointer、序列化、并发和迁移语义随版本与后端而异，接入时应根据当前文档验证。本页的 JSON 文件、动作状态与发布流程不是 LangGraph 内部实现。

RAG 可以在恢复后找回“部署手册中如何回滚”，却不能证明某次部署是否已经提交。相似度命中的聊天摘要也不能作为事务日志。公开的检查点能力提供基础设施，业务仍需定义幂等边界、外部动作协议和人工审批点。

## 优化前后与故障注入

| 场景 | 优化前 | 优化后 | 验证 |
|---|---|---|---|
| 提交后崩溃 | 摘要写“下一步发布” | 动作 ID 对应外部结果 | 在外部成功后杀进程 |
| 输入被替换 | 恢复后继续旧计划 | 校验任务输入哈希 | 修改目标提交再恢复 |
| schema 升级 | 新代码猜测旧字段 | 显式迁移或拒绝加载 | 用未知版本检查点测试 |
| 原文到期 | 临时 URL 写入摘要 | 保存对象 ID 与保留期 | 模拟无权限、过期和缺失 |
| 并发恢复 | 两个实例重复执行 | 锁、租约或条件写 | 同时启动两个恢复进程 |

优化后的系统不承诺“任何故障都自动恢复”。当外部系统无法查询幂等键、检查点与实际状态矛盾或审计记录已删除时，安全结果可能是暂停并升级人工。恢复能力的目标是避免静默重复副作用，而不是强行让流程继续。
