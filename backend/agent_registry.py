"""
智能体注册与元数据管理服务
提供智能体注册、查询、树形结构展示等功能
"""
import os
import json
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Integer, Float, Text, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

import trust_engine

# 数据库配置
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agents.db")

Base = declarative_base()


class AgentMetadata(Base):
    """智能体元数据模型"""
    __tablename__ = "agent_metadata"
    
    id = Column(String, primary_key=True)
    agent_id = Column(String, index=True, nullable=False)
    agent_type = Column(String, nullable=False)
    trust_score = Column(Float, default=0.0)
    behavior_semantic_tags = Column(Text, nullable=True)
    communication_context = Column(Text, nullable=True)
    gnn_features = Column(JSON, nullable=True)
    node_topology_relations = Column(Text, nullable=True)
    anomaly_behavior_flag = Column(Integer, default=0)
    policy_binding = Column(String, nullable=True)
    audit_log_level = Column(String, default="INFO")
    data_version = Column(String, default="1.0.0")
    config_file = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BehaviorRecord(Base):
    """智能体行为证据记录（信任评估引擎的输入源）"""
    __tablename__ = "behavior_records"

    id = Column(String, primary_key=True)
    agent_id = Column(String, index=True, nullable=False)
    behavior_type = Column(String, nullable=False)   # task / message / resource
    score = Column(Float, nullable=False)            # 该次行为得分 0-1
    anomaly = Column(Integer, default=0)             # 是否为异常行为
    ts = Column(DateTime, default=datetime.utcnow)


class Policy(Base):
    """防御策略模型（策略编排平台）"""
    __tablename__ = "policies"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    rule_type = Column(String, nullable=False)       # threshold / rate_limit / anomaly_detect
    params = Column(JSON, default=dict)              # 策略参数
    enabled = Column(Integer, default=1)             # 1=启用 0=禁用
    priority = Column(Integer, default=0)            # 优先级，数字越大越优先
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# 初始化数据库
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed_demo_data():
    """初始化演示数据：若库为空，写入若干智能体及其行为证据，使信任引擎可被真实驱动。"""
    db = SessionLocal()
    try:
        if db.query(AgentMetadata).first():
            return
        now = datetime.utcnow()
        demo = [
            {"agent_id": "validator", "agent_type": "validator", "degree": 18, "centrality": 0.82, "consensus": 0.78, "anomaly": 0},
            {"agent_id": "auditor", "agent_type": "auditor", "degree": 15, "centrality": 0.75, "consensus": 0.80, "anomaly": 0},
            {"agent_id": "router", "agent_type": "router", "degree": 9, "centrality": 0.55, "consensus": 0.62, "anomaly": 0},
            {"agent_id": "anomaly-detector", "agent_type": "anomaly-detector", "degree": 21, "centrality": 0.88, "consensus": 0.70, "anomaly": 0},
            {"agent_id": "score-calculator", "agent_type": "score-calculator", "degree": 12, "centrality": 0.66, "consensus": 0.73, "anomaly": 0},
            {"agent_id": "fhir-adapter", "agent_type": "fhir-adapter", "degree": 6, "centrality": 0.40, "consensus": 0.58, "anomaly": 1},
            {"agent_id": "consent-manager", "agent_type": "consent-manager", "degree": 7, "centrality": 0.48, "consensus": 0.65, "anomaly": 0},
            {"agent_id": "ml-inference", "agent_type": "ml-inference", "degree": 14, "centrality": 0.70, "consensus": 0.72, "anomaly": 0},
            {"agent_id": "explanation-generator", "agent_type": "explanation-generator", "degree": 8, "centrality": 0.52, "consensus": 0.60, "anomaly": 0},
            {"agent_id": "sensor-collector", "agent_type": "sensor-collector", "degree": 11, "centrality": 0.61, "consensus": 0.55, "anomaly": 0},
            {"agent_id": "edge-processor", "agent_type": "edge-processor", "degree": 10, "centrality": 0.58, "consensus": 0.50, "anomaly": 2},
        ]
        for spec in demo:
            agent = AgentMetadata(
                id=f"ag_seed_{spec['agent_id']}",
                agent_id=spec["agent_id"],
                agent_type=spec["agent_type"],
                trust_score=round(80.0 + spec["centrality"] * 15, 1),
                behavior_semantic_tags=json.dumps([spec["agent_type"], "demo"]),
                communication_context="demo-cluster",
                gnn_features={"degree": spec["degree"], "centrality": spec["centrality"], "consensus": spec["consensus"]},
                node_topology_relations=f"{spec['agent_id']}->peer-1->peer-2",
                anomaly_behavior_flag=spec["anomaly"],
                policy_binding="default",
                audit_log_level="INFO",
                data_version="1.0.0",
                config_file="",
            )
            db.add(agent)
            # 为每个智能体生成近 7 天行为证据（确定性随机）
            rnd = random.Random(hash(spec["agent_id"]) & 0xffffffff)
            for d in range(7):
                day = now - timedelta(days=6 - d)
                for _ in range(rnd.randint(3, 6)):
                    btype = rnd.choice(["task", "message", "resource"])
                    base = {"validator": 0.9, "auditor": 0.92, "router": 0.8, "anomaly-detector": 0.88,
                            "score-calculator": 0.85, "fhir-adapter": 0.7, "consent-manager": 0.82,
                            "ml-inference": 0.86, "explanation-generator": 0.83, "sensor-collector": 0.78,
                            "edge-processor": 0.6}.get(spec["agent_id"], 0.8)
                    # 异常智能体评分随天数恶化，体现时间维度的信任漂移
                    drift = 0.0 if spec["anomaly"] == 0 else -0.04 * d * spec["anomaly"]
                    score = max(0.05, min(1.0, base + drift + rnd.uniform(-0.1, 0.1)))
                    db.add(BehaviorRecord(
                        id=f"bh_{spec['agent_id']}_{d}_{_}",
                        agent_id=spec["agent_id"],
                        behavior_type=btype,
                        score=round(score, 3),
                        anomaly=1 if (spec["anomaly"] >= 2 and rnd.random() < 0.4) else 0,
                        ts=day + timedelta(hours=rnd.randint(0, 23), minutes=rnd.randint(0, 59)),
                    ))
        _seed_policies(db)
        db.commit()
    finally:
        db.close()


def _seed_policies(db: Session):
    """初始化默认防御策略。"""
    if db.query(Policy).first():
        return
    defaults = [
        Policy(
            id="pol_baseline_threshold",
            name="基线信任阈值",
            description="信任分低于 60 分触发告警并建议人工复核",
            rule_type="threshold",
            params={"threshold": 60, "action": "alert"},
            enabled=1,
            priority=100,
        ),
        Policy(
            id="pol_rate_limit",
            name="异常行为限速",
            description="5 分钟内异常行为超过 3 次则临时隔离该智能体",
            rule_type="rate_limit",
            params={"window_minutes": 5, "max_anomalies": 3, "action": "quarantine"},
            enabled=1,
            priority=90,
        ),
        Policy(
            id="pol_anomaly_detect",
            name="行为突变检测",
            description="检测任务/消息/资源三类行为得分的突变",
            rule_type="anomaly_detect",
            params={"sensitivity": 0.8, "min_drop": 0.2},
            enabled=1,
            priority=80,
        ),
    ]
    db.add_all(defaults)


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_demo_data()
    # 确保策略表存在默认数据（兼容已有数据库升级场景）
    db = SessionLocal()
    try:
        _seed_policies(db)
        db.commit()
    finally:
        db.close()
    yield


app = FastAPI(title="智能体注册与元数据管理服务", version="1.0.0", lifespan=lifespan)


class AgentTreeItem(BaseModel):
    """智能体树节点"""
    id: str
    name: str
    children: Optional[List["AgentTreeItem"]] = None
    button: Optional[Dict[str, Any]] = None


class AgentRegisterRequest(BaseModel):
    """智能体注册请求"""
    agent_id: str
    agent_type: str
    behavior_semantic_tags: List[str]
    communication_context: str
    gnn_features: Dict[str, Any]
    node_topology_relations: str
    anomaly_behavior_flag: int
    policy_binding: str
    audit_log_level: str
    data_version: str
    config_file: str


class AgentDetailResponse(BaseModel):
    """智能体详情响应"""
    agent_id: str
    registered_at: str
    trust_score: float
    behavior_summary: str
    trust_evolution: List[Dict[str, Any]]
    explanation_tags: List[str]
    gnn_explanation: str
    gnn_subgraph_scores: Dict[str, float]


class PolicyItem(BaseModel):
    """防御策略项"""
    id: str
    name: str
    description: str
    rule_type: str
    params: Dict[str, Any]
    enabled: int
    priority: int


class PolicyCreateRequest(BaseModel):
    """创建策略请求"""
    name: str
    description: str
    rule_type: str
    params: Dict[str, Any]
    priority: int


@app.get("/api/tree", response_model=List[AgentTreeItem])
def get_agent_tree(db: Session = Depends(get_db)):
    """获取智能体组织结构树（写入数据库的 agent 也会出现）"""
    # 模拟分层智能体树（域/集群/角色分组）
    domains = ["finance-domain", "healthcare-domain", "iot-cluster"]
    clusters = {
        "finance-domain": ["core-banking", "risk-analytics"],
        "healthcare-domain": ["ehr-sync", "diagnosis-assist"]
    }
    roles = {
        "core-banking": ["validator", "auditor", "router"],
        "risk-analytics": ["anomaly-detector", "score-calculator"],
        "ehr-sync": ["fhir-adapter", "consent-manager"],
        "diagnosis-assist": ["ml-inference", "explanation-generator"],
        "iot-cluster": ["sensor-collector", "edge-processor"]
    }

    # 收集预置 agent_id，用于去重
    preset_ids = {r for rs in roles.values() for r in rs}

    tree = []
    for i, domain in enumerate(domains, 1):
        domain_node = {"id": f"d{i}", "name": domain, "children": []}
        if domain in clusters:
            for j, cluster in enumerate(clusters[domain], 1):
                cluster_node = {"id": f"c{i}-{j}", "name": cluster, "children": []}
                if cluster in roles:
                    for k, role in enumerate(roles[cluster], 1):
                        cluster_node["children"].append({"id": role, "name": role, "leaf": True})
                domain_node["children"].append(cluster_node)
        tree.append(domain_node)

    # 追加一个 "custom-agents" cluster，含所有通过 /api/agent/register 注册的智能体
    db_agents = db.query(AgentMetadata).filter(~AgentMetadata.agent_id.in_(preset_ids)).all()
    if db_agents:
        custom_cluster = {
            "id": "c-custom",
            "name": "custom-agents",
            "children": [{"id": ag.agent_id, "name": ag.agent_id, "leaf": True} for ag in db_agents]
        }
        custom_domain = {"id": "d-custom", "name": "custom-domain", "children": [custom_cluster]}
        tree.append(custom_domain)

    # 顶层辅助节点
    tree.append({"id": "a1", "name": "global-trust-graph",
                 "button": {"text": "查看", "icon": "/static/images/view.png"}})
    tree.append({"id": "a2", "name": "audit-log-aggregator"})

    return tree


@app.get("/api/agent/{agent_id}", response_model=AgentDetailResponse)
def get_agent_detail(agent_id: str, db: Session = Depends(get_db)):
    """获取智能体详细信息（信任分与解释由动态信任评估引擎实时计算）"""
    db_agent = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 拉取该智能体的行为证据，交由信任评估引擎计算
    behaviors = [
        {"type": b.behavior_type, "score": b.score, "ts": b.ts, "anomaly": b.anomaly}
        for b in db.query(BehaviorRecord).filter(BehaviorRecord.agent_id == agent_id).all()
    ]

    trust_score = trust_engine.calculate_trust_score(behaviors, last_update=db_agent.updated_at)
    if trust_score is None:
        trust_score = db_agent.trust_score  # 无行为证据时回退基线分

    trust_evolution = trust_engine.trust_evolution_series(behaviors,  days=7)

    gnn = trust_engine.generate_gnn_explanation(
        gnn_features=db_agent.gnn_features or {},
        topology=db_agent.node_topology_relations,
        anomaly_flag=db_agent.anomaly_behavior_flag,
    )

    return AgentDetailResponse(
        agent_id=db_agent.agent_id,
        registered_at=db_agent.created_at.isoformat(),
        trust_score=trust_score,
        behavior_summary=f"Type: {db_agent.agent_type}. Active in {db_agent.communication_context or 'default context'}.",
        trust_evolution=trust_evolution,
        explanation_tags=gnn["tags"],
        gnn_explanation=gnn["explanation"],
        gnn_subgraph_scores=gnn["subgraph_scores"],
    )


@app.get("/api/trust/score/{agent_id}")
def get_trust_score(agent_id: str, db: Session = Depends(get_db)):
    """信任评分接口：返回动态信任分与融合明细"""
    db_agent = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    behaviors = [
        {"type": b.behavior_type, "score": b.score, "ts": b.ts, "anomaly": b.anomaly}
        for b in db.query(BehaviorRecord).filter(BehaviorRecord.agent_id == agent_id).all()
    ]
    score = trust_engine.calculate_trust_score(behaviors, last_update=db_agent.updated_at)
    if score is None:
        score = db_agent.trust_score
    evidence = trust_engine.aggregate_evidence(behaviors)
    return {"agent_id": agent_id, "trust_score": score, "evidence": evidence}


@app.get("/api/trust/explain/{agent_id}")
def get_trust_explanation(agent_id: str, db: Session = Depends(get_db)):
    """图可解释性接口：返回 GNN 子图得分与标签"""
    db_agent = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    gnn = trust_engine.generate_gnn_explanation(
        gnn_features=db_agent.gnn_features or {},
        topology=db_agent.node_topology_relations,
        anomaly_flag=db_agent.anomaly_behavior_flag,
    )
    return {"agent_id": agent_id, **gnn}


@app.post("/api/agent/register")
def register_agent(req: AgentRegisterRequest, db: Session = Depends(get_db)):
    """注册新智能体"""
    existing = db.query(AgentMetadata).filter(AgentMetadata.agent_id == req.agent_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Agent ID already registered")
    
    # 模拟身份验证和基线建模
    base_score = 85.0
    if "anomaly-detector" in req.agent_type.lower():
        base_score += 3.0
    if "auditor" in req.agent_type.lower():
        base_score += 5.0
    
    # 持久化
    agent = AgentMetadata(
        id=f"ag_{int(datetime.utcnow().timestamp())}_{req.agent_id}",
        agent_id=req.agent_id,
        agent_type=req.agent_type,
        trust_score=round(base_score, 1),
        behavior_semantic_tags=json.dumps(req.behavior_semantic_tags),
        communication_context=req.communication_context,
        gnn_features=req.gnn_features,
        node_topology_relations=req.node_topology_relations,
        anomaly_behavior_flag=req.anomaly_behavior_flag,
        policy_binding=req.policy_binding,
        audit_log_level=req.audit_log_level,
        data_version=req.data_version,
        config_file=req.config_file
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    return {"status": "success", "agent_id": agent.agent_id, "trust_score": agent.trust_score}


@app.get("/api/chart/metadata-monitoring")
def get_metadata_monitoring_chart():
    """获取元数据监控图表数据"""
    now = datetime.utcnow()
    hours = [(now - timedelta(hours=i)).strftime("%H:%M") for i in range(6, -1, -1)]
    
    # 模拟实时指标
    scores = [85, 82, 88, 90, 87, 85, 83]
    anomalies = [3, 5, 2, 1, 4, 3, 2]
    integrity = [92, 90, 95, 97, 94, 93, 91]
    activity = [78, 82, 85, 88, 86, 84, 80]
    
    return {
        "title": "分布式多智能体系统元数据监控仪表板",
        "chart_type": "line",
        "xAxis": {
            "type": "category",
            "data": hours,
            "name": "时间",
            "nameLocation": "middle",
            "nameGap": 30
        },
        "yAxis": {
            "type": "value",
            "name": "指标值",
            "nameLocation": "middle",
            "nameGap": 40
        },
        "series": [
            {"name": "信任度评分", "data": scores, "type": "line", "itemStyle": {"color": "#52c41a"}},
            {"name": "异常行为检测", "data": anomalies, "type": "line", "itemStyle": {"color": "#f5222d"}},
            {"name": "元数据完整性", "data": integrity, "type": "line", "itemStyle": {"color": "#1890ff"}},
            {"name": "节点活跃度", "data": activity, "type": "line", "itemStyle": {"color": "#722ed1"}}
        ],
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "cross"}},
        "legend": {"top": "bottom", "data": ["信任度评分", "异常行为检测", "元数据完整性", "节点活跃度"]},
        "grid": {"left": "3%", "right": "4%", "bottom": "15%", "containLabel": True}
    }


# -----------------------------------------------------------------------------
# 跨智能体交互图谱
# -----------------------------------------------------------------------------

@app.get("/api/graph/interaction")
def get_interaction_graph(db: Session = Depends(get_db)):
    """
    获取跨智能体交互图谱。

    节点来自 AgentMetadata；边基于共同通信上下文与 node_topology_relations 构建，
    并标记涉及异常节点的可疑连边。
    """
    agents = db.query(AgentMetadata).all()
    agent_ids = {ag.agent_id for ag in agents}

    nodes = []
    for ag in agents:
        nodes.append({
            "id": ag.agent_id,
            "type": ag.agent_type,
            "trust_score": ag.trust_score,
            "anomaly": ag.anomaly_behavior_flag or 0,
            "degree": (ag.gnn_features or {}).get("degree", 0),
        })

    links = []

    # 1. 共同通信上下文 => 弱连接
    context_groups: Dict[str, List[str]] = {}
    for ag in agents:
        ctx = ag.communication_context or "default"
        context_groups.setdefault(ctx, []).append(ag.agent_id)
    for ctx, ids in context_groups.items():
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                links.append({
                    "source": ids[i],
                    "target": ids[j],
                    "relation": "same-context",
                    "context": ctx,
                    "weight": 0.25,
                })

    # 2. 拓扑关系 => 强连接
    for ag in agents:
        topo = ag.node_topology_relations or ""
        if "->" in topo:
            parts = [p.strip() for p in topo.split("->")]
            for target in parts[1:]:
                target_id = target.split("-")[0].strip()
                if target_id in agent_ids and target_id != ag.agent_id:
                    links.append({
                        "source": ag.agent_id,
                        "target": target_id,
                        "relation": "topology",
                        "weight": 0.75,
                    })

    # 去重边
    seen = set()
    unique_links = []
    for link in links:
        key = tuple(sorted([link["source"], link["target"], link["relation"]]))
        if key not in seen:
            seen.add(key)
            unique_links.append(link)
    links = unique_links

    # 节点影响力（简化 PageRank：基于入度归一化）
    node_scores = {n["id"]: {"in_degree": 0, "out_degree": 0, "influence": 0.0} for n in nodes}
    for link in links:
        node_scores[link["source"]]["out_degree"] += 1
        node_scores[link["target"]]["in_degree"] += 1
    max_in = max((v["in_degree"] for v in node_scores.values()), default=1) or 1
    for nid, v in node_scores.items():
        v["influence"] = round(0.25 + 0.75 * v["in_degree"] / max_in, 3)

    # 可疑连边：连接异常节点或低信任分节点
    anomaly_ids = {n["id"] for n in nodes if n["anomaly"] > 0}
    suspicious = []
    for link in links:
        src = link["source"]
        tgt = link["target"]
        if src in anomaly_ids or tgt in anomaly_ids:
            suspicious.append({
                "source": src,
                "target": tgt,
                "relation": link["relation"],
                "reason": "connects-to-anomaly",
            })

    return {
        "nodes": nodes,
        "links": links,
        "node_scores": node_scores,
        "suspicious_edges": suspicious,
        "summary": {
            "node_count": len(nodes),
            "edge_count": len(links),
            "anomaly_count": len(anomaly_ids),
            "suspicious_edge_count": len(suspicious),
        },
    }


# -----------------------------------------------------------------------------
# 防御策略编排平台
# -----------------------------------------------------------------------------

@app.get("/api/policies", response_model=List[PolicyItem])
def list_policies(db: Session = Depends(get_db)):
    """列出所有防御策略。"""
    return [
        PolicyItem(**{k: getattr(p, k) for k in PolicyItem.model_fields})
        for p in db.query(Policy).order_by(Policy.priority.desc()).all()
    ]


@app.post("/api/policies", response_model=PolicyItem)
def create_policy(req: PolicyCreateRequest, db: Session = Depends(get_db)):
    """创建新策略。"""
    pid = f"pol_{int(datetime.utcnow().timestamp())}_{random.randint(1000, 9999)}"
    p = Policy(
        id=pid,
        name=req.name,
        description=req.description,
        rule_type=req.rule_type,
        params=req.params,
        enabled=1,
        priority=req.priority,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return PolicyItem(**{k: getattr(p, k) for k in PolicyItem.model_fields})


@app.patch("/api/policies/{policy_id}", response_model=PolicyItem)
def update_policy(policy_id: str, body: Dict[str, Any], db: Session = Depends(get_db)):
    """更新策略（启用/禁用、参数、优先级）。"""
    p = db.query(Policy).filter(Policy.id == policy_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    if "enabled" in body:
        p.enabled = 1 if body["enabled"] else 0
    if "params" in body:
        p.params = body["params"]
    if "priority" in body:
        p.priority = body["priority"]
    db.commit()
    db.refresh(p)
    return PolicyItem(**{k: getattr(p, k) for k in PolicyItem.model_fields})


@app.delete("/api/policies/{policy_id}")
def delete_policy(policy_id: str, db: Session = Depends(get_db)):
    """删除策略。"""
    p = db.query(Policy).filter(Policy.id == policy_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(p)
    db.commit()
    return {"status": "ok"}


# -----------------------------------------------------------------------------
# 全链路溯源看板
# -----------------------------------------------------------------------------

@app.get("/api/audit/trace/{agent_id}")
def get_audit_trace(agent_id: str, db: Session = Depends(get_db)):
    """
    获取指定智能体的全链路审计时间线。

    时间线包括：注册事件、行为证据事件、信任评估事件。
    """
    agent = db.query(AgentMetadata).filter(AgentMetadata.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    behaviors = (
        db.query(BehaviorRecord)
        .filter(BehaviorRecord.agent_id == agent_id)
        .order_by(BehaviorRecord.ts)
        .all()
    )

    events = [
        {
            "ts": agent.created_at.isoformat(),
            "type": "register",
            "level": "INFO",
            "message": f"智能体 {agent_id} 注册成功，初始信任分 {agent.trust_score}",
            "score": None,
            "anomaly": 0,
        }
    ]

    for b in behaviors:
        events.append({
            "ts": b.ts.isoformat(),
            "type": b.behavior_type,
            "level": "WARNING" if b.anomaly else "INFO",
            "message": f"{b.behavior_type} 行为得分 {b.score}" + ("，触发异常标记" if b.anomaly else ""),
            "score": b.score,
            "anomaly": b.anomaly,
        })

    trust_score = trust_engine.calculate_trust_score(
        [{"type": b.behavior_type, "score": b.score, "ts": b.ts, "anomaly": b.anomaly} for b in behaviors],
        last_update=agent.updated_at,
    )
    if trust_score is not None:
        events.append({
            "ts": agent.updated_at.isoformat(),
            "type": "trust-evaluation",
            "level": "WARNING" if trust_score < 70 else "INFO",
            "message": f"动态信任评估完成，当前信任分 {trust_score}",
            "score": trust_score,
            "anomaly": 0,
        })

    events.sort(key=lambda x: x["ts"])
    return {
        "agent_id": agent_id,
        "event_count": len(events),
        "anomaly_count": sum(1 for e in events if e["anomaly"]),
        "events": events,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
