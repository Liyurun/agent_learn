window.HANDBOOK_DATA = {
  learningModes: [
    {
      id: "systematic",
      title: "系统学习",
      summary: "按基础 → 原语 → 编排 → 工程 → 案例推进",
      target: "#part1"
    },
    {
      id: "lookup",
      title: "快速查阅",
      summary: "按问题定位模式、框架、MCP、Eval、案例",
      target: "#moduleAtlas"
    },
    {
      id: "interview",
      title: "面试复习",
      summary: "直接跳到题库、追问链、案例可讲点和对比矩阵",
      target: "#part4"
    },
    {
      id: "advanced",
      title: "进阶前沿",
      summary: "后训练、Coding Agent、评估基准、多模态与成本安全",
      target: "#part5"
    }
  ],
  modules: [
    { id: "foundation-map", title: "01 基础地图", anchor: "#part1", chapters: ["什么是 Agent", "核心组件", "设计模式"] },
    { id: "capability-primitives", title: "02 能力原语", anchor: "#part2", chapters: ["Context", "Memory", "MCP", "Tools"] },
    { id: "orchestration", title: "03 编排系统", anchor: "#ch7", chapters: ["Routing", "Planning", "Handoff", "Multi-Agent"] },
    { id: "engineering", title: "04 工程落地", anchor: "#ch11", chapters: ["Eval", "Tracing", "Guardrails", "Latency"] },
    { id: "cases", title: "05 案例库", anchor: "#caseLibrary", chapters: ["Research", "Support", "Office"] },
    { id: "interview-resources", title: "06 面试与资料库", anchor: "#part4", chapters: ["题库", "追问链", "教程地图"] },
    { id: "advanced-frontier", title: "07 进阶前沿", anchor: "#part5", chapters: ["后训练 SFT/RL", "Coding Agent", "评估基准", "多模态/CUA"] }
  ],
  moduleQuizzes: [
    {
      id: "module-quiz-foundation-routing",
      moduleId: "foundation-map",
      focus: "基础地图",
      level: "入门复盘",
      stem: "你在做一个报销助手，80% 请求都能按固定 SOP 处理，只有少数异常单需要跨系统查证和继续追问。首版系统最稳的架构判断是什么？",
      options: [
        "先把固定主干写成 workflow，把低置信度或异常分支单独交给 Agent 处理。",
        "直接做一个自由探索的通用 Agent，让它统一处理所有报销请求。",
        "先上多 Agent，因为财务、审批、通知天然是不同角色。"
      ],
      correct: 0,
      explanation: "基础地图里最重要的判断是先分清 workflow 与 agent。已知路径的主干优先固化成 workflow，真正需要运行时决策的例外再交给 Agent，这样更稳、更便宜，也更容易上线。",
      target: "#part1"
    },
    {
      id: "module-quiz-engineering-guardrails",
      moduleId: "engineering",
      focus: "工程落地",
      level: "工程判断",
      stem: "一个带工具的 Agent 离线 Demo 已经能跑通，但线上试运行时偶发长尾延迟和重复调用慢工具。上线前第一批必须补齐的工程动作是哪组？",
      options: [
        "优先换更大的模型，希望它少走弯路，其他逻辑先不动。",
        "先把提示词写得更长更细，让模型自己减少错误调用。",
        "补 tracing / eval，可观测每步轨迹，并同时加 max_steps、超时、循环检测和失败兜底。"
      ],
      correct: 2,
      explanation: "工程落地不能只看 Demo 是否能跑通，必须先把过程看见并把风险关住。tracing / eval 负责定位问题，max_steps、超时、循环检测和失败兜底负责把线上成本与可靠性收住。",
      target: "#ch11"
    }
  ],
  tutorials: [
    {
      id: "anthropic-effective-agents",
      provider: "Anthropic",
      title: "Building Effective Agents",
      format: "工程博客",
      level: "入门必读",
      effort: "60-90 分钟",
      fit: "先建立 Workflow vs Agent 的判断框架",
      summary: "用大量真实落地经验解释 Agent 为什么应从简单、可组合的模式起步，再逐步引入复杂度。",
      takeaways: ["Workflow vs Agent", "常见 Agent 模式", "从最小闭环开始"],
      url: "https://www.anthropic.com/engineering/building-effective-agents"
    },
    {
      id: "openai-agents-quickstart",
      provider: "OpenAI",
      title: "Agents SDK Quickstart",
      format: "官方文档",
      level: "上手实践",
      effort: "45-60 分钟",
      fit: "想快速跑通一个官方生态 Agent Demo",
      summary: "直接从 Agent、Runner、Tools、Handoffs 这些核心抽象切入，适合把概念迅速变成可运行样例。",
      takeaways: ["Agent / Runner 骨架", "Tool 调用", "Handoff 多 Agent"],
      url: "https://openai.github.io/openai-agents-python/quickstart/"
    },
    {
      id: "hf-smolagents",
      provider: "Hugging Face",
      title: "smolagents 官方教程",
      format: "官方教程",
      level: "轻量实操",
      effort: "1-2 小时",
      fit: "想最低成本跑通第一个可解释 Agent",
      summary: "围绕 CodeAgent 和自定义工具展开，适合一边读一边跑，快速建立“代码即行动”的直觉。",
      takeaways: ["CodeAgent", "自定义工具", "Agents Course 衔接"],
      url: "https://huggingface.co/docs/smolagents"
    },
    {
      id: "dlai-agentic-patterns",
      provider: "DeepLearning.AI",
      title: "AI Agentic Design Patterns with AutoGen",
      format: "短课",
      level: "概念补强",
      effort: "2-3 小时",
      fit: "想系统补齐多智能体协作与设计模式",
      summary: "课程节奏紧凑，适合在具备单 Agent 基础后，用案例把多智能体分工、协同和评估串起来。",
      takeaways: ["多 Agent 分工", "协作模式", "案例驱动理解"],
      url: "https://www.deeplearning.ai/short-courses/ai-agentic-design-patterns-with-autogen/"
    }
  ],
  patterns: [
    {
      id: "react",
      label: "Pattern 01",
      title: "ReAct",
      summary: "默认首选的基础骨架：边想边做边观察，适合信息不全、需要工具探索的任务。",
      trigger: "场景：边查边做",
      cost: "代价：步数 / token 偏高",
      bullets: [
        "适合：搜索、调 API、读文档、逐步排查这类路径不完全确定的任务。",
        "警惕：慢工具过多时会拖高延迟，必须配 max_steps、超时和循环检测。",
        "判断句：如果你需要『根据观察结果决定下一步』，ReAct 往往就是起点。"
      ],
      interviewCue: "先从 ReAct 起步，只有当任务明显需要预规划或多角色时再升级。",
      target: "#ch3"
    },
    {
      id: "planning",
      label: "Pattern 02",
      title: "Planning",
      summary: "先把大任务拆成可执行子任务，再按计划推进，适合长程和结构化交付。",
      trigger: "场景：长链路任务",
      cost: "代价：计划可能过时",
      bullets: [
        "适合：报告生成、复杂办公开票、需要明确里程碑的多步骤流程。",
        "警惕：外部环境变化快时，静态计划容易失效，要允许重规划或局部改写。",
        "判断句：如果失败主要来自『没想清楚顺序』，而不是『缺信息』，优先考虑 Planning。"
      ],
      interviewCue: "规划不是为了更复杂，而是为了把长任务拆成可验证的小步。",
      target: "#ch3"
    },
    {
      id: "multi-agent",
      label: "Pattern 03",
      title: "Multi-Agent",
      summary: "让多个专职 Agent 分工协作，只在角色、工具集或并行性确实不同的时候使用。",
      trigger: "场景：角色分工 / 并行",
      cost: "代价：协调成本真实存在",
      bullets: [
        "适合：研究拆工、评审-执行分离、需要不同系统提示词或权限边界的任务。",
        "警惕：上下文同步、冲突决策和额外调用成本，很多场景单 Agent 就够了。",
        "判断句：只有当『拆开以后明显更快或更稳』，多 Agent 才值得。"
      ],
      interviewCue: "多 Agent 不是银弹，我会先证明单 Agent 做不到，再引入分工。",
      target: "#ch7"
    },
    {
      id: "evaluator-optimizer",
      label: "Pattern 04",
      title: "Evaluator-Optimizer",
      summary: "生成与评估分离，通过明确 rubric 反复打磨结果，适合质量门槛高的输出。",
      trigger: "场景：有明确评分标准",
      cost: "代价：双轨调用成本",
      bullets: [
        "适合：SQL 生成、客服回复质检、长文润色、需要稳定质量阈值的输出。",
        "警惕：如果 rubric 不清，循环只会放大噪声；必须先定义通过标准。",
        "判断句：当你能说清『什么叫好』，就能把评估器单独拉出来。"
      ],
      interviewCue: "把评估显式建模，比单纯让模型『再想想』更可控，也更利于 Eval 闭环。",
      target: "#ch11"
    }
  ],
  diagnostics: [
    {
      id: "diag-eval-tracing",
      focus: "Eval / Tracing",
      level: "中等",
      stem: "客服 Agent 的最终回答看起来流畅，但经常『像答了其实没解决』。团队只有最终正确率，没有保存工具轨迹和中间判断。下一步最该补什么？",
      options: [
        "继续微调主模型，先把回答语气调得更像人工客服。",
        "补充运行级 tracing 与轨迹评估，先定位是检索、工具选择还是总结阶段失真。",
        "把上下文窗口加到最大，让模型一次看到更多历史消息。",
        "直接改成多 Agent，让一个 Agent 专门负责写最终答案。"
      ],
      correct: 1,
      explanation: "这类问题先要把过程看见。没有 tracing，就无法判断是检索召回差、工具调用错，还是最终总结失真；工程上应先补链路追踪与 trajectory eval，再做针对性修复。",
      target: "#ch11"
    },
    {
      id: "diag-deploy-loop",
      focus: "部署 / Guardrails",
      level: "较难",
      stem: "一个 CodeAct Agent 在线上偶发死循环，重复调用慢工具，导致 P95 延迟和单次成本同时飙升。最合理的第一组工程动作是什么？",
      options: [
        "加 max_steps、循环检测、工具超时与失败兜底，并把关键状态落盘以支持断点恢复。",
        "先把模型换成更大的版本，让它少犯错，其他逻辑暂时不动。",
        "把所有工具都并行调用一次，减少等待时间。",
        "取消日志与 tracing，先把线上开销压下去再说。"
      ],
      correct: 0,
      explanation: "症状已经指向控制流失稳和慢工具放大成本。第一优先级是加护栏：限制步数、检测循环、设置超时和兜底，同时确保失败后能恢复，而不是盲目换模型或放弃观测。",
      target: "#ch12"
    }
  ],
  caseStudies: [
    {
      id: "research-agent",
      label: "Case 01",
      title: "Research Agent",
      summary: "把开放问题拆成检索计划、证据卡和结论摘要，适合要边查边判断可信度的研究任务。",
      domain: "研究分析",
      pattern: "ReAct + Planning + Evaluator",
      stack: "单 Agent 主控，必要时拉起专题子任务",
      situation: "用户会抛出“比较三家向量数据库”“最近一年 Agent 框架怎么选”这类开放问题，信息分散在博客、文档、论文和 changelog 里。",
      goal: "在限定时间内产出一份带来源、带权衡、能继续追问的研究结论，而不是只拼接搜索结果。",
      whyAgent: [
        "问题边界会随着搜索结果不断收敛，查询词需要动态改写。",
        "需要根据证据质量决定下一步：继续检索、交叉验证，还是进入总结。",
        "固定 workflow 很难提前写死所有分支，容易要么漏查，要么查得过深。"
      ],
      architecture: [
        "入口先把问题拆成：目标、约束、必须回答的子问题。",
        "主 Agent 维护研究看板：已验证事实、待确认假设、冲突证据、剩余时间。",
        "检索阶段使用 search / fetch / note 三类工具，证据统一写入结构化卡片。",
        "总结前加一个 evaluator，对引用覆盖率、结论一致性和风险提示做二次检查。"
      ],
      flow: [
        "澄清范围：先确认行业、时间范围、对比维度。",
        "列计划：把问题拆成若干 research threads，并确定优先级。",
        "执行搜索：按 thread 检索，发现高价值来源后继续深挖。",
        "归档证据：每条证据记录来源、时间、原文摘录、可信度判断。",
        "冲突处理：如果不同来源矛盾，追加验证步骤并显式标注不确定性。",
        "最终输出：形成结论、建议、未覆盖风险和可继续追问的方向。"
      ],
      tools: [
        "WebSearch / 文档检索：找官方文档、博客、发布说明。",
        "WebFetch / 页面抓取：读取长文或 changelog 正文。",
        "结构化笔记工具：把证据沉淀成 source cards。",
        "引用整理器：确保结论和出处一一对应。"
      ],
      memory: [
        "短期记忆保留当前研究计划、最近证据与待验证假设。",
        "长期记忆沉淀常用来源白名单、主题卡、历史研究结论。",
        "对长任务优先存摘要与引用，不把整篇原文塞回上下文。"
      ],
      guardrails: [
        "不允许无来源结论进入最终摘要。",
        "把“事实”与“推断/建议”分栏输出，避免混写。",
        "时间耗尽时必须返回当前证据边界，而不是继续无限搜索。"
      ],
      eval: [
        "事实正确率：抽样核验引用与结论是否一致。",
        "引用覆盖率：关键结论是否都有来源支撑。",
        "研究深度：是否覆盖用户关心的核心维度而不是表面罗列。",
        "交付时延：在约束时间内完成而不是过度探索。"
      ],
      interviewAngles: [
        "为什么 Research 更适合单 Agent + evaluator，而不是一开始就上多 Agent。",
        "如何处理冲突证据与不确定结论。",
        "为什么研究系统的重点不是“搜得多”，而是“证据闭环”。"
      ],
      antiPattern: "一上来全量抓取网页并把原文塞进上下文，会同时造成成本飙升和上下文腐烂。"
    },
    {
      id: "support-agent",
      label: "Case 02",
      title: "Support Agent",
      summary: "把标准客服流程留在 workflow，把复杂异常交给 Agent 决策，目标是更稳而不是更花哨。",
      domain: "客服支持",
      pattern: "Workflow + Exception Agent",
      stack: "意图分类 + 工单系统 + 策略校验 + 人工兜底",
      situation: "用户咨询订单、退款、物流、账号权限等问题，其中大部分是标准流程，少数是多轮澄清、跨系统查询和政策判断的复杂 case。",
      goal: "在不牺牲合规和响应速度的前提下，提高首响质量、减少人工重复劳动，并把真正复杂的问题准确升级。",
      whyAgent: [
        "高频标准问题应走固定流程，没必要全部 agent 化。",
        "异常 case 需要根据对话上下文、订单状态、政策条款动态决定下一步。",
        "Agent 价值在于处理例外，而不是替代所有客服逻辑。"
      ],
      architecture: [
        "先做 intent routing：订单查询、退款、物流、账号等标准意图直接进 workflow。",
        "命中低置信度、跨意图或异常状态时，转入 support agent 继续澄清。",
        "Agent 只读知识库、订单系统、政策中心，涉及高风险动作必须走审批或人工确认。",
        "最终回答前运行 policy checker，校验措辞、权限、补偿边界和敏感信息。"
      ],
      flow: [
        "分类工单：先判断是不是可编排的标准流程。",
        "收集上下文：读取订单状态、历史沟通、用户分层和知识库条目。",
        "动态决策：需要时继续追问、改查其他系统或触发升级。",
        "生成答复：先给用户结论，再解释原因和下一步动作。",
        "高风险场景：退款超权限、投诉升级、账号安全问题统一转人工。"
      ],
      tools: [
        "订单 / CRM 查询工具：拿到实时业务状态。",
        "知识库检索：查政策、FAQ、SOP。",
        "工单系统：记录标签、状态与升级原因。",
        "Policy checker：校验赔付边界、合规措辞与敏感字段。"
      ],
      memory: [
        "短期记忆保留当前会话的澄清问答和操作记录。",
        "长期记忆存用户偏好、历史工单摘要与常见问题模板。",
        "任何会影响决策的关键信息都回写工单，方便人工接手。"
      ],
      guardrails: [
        "超权限动作只允许建议，不允许直接执行。",
        "涉及 PII 的内容要脱敏展示与记录。",
        "低置信度或规则冲突时优先升级人工，不硬答。"
      ],
      eval: [
        "首响解决率与人工升级准确率。",
        "政策违规率与敏感信息泄露率。",
        "平均处理时长和用户满意度。",
        "异常工单上的解释充分性与可追溯性。"
      ],
      interviewAngles: [
        "为什么客服系统要先做 workflow，再给异常分支加 Agent。",
        "如何定义“何时该升级人工”的阈值。",
        "怎样把 policy checker 接在最终回答前，形成真正可上线的护栏。"
      ],
      antiPattern: "把所有客服问题都交给自由探索的 Agent，会把本来稳定的 SOP 变得昂贵且不可控。"
    },
    {
      id: "office-agent",
      label: "Case 03",
      title: "Office Agent",
      summary: "跨日历、文档、邮件和 IM 的办公协作 Agent，强调类型安全、审批节点与多角色协作。",
      domain: "办公自动化",
      pattern: "Planning + Typed Tools + Multi-Agent",
      stack: "协调者 + Calendar / Docs / Messaging 专职角色",
      situation: "用户会提出“帮我安排评审会、拉齐材料、会后同步纪要和待办”这类跨系统任务，包含时间协调、文档生成、消息通知和权限检查。",
      goal: "让办公流程真正省时间：输入一个目标，系统能组织会议、准备材料、沉淀结论，但关键动作仍可审阅和撤回。",
      whyAgent: [
        "任务跨多个系统，执行顺序受实时状态影响，比如会议室是否空闲、参会人是否可用。",
        "每个子域工具的权限和输出结构不同，类型安全可以降低串联错误。",
        "当涉及文档整理、日程安排、消息发送时，按角色拆分能让上下文更干净。"
      ],
      architecture: [
        "协调 Agent 先把目标拆成：会前准备、会中材料、会后分发三段。",
        "Calendar Agent 负责忙闲查询、会议室预定和邀请草案。",
        "Docs Agent 负责议程、材料汇总、纪要模板与待办结构化输出。",
        "Messaging Agent 负责 IM / 邮件发送，但必须读取协调者给出的结构化 payload。"
      ],
      flow: [
        "解析目标：识别会议主题、时间约束、参与人和交付物。",
        "预检查：验证权限、日历可用性、文档模板和联系人解析。",
        "分角色执行：各 Agent 只处理自己域内的工具与上下文。",
        "合并结果：协调者汇总会议链接、议程、材料状态和通知文案。",
        "关键动作确认：真正发消息、改日历前要求用户确认。"
      ],
      tools: [
        "Calendar API：忙闲查询、创建日程、预定会议室。",
        "Docs / Sheets 工具：生成议程、整理纪要、收集附件。",
        "Mail / IM 工具：发送邀请、提醒、会后总结。",
        "Schema validator：校验参会人列表、时间区间、待办结构。"
      ],
      memory: [
        "短期记忆保留当前任务的时间线、草稿与审批状态。",
        "长期记忆记录常用模板、固定参会人组和历史会议偏好。",
        "跨角色传递时只传结构化摘要，避免把整段原始对话复制给所有 Agent。"
      ],
      guardrails: [
        "任何外发消息、日历改动、共享权限变更都要显式确认。",
        "角色之间只共享最小必要字段，避免权限扩散。",
        "时间冲突、联系人解析失败、模板缺失时先返回可执行补救建议。"
      ],
      eval: [
        "任务完成率：是否真正把会前到会后的闭环跑通。",
        "结构化正确率：时间、联系人、待办字段是否可直接落库。",
        "误发/误改率：是否出现错误邀请、错误通知或权限越权。",
        "用户二次编辑比例：输出草稿距离可用还有多远。"
      ],
      interviewAngles: [
        "为什么 Office 场景更适合类型化工具契约，而不是纯文本串联。",
        "什么时候多角色协作是合理拆分，什么时候只是过度设计。",
        "如何设置用户确认节点，避免“看起来自动化，实际上风险极高”。"
      ],
      antiPattern: "让一个全能 Agent 同时掌握日历、文档、消息所有上下文，通常会带来权限混乱和状态不一致。"
    }
  ],
  scenarioOptions: [
    {
      id: "fixed-flow",
      label: "固定流程",
      hint: "步骤基本可预编排，目标是稳、便宜、可复现。"
    },
    {
      id: "dynamic-decision",
      label: "动态决策",
      hint: "要根据运行时观察结果决定下一步。"
    },
    {
      id: "type-safe",
      label: "类型安全",
      hint: "输出要结构化、可校验、方便审计或落库。"
    },
    {
      id: "multi-role",
      label: "多角色协作",
      hint: "角色职责、权限或提示词边界明确不同。"
    }
  ],
  scenarioRules: [
    {
      id: "conflict-split",
      requiresAll: ["fixed-flow", "dynamic-decision"],
      priority: 90,
      title: "先拆主干和例外，再决定要不要 Agent",
      recommendation: "不要把“固定流程”和“动态决策”塞进同一个自由 Agent。先把 80% 可编排主干写成 workflow，把真正不确定的例外分支单独交给 Agent。",
      rationale: "这能同时保留稳定性和灵活性，是很多线上系统最常见也最稳的架构切分。",
      nextActions: [
        "先列出哪些步骤始终不变，固定成显式节点。",
        "给例外分支设准入条件，例如低置信度、跨系统查询、规则冲突。",
        "在例外分支前后加 tracing 和人工兜底，避免主链路被拖慢。"
      ],
      caseId: "support-agent"
    },
    {
      id: "typed-workflow",
      requiresAll: ["fixed-flow", "type-safe"],
      excludes: ["dynamic-decision"],
      priority: 80,
      title: "推荐：类型化 Workflow",
      recommendation: "优先做 schema-first 的 workflow：每一步都定义输入输出结构，不急着上 Agent。",
      rationale: "当路径已知时，工程收益主要来自稳定编排和可校验的结构化结果，而不是自由探索能力。",
      nextActions: [
        "把每个节点的入参与产出做成显式 schema。",
        "失败时返回可重试的状态，而不是让模型自由发挥补救。",
        "先用离线样本覆盖异常分支，再决定是否需要 Agent 补洞。"
      ],
      caseId: "office-agent"
    },
    {
      id: "fixed-collaboration",
      requiresAll: ["fixed-flow", "multi-role"],
      excludes: ["dynamic-decision"],
      priority: 70,
      title: "推荐：显式分工的 Workflow，而不是自由多 Agent",
      recommendation: "如果角色分工存在，但路径仍然固定，优先做成“审批 / 复核 / 通知”等显式节点，不要因为有多个角色就自动升级成多 Agent。",
      rationale: "多角色不等于多智能体。只有当角色真的需要独立上下文和运行时判断时，多 Agent 才值得引入。",
      nextActions: [
        "把角色职责画成 swimlane，看是否只是固定顺序传递。",
        "确认是否存在独立权限边界或独立工具集。",
        "若没有运行时分支变化，就保持 workflow 方案。"
      ],
      caseId: "office-agent"
    },
    {
      id: "dynamic-typed-team",
      requiresAll: ["dynamic-decision", "type-safe", "multi-role"],
      priority: 95,
      title: "推荐：协调者 + 专职角色的类型安全多 Agent",
      recommendation: "适合采用 coordinator + specialist agents：用协调者规划与收敛，用角色 Agent 负责各自工具域，并通过结构化 payload 交接。",
      rationale: "你既需要运行时决策，也需要清晰的契约和角色边界，这正是多角色办公协作或复杂后台运营场景的典型需求。",
      nextActions: [
        "先定义跨角色共享的 schema，避免纯文本口口相传。",
        "让协调者只做调度与整合，不直接拥有所有权限。",
        "把外发动作、写操作和权限变更都放在确认节点后。"
      ],
      caseId: "office-agent"
    },
    {
      id: "dynamic-typed",
      requiresAll: ["dynamic-decision", "type-safe"],
      excludes: ["multi-role"],
      priority: 85,
      title: "推荐：单 Agent + 类型安全工具契约",
      recommendation: "适合从单 Agent 起步，但要把工具入参、结构化输出和校验器建完整。这样既保留动态决策能力，也能把结果稳定接到业务系统。",
      rationale: "很多业务并不需要多角色协作，真正的复杂度来自“要动态决策，同时还得稳定落地”。",
      nextActions: [
        "先做 schema-first 的工具和输出模型。",
        "为关键步骤加 validator / retry / fallback。",
        "用 tracing 观察失败主要发生在选工具、填参数还是总结阶段。"
      ],
      caseId: "office-agent"
    },
    {
      id: "dynamic-team",
      requiresAll: ["dynamic-decision", "multi-role"],
      excludes: ["type-safe"],
      priority: 75,
      title: "推荐：谨慎引入多 Agent 编排",
      recommendation: "只有当角色分工真的能降低上下文复杂度或带来并行收益时，再上多 Agent。先验证 coordinator 是否只负责路由与汇总，避免每个角色都重复拿大上下文。",
      rationale: "多 Agent 的收益来自隔离与并行，而不是“看起来更智能”。如果拆分后没有更快或更稳，就不要上。",
      nextActions: [
        "先用单 Agent 模拟角色边界，确认确实存在上下文拥塞或权限分离问题。",
        "定义 handoff 的触发条件和返回格式。",
        "给每个角色限制最小必要工具集，避免全员全权限。"
      ],
      caseId: "office-agent"
    },
    {
      id: "dynamic-single",
      requiresAll: ["dynamic-decision"],
      excludes: ["fixed-flow", "multi-role"],
      priority: 65,
      title: "推荐：单 Agent + ReAct / Planning",
      recommendation: "先从单 Agent 开始最稳：让它根据观察结果决定下一步，并在关键节点重规划。不要过早引入多角色和复杂编排。",
      rationale: "当任务的不确定性来自信息缺失或路径探索时，单 Agent 往往已经足够，调试和评估成本也最低。",
      nextActions: [
        "先定义清晰的工具说明和 max_steps。",
        "为“继续搜索 / 结束回答 / 请求澄清”设计显式退出条件。",
        "把中间证据和计划外置，避免上下文越跑越大。"
      ],
      caseId: "research-agent"
    },
    {
      id: "fixed-single",
      requiresAll: ["fixed-flow"],
      excludes: ["dynamic-decision", "multi-role"],
      priority: 60,
      title: "推荐：先做普通 Workflow",
      recommendation: "这类任务先别 Agent 化。把步骤固定、接口定义清楚、异常分支显式列出来，通常更便宜、更稳、更容易上线。",
      rationale: "当路径已知时，Agent 带来的自由度不会转化成收益，反而会增加不确定性和调试成本。",
      nextActions: [
        "把流程画成状态机或 DAG。",
        "为每个节点补充输入、输出、失败处理。",
        "只有当某个节点开始需要运行时判断，再局部引入 Agent。"
      ],
      caseId: "support-agent"
    }
  ],
  evalFrameworks: [
    {
      id: "langsmith",
      name: "LangSmith",
      type: "全栈评估 + Tracing 平台",
      openSource: "商业（有免费额度）",
      features: ["自动 Trace 每次 run", "数据集 / 回归测试管理", "内置 LLM-as-Judge 评估器", "Prompt 版本与对比", "与 LangChain / LangGraph 深度集成"],
      bestFor: "LangChain / LangGraph 技术栈的团队",
      url: "https://docs.smith.langchain.com/"
    },
    {
      id: "langfuse",
      name: "Langfuse",
      type: "开源可观测 + 评估平台",
      openSource: "开源，可自托管",
      features: ["OpenTelemetry 兼容", "Trace / Span / Generation 分层", "成本与 token 追踪", "打分与人工标注", "Prompt 管理"],
      bestFor: "需要自托管、跨框架埋点的团队",
      url: "https://langfuse.com/"
    },
    {
      id: "phoenix",
      name: "Arize Phoenix",
      type: "开源可观测平台",
      openSource: "开源",
      features: ["基于 OpenTelemetry", "RAG 检索质量分析", "Embedding 漂移可视化", "轨迹与 Span 回放", "内置评估模板"],
      bestFor: "重 RAG / 需要根因分析的应用",
      url: "https://phoenix.arize.com/"
    },
    {
      id: "ragas",
      name: "Ragas",
      type: "评估指标库",
      openSource: "开源",
      features: ["Faithfulness / 答案相关性", "上下文精确率与召回率", "无需大量人工标注", "可接入 CI 回归", "面向 RAG / Agentic RAG"],
      bestFor: "想量化 RAG 质量的项目",
      url: "https://docs.ragas.io/"
    },
    {
      id: "logfire",
      name: "Pydantic Logfire",
      type: "可观测平台",
      openSource: "商业（基于 OTel）",
      features: ["原生集成 PydanticAI", "OpenTelemetry 底座", "结构化 Span 观测", "SQL 式查询 Trace", "类型安全上下文"],
      bestFor: "PydanticAI / Python 类型安全栈",
      url: "https://logfire.pydantic.dev/docs/"
    }
  ],
  guardrailLayers: [
    {
      id: "input",
      stage: "输入护栏",
      goal: "在内容进入模型前，拦截攻击与不合规输入。",
      tactics: ["提示注入 / 越狱检测（PromptGuard、Llama Guard 等分类器）", "PII / 敏感信息脱敏", "话题与合规范围限制", "输入长度与格式校验"],
      failIfMissing: "外部内容里藏的指令会直接劫持 Agent（间接提示注入）。"
    },
    {
      id: "hierarchy",
      stage: "指令层级",
      goal: "让系统指令的优先级高于用户与外部内容。",
      tactics: ["system > developer > user > 工具返回 的清晰分层", "把不可信外部内容显式标注、隔离", "禁止外部内容改写系统目标"],
      failIfMissing: "文档 / 网页里的『忽略以上指令』能覆盖你的系统提示。"
    },
    {
      id: "tool",
      stage: "工具 / 动作护栏",
      goal: "限制 Agent 能做什么、能做到多大范围。",
      tactics: ["最小权限：只给必要工具", "危险动作加 human-in-the-loop 确认", "CodeAct 必须沙箱执行", "调用参数做 schema 校验与白名单"],
      failIfMissing: "一次错误的删除 / 转账 / 越权查询就可能造成不可逆后果。"
    },
    {
      id: "output",
      stage: "输出护栏",
      goal: "在结果返回用户前，做正确性与安全校验。",
      tactics: ["结构化输出 schema 校验（Guardrails AI 等）", "毒性 / 敏感内容过滤", "对渲染场景做 XSS / 模板注入防护", "关键结论做事实核查或引用验证"],
      failIfMissing: "模型可能输出可执行脚本、泄露密钥或编造事实。"
    }
  ],
  debugPlaybook: [
    {
      id: "infinite-loop",
      name: "无限循环 / 不收敛",
      symptoms: ["反复调用同一个工具", "步数持续增长却不产出结论", "token 消耗异常飙升"],
      detection: ["监控 max_steps 与单 run 步数分布", "对连续动作做相似度 / 重复检测", "在 tracing 里看是否绕圈"],
      fixes: ["硬性 max_steps 上限 + 超限兜底回复", "为『继续 / 结束 / 请求澄清』设计显式退出条件", "对重复动作做去重或惩罚", "关键节点加人工确认"]
    },
    {
      id: "context-explosion",
      name: "上下文爆炸",
      symptoms: ["准确率随对话变长而下降", "延迟与成本随步数线性上升", "重要早期信息被淹没（context rot）"],
      detection: ["监控上下文窗口占用率", "追踪关键信息在长对话中的保留率", "对比短/长上下文下的成功率"],
      fixes: ["滚动摘要压缩历史", "把结构化笔记 / 状态外置到记忆", "用子 Agent 隔离长上下文", "只召回当前步骤真正需要的信息"]
    },
    {
      id: "error-accumulation",
      name: "错误累积",
      symptoms: ["早期一步判断错，后续全部跑偏", "最终答案自信但整体方向错误", "中途没有任何自检"],
      detection: ["在 tracing 里定位首个出错的 Span", "对关键中间结果单独评估", "回放轨迹找『错误起点』"],
      fixes: ["关键步骤后加 Reflection 自检", "对高风险中间结果做验证再继续", "重要分叉点设人工确认节点", "失败可回退到上一个可信状态"]
    },
    {
      id: "prompt-injection",
      name: "提示注入 / 越狱",
      symptoms: ["Agent 突然偏离既定目标", "泄露系统提示或敏感信息", "执行了用户未授权的动作"],
      detection: ["用注入 / 越狱分类器扫描输入", "检测输出与既定策略的偏离", "对『来自外部内容的新指令』告警"],
      fixes: ["隔离并标注所有不可信外部内容", "强化指令层级，系统优先", "最小权限工具 + 危险动作确认", "输入输出双向护栏组合使用"]
    },
    {
      id: "tool-hallucination",
      name: "幻觉工具调用",
      symptoms: ["调用不存在的工具", "编造参数或参数类型错误", "把自然语言当成结构化返回"],
      detection: ["严格 schema 校验捕获非法调用", "统计工具调用成功率", "对未知工具名直接拦截"],
      fixes: ["工具白名单 + 严格参数 schema", "把校验失败作为反馈让模型重试", "精简工具说明，减少歧义", "为常错工具补 few-shot 示例"]
    }
  ],
  insights: [
    {
      id: "karpathy-decade",
      author: "Andrej Karpathy",
      role: "前 Tesla AI 总监 / OpenAI 创始成员",
      theme: "冷静预期",
      punch: "这是 Agent 的十年，而不是 Agent 的元年。",
      detail: "他反对『一年就通用 Agent』的炒作：问题可解但很难，把模型当成靠谱实习生用还差得远，这条差距要用大约十年去补。做工程要按这个节奏设定预期，别赌一次到位。",
      takeaway: "面试谈趋势时，用『可解但难、十年尺度』替代盲目乐观，更显判断力。",
      url: "https://www.teamday.ai/ai/andrej-karpathy-dwarkesh-ghosts-not-animals",
      chapter: { id: "ch1", label: "第 1 章 · 什么是 Agent" }
    },
    {
      id: "karpathy-ghosts",
      author: "Andrej Karpathy",
      role: "前 Tesla AI 总监 / OpenAI 创始成员",
      theme: "本质认知",
      punch: "我们在造『幽灵』，不是『动物』。",
      detail: "大模型是预训练塑造出的统计模拟器，没有动物那样的内在动机与具身。对它吼叫不会让它变好或变差，因此别把拟人化直觉套上去，要用『它只知道你喂进上下文的东西』这个视角设计系统。",
      takeaway: "设计提示与工具时，永远从『Agent 的上下文里到底有什么』出发。",
      url: "https://philippdubach.com/posts/karpathys-software-3.0-playbook/",
      chapter: { id: "ch1", label: "第 1 章 · 什么是 Agent" }
    },
    {
      id: "ng-workflow",
      author: "Andrew Ng",
      role: "DeepLearning.AI 创始人 / Coursera 联创",
      theme: "务实落地",
      punch: "简单的 agentic workflow，胜过复杂的全自主系统。",
      detail: "真正的机会往往在可拆成顺序步骤的平凡业务流程上：用现成的『乐高积木』式工具，先快速搭端到端系统，再针对性优化。别一上来就追求完全自主。",
      takeaway: "先固化可编排主干、再对薄弱环节做 agent 化，是最稳的落地路径。",
      url: "https://35.197.103.146/blog/0550/andrew-ng-thinks-simple-ai-agents-workflows-beat-complex-autonomous-systems",
      chapter: { id: "ch3", label: "第 3 章 · 六大核心设计模式" }
    },
    {
      id: "ng-iterate",
      author: "Andrew Ng",
      role: "DeepLearning.AI 创始人 / Coursera 联创",
      theme: "迭代方法论",
      punch: "在 Build 和 Analyze 两种模式间来回切换。",
      detail: "Build：先让端到端系统跑起来（哪怕粗糙）；Analyze：看输出、读 trace、跑 10–20 条小评测，做误差分析定位薄弱组件。迭代速度是 agentic 开发的第一竞争力。",
      takeaway: "强调『错误分析 + 小样本评测驱动迭代』，比只说『我会调优』更专业。",
      url: "https://10xplaybooks.com/p/inside-andrew-ng-agentic-ai-course",
      chapter: { id: "ch11", label: "第 11 章 · 评估与可观测性" }
    },
    {
      id: "anthropic-simplicity",
      author: "Anthropic 工程团队",
      role: "Building Effective Agents",
      theme: "极简优先",
      punch: "从能work的最简方案起步，评估证明需要时才加复杂度。",
      detail: "最成功的实现常常不是复杂框架，而是简单可组合的模式。路线是：基础 LLM 调用 → 加检索/示例 → workflow 显式编排 → 只有在用例确实需要时才上动态 Agent。框架会隐藏底层 prompt 与响应，增加调试难度。",
      takeaway: "被问架构时先说『我会先评估要不要 Agent』，展现工程成熟度。",
      url: "https://www.anthropic.com/research/building-effective-agents",
      chapter: { id: "ch7", label: "第 7 章 · 框架全景与选型" }
    },
    {
      id: "anthropic-context",
      author: "Anthropic 工程团队",
      role: "Effective Context Engineering",
      theme: "上下文工程",
      punch: "上下文工程正在取代提示工程。",
      detail: "重点从『怎么写一句 prompt』转向『在推理时维护一组最优的 token/信息』——包括指令、检索结果、记忆、工具状态。管理好进入模型的上下文，是让 Agent 可靠的关键。",
      takeaway: "把『上下文工程』作为记忆/RAG/多轮设计的统一视角来讲。",
      url: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents",
      chapter: { id: "ch4", label: "第 4 章 · 上下文工程" }
    },
    {
      id: "chase-context",
      author: "Harrison Chase",
      role: "LangChain / LangGraph CEO",
      theme: "系统设计",
      punch: "多数 Agent 失败不是模型不够聪明，而是系统设计出了问题。",
      detail: "错误的指令、错误的检索、错误的记忆或工具状态在错误的时间到达模型，才是失败根因。『光有更好的模型，不足以把 Agent 送上生产——基础设施与上下文工程同样重要。』",
      takeaway: "把线上 badcase 归因到『上下文/系统』而非只怪模型，是资深信号。",
      url: "https://www.elegantsoftwaresolutions.com/blog/harrison-chase-profile-agent-infrastructure",
      chapter: { id: "ch12", label: "第 12 章 · 生产部署与避坑" }
    },
    {
      id: "weng-anatomy",
      author: "Lilian Weng",
      role: "前 OpenAI 研究副总裁",
      theme: "经典架构",
      punch: "Agent = LLM + 规划 + 记忆 + 工具使用。",
      detail: "她 2023 年的综述把 Agent 拆成规划（任务分解/自我反思）、记忆（短期即上下文、长期靠外部向量存储）、工具使用三大件。此后几乎所有严肃的 Agent 技术讨论都沿用这个骨架。",
      takeaway: "白板画架构时，用这四件套开场，再谈你的具体取舍。",
      url: "https://lilianweng.github.io/posts/2023-06-23-agent",
      chapter: { id: "ch2", label: "第 2 章 · 四大核心组件" }
    },
    {
      id: "yao-second-half",
      author: "姚顺雨 (Shunyu Yao)",
      role: "ReAct 作者 / OpenAI 研究员",
      theme: "评估为王",
      punch: "AI 的下半场，评估比训练更重要。",
      detail: "上半场比拼模型训练与刷榜；下半场的核心是『该训练 AI 做什么、怎么衡量真实进展』。瓶颈不再是训练，而是定义有意义的任务、环境与稳健的奖励信号，心态更接近产品经理。",
      takeaway: "谈 Agent 质量时，把『评估体系』摆到和模型能力同等高度。",
      url: "https://ysymyth.github.io/The-Second-Half/",
      chapter: { id: "ch11", label: "第 11 章 · 评估与可观测性" }
    },
    {
      id: "yan-single-thread",
      author: "Walden Yan",
      role: "Cognition 联合创始人（Devin）",
      theme: "架构取舍",
      punch: "别急着上多 Agent：动作背后都藏着隐含决策，决策一冲突结果就崩。",
      detail: "Cognition 的两条原则：① 共享完整上下文，别让子代理各拿一段就开工；② 每个动作都携带隐含决策，多个代理并行时决策相互冲突会产生坏结果。因此他们的默认选择是『单线程 + 一次压缩』的线性 Agent，而不是花哨的多代理拓扑。",
      takeaway: "被问『要不要多 Agent』时，先反问任务能否并行、上下文能否共享，别默认越多越好。",
      url: "https://cognition.ai/blog/dont-build-multi-agents",
      chapter: { id: "ch17", label: "第 17 章 · Coding Agent" }
    },
    {
      id: "anthropic-multiagent-cost",
      author: "Anthropic 工程团队",
      role: "How we built our multi-agent research system",
      theme: "架构取舍",
      punch: "多 Agent 大约烧 15× 的 token，只有任务够值、能并行才划算。",
      detail: "对照组：普通对话 1×、单 Agent ~4×、多 Agent ~15× token。Token 用量本身能解释约 80% 的效果差异——这是花钱买性能。所以多 Agent 适合『可拆成独立并行子任务、且任务价值高到能覆盖成本』的场景，比如广度优先的研究检索。",
      takeaway: "和 Cognition 观点合起来讲：多 Agent 不是更高级，而是一种昂贵且有前提的权衡。",
      url: "https://www.anthropic.com/engineering/multi-agent-research-system",
      chapter: { id: "ch17", label: "第 17 章 · Coding Agent" }
    },
    {
      id: "horthy-12factor",
      author: "Dex Horthy",
      role: "HumanLayer 创始人 / 12-Factor Agents 作者",
      theme: "工程原则",
      punch: "拥有你的上下文窗口，把 Agent 做成无状态的 reducer。",
      detail: "12-Factor Agents 把可靠 Agent 的经验拆成工程原则：自己掌控 prompt 与上下文窗口的拼装（而非交给框架黑盒）、把错误压缩进上下文、拥有控制流、用小而专注的 Agent、随时可暂停/恢复。核心是把不确定的 LLM 包在确定性的工程骨架里。",
      takeaway: "面试讲工程化时，用『自己拥有 context 与控制流』替代『我用了某框架』，更显体系。",
      url: "https://github.com/humanlayer/12-factor-agents",
      chapter: { id: "ch20", label: "第 20 章 · 成本延迟与安全" }
    },
    {
      id: "hamel-error-analysis",
      author: "Hamel Husain",
      role: "独立 AI 咨询顾问 / 《Your AI Product Needs Evals》",
      theme: "评估为王",
      punch: "先看你的数据：错误分析才是评估体系的起点。",
      detail: "失败的 AI 产品几乎都栽在没有稳健的评估系统上。正确顺序是：先看真实输出、把错误分门别类做误差分析；每遇到一类错误就写一个测试——能用代码断言就用断言，不行再上 LLM-as-Judge。评估是快速迭代的飞轮，等价于软件工程里的测试。",
      takeaway: "别一上来谈指标，先讲『看数据 + 错误分析 + 分层评测』，这是资深味道。",
      url: "https://hamel.dev/blog/posts/evals/",
      chapter: { id: "ch11", label: "第 11 章 · 评估与可观测性" }
    },
    {
      id: "brown-test-time",
      author: "Noam Brown",
      role: "OpenAI 研究科学家 / o1 推理团队",
      theme: "推理范式",
      punch: "让模型多想几秒，常常胜过换一个更大的模型。",
      detail: "他用扑克 AI 举例：决策前让模型『思考』20 秒，效果相当于把模型放大约 10 万倍。推理阶段多花算力（test-time compute）已成为决定能力的主轴之一——这正是 Agent『多步推理 + 反思 + 工具调用』范式的底层依据。",
      takeaway: "解释为什么 ReAct/反思有效时，用『推理期算力换质量』给出第一性原理。",
      url: "https://www.sequoiacap.com/podcast/training-data-noam-brown/",
      chapter: { id: "ch3", label: "第 3 章 · 六大核心设计模式" }
    },
    {
      id: "schulman-rlhf",
      author: "John Schulman",
      role: "PPO / RLHF 主要作者 · OpenAI 联合创始人",
      theme: "后训练",
      punch: "对齐不是让模型更聪明，而是让它按人类偏好行动。",
      detail: "预训练决定模型『知道什么』，后训练（SFT + RLHF/偏好优化）决定它『愿意怎么表达和行动』。RLHF 的价值在于优化那些无法写成明确损失函数的目标——有用、诚实、无害，靠人类偏好信号来逼近。",
      takeaway: "面试谈后训练时，先分清『能力来自预训练、行为来自后训练』这条主线。",
      url: "https://openai.com/index/instruction-following/",
      chapter: { id: "ch16", label: "第 16 章 · 模型后训练" }
    },
    {
      id: "deepseek-grpo",
      author: "DeepSeek 团队",
      role: "DeepSeek-R1 / GRPO",
      theme: "后训练",
      punch: "去掉价值网络，用组内相对得分做优势估计，RL 也能训出强推理。",
      detail: "GRPO（组相对策略优化）对同一问题采样一组答案，用组内平均得分作基线算相对优势，省掉了 PPO 里那个和策略同样大的 Critic 网络，显存和工程复杂度大幅下降。R1 用可验证奖励（答案对错、代码能否通过测试）+ GRPO 训出了长链推理。",
      takeaway: "被问 DPO/GRPO 区别时，点出『GRPO 免 Critic + 可验证奖励』这两个关键。",
      url: "https://arxiv.org/abs/2402.03300",
      chapter: { id: "ch16", label: "第 16 章 · 模型后训练" }
    },
    {
      id: "yao-eval-benchmark",
      author: "姚顺雨 (Shunyu Yao)",
      role: "τ-bench 合作者 / ReAct 作者",
      theme: "评估基准",
      punch: "别只看『能不能做一次』，要看『能不能每次都做对』。",
      detail: "τ-bench 用 pass^k（连续 k 次都成功的概率）而非 pass@1 衡量 Agent，暴露了一个真相：很多 Agent 单次能成，但一致性差、换个措辞就崩。生产级可靠性考的是稳定性，不是运气好那一次。",
      takeaway: "谈评估时引入 pass^k / 一致性视角，比只说成功率更显深度。",
      url: "https://arxiv.org/abs/2406.12045",
      chapter: { id: "ch18", label: "第 18 章 · 评估基准全景" }
    },
    {
      id: "wei-cot",
      author: "Jason Wei",
      role: "Chain-of-Thought 一作 / OpenAI 研究员",
      theme: "提示工程",
      punch: "在示范里加一句『一步步推理』，多步推理能力会在大模型上涌现。",
      detail: "思维链（CoT）不改一个参数，只是在 few-shot 示范里把『问题→答案』换成『问题→推理过程→答案』，就能显著提升算术、常识与符号推理表现，而且这种收益只有在模型足够大时才涌现。它把『一次性心算』拆成『边写边算』，等于给了模型一张草稿纸。",
      takeaway: "答提示工程题时，把 CoT 定位成『按需选型的一档』而非默认开关：简单任务纯浪费 token，复杂推理才值得上。",
      url: "https://arxiv.org/abs/2201.11903",
      chapter: { id: "ch21", label: "第 21 章 · 系统化提示工程" }
    },
    {
      id: "yao-tot",
      author: "姚顺雨 (Shunyu Yao)",
      role: "ReAct / Tree of Thoughts 作者 · OpenAI 研究员",
      theme: "推理范式",
      punch: "把推理从一条不可回头的链，升级成能探索、能回溯的树。",
      detail: "CoT 是线性、贪心、一次成型的推理链，走岔一步整条就废。ToT 把问题建模成对『思维树』的搜索：每个节点生成多条候选想法、用评估函数打分、再用 BFS/DFS 遍历，支持前瞻与回溯。补上的正是 CoT 缺的两件事——生成多条路径（探索）与评估并选择/回退（搜索）。",
      takeaway: "谈高级推理时讲清『链→树→图』的演进主线，并强调 ToT/LATS 成本高、只在高价值难题才划算。",
      url: "https://arxiv.org/abs/2305.10601",
      chapter: { id: "ch22", label: "第 22 章 · 高级推理与搜索式规划" }
    },
    {
      id: "openai-realtime",
      author: "OpenAI 团队",
      role: "Realtime API / gpt-realtime（2025-08 GA）",
      theme: "实时交互",
      punch: "语音 Agent 最难的不是听懂说出，而是『什么时候该说、什么时候该闭嘴』。",
      detail: "Realtime API 走端到端语音路线，用事件驱动的持久连接把延迟、打断（barge-in）、轮次判定这些交互时序难题大部分替你扛下：浏览器端用 WebRTC、服务端用 WebSocket，内置 VAD 与打断中断事件，GA 版还带 SIP 电话接入与远程 MCP 工具调用。这让全双工语音客服从 demo 变成可落地的基础设施。",
      takeaway: "被问语音 Agent 系统设计时，先答『全流式 + 并行重叠压到 700ms 内』和『端点判定/打断/回声消除』这些非 AI 难点，再谈级联式 vs 端到端取舍。",
      url: "https://openai.com/index/introducing-the-realtime-api/",
      chapter: { id: "ch23", label: "第 23 章 · 语音与实时交互 Agent" }
    },
    {
      id: "huyen-continual",
      author: "Chip Huyen",
      role: "《Designing ML Systems》/《AI Engineering》作者",
      theme: "持续进化",
      punch: "别按固定时间表重训——数据分布一漂移、性能一下滑，就持续更新。",
      detail: "她把实时 ML 分两级：Level 1 是在线预测，Level 2 是系统能吸收新数据、实时更新模型，即持续学习。落到 Agent 上就是数据飞轮：用户使用 → 记录轨迹与反馈 → 挖掘失败难例 → 补进评估集/训练数据 → 改提示/补检索/必要时微调 → Agent 变强 → 更多人用。没有埋点就没有飞轮。",
      takeaway: "谈运营 Agent 时强调『先埋点、后一切』，且飞轮绝大部分收益来自改提示+补检索+扩评估集，微调是最后最重的手段。",
      url: "https://huyenchip.com/2020/12/27/real-time-machine-learning.html",
      chapter: { id: "ch24", label: "第 24 章 · 云原生部署与数据飞轮" }
    }
  ],
  postTraining: [
    {
      id: "sft",
      stage: "SFT 监督微调",
      role: "打基础 / 学格式",
      idea: "用『指令→理想回答』的标注数据做标准的下一 token 预测，让基座模型学会遵循指令、按目标格式作答。",
      pros: ["实现最简单、最稳定", "少量高质量数据即可见效", "教会格式与领域风格最有效"],
      cons: ["只会模仿示范，学不到『什么更好』", "数据质量天花板 = 效果天花板", "容易过拟合、丧失多样性"],
      when: "冷启动、注入领域知识、固定输出格式（如工具调用 JSON）。几乎所有后训练的第一步。"
    },
    {
      id: "rlhf",
      stage: "RLHF (PPO)",
      role: "对齐人类偏好",
      idea: "先用人类偏好数据训一个奖励模型（Reward Model），再用 PPO 强化学习让策略模型最大化奖励，同时用 KL 约束别偏离 SFT 太远。",
      pros: ["能优化无法写成损失函数的目标（有用/无害）", "InstructGPT/ChatGPT 的经典路线", "对开放式生成质量提升明显"],
      cons: ["流水线复杂：要额外训 RM + 在线采样", "PPO 需要 Critic，显存翻倍、调参难", "奖励易被 hack（reward hacking）"],
      when: "追求最强对齐效果、有充足工程与算力资源的团队。"
    },
    {
      id: "dpo",
      stage: "DPO 直接偏好优化",
      role: "免奖励模型的对齐",
      idea: "把 RLHF 的两步合成一步：直接在『偏好对（chosen/rejected）』上用一个分类式损失优化策略，数学上等价于隐式奖励，无需单独的奖励模型与在线采样。",
      pros: ["无 RM、无在线 rollout，实现简单", "训练稳定、复现容易", "已成为开源社区偏好对齐的默认选择"],
      cons: ["依赖离线偏好数据的质量与覆盖", "对分布外偏好泛化弱于在线 RL", "对超参（β）较敏感"],
      when: "想要接近 RLHF 的效果，但不想承担 PPO 的工程复杂度时的首选。"
    },
    {
      id: "grpo",
      stage: "GRPO 组相对策略优化",
      role: "免 Critic 的强化学习",
      idea: "对每个问题采样一组答案，用『组内平均得分』当基线来估计每个答案的相对优势，省掉了 PPO 中与策略同样大的价值网络；配合可验证奖励（答案对错/测试通过）效果尤佳。",
      pros: ["无需 Critic，显存与复杂度大降", "天然适配可验证奖励，抗 reward hacking", "DeepSeek-R1 用它训出长链推理"],
      cons: ["仍需在线采样，比 DPO 重", "依赖可自动验证的奖励信号", "组采样带来额外推理开销"],
      when: "训练推理/代码等『答案可自动判对错』的能力，且想避开 PPO 的 Critic 负担。"
    }
  ],
  finetuneDecision: {
    intro: "微调不是默认动作，而是排除法之后的选择。按顺序自问四个问题，任一步能解决就别急着微调——微调成本高、会引入维护负担，还可能损伤通用能力。",
    steps: [
      {
        q: "① 换更好的提示词 / few-shot 示例能解决吗？",
        yes: "先做提示工程。这是最便宜、最快的手段，很多『效果不好』其实是提示没写对。",
        no: "进入第 2 步。"
      },
      {
        q: "② 缺的是『知识』而不是『行为』吗？",
        yes: "上 RAG / 上下文工程。让模型检索到事实，比把事实塞进权重更新更划算、更易维护。",
        no: "进入第 3 步。"
      },
      {
        q: "③ 需要的是稳定的格式 / 风格 / 领域语气？",
        yes: "用 SFT。监督微调最擅长教会固定输出格式（如可靠的工具调用）与领域风格。",
        no: "进入第 4 步。"
      },
      {
        q: "④ 需要优化人类偏好 / 可验证的复杂能力（推理、代码）？",
        yes: "偏好优化：资源紧张用 DPO；有可自动验证奖励、追求推理能力上限用 GRPO/RLHF。",
        no: "回到提示工程 + RAG，多半还不需要微调。"
      }
    ]
  },
  codingAgentTrace: {
    intro: "Coding Agent 的核心不是『会写代码』，而是『能在真实代码库里定位问题→改对→用测试证明改对』的闭环。下面是一个 SWE-bench 式修 bug Agent 的典型执行轨迹，点每一步看它在做什么、以及背后的工程要点。",
    steps: [
      {
        title: "① 理解 Issue 与代码库",
        action: "读 issue 描述与复现信息，用代码检索（grep / 向量检索 / 符号索引）定位相关文件与函数。",
        note: "关键是『先定位再动手』。上下文窗口装不下整个仓库，检索质量直接决定成败——这是 Coding Agent 版的上下文工程。"
      },
      {
        title: "② 复现问题",
        action: "在沙箱里运行现有测试或写一个最小复现脚本，确认 bug 真实存在、锁定失败现象。",
        note: "没复现就改代码 = 盲改。能复现才能在最后用『测试由红转绿』证明修好了。"
      },
      {
        title: "③ 制定修改计划",
        action: "基于定位与复现，规划要改哪些文件、改动边界，必要时分解成多步。",
        note: "对应 Anthropic 的 orchestrator-workers 思路：复杂多文件改动先规划再分发，避免走一步看一步。"
      },
      {
        title: "④ 编辑代码",
        action: "以结构化 diff / 精确行编辑修改多个文件，保持改动最小、聚焦。",
        note: "多文件一致性是难点：改了函数签名要同步所有调用点，否则测试会在别处炸。"
      },
      {
        title: "⑤ 运行测试（反馈闭环核心）",
        action: "在沙箱执行项目测试套件，拿到报错/失败信息。",
        note: "沙箱（E2B / Docker）是安全底线：任意代码执行必须隔离。测试输出是 Agent 最可靠的『真值奖励』。"
      },
      {
        title: "⑥ 按报错迭代",
        action: "把测试报错压回上下文，定位新问题，回到第 4 步继续改，直到测试全绿或达到步数上限。",
        note: "这就是编码版 ReAct 循环。要设 max_steps 与循环检测，防止在同一个错误上反复打转烧 token。"
      }
    ]
  },
  benchmarks: [
    {
      id: "gaia",
      name: "GAIA",
      env: "通用助手",
      focus: "通用能力",
      by: "Meta AI 等 (2023)",
      tasks: "466 题，分 3 个难度层级",
      measures: "真实世界通用助手任务：需要多步推理 + 网页浏览 + 工具使用 + 多模态理解，答案唯一可自动比对。",
      signal: "人类 ~92%，而 2023 年 GPT-4+插件仅 ~15%——凸显『对人简单、对 AI 难』的能力鸿沟。",
      url: "https://arxiv.org/abs/2311.12983"
    },
    {
      id: "swebench",
      name: "SWE-bench Verified",
      env: "真实代码库",
      focus: "编码能力",
      by: "Princeton / OpenAI 筛选",
      tasks: "500 道人工校验过的真实 GitHub issue",
      measures: "给定真实仓库与 issue，Agent 要提交能通过项目测试的补丁；多文件、需理解大型代码库。",
      signal: "Coding Agent 的黄金标尺。Verified 子集剔除了模糊/不可解任务，比原始 2294 题更可信。",
      url: "https://www.swebench.com/"
    },
    {
      id: "taubench",
      name: "τ-bench / τ²-bench",
      env: "工具 + 对话",
      focus: "可靠性",
      by: "Sierra (2024)",
      tasks: "零售 / 航空客服领域，含真实 API 与策略约束",
      measures: "Agent 要在遵守领域政策的前提下多轮对话 + 调工具完成事务，比对最终数据库状态判对错。",
      signal: "首创 pass^k 衡量『多次都成功』的一致性，暴露 Agent『能成一次≠稳定可用』的可靠性短板。",
      url: "https://arxiv.org/abs/2406.12045"
    },
    {
      id: "osworld",
      name: "OSWorld",
      env: "真实操作系统",
      focus: "Computer Use",
      by: "港大 / Salesforce (2024)",
      tasks: "369 个跨 Ubuntu/Windows 的真实电脑任务",
      measures: "多模态 GUI Agent 看截图、操作真实软件（文件/浏览器/办公），用执行脚本判定是否达成。",
      signal: "人类 ~72%，早期最强模型一度不足 15%——多模态 + 长程操作是当前最硬骨头之一。",
      url: "https://os-world.github.io/"
    },
    {
      id: "webarena",
      name: "WebArena",
      env: "仿真网站",
      focus: "网页操作",
      by: "CMU (2023)",
      tasks: "812 个跨电商/论坛/CMS/地图的网页任务",
      measures: "在自托管的真实网站沙箱里完成端到端任务，按功能是否达成而非表面文本匹配来评分。",
      signal: "评估网页 Agent 的经典基准，强调『改变真实网站状态』的功能正确性。",
      url: "https://webarena.dev/"
    }
  ],
  benchmarkQuizzes: [
    {
      id: "bench-quiz-swebench",
      focus: "评估基准",
      level: "进阶判断",
      stem: "你在评估一个自研 Coding Agent，想用一个业界公认、能反映『在真实代码库里修 bug』能力且任务经过人工校验的基准。最合适的是？",
      options: ["GAIA", "SWE-bench Verified", "τ-bench 航空域"],
      correct: 1,
      explanation: "SWE-bench Verified 是 500 道经人工校验的真实 GitHub issue，用项目测试套件判定补丁是否有效，是编码 Agent 最主流、最可信的标尺。GAIA 测通用助手能力，τ-bench 测工具对话可靠性，都不聚焦代码库修复。",
      target: "#ch18"
    },
    {
      id: "bench-quiz-passk",
      focus: "评估基准",
      level: "进阶判断",
      stem: "线上 Agent『大部分时候能完成任务，但偶尔换个说法就失败』。要量化这种一致性问题，最该关注哪个指标视角？",
      options: ["pass@1（单次成功率）", "pass^k（连续 k 次都成功的概率）", "困惑度 perplexity"],
      correct: 1,
      explanation: "pass^k 衡量『连续多次都成功』，正是 τ-bench 用来暴露一致性短板的指标——生产可靠性看的是稳定性而非某一次运气。pass@1 只看单次，perplexity 是语言建模指标，与任务一致性无关。",
      target: "#ch18"
    }
  ],
  postTrainingQuizzes: [
    {
      id: "pt-quiz-dpo-grpo",
      focus: "模型后训练",
      level: "进阶判断",
      stem: "团队算力有限，只有一批人工标注的『偏好对（chosen/rejected）』数据，想做偏好对齐又不想搭 PPO 那套在线 RL + 奖励模型流水线。最合适的方法是？",
      options: ["RLHF (PPO)", "DPO 直接偏好优化", "再做一轮 SFT"],
      correct: 1,
      explanation: "DPO 直接在偏好对上用分类式损失优化策略，无需单独训练奖励模型、也无需在线采样，实现简单稳定，正是『想要接近 RLHF 效果但不想承担 PPO 复杂度』的首选。SFT 只会模仿示范、学不到偏好高低。",
      target: "#ch16"
    },
    {
      id: "pt-quiz-when-finetune",
      focus: "模型后训练",
      level: "进阶判断",
      stem: "客服 Agent 老是答错公司最新政策细节。在考虑微调前，最该先尝试的是？",
      options: ["直接 SFT 把政策写进权重", "上 RAG 让它检索最新政策文档", "用 GRPO 做强化学习"],
      correct: 1,
      explanation: "缺的是『知识/事实』而非『行为/格式』，应优先用 RAG / 上下文工程让模型检索到最新政策——既便宜又易维护，政策一变更新文档即可。把事实塞进权重（SFT）成本高且过时就得重训。",
      target: "#ch16"
    }
  ],
  productionPrinciples: [
    { id: "p1", title: "拥有你的上下文窗口", desc: "别把上下文拼装交给框架黑盒，自己精确控制每一步喂给模型什么。" },
    { id: "p2", title: "拥有你的提示词", desc: "把 prompt 当一等公民的代码来管理、版本化，而不是深埋在框架里。" },
    { id: "p3", title: "工具即结构化输出", desc: "工具调用本质是让模型产出结构化 JSON，别过度神化『工具』这个词。" },
    { id: "p4", title: "统一执行状态与业务状态", desc: "让 Agent 的执行状态可序列化、可落库，便于恢复与审计。" },
    { id: "p5", title: "小而专注的 Agent", desc: "与其造一个全能大 Agent，不如拆成职责清晰的小 Agent，好测好调。" },
    { id: "p6", title: "把错误压缩进上下文", desc: "失败信息要精炼后回喂给模型，让它据此自我修正，而非直接崩溃。" },
    { id: "p7", title: "支持启动 / 暂停 / 恢复", desc: "长程任务要能中断续跑，用简单 API 管理生命周期。" },
    { id: "p8", title: "拥有你的控制流", desc: "循环、分支、重试等控制逻辑放在确定性的代码里，别全交给模型即兴发挥。" },
    { id: "p9", title: "无状态 Reducer 化", desc: "把 Agent 设计成『输入状态 → 输出新状态』的纯函数式 reducer，天然可测试、可重放。" }
  ],
  costLatencyTactics: [
    {
      id: "routing",
      lever: "模型路由",
      idea: "按任务难度把请求分流到不同规模的模型：简单分类/抽取用小模型，复杂推理才上大模型。",
      tactics: ["用小模型做分诊/意图识别", "难任务再升级到大模型", "缓存路由决策"],
      metric: "每任务成本、平均调用价位"
    },
    {
      id: "caching",
      lever: "缓存",
      idea: "对重复的 prompt 前缀、工具结果、检索片段做缓存，避免重复付费与重复计算。",
      tactics: ["Prompt 前缀缓存（KV cache）", "工具/检索结果缓存", "语义缓存相似查询"],
      metric: "缓存命中率、重复调用占比"
    },
    {
      id: "latency",
      lever: "延迟优化",
      idea: "并行独立工具调用、流式返回首字节、给慢工具设超时与降级，减少无谓推理轮次。",
      tactics: ["并行 fan-out 独立子任务", "流式输出降低 TTFT", "慢工具超时 + 降级兜底"],
      metric: "TTFT、P95 延迟、吞吐"
    },
    {
      id: "context",
      lever: "上下文瘦身",
      idea: "好的上下文工程本身就是最大的降本手段——token 少了，钱和时间都省了。",
      tactics: ["压缩历史 / 外置笔记", "按需加载工具与文档", "子 Agent 隔离长上下文"],
      metric: "平均输入 token 数、单轮成本"
    }
  ],
  multimodalCapabilities: [
    { axis: "视觉理解", desc: "读懂截图、图表、文档版面、UI 元素，是多模态 Agent 的地基。" },
    { axis: "坐标定位", desc: "把『点这个按钮』落到像素坐标，GUI Agent 最易失误的一环。" },
    { axis: "长程操作", desc: "跨多个界面/步骤保持目标不漂移，考验规划与记忆。" },
    { axis: "图文工具调用", desc: "结合视觉输入决定调用哪个工具、传什么参数。" },
    { axis: "成本控制", desc: "图像 token 昂贵，截图频率与分辨率要精打细算。" }
  ]
};
