# 第 10 章容器化部署小节实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在第 10 章加入可直接照着搭建的 FastAPI + Qdrant + Docker Compose 容器化部署小节，并同步更新生产化说明、面试追问与小结。

**Architecture:** 保留现有 `rag_answer()` 教学管线，把在线查询包装为无状态 FastAPI 服务；向量检索由独立 Qdrant 容器承载并使用命名卷持久化。示例通过环境变量连接服务，以健康检查协调启动，并明确 Compose 的使用边界。

**Tech Stack:** FastAPI、Pydantic、Uvicorn、Qdrant Client、Docker、Docker Compose。

---

### Task 1: 更新一手资料导航

**Files:**
- Modify: `content/chapters/ch10.md`

- [ ] **Step 1: 在本章资料卡加入官方部署资料**

增加 Docker Python 容器指南、Compose 启动顺序、FastAPI 容器部署和 Qdrant Docker 文档链接；保留原有 RAG 资料顺序。

- [ ] **Step 2: 校验新增链接使用 HTTPS 与 `rel="noopener"`**

运行：

```bash
python3 tools/verify_handbook.py source
```

预期：`[PASS] stage=source`。

### Task 2: 增加服务封装与 Qdrant 适配代码

**Files:**
- Modify: `content/chapters/ch10.md`

- [ ] **Step 1: 插入容器化部署小节**

放在端到端 `rag_answer()` 示例之后、生产演进提示卡之前，先解释 API 与向量库的进程边界。

- [ ] **Step 2: 增加 `app/rag.py` 示例**

示例从 `QDRANT_URL`、`QDRANT_COLLECTION` 读取配置，创建 `QdrantClient`，提供 `check_vector_store()` 和现有 `rag_answer()` 的适配边界。正文明确索引构建不应在每个 Web 进程启动时执行。

- [ ] **Step 3: 增加 `app/main.py` 示例**

定义 `QueryRequest`、`QueryResponse`，提供 `/query` 和 `/healthz`。`/query` 使用 `run_in_threadpool()` 调用阻塞式 RAG；健康检查失败返回 503；查询失败不泄露内部错误。

### Task 3: 增加依赖与容器配置

**Files:**
- Modify: `content/chapters/ch10.md`

- [ ] **Step 1: 增加 `app/requirements.txt`**

包含 FastAPI、Uvicorn、Qdrant Client 以及前文 RAG 所需依赖的兼容版本范围。

- [ ] **Step 2: 增加 Dockerfile**

使用明确 Python slim 标签，建立非 root 用户，只复制依赖与应用代码，通过 Uvicorn 启动 `app.main:app`，并使用 Python 标准库执行健康检查。

- [ ] **Step 3: 增加 `compose.yaml`**

定义 `api` 与 `qdrant` 服务；Qdrant 使用明确镜像标签、命名卷和健康检查；API 通过环境变量连接 `http://qdrant:6333`，使用 `depends_on.condition: service_healthy`。

- [ ] **Step 4: 增加启动和验证命令**

提供 `docker compose up --build -d`、`docker compose ps`、`curl /healthz`、`curl /query` 和 `docker compose down`。

### Task 4: 写清生产边界并同步上下文

**Files:**
- Modify: `content/chapters/ch10.md`

- [ ] **Step 1: 增加容器化红线**

说明密钥只通过运行时环境变量或 Secret 注入；Qdrant 数据必须挂卷；启动顺序不替代运行时重试；索引构建与查询服务分离；Compose 不等于生产编排。

- [ ] **Step 2: 更新“从 Demo 演进到生产”提示**

把已完成的 Qdrant/容器化标为本节基础，余下工作聚焦离线索引、评估、可观测性、鉴权限流和云端编排。

- [ ] **Step 3: 更新面试追问链**

新增“如何交付与扩容 RAG 服务”，答案包含无状态 API、独立向量库、健康检查、持久卷、密钥注入与运行时重试。

- [ ] **Step 4: 更新本章小结**

加入“容器化解决可重复交付，但不自动解决数据更新、扩缩容、监控与安全”。

### Task 5: 回归构建与成品

**Files:**
- Generated: `agent-learning-handbook.html`
- Generated: `Agent学习与面试宝典.pdf`

- [ ] **Step 1: 运行自动化测试**

```bash
npm test
```

预期：Python 12 项和 Node 4 项全部通过。

- [ ] **Step 2: 校验源文件**

```bash
python3 tools/verify_handbook.py source
```

预期：`[PASS] stage=source`。

- [ ] **Step 3: 构建并校验 HTML**

```bash
npm run build
npm run verify
```

预期：构建和最终校验通过，新小节文本与代码出现在生成 HTML 中。

- [ ] **Step 4: 安装 Node 依赖并导出 PDF**

```bash
npm ci
npm run pdf
```

预期：PDF 页数不少于 250，正式文件只在导出和页数检查成功后替换。

- [ ] **Step 5: 清理临时依赖**

删除 `node_modules` 和测试生成的 `__pycache__`，保留 `package-lock.json`、HTML 与 PDF 成品。

## 自检结论

- 设计中的插入位置、代码文件、环境变量、健康检查、持久化、启动命令、生产边界和原有内容同步均有对应任务。
- 文件名、端口和环境变量在所有任务中一致：API `8000`、Qdrant `6333`、`QDRANT_URL`、`QDRANT_COLLECTION`。
- 本次只修改第 10 章源文件和设计/计划文档，不直接编辑生成物。
- 当前项目没有 Git 元数据，因此不包含无法执行的提交步骤。
