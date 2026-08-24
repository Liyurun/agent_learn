# 第 10 章容器化部署小节设计

## 目标

在第 10 章“Agentic RAG 实战”中新增“容器化部署：把本地 RAG 变成可交付服务”小节，把现有 `rag_answer()` 教学管线包装为 FastAPI 服务，并使用 Docker Compose 编排 API 与 Qdrant。新增内容必须延续本章“检索质量优先、答案可核查”的主线，不扩展成完整云原生部署教程。

## 插入位置

新小节插入到“第 6 步 · 组装成完整管线”之后、“从这份 Demo 演进到生产 / Agentic RAG”提示卡之前。阅读路径为：

1. 本地运行 `rag_answer()`。
2. 用 FastAPI 暴露查询和健康检查接口。
3. 把检索存储替换为独立 Qdrant 服务。
4. 用 Docker Compose 启动并验证。
5. 回到“从 Demo 演进到生产”总结其余生产化工作。

## 内容范围

小节包含以下内容：

- 服务边界说明：API 容器负责查询编排，Qdrant 容器负责向量存储。
- FastAPI `/query` 接口：接收问题，调用现有 `rag_answer()`，返回答案。
- FastAPI `/healthz` 接口：检查进程及 Qdrant 可达性。
- Qdrant 配置：通过 `QDRANT_URL` 和 `QDRANT_COLLECTION` 环境变量注入。
- 容器依赖：提供锁定兼容范围的 Python 依赖示例。
- Dockerfile：非 root 用户、无缓冲日志、健康检查、Uvicorn 启动命令。
- `compose.yaml`：API、Qdrant、持久卷、健康检查和基于健康状态的依赖。
- 启动与验证命令：`docker compose up --build`、健康检查和问答请求。
- 生产边界：密钥不进入镜像；索引构建与在线查询分离；Compose 只代表本地/单机交付；水平扩容前需处理无状态 API、共享向量库与限流。

## 代码设计

示例采用四个逻辑文件，均以内嵌代码块形式展示，不在项目根目录创建可执行服务工程：

```text
app/
├── main.py
├── rag.py
└── requirements.txt
Dockerfile
compose.yaml
```

`app/rag.py` 不重复本章全部 RAG 实现，只展示 Qdrant 连接和 `rag_answer()` 的适配边界，并明确将前文的切分、嵌入、重排、生成和忠实度自检移动到该模块。

`app/main.py` 使用 Pydantic 请求/响应模型，避免返回无约束字典。阻塞式 RAG 调用通过线程池执行，避免在异步接口中直接阻塞事件循环。

健康检查调用 Qdrant 集合接口；失败时返回 HTTP 503，而不是永远返回 200。

## 版本与一手资料

在本章一手资料卡中补充以下官方来源：

- Docker Python 容器化指南。
- Docker Compose 启动顺序与健康检查说明。
- Qdrant Docker/Quickstart 与 Python Client 文档。
- FastAPI Docker 部署说明。

示例使用兼容版本范围，不声称某个镜像标签永远最新；Qdrant 镜像使用明确版本标签，读者实际部署前需回官方发行页核对。

## 原有内容更新

- “从这份 Demo 演进到生产”提示卡调整为：Qdrant 与容器化已由新增小节演示，后续重点为索引离线化、评估、可观测性、鉴权限流和编排平台。
- 面试追问链新增一问：如何交付和扩容 RAG 服务，回答涵盖无状态 API、独立向量库、健康检查、持久卷和密钥注入。
- 本章小结增加一句容器化只解决“可重复交付”，不自动解决数据更新、扩缩容、监控和安全。

## 错误处理

- `/query` 拒绝空白问题。
- Qdrant 不可用时健康检查返回 503。
- 查询异常通过统一 HTTP 500 返回，不把密钥、内部堆栈或连接字符串暴露给调用方。
- Compose 使用 Qdrant 健康状态控制 API 启动，但正文明确说明启动顺序不能替代运行时重试。

## 验收

1. 只修改 `content/chapters/ch10.md` 及必要的设计/计划文档，不直接编辑生成 HTML/PDF。
2. 新小节位于端到端管线和生产演进提示卡之间。
3. FastAPI、Dockerfile 和 Compose 示例中的文件名、端口、环境变量、健康检查路径一致。
4. Qdrant 数据使用命名卷持久化。
5. 示例不包含硬编码 API Key。
6. 第 10 章资料卡、生产演进提示、面试追问链和小结同步更新。
7. Python 与 Node 测试通过。
8. HTML 构建、源文件校验和最终校验通过。
9. PDF 重新导出成功且满足页数门槛。

## 非目标

- 不引入 Kubernetes、Nginx、TLS、OAuth、OpenTelemetry 或 CI/CD 的完整配置。
- 不重写第 10 章现有 RAG 算法。
- 不创建独立可部署示例仓库。
- 不把 Compose 描述为生产集群编排方案。
