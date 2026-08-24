/* ============================================================
   learner-guide.js — 学习者友好增强层
   为每一章注入：难度 + 阅读时长、学完你能（导学目标）、
   一句话导读（大白话/类比）、核心要点（章末小结）、上/下章导航，
   并提供字号调节与章末学习标记（localStorage 持久化）。
   纯前端、离线可用，不改动正文，任何数据缺失都安全降级。
   ============================================================ */
(function () {
  'use strict';

  var LEVEL = {
    easy: { label: '入门', cls: 'easy' },
    mid:  { label: '进阶', cls: 'mid' },
    hard: { label: '硬核', cls: 'hard' }
  };

  // 每章导学数据：hook=大白话导读，goals=学完你能，key=核心要点，level=难度
  var GUIDE = {
    ch1: {
      level: 'easy',
      hook: '普通大模型像“问一句答一句的问答机”；Agent 更像一个“接了活会自己拆解、自己动手、干砸了还会返工”的助理。这一章先把这条分界线划清楚。',
      goals: [
        '用一句话讲清 Agent 与普通 LLM 调用的本质区别',
        '判断一个系统到底算不算 Agent（目标导向 / 自主决策 / 多步循环）',
        '说清“什么时候该上 Agent、什么时候老老实实写 Workflow”'
      ],
      key: [
        'Agent = 目标导向 + 自主决策 + 多步循环，缺了循环只是一次带工具的函数调用',
        '约 80% 场景用 Workflow 更省、更稳、更好调试，别一上来就上 Agent',
        '面试送分点：主动区分 Workflow 与 Agent，比堆架构更显成熟'
      ]
    },
    ch2: {
      level: 'easy',
      hook: '把 Agent 拆开看，就像看一个人怎么干活：大脑（模型）负责想，记忆负责记，双手（工具）负责做，嘴（交互层）负责沟通——四件套齐了才转得起来。',
      goals: [
        '说出 Agent 四大核心件各自负责什么',
        '理解“推理引擎”比普通调模型多了哪些要求',
        '在脑子里画出一个最小 Agent 的执行循环'
      ],
      key: [
        '四大件：推理引擎（大脑）、记忆、工具使用、通信/交互层，缺一不可',
        '推理引擎的关键不是“更会答”，而是“会决定下一步做什么”',
        '工具设计要像好 API：命名清晰、参数最小、错误可读'
      ]
    },
    ch3: {
      level: 'mid',
      hook: '设计模式就是前人踩过坑后总结的“招式套路”。你不用每次从零发明，遇到对应场景直接调用对应招式即可，这一章把六大常用招式讲透。',
      goals: [
        '记住六大设计模式各自解决什么问题',
        '看到一个需求能快速对上应该用哪种模式',
        '讲清 ReAct 为什么是最常用的默认招式'
      ],
      key: [
        'ReAct（思考→行动→观察循环）是万金油默认起手式',
        'Reflection（反思）、Planning（规划）、Tool Use、Multi-Agent、Evaluator-Optimizer 各有适用场景',
        '多 Agent 不是更高级，而是昂贵且有前提的权衡'
      ]
    },
    ch4: {
      level: 'mid',
      hook: '模型的“注意力”是有限的，喂太多、喂太乱，它反而记不住、抓不准——这叫上下文腐烂。上下文工程就是“把该给的、按最好的方式给到模型”的手艺。',
      goals: [
        '理解“上下文腐烂”为什么会让长上下文越喂越差',
        '掌握写入 / 选择 / 压缩 / 隔离四大上下文策略',
        '分清上下文工程与提示词工程的区别'
      ],
      key: [
        '上下文腐烂：token 越多，模型回忆准确率越可能下降',
        '四大策略：Write（外置笔记）/ Select（按需取）/ Compress（压缩）/ Isolate（子 Agent 隔离）',
        '上下文工程是最划算的降本手段——token 少了，钱和延迟一起降'
      ]
    },
    ch5: {
      level: 'mid',
      hook: '没有记忆的 Agent 像“每次开口都失忆的人”。记忆系统就是给它配一本随身笔记 + 一个长期档案库，让它记得住上文、也记得住“上次的经验”。',
      goals: [
        '区分短期记忆与长期记忆的边界与联动',
        '了解语义 / 情景 / 程序三类长期记忆',
        '知道“热路径写入”与“后台写入”各自的取舍'
      ],
      key: [
        '短期记忆=当前对话窗口，长期记忆=可检索的外部存储',
        '长期记忆三分类：语义（事实）/ 情景（经历）/ 程序（技能）',
        '写记忆别都塞进热路径，异步后台写入更省延迟'
      ]
    },
    ch6: {
      level: 'mid',
      hook: 'MCP 就是“AI 应用的 USB-C 接口”——以前每接一个工具都要单独接线，现在统一插口，一次对接、到处可用。',
      goals: [
        '用一句话向外行解释 MCP 是什么',
        '说清 MCP 的 Host / Client / Server 架构',
        '分清 MCP 与 Function Calling 的关系'
      ],
      key: [
        'MCP 是开放标准，统一了模型与外部工具/数据的对接方式',
        '三层架构：Host（宿主）、Client（客户端）、Server（能力提供方）',
        'MCP 不是取代 Function Calling，而是把工具做成可复用的标准服务'
      ]
    },
    ch7: {
      level: 'mid',
      hook: '框架选型像买鞋：不是越贵越好，而是合不合脚。这一章帮你把主流框架的“脚型”摸清，遇到需求就知道该穿哪双。',
      goals: [
        '掌握主流框架（smolagents/PydanticAI/LangGraph/CrewAI 等）各自定位',
        '学会“先评估要不要框架”而非无脑上重框架',
        '知道什么时候该“去框架化”直接调底层 API'
      ],
      key: [
        'smolagents 学原理、PydanticAI 做工程、LangGraph 精控复杂流程、CrewAI 玩多角色',
        '很多团队最终从重框架回退到轻量方案，因为抽象层反而添乱',
        '选型口诀：先用最简单的方案，只在必要时增加复杂度'
      ]
    },
    ch8: {
      level: 'easy',
      hook: '光看不练假把式。这一章用极简的 smolagents 让你亲手跑通第一个 Agent，把前面的概念变成手感。',
      goals: [
        '搭起 smolagents 的最小可运行骨架',
        '理解 CodeAgent“写代码即行动”为什么更高效',
        '自定义一个工具并让 Agent 调用它'
      ],
      key: [
        'smolagents 核心逻辑约千行，抽象极薄，最适合学原理',
        'CodeAct：以可执行代码作为动作，比 JSON 工具调用更省步骤',
        '学完能平滑迁移到任何重框架'
      ]
    },
    ch9: {
      level: 'mid',
      hook: '如果说 smolagents 是“学车用的教练车”，PydanticAI 就是“能上路的量产车”——类型安全、结构化输出，产出可以直接上线。',
      goals: [
        '用 PydanticAI 产出类型安全的结构化结果',
        '理解依赖注入如何让 Agent 更好测试与维护',
        '写出一个具备工程规范的可上线 Agent'
      ],
      key: [
        'PydanticAI 被称为“Agent 界的 FastAPI”，主打生产级工程化',
        '结构化输出 + 依赖注入 = 好测试、好维护、好上线',
        '类型即契约：让错误在编译期/校验期暴露，而不是线上'
      ]
    },
    ch10: {
      level: 'hard',
      hook: '让 Agent 张口就答容易胡说；先去“查资料”再回答，才靠谱。RAG 就是给 Agent 配一个“开卷考试”的资料库，Agentic RAG 更进一步——它会自己决定查不查、查几次、查得准不准。',
      goals: [
        '打通一条端到端可运行的 RAG 问答链路',
        '掌握切分 / 混合检索 / 重排 / 防幻觉等关键环节',
        '说清传统 RAG 与 Agentic RAG 的区别，并会排查“检索不准”'
      ],
      key: [
        '传统 RAG 是一次性“检索→拼接→生成”，Agentic RAG 能多轮自我修正',
        '检索质量关键链路：切分策略 → 混合检索(稠密+稀疏) → 重排 → 引用溯源',
        '防幻觉三件套：强制引用、答不出就说“不知道”、忠实度校验'
      ]
    },
    ch11: {
      level: 'mid',
      hook: '“感觉变好了”不算数。没有评估，你根本不知道改动是进步还是退步。这一章教你像做实验一样，用数据说话地评估和观测 Agent。',
      goals: [
        '设计组件级 + 轨迹级的评估方法',
        '用 LLM-as-Judge 和 Ground Truth 各自的正确姿势',
        '接入可观测性（tracing）定位问题出在哪一步'
      ],
      key: [
        '评估分层：组件级（单点准不准）+ 轨迹级（整条路径对不对）',
        'LLM-as-Judge 便宜但需校准，关键指标仍要 Ground Truth 兜底',
        '可观测性靠 tracing：把每一步思考/工具调用记录下来才能复盘'
      ]
    },
    ch12: {
      level: 'mid',
      hook: 'Demo 能跑 ≠ 能上线。生产环境有一堆“暗坑”：无限循环、上下文爆炸、成本失控、被提示注入。这一章带你提前把坑填上。',
      goals: [
        '识别并防住常见失败模式（死循环 / 上下文爆炸 / 错误累积）',
        '给 Agent 加上护栏（输入输出校验、工具权限、注入防护）',
        '把可靠性工程原则落到自己的系统里'
      ],
      key: [
        '常见翻车：无限循环、目标漂移、错误累积、幻觉级联',
        '护栏是标配：输入/输出校验 + 工具权限最小化 + 提示注入防护',
        '设步数上限、超时、降级兜底，是上线前的基本功'
      ]
    },
    ch13: {
      level: 'mid',
      hook: '面试其实是有“题库”的。这一章把高频题按难度铺开，配套“先自答再看解析”的主动回忆练法，比干背答案记得牢得多。',
      goals: [
        '刷完各难度层的高频面试题',
        '养成“先自己答、再对解析”的主动回忆习惯',
        '定位自己薄弱的知识点回炉重读'
      ],
      key: [
        '答案默认折叠：先在心里/纸上答一遍再展开对照',
        '题目按 EASY/MEDIUM/HARD 分层，覆盖概念到工程判断',
        '错题回到对应章节重读，比反复看答案更有效'
      ]
    },
    ch14: {
      level: 'mid',
      hook: '答得好不等于会答。这一章给你可复用的“答题框架”，还教你把项目经历讲成一个有冲突、有取舍、有结果的好故事。',
      goals: [
        '掌握结构化答题框架，避免答得零散',
        '把项目经历打磨成可讲的 STAR 式故事',
        '预判追问链，准备好“为什么这么选”的取舍理由'
      ],
      key: [
        '好答案=结论先行 + 取舍理由 + 落地细节',
        '项目故事要有：背景、你的判断、遇到的坑、量化结果',
        '面试官爱追“为什么不用另一种方案”，提前准备取舍论据'
      ]
    },
    ch15: {
      level: 'easy',
      hook: '学习最怕“不知道下一步学什么”。这一章给你一张按阶段推进的路线图和精选资料，照着走就行。',
      goals: [
        '按阶段规划自己的 Agent 学习路径',
        '挑选适合当前水平的优质资料',
        '把“学—练—复盘”形成闭环'
      ],
      key: [
        '路线图分阶段：打基础 → 动手实践 → 工程/评估 → 面试冲刺',
        '资料贵精不贵多，选定就深挖，别在收藏夹里吃灰',
        '每学一块立刻动手复现，形成正反馈'
      ]
    },
    ch16: {
      level: 'hard',
      hook: '模型为什么“听得懂人话、还挺守规矩”？靠的是预训练之后的“后训练”。这一章把 SFT、RLHF、DPO、GRPO 这几种“调教”手段一次讲清。',
      goals: [
        '理解后训练在整条训练管线中的位置与作用',
        '说清 SFT / RLHF / DPO / GRPO 各自解决什么',
        '知道什么场景才值得动用微调这门“重炮”'
      ],
      key: [
        'SFT 教格式与基本对齐，RLHF/DPO 做偏好对齐，GRPO 练可验证的长链推理',
        'DPO 免奖励模型、直接在偏好对上优化，更简单稳定',
        '能靠提示 + 检索解决的，别急着微调；数据够了再上'
      ]
    },
    ch17: {
      level: 'hard',
      hook: 'Devin、Cursor、Claude Code 这类“会写代码的 Agent”到底怎么搭的？这一章拆开它的架构，看它如何读代码、改代码、跑测试、再自我修正。',
      goals: [
        '拆解 Coding Agent 的核心架构与执行轨迹',
        '理解它如何管理代码上下文与工具（编辑/运行/测试）',
        '总结出可迁移到自己项目的设计原则'
      ],
      key: [
        'Coding Agent 靠“编辑—运行—看反馈—再修”的紧闭环取胜',
        '代码上下文管理是命门：给太多噪声、给太少没依据',
        '让它自己跑测试拿到真实反馈，比让它“想清楚”更有效'
      ]
    },
    ch18: {
      level: 'mid',
      hook: '怎么客观说“这个 Agent 到底强不强”？靠公认的评测基准。这一章把 GAIA、SWE-bench、τ-bench 等主流标尺一次认全。',
      goals: [
        '认清各大基准分别考什么能力',
        '读懂 pass^k 这类指标背后的“稳定性”含义',
        '会用基准结果佐证自己的技术判断'
      ],
      key: [
        'GAIA 考通用助理、SWE-bench 考真实修 bug、OSWorld/WebArena 考 GUI 操作',
        'τ-bench 用 pass^k 暴露“能成一次 ≠ 稳定可用”',
        '基准是标尺不是目标，别为刷榜而过拟合'
      ]
    },
    ch19: {
      level: 'hard',
      hook: '会看屏幕、会点按钮的 Agent（Computer Use）比纯文字难得多——它得先“看懂”，再把“点这个”落到精确的像素坐标。这一章讲清多模态 Agent 的难点。',
      goals: [
        '理解多模态 Agent 的能力拆解（视觉理解/坐标定位/长程操作）',
        '说清 GUI Agent 最容易失误的环节',
        '知道图像 token 昂贵下如何做成本控制'
      ],
      key: [
        '视觉理解是地基，坐标定位是最易翻车的一环',
        '长程操作考验“多步不跑偏”的规划与记忆',
        '截图分辨率与频率要精打细算，图像 token 很贵'
      ]
    },
    ch20: {
      level: 'mid',
      hook: '同样一个 Agent，有人跑得又快又便宜，有人烧钱还慢。差别就在成本与延迟的工程优化，以及别让它“乱来”的安全对齐。',
      goals: [
        '掌握模型路由 / 缓存 / 并行 / 上下文瘦身等降本提速手段',
        '定位延迟瓶颈（TTFT、P95）并对症下药',
        '理解安全对齐在成本之外为什么同样是硬约束'
      ],
      key: [
        '降本四板斧：模型路由、缓存命中、并行 fan-out、上下文瘦身',
        '提速看 TTFT 与 P95：流式输出 + 慢工具超时降级',
        '安全对齐不是可选项：能力越强，越要管住边界'
      ]
    },
    ch21: {
      level: 'mid',
      hook: '写提示词像“给一个能力超强、但没背景知识、干完就失忆的实习生交代活”。交代得越清楚、给的例子越到位，他干得越好。',
      goals: [
        '按场景选对提示技巧（零样本/少样本/思维链/自洽性/结构化）',
        '用少样本把一个“翻车”的任务调到能用',
        '记住常见反模式，避免“想当然”踩坑'
      ],
      key: [
        '零样本适合常见任务，格式特殊就上少样本给例子',
        '思维链只在多步推理才用，简单任务上它纯烧 token',
        '结构化分区（角色/规则/格式/示例/输入）既清晰又防注入'
      ]
    },
    ch22: {
      level: 'hard',
      hook: '让模型解难题，就像走迷宫：CoT 是“闭眼一路往前走不回头”，ToT 是“带记号笔探路能回溯”，GoT 是“一群人分头探还能拼地图”。这一章教你按题选“走法”。',
      goals: [
        '分清 CoT / ToT / GoT / ReWOO / LATS 各自的走法与代价',
        '手把手用 ToT 走一遍搜索、回溯、剪枝',
        '算清 ReWOO 为什么能省下大量 token'
      ],
      key: [
        'CoT=线性贪心，ToT=树搜索可回溯，GoT=图结构可合并',
        'ReWOO 把“规划”和“执行”解耦，观察结果不重复喂，省 token',
        'LATS 最强也最贵：用蒙特卡洛树搜索精算“值不值得深入探”'
      ]
    },
    ch23: {
      level: 'hard',
      hook: '文字 Agent 像“用对讲机”——说完喊“完毕”对方才接话；语音 Agent 像“打电话”——能随时插话、被打断，还没有“完毕”信号。难点全是被“打电话”逼出来的。',
      goals: [
        '理解全双工交互比文字多出的难点',
        '说清 VAD、端点判定、打断、延迟预算怎么配合',
        '分清级联式与端到端语音架构的取舍'
      ],
      key: [
        '没有“完毕”信号 → 要靠端点判定猜“这轮说完没”',
        '延迟是生死线：用填充语掩盖工具调用耗时',
        '被打断要能秒停并清空队列，回声消除防“自己打断自己”'
      ]
    },
    ch24: {
      level: 'mid',
      hook: '把 Agent 送上线，像港口物流：容器化=把货打进标准集装箱，K8s=自动化码头调度，状态外置=贵重货存岸上仓库，数据飞轮=越跑越准的物流网。',
      goals: [
        '理解容器化 / Kubernetes / Serverless 各自解决什么',
        '说清为什么状态必须外置、不能锁在实例内存',
        '讲清数据飞轮如何让 Agent “越用越强”'
      ],
      key: [
        '容器化让“在我机器上是好的”变成到处都一样跑',
        '状态外置到 Redis/数据库/向量库，实例才能随时替换',
        '数据飞轮：用得越多 → 暴露真实问题越多 → 修得越准 → 用户越满意'
      ]
    }
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function li(items) {
    return '<ul class="lg-list">' + items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
  }

  // 估算阅读时长：中文按 ~380 字/分钟，代码按 ~11 行/分钟
  function estimateMinutes(section) {
    var text = section.textContent || '';
    var cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    var codeLines = 0;
    Array.prototype.slice.call(section.querySelectorAll('pre')).forEach(function (pre) {
      if (pre.classList.contains('mermaid')) return;
      codeLines += (pre.textContent || '').split('\n').length;
    });
    var min = Math.round(cjk / 380 + codeLines / 11);
    return Math.max(2, min);
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    // 收集正文章节（ch1..ch24），保持 DOM 顺序
    var chapters = Array.prototype.slice.call(document.querySelectorAll('section.chapter'))
      .filter(function (s) { return /^ch\d+$/.test(s.id) && GUIDE[s.id]; });

    if (!chapters.length) return;

    var READ_KEY = 'ah-read-chapters';
    var readState = {};
    try { readState = JSON.parse(localStorage.getItem(READ_KEY) || '{}') || {}; } catch (e) { readState = {}; }
    function saveRead() { try { localStorage.setItem(READ_KEY, JSON.stringify(readState)); } catch (e) {} }

    var total = chapters.length;

    function titleOf(section) {
      var h = $('.chap-title', section);
      if (!h) return section.id;
      var clone = h.cloneNode(true);
      var k = clone.querySelector('.kicker');
      if (k) k.remove();
      return (clone.textContent || '').trim();
    }

    chapters.forEach(function (section, idx) {
      var data = GUIDE[section.id];
      var titleNode = $('.chap-title', section);
      if (!titleNode) return;

      var minutes = estimateMinutes(section);
      var lv = LEVEL[data.level] || LEVEL.mid;

      /* ---------- 章首导学卡 ---------- */
      var opener = el('div', 'lg-opener');
      opener.setAttribute('data-lg', 'opener');
      opener.innerHTML =
        '<div class="lg-meta">' +
          '<span class="lg-badge lg-' + lv.cls + '">难度 · ' + lv.label + '</span>' +
          '<span class="lg-badge lg-time">⏱ 约 ' + minutes + ' 分钟</span>' +
          '<span class="lg-badge lg-idx">第 ' + (idx + 1) + ' / ' + total + ' 章</span>' +
        '</div>' +
        '<div class="lg-hook"><span class="lg-hook-mark">导读</span>' + data.hook + '</div>' +
        '<div class="lg-goals">' +
          '<div class="lg-goals-t">🎯 学完这一章，你能：</div>' + li(data.goals) +
        '</div>';
      titleNode.insertAdjacentElement('afterend', opener);

      /* ---------- 章末小结卡 + 上/下章导航 ---------- */
      var prev = chapters[idx - 1];
      var next = chapters[idx + 1];
      var navHtml = '<div class="lg-nav">';
      navHtml += prev
        ? '<a class="lg-nav-btn prev" href="#' + prev.id + '"><span>← 上一章</span><b>' + titleOf(prev) + '</b></a>'
        : '<span class="lg-nav-btn ghost"></span>';
      navHtml += '<button class="lg-read-btn" data-read="' + section.id + '">✓ 标记学完</button>';
      navHtml += next
        ? '<a class="lg-nav-btn next" href="#' + next.id + '"><span>下一章 →</span><b>' + titleOf(next) + '</b></a>'
        : '<span class="lg-nav-btn ghost"></span>';
      navHtml += '</div>';

      var summary = el('div', 'lg-summary');
      summary.setAttribute('data-lg', 'summary');
      summary.innerHTML =
        '<div class="lg-sum-head">📌 本章要点回顾</div>' +
        li(data.key) +
        navHtml;
      section.appendChild(summary);

      // 标记学完按钮
      var readBtn = summary.querySelector('.lg-read-btn');
      function paintRead() {
        if (readState[section.id]) {
          readBtn.classList.add('done');
          readBtn.textContent = '✓ 已学完（点击取消）';
          summary.classList.add('is-read');
        } else {
          readBtn.classList.remove('done');
          readBtn.textContent = '✓ 标记学完';
          summary.classList.remove('is-read');
        }
      }
      readBtn.addEventListener('click', function () {
        readState[section.id] = !readState[section.id];
        saveRead(); paintRead();
      });
      paintRead();
    });

    /* ---------- 顶栏：字号调节 ---------- */
    var tools = $('.nav-tools');
    if (tools) {
      // 字号调节
      var FONT_KEY = 'ah-font-scale';
      var scales = [15, 16, 17, 18, 19];
      var scale = 16;
      try { scale = parseInt(localStorage.getItem(FONT_KEY), 10) || 16; } catch (e) {}
      if (scales.indexOf(scale) === -1) scale = 16;
      function applyFont() {
        document.documentElement.style.fontSize = scale + 'px';
        try { localStorage.setItem(FONT_KEY, String(scale)); } catch (e) {}
      }
      applyFont();

      var fontWrap = el('div', 'lg-font');
      fontWrap.innerHTML =
        '<button class="icon-btn lg-font-btn" id="lgFontDown" title="缩小字号">A−</button>' +
        '<button class="icon-btn lg-font-btn" id="lgFontUp" title="放大字号">A+</button>';

      // 放到主题按钮之前
      var themePicker = $('.theme-picker', tools);
      tools.insertBefore(fontWrap, themePicker || null);

      $('#lgFontDown', fontWrap).addEventListener('click', function () {
        var i = scales.indexOf(scale); if (i > 0) { scale = scales[i - 1]; applyFont(); }
      });
      $('#lgFontUp', fontWrap).addEventListener('click', function () {
        var i = scales.indexOf(scale); if (i < scales.length - 1) { scale = scales[i + 1]; applyFont(); }
      });
    }
  });
})();
