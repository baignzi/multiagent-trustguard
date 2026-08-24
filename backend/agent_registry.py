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
        db.commit()
    finally:
        db.close()


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
