# 多智能体恶意行为防御与信任评估系统

## 项目概述

本系统面向分布式多智能体协同场景，解决传统安全机制难以应对的隐蔽协同攻击、身份冒用与信任漂移问题。通过融合行为语义分析、图神经网络与可解释信任模型，构建具备自适应能力的防御闭环。

## 技术栈

### 后端
- **FastAPI**: 智能体注册与元数据管理服务（端口 8000）
- **Flask**: 恶意行为实时检测中心服务（端口 5000）
- **SQLAlchemy**: ORM框架，支持SQLite/MySQL
- **Pydantic**: 数据验证

### 前端
- **React 18**: 组件化UI框架
- **React Markdown**: Markdown渲染
- **KaTeX**: 数学公式渲染
- **ECharts**: 数据可视化（需单独引入）

### 数据库
- SQLite（开发环境）
- MySQL 8.0（生产环境）

## 项目结构

```
project/
├── backend/                    # 后端服务
│   ├── agent_registry.py      # FastAPI智能体注册服务
│   ├── detection_center.py    # Flask检测中心服务
│   └── requirements.txt       # Python依赖
├── frontend/                   # 前端应用
│   ├── public/
│   │   └── index.html         # HTML入口
│   ├── src/
│   │   ├── components/
│   │   │   └── DetectionCenter.js  # 检测中心组件
│   │   ├── styles/
│   │   │   └── index.css      # 全局样式
│   │   └── App.js             # 主应用组件
│   └── package.json           # Node.js依赖
└── README.md                  # 项目说明
```

## 快速开始

### 1. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动后端服务

**智能体注册服务**（终端1）:
```bash
python agent_registry.py
```
访问: http://localhost:8000/docs (Swagger UI)

**检测中心服务**（终端2）:
```bash
python detection_center.py
```
访问: http://localhost:5000

### 3. 安装前端依赖

```bash
cd frontend
npm install
```

### 4. 启动前端开发服务器

```bash
npm start
```
访问: http://localhost:3000

## 核心功能模块

### 1. 智能体注册与元数据管理
- 智能体组织结构树展示
- 智能体元数据查看与编辑
- 新智能体注册流程
- 信任评分演化追踪

### 2. 恶意行为实时检测中心
- 行为流实时监控
- 异常检测策略配置
- 检测报告生成
- 攻击链路溯源

### 3. 动态信任评估引擎 (已实现，见 backend/trust_engine.py)
- 时间衰减因子 + 证据权重融合的动态信任分（task 0.3 / message 0.4 / resource 0.3，decay=e^(-0.1*t)）
- GNN 子图加权可解释性标签生成（degree-centrality / trust-propagation / cross-domain-consensus）
- 真实行为证据驱动，接口：`/api/trust/score/{id}`、`/api/trust/explain/{id}`、`/api/agent/{id}`

### 4. 跨智能体交互图谱
- 关系拓扑可视化
- 路径可信度推演
- 协同攻击识别

### 5. 防御策略编排平台
- 策略模板库管理
- 策略参数动态调整
- 策略有效性评估

### 6. 全链路溯源看板
- 事件回溯轨迹
- 证据链验证
- 合规报告生成

## API接口说明

### 智能体注册服务 (FastAPI - 端口8000)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/tree` | GET | 获取智能体组织结构树 |
| `/api/agent/{agent_id}` | GET | 获取智能体详细信息 |
| `/api/agent/register` | POST | 注册新智能体 |
| `/api/chart/metadata-monitoring` | GET | 获取元数据监控图表数据 |

### 检测中心服务 (Flask - 端口5000)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/left-tree` | GET | 获取左侧集群树 |
| `/api/v1/right-tree` | GET | 获取右侧风险实体树 |
| `/api/v1/behavior-table` | GET | 获取行为流表格数据 |
| `/api/v1/detection-form-schema` | GET | 获取检测表单配置 |
| `/api/v1/markdown-report` | GET | 获取Markdown检测报告 |
| `/api/v1/chart/abnormal-trend` | GET | 获取异常趋势图表 |
| `/api/v1/chart/agent-deep-analysis` | GET | 获取智能体深度分析图表 |
| `/api/v1/calendar-events` | GET | 获取日历事件数据 |

## 系统架构

```
                        ┌─────────────────┐
用户请求 ──────────────→ │   API Gateway    │
                        │  鉴权/限流/路由   │
                        └────────┬────────┘
                                 |
               ┌─────────────────┼─────────────────┐
               v                 v                 v
        ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
        │ Agent Registry│  │Detection Center│  │ Trust Engine │
        │  (FastAPI)    │  │   (Flask)     │  │  (Python)    │
        └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
               |                |                 |
        ┌──────▼──────────────────────────────────▼──────┐
        │              数据层                              │
        │  SQLite/MySQL（持久化）  Redis（缓存）            │
        └─────────────────────────────────────────────────┘
```

## 关键技术特点

1. **行为语义分析**: 提取智能体交互意图特征
2. **图神经网络(GNN)**: 建模多主体动态关联拓扑
3. **可解释信任模型**: 生成量化可信度评分及证据链
4. **全链路溯源**: 支持时间轴回放与原始日志关联
5. **国密SM4加密**: 审计日志加密存储

## 注意事项

1. 首次运行前请确保已安装所有依赖
2. 生产环境建议使用MySQL替代SQLite
3. ECharts图表需要额外引入echarts库
4. 静态资源文件（图标、图片）需放置在对应目录

## 开发环境要求

- Python 3.8+
- Node.js 16+
- npm 或 yarn
- Git

## 许可证

内部项目，仅供授权使用。
