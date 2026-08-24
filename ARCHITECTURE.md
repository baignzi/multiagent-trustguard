# 多智能体恶意行为防御与信任评估系统 - 技术架构文档

## 1. 系统概述

### 1.1 业务目标
本系统面向分布式多智能体协同环境，提供恶意行为实时识别与动态信任评估能力，有效应对越权调用、虚假响应、协同欺骗等高级威胁，全面提升系统鲁棒性与可审计性。

### 1.2 核心功能
- **行为日志解析**: 统一采集各智能体的交互记录、资源访问请求、消息响应内容
- **异常模式挖掘**: 序列异常检测、聚类分析对个体行为实时评分
- **跨智能体交互图谱**: 有向图结构建模，发现协同欺骗等群体性异常模式
- **信任评估引擎**: 时间衰减因子 + 证据权重融合算法生成动态信任分
- **全链路溯源视图**: 反向追踪攻击源、还原攻击链条

### 1.3 技术特点
- 支持异构智能体接入
- 内置轻量级GNN行为图谱引擎
- 采用贝叶斯+D-S证据理论融合的信任评估模型
- 提供低代码策略编排界面
- 全链路操作留痕与国密SM4加密审计日志

---

## 2. 总体架构

### 2.1 架构图（ASCII）

```
                        ┌─────────────────────────────┐
用户/管理员 ───────────→ │      Web前端 (React)         │
                        │   http://localhost:3000      │
                        └──────────────┬──────────────┘
                                       |
                    ┌──────────────────┼──────────────────┐
                    v                  v                   v
        ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐
        │ Agent Registry   │  │Detection Center│  │ Trust Evaluation│
        │   Service        │  │    Service     │  │     Engine      │
        │  (FastAPI:8000)  │  │  (Flask:5000)  │  │   (Python Lib)  │
        └────────┬─────────┘  └───────┬────────┘  └────────┬────────┘
                 |                     |                    |
        ┌────────▼─────────────────────▼────────────────────▼────────┐
        │                    数据持久层                                │
        │  ┌──────────────┐  ┌──────────┐  ┌──────────────────────┐  │
        │  │ SQLite/MySQL │  │  Redis   │  │  GNN Model Storage   │  │
        │  │ (元数据存储)  │  │  (缓存)   │  │  (图特征向量)         │  │
        │  └──────────────┘  └──────────┘  └──────────────────────┘  │
        └────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件说明

| 组件 | 职责 | 技术选型 | 部署方式 |
|------|------|---------|---------|
| Web前端 | UI展示、用户交互 | React 18 + Markdown渲染 | 独立SPA应用 |
| Agent Registry | 智能体注册、元数据管理、树形结构查询 | FastAPI + SQLAlchemy | Python服务 |
| Detection Center | 行为监控、异常检测、报告生成 | Flask + CORS | Python服务 |
| Trust Engine | 信任评分计算、GNN推理 | Python库(NumPy/SciPy) | 内嵌模块 |
| Database | 持久化存储智能体元数据、行为日志 | SQLite(开发)/MySQL(生产) | 本地/远程 |
| Cache | 高频数据缓存、会话管理 | Redis | 可选 |

---

## 3. 关键模块设计

### 3.1 智能体注册与元数据管理模块

#### 架构图
```
用户请求
    |
    v
API Gateway（鉴权/限流/路由）
    |
    v
Agent Registry Service
    |               ├── GET /api/tree          → 返回组织结构树
    |               ├── GET /api/agent/{id}    → 返回智能体详情
    |               └── POST /api/agent/register → 注册新智能体
    |
    v
SQLAlchemy ORM
    |
    v
SQLite/MySQL数据库
    ├── agent_metadata表（主数据）
    └── behavior_logs表（行为日志）
```

#### 接口设计

**注册智能体**
```
POST /api/agent/register
Request: {
  "agent_id": "agent-001",
  "agent_type": "validator",
  "behavior_semantic_tags": ["identity", "encrypted"],
  "communication_context": "finance-domain",
  "gnn_features": {"degree": 5, "centrality": 0.8},
  "node_topology_relations": "cluster-01",
  "anomaly_behavior_flag": 0,
  "policy_binding": "policy-v1",
  "audit_log_level": "INFO",
  "data_version": "1.0.0",
  "config_file": "/path/to/config.json"
}
Response: {
  "status": "success",
  "agent_id": "agent-001",
  "trust_score": 85.0
}
错误码: 400-Agent ID已存在, 422-参数校验失败
```

**获取智能体详情**
```
GET /api/agent/{agent_id}
Response: {
  "agent_id": "agent-001",
  "registered_at": "2024-06-12T10:00:00Z",
  "trust_score": 87.5,
  "behavior_summary": "Type: validator. Active in finance-domain.",
  "trust_evolution": [
    {"date": "2024-06-06", "score": 85.0, "anomalies": 5},
    {"date": "2024-06-07", "score": 86.2, "anomalies": 4},
    ...
  ],
  "explanation_tags": ["GNN-degree-centrality", "trust-propagation-path"],
  "gnn_explanation": "Trust score derived via GraphSAGE..."
}
```

#### 数据模型

**表名: agent_metadata**

| 字段 | 类型 | 必填 | 索引 | 说明 |
|------|------|------|------|------|
| id | VARCHAR(128) | 是 | PK | 主键UUID |
| agent_id | VARCHAR(64) | 是 | UNI | 智能体唯一标识 |
| agent_type | VARCHAR(32) | 是 | IDX | 智能体类型 |
| trust_score | FLOAT | 是 | - | 当前信任评分(0-100) |
| behavior_semantic_tags | TEXT | 否 | - | JSON数组:行为语义标签 |
| communication_context | TEXT | 否 | - | 通信上下文描述 |
| gnn_features | JSON | 否 | - | GNN特征向量 |
| node_topology_relations | TEXT | 否 | - | 节点拓扑关系 |
| anomaly_behavior_flag | INT | 是 | IDX | 0-正常 1-轻度异常 2-严重异常 |
| policy_binding | VARCHAR(64) | 否 | - | 绑定的安全策略ID |
| audit_log_level | VARCHAR(16) | 是 | - | DEBUG/INFO/WARNING/ERROR |
| data_version | VARCHAR(16) | 是 | - | 数据版本号 |
| config_file | TEXT | 否 | - | 配置文件路径 |
| created_at | DATETIME | 是 | - | 创建时间 |
| updated_at | DATETIME | 是 | - | 更新时间 |

#### 关键逻辑
- **并发控制**: 基于agent_id的唯一约束防止重复注册
- **信任评分初始化**: 根据智能体类型分配基线分数(anomaly-detector +3, auditor +5)
- **幂等设计**: 注册前检查agent_id是否已存在

---

### 3.2 恶意行为实时检测中心模块

#### 架构图
```
实时监控数据流
    |
    v
Detection Center Service
    |               ├── GET /api/v1/left-tree       → 集群树
    |               ├── GET /api/v1/right-tree      → 风险实体树
    |               ├── GET /api/v1/behavior-table  → 行为流表格
    |               ├── GET /api/v1/detection-form-schema → 表单配置
    |               ├── GET /api/v1/markdown-report → 检测报告
    |               └── GET /api/v1/chart/*         → 图表数据
    |
    v
Mock Data Layer (模拟真实查询)
    ├── PostgreSQL (行为日志)
    └── Neo4j (图谱关系)
```

#### 核心数据结构

**行为流表格数据**
```json
{
  "rows": [
    {
      "timestamp": "2024-06-12 14:25:11",
      "subject_id": "Agent-045",
      "action_type": "sync",
      "semantic_tag": "state",
      "risk_score": 78.5,
      "status": "alert"
    }
  ]
}
```

**检测报告Markdown**
```markdown
## 实时检测报告

**攻击链路还原**  
`Agent-012 → Agent-045 → Agent-088`：身份令牌被复用

**信任衰减路径**  
`初始信任=0.92 → 0.68（+3跳）→ 0.31（+6跳）→ 0.14（+9跳）`

**关键行为证据**  
- Agent-045 发起 17次非预期state_sync请求（基线：≤2次/分钟）
- 语义标签偏离度：intent="reconfigure" vs 实际执行 "bypass_auth"（置信度 98.3%）
```

---

### 3.3 动态信任评估引擎（已实现，见 backend/trust_engine.py）

> 本节算法已在 `backend/trust_engine.py` 中落地为纯函数模块，并由 `backend/agent_registry.py`
> 的 `/api/agent/{id}`、`/api/trust/score/{id}`、`/api/trust/explain/{id}` 调用。文档公式与代码保持一致。

#### 信任评分算法

```python
def calculate_trust_score(agent_id, time_window="7d"):
    """
    基于时间衰减因子与证据权重融合的信任评分算法
    
    公式:
    trust_score = Σ(w_i * evidence_i) * decay_factor(t)
    
    其中:
    - w_i: 第i类行为的权重(任务完成率0.3, 消息真实性0.4, 资源消耗合理性0.3)
    - evidence_i: 第i类行为的证据值(0-1)
    - decay_factor(t) = e^(-λ*t), λ=0.1, t为距当前的天数
    """
    # 1. 收集近期行为证据
    behaviors = fetch_behaviors(agent_id, time_window)
    
    # 2. 分类加权
    task_completion = sum(b.score for b in behaviors if b.type == "task") / len(task_behaviors)
    message_authenticity = sum(b.score for b in behaviors if b.type == "message") / len(msg_behaviors)
    resource_usage = sum(b.score for b in behaviors if b.type == "resource") / len(res_behaviors)
    
    # 3. 时间衰减
    decay_factor = math.exp(-0.1 * days_since_last_update)
    
    # 4. 融合计算
    raw_score = 0.3 * task_completion + 0.4 * message_authenticity + 0.3 * resource_usage
    final_score = raw_score * decay_factor * 100
    
    return min(100, max(0, final_score))
```

#### GNN解释标签生成

```python
def generate_gnn_explanation(agent_id):
    """
    基于GraphSAGE生成信任评分解释
    
    输出标签:
    - GNN-degree-centrality: 节点度中心性
    - trust-propagation-path: 信任传播路径
    - cross-domain-consensus: 跨域共识度
    - behavior-drift-detected: 行为漂移检测(仅当anomaly_flag>0时)
    """
    subgraphs = extract_key_subgraphs(agent_id)
    weights = [0.4, 0.35, 0.25]  # 子图权重
    
    score = sum(w * gnn_subgraph_score(sub) for w, sub in zip(weights, subgraphs))
    
    tags = ["GNN-degree-centrality", "trust-propagation-path", "cross-domain-consensus"]
    if has_anomaly(agent_id):
        tags.append("behavior-drift-detected")
    
    return {
        "score": score,
        "tags": tags,
        "explanation": f"Trust score derived via GraphSAGE on {len(tags)} key subgraphs"
    }
```

---

## 4. 技术选型

### 4.1 选型决策

| 决策点 | 方案A | 方案B | 结论 |
|--------|-------|-------|------|
| Web框架 | FastAPI | Django REST | FastAPI(异步高性能) |
| 检测服务 | Flask | FastAPI | Flask(轻量快速原型) |
| ORM | SQLAlchemy | Peewee | SQLAlchemy(生态成熟) |
| 数据库 | MySQL 8.0 | PostgreSQL 15 | MySQL 8.0(团队经验) |
| 前端框架 | React 18 | Vue 3 | React 18(组件生态丰富) |
| 图表库 | ECharts | Chart.js | ECharts(中文支持好) |
| 缓存 | Redis | Memcached | Redis(数据结构丰富) |

### 4.2 选型理由

**FastAPI选择原因**:
- 原生异步支持，适合高并发场景
- 自动生成Swagger文档，降低API维护成本
- Pydantic集成，数据验证简洁

**放弃Django原因**:
- 重量级框架，启动慢
- ORM迁移成本高

**MySQL选择原因**:
- 团队已有运维经验
- 事务支持完善
- 社区活跃，问题易排查

---

## 5. 性能与容量估算

### 5.1 流量模型
- 智能体数量: 100-500个
- 日均行为日志: 10万条
- 峰值QPS: 500（按20%集中在2小时算）
- 信任评估频率: 每5分钟一次

### 5.2 资源估算

| 服务 | 实例数 | 配置 | 峰值CPU | 峰值内存 |
|------|--------|------|---------|---------|
| Agent Registry | 2 | 2C4G | 40% | 50% |
| Detection Center | 2 | 2C4G | 50% | 60% |
| MySQL | 1主1从 | 4C16G | 30% | 50% |
| Redis | 单节点 | 2C8G | 20% | 40% |

### 5.3 压测方案
- 工具: Locust/JMeter
- 场景: 并发注册100个智能体、查询1000次/秒
- 指标: P99延迟 < 200ms, 错误率 < 0.1%

---

## 6. 安全与合规

### 6.1 安全措施
- API鉴权: JWT Token
- 数据传输: HTTPS/TLS 1.3
- 敏感数据: 国密SM4加密存储
- 审计日志: 全链路操作留痕，不可篡改

### 6.2 合规要求
- 符合《网络安全法》数据留存要求(≥6个月)
- 满足等保2.0三级要求
- 支持GDPR数据删除请求

---

## 7. 风险与降级

### 7.1 风险清单

| 风险 | 概率 | 影响 | 降级方案 | 负责人 |
|------|------|------|---------|--------|
| 数据库主库宕机 | 低 | 严重 | 自动主从切换，30s内恢复 | DBA |
| GNN模型推理超时 | 中 | 中 | 返回缓存信任分，后台异步更新 | 后端 |
| 第三方接口超时 | 高 | 中 | 熔断降级，返回默认值 | 后端 |
| 前端ECharts加载失败 | 低 | 低 | 降级为纯文本表格展示 | 前端 |

### 7.2 降级层级
1. **L1**: 服务降级(返回缓存数据)
2. **L2**: 功能降级(关闭非核心功能)
3. **L3**: 只读模式(禁止写操作)
4. **L4**: 维护模式(提示系统维护中)

---

## 8. 实施计划

| 阶段 | 时间 | 交付物 | 负责人 |
|------|------|--------|--------|
| 方案评审 | MM.DD | 评审通过 | TL |
| 后端开发 | MM.DD - MM.DD | API服务完成 | 后端团队 |
| 前端开发 | MM.DD - MM.DD | UI界面完成 | 前端团队 |
| 联调测试 | MM.DD - MM.DD | 集成测试通过 | QA |
| 压测优化 | MM.DD - MM.DD | 压测报告 | SRE |
| 上线发布 | MM.DD | 线上版本 | PM |

---

## 9. 附录

### 9.1 术语表
- **GNN**: Graph Neural Network，图神经网络
- **SHAP**: SHapley Additive exPlanations，可解释AI方法
- **D-S证据理论**: Dempster-Shafer Theory，不确定性推理方法

### 9.2 参考资料
- 《多智能体安全白皮书 v2.3》
- FastAPI官方文档: https://fastapi.tiangolo.com/
- React官方文档: https://react.dev/
