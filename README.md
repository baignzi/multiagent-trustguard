# 多智能体恶意行为防御与信任评估系统

## 项目概述

本系统面向分布式多智能体协同场景，解决传统安全机制难以应对的隐蔽协同攻击、身份冒用与信任漂移问题。通过融合行为语义分析、图神经网络与可解释信任模型，构建具备自适应能力的防御闭环。

当前仓库为**可运行的演示原型（v1）**：后端提供智能体注册/元数据管理、动态信任评估算法核心、交互图谱、策略编排与全链路溯源；前端提供组织树浏览、智能体注册、监控仪表盘，以及元数据监控、交互图谱、策略编排、溯源看板与恶意行为检测中心五个功能模块的切换视图。

## 技术栈

### 后端
- **FastAPI**：智能体注册与元数据管理服务（端口 8000）
- **Flask**：恶意行为检测中心服务（端口 5000，当前为 Mock 接口）
- **SQLAlchemy**：ORM 框架，持久化到 SQLite（演示）/ 可切换 MySQL
- **Pydantic**：数据校验

### 算法核心
- **backend/trust_engine.py**：动态信任评估引擎（纯函数实现，已在 v1 落地）

### 前端
- **React 18** + Create React App（react-scripts）
- **react-markdown / remark-math / rehype-katex / katex**：Markdown 与数学公式渲染
- **http-proxy-middleware**：开发期将 `/api` 代理转发到后端（端口 8000）
- **可视化**：原生 SVG 折线图（无第三方图表库，监控仪表盘由 SVG 直接绘制）

### 数据库
- SQLite（开发演示，库文件 `agents.db` 已在 `.gitignore` 忽略，首次启动自动 seed 演示数据）
- MySQL 8.0（生产环境规划）

## 项目结构

```
project/
├── backend/                        # 后端服务
│   ├── agent_registry.py           # FastAPI 智能体注册与元数据服务（:8000）
│   ├── trust_engine.py             # 动态信任评估引擎（算法核心，纯函数）
│   ├── detection_center.py         # Flask 检测中心服务（:5000，Mock 接口）
│   └── requirements.txt            # Python 依赖
├── frontend/                       # 前端应用（React）
│   ├── public/
│   │   └── index.html              # HTML 入口
│   ├── src/
│   │   ├── components/
│   │   │   └── DetectionCenter.js  # 检测中心组件（已挂载为"检测中心"页签，消费 :5000 接口）
│   │   ├── styles/
│   │   │   └── index.css           # 全局样式
│   │   ├── App.js                  # 主应用（组织树/注册/监控仪表盘/交互图谱/策略/溯源）
│   │   ├── index.js                # React 入口
│   │   └── setupProxy.js           # 开发期 /api 代理配置
│   └── package.json                # Node.js 依赖
├── start.sh                        # Linux/macOS 一键启动脚本
├── start.bat                       # Windows 启动脚本
└── README.md                       # 项目说明
```

## 快速开始

### 方式一：一键启动（推荐）

```bash
# Linux / macOS
./start.sh

# Windows
start.bat
```

> 说明：`start.bat` 中的 Python 解释器路径为本地绝对路径，使用前请改为你环境的实际路径。
> `start.sh` 会依次安装后端依赖、前端依赖，并先后启动 Detection Center(:5000)、Agent Registry(:8000) 与前端(:3000)。

### 方式二：分步启动

**1. 安装后端依赖**
```bash
cd backend
pip install -r requirements.txt
```

**2. 启动后端服务**

智能体注册服务（终端 1）：
```bash
cd backend
python agent_registry.py
# 等价于：uvicorn agent_registry:app --host 0.0.0.0 --port 8000
```
API 文档：http://localhost:8000/docs （Swagger UI）

检测中心服务（终端 2，可选）：
```bash
cd backend
python detection_center.py
```
访问：http://localhost:5000

**3. 安装并启动前端（终端 3）**
```bash
cd frontend
npm install
npm start
```
访问：http://localhost:3000

> 前端通过 `setupProxy.js` 将 `/api/*` 请求代理到 `http://localhost:8000`，因此需先启动后端再访问前端页面。

## 核心功能与实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 智能体注册与元数据管理 | 已实现 | 组织树、注册流程、元数据查询（`/api/tree`、`/api/agent/register`、`/api/agent/{id}`） |
| 动态信任评估引擎 | 已实现 | `backend/trust_engine.py`，基于行为证据的时间衰减 + 证据加权评分（详见下节） |
| 元数据监控仪表盘 | 已实现 | 前端以原生 SVG 折线图渲染 `/api/chart/metadata-monitoring` |
| 恶意行为检测中心（前端视图） | 已实现 | 前端"检测中心"页签消费 :5000 全部接口：集群/风险实体双树、实时行为流表、异常趋势与深度分析折线图、检测策略配置下发表单、Markdown 检测报告与安全运营日历 |
| 跨智能体交互图谱 | 已实现 | 后端 `/api/graph/interaction` 构建节点/边/可疑连边；前端 SVG 网络图渲染 |
| 防御策略编排平台 | 已实现 | 后端 `Policy` 模型 + CRUD 接口；前端策略列表与启用/禁用/删除 |
| 全链路溯源看板 | 已实现 | 后端 `/api/audit/trace/{agent_id}` 生成事件时间线；前端时间轴展示 |

## 动态信任评估引擎（已实现）

核心算法位于 `backend/trust_engine.py`，为不依赖 Web 框架的纯函数模块，便于测试与复用。

### 信任评分公式

对智能体近期行为证据按类型加权融合，并施加时间衰减：

```
trust_score = Σ ( w_i × evidence_i ) × decay_factor(Δt)
decay_factor(Δt) = e^(-λ·Δt)        // λ = 0.1
```

- 证据权重：`task = 0.3`、`message = 0.4`、`resource = 0.3`
- 行为证据来自 `BehaviorRecord` 表（启动时 seed 演示数据），包含行为类型、得分、时间戳与异常标记
- 时间衰减保证越早的行为对当前信任分影响越小

### 可解释性（GNN 特征）

`generate_gnn_explanation()` 基于图特征（节点度、中心性、跨域共识）实时计算子图得分，并产出标签：

- `GNN-degree-centrality` / `trust-propagation-path` / `cross-domain-consensus`
- 检测到行为漂移时追加 `behavior-drift-detected`

### 对外接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/trust/score/{agent_id}` | GET | 返回实时计算的信任分 + 三类证据融合明细 |
| `/api/trust/explain/{agent_id}` | GET | 返回 GNN 子图解释得分与标签 |
| `/api/agent/{agent_id}` | GET | 智能体详情，含真实信任分、7 日演化、解释标签（由引擎驱动） |

## API 接口说明

### 智能体注册服务（FastAPI - 端口 8000）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/tree` | GET | 获取智能体组织结构树（含注册后写入数据库的自定义智能体） |
| `/api/agent/{agent_id}` | GET | 获取智能体详细信息（信任分/演化/解释，由引擎实时计算） |
| `/api/agent/register` | POST | 注册新智能体 |
| `/api/trust/score/{agent_id}` | GET | 动态信任评分（算法核心接口） |
| `/api/trust/explain/{agent_id}` | GET | GNN 可解释性标签与子图得分 |
| `/api/chart/metadata-monitoring` | GET | 获取元数据监控图表数据（4 条折线） |
| `/api/graph/interaction` | GET | 跨智能体交互图谱（节点/边/可疑连边/影响力） |
| `/api/policies` | GET/POST | 防御策略列表 / 创建策略 |
| `/api/policies/{id}` | PATCH/DELETE | 更新策略（启用/禁用/参数） / 删除策略 |
| `/api/audit/trace/{agent_id}` | GET | 全链路审计时间线（注册/行为/信任评估事件） |

### 检测中心服务（Flask - 端口 5000，当前为 Mock）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/left-tree` | GET | 获取左侧集群树 |
| `/api/v1/right-tree` | GET | 获取右侧风险实体树 |
| `/api/v1/behavior-table` | GET | 获取行为流表格数据 |
| `/api/v1/detection-form-schema` | GET | 获取检测表单配置 |
| `/api/v1/markdown-report` | GET | 获取 Markdown 检测报告 |
| `/api/v1/chart/abnormal-trend` | GET | 获取异常趋势图表 |
| `/api/v1/chart/agent-deep-analysis` | GET | 获取智能体深度分析图表 |
| `/api/v1/calendar-events` | GET | 获取日历事件数据 |
| `/api/v1/detection-config` | POST | 接收前端检测策略配置表单并返回下发回执（含配置 ID） |
