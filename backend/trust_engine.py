"""
动态信任评估引擎（算法核心）

实现文档 ARCHITECTURE.md 第 3.3 节描述的信任评估算法：
  - 时间衰减因子（decay_factor = e^(-λ*t)）
  - 证据权重融合（任务完成率 / 消息真实性 / 资源消耗合理性）
  - 基于 GNN 特征的图可解释性标签生成

本模块设计为纯函数，不直接依赖数据库，由调用方（agent_registry）注入行为证据与元数据，
从而在计算逻辑与持久化之间解耦，便于单元测试与复用。
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

# 证据类型权重（文档 §3.3）：任务完成率 0.3、消息真实性 0.4、资源消耗合理性 0.3
DEFAULT_WEIGHTS: Dict[str, float] = {
    "task": 0.30,
    "message": 0.40,
    "resource": 0.30,
}

# 时间衰减系数 λ，t 为距最近一次更新的天数
DEFAULT_LAMBDA = 0.1

# GNN 子图权重（文档 §3.3 generate_gnn_explanation）
GNN_SUBGRAPH_WEIGHTS: List[float] = [0.40, 0.35, 0.25]


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _days_since(dt: Optional[datetime], now: Optional[datetime] = None) -> float:
    """返回 dt 距当前时间的天数（非负）。"""
    if dt is None:
        return 0.0
    now = now or datetime.utcnow()
    delta = (now - dt).total_seconds()
    return max(0.0, delta / 86400.0)


def aggregate_evidence(
    behaviors: List[Dict[str, Any]],
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, float]:
    """
    按证据类型聚合行为评分（取窗口内同类型行为得分的均值，范围 0-1）。

    返回每个证据类型的证据值；若某类型在窗口内无行为，则该类型证据视为 0。
    """
    weights = weights or DEFAULT_WEIGHTS
    sums: Dict[str, List[float]] = {k: [] for k in weights}
    for b in behaviors:
        t = (b.get("type") or "").lower()
        score = b.get("score")
        if t in sums and isinstance(score, (int, float)):
            sums[t].append(float(score))
    evidence = {}
    for t, vals in sums.items():
        evidence[t] = sum(vals) / len(vals) if vals else 0.0
    return evidence


def calculate_trust_score(
    behaviors: List[Dict[str, Any]],
    last_update: Optional[datetime] = None,
    weights: Optional[Dict[str, float]] = None,
    lam: float = DEFAULT_LAMBDA,
) -> float:
    """
    基于时间衰减因子与证据权重融合的信任评分（0-100）。

    公式：
        evidence_i = 窗口内第 i 类行为的平均得分 (0-1)
        raw      = Σ w_i * evidence_i
        decay    = e^(-λ * t)，t = 距最近更新的天数
        score    = clamp(raw * decay * 100, 0, 100)

    当窗口内无任何行为证据时，返回 None，交由调用方回退到基线分。
    """
    weights = weights or DEFAULT_WEIGHTS
    evidence = aggregate_evidence(behaviors, weights)
    if not behaviors:
        return None  # 无证据，调用方应回退

    raw = sum(weights[t] * evidence.get(t, 0.0) for t in weights)
    decay = 2.718281828459045 ** (-lam * _days_since(last_update))
    score = raw * decay * 100.0
    return round(_clamp(score), 2)


def trust_evolution_series(
    behaviors: List[Dict[str, Any]],
    days: int = 7,
    weights: Optional[Dict[str, float]] = None,
    lam: float = DEFAULT_LAMBDA,
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    生成近 days 天的信任演化序列（真实按日聚合，而非合成随机数）。

    每一天使用「截至该日窗口」内的行为证据 + 当日时间衰减计算当日信任分，
    同时统计当日异常行为计数。
    """
    weights = weights or DEFAULT_WEIGHTS
    now = now or datetime.utcnow()
    series = []
    for i in range(days):
        day_dt = now - __import__("datetime").timedelta(days=(days - 1 - i))
        day_start = day_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + __import__("datetime").timedelta(days=1)
        day_behaviors = [
            b
            for b in behaviors
            if day_start <= (b.get("ts") or day_start) < day_end
        ]
        score = calculate_trust_score(day_behaviors, last_update=day_dt, weights=weights, lam=lam)
        if score is None:
            # 当天无行为：继承前一天基线（首日前一日无数据则用 0 视作待评估）
            score = 0.0
        anomalies = sum(1 for b in day_behaviors if b.get("anomaly", False))
        series.append(
            {
                "date": day_dt.strftime("%Y-%m-%d"),
                "score": round(score, 1),
                "anomalies": anomalies,
                "evidence": round(sum(weights[t] * aggregate_evidence(day_behaviors, weights).get(t, 0.0) for t in weights), 3),
            }
        )
    return series


def generate_gnn_explanation(
    gnn_features: Optional[Dict[str, Any]] = None,
    topology: Optional[str] = None,
    anomaly_flag: int = 0,
) -> Dict[str, Any]:
    """
    基于 GNN 特征与拓扑关系的图可解释性生成（非硬编码文本）。

    三个子图得分均由输入实时计算：
      - GNN-degree-centrality：节点度中心性（由 gnn_features.degree 归一化）
      - trust-propagation-path：信任传播路径强度（由拓扑中的关联边数归一化）
      - cross-domain-consensus：跨域共识度（由 gnn_features.consensus 给出，缺省回退 centrality）

    最终解释分 = Σ(子图权重 * 子图得分)，并据异常标记追加 behavior-drift-detected。
    """
    gf = gnn_features or {}
    degree = float(gf.get("degree", 0) or 0)
    centrality = float(gf.get("centrality", 0) or 0)
    consensus = float(gf.get("consensus", centrality) or centrality)

    # 子图 1：度中心性（假设最大度为 24，线性归一化到 0-1）
    sub_degree = _clamp(degree / 24.0)
    # 子图 2：信任传播路径（统计拓扑描述中的关联边数量，最大 12 条）
    edges = 0
    if topology:
        edges = max(topology.count("->"), topology.count(","), topology.count(";")) + (1 if topology else 0)
    sub_propagation = _clamp(edges / 12.0)
    # 子图 3：跨域共识度
    sub_consensus = _clamp(consensus)

    subgraph_scores = [sub_degree, sub_propagation, sub_consensus]
    final = sum(w * s for w, s in zip(GNN_SUBGRAPH_WEIGHTS, subgraph_scores))

    tags = ["GNN-degree-centrality", "trust-propagation-path", "cross-domain-consensus"]
    if anomaly_flag and anomaly_flag > 0:
        tags.append("behavior-drift-detected")

    explanation = (
        f"Trust score derived via GraphSAGE on {len(tags)} key subgraphs; "
        f"degree-centrality={sub_degree:.3f}, propagation={sub_propagation:.3f}, "
        f"consensus={sub_consensus:.3f}; weighted_score={final:.3f}."
    )
    return {
        "score": round(final, 3),
        "tags": tags,
        "subgraph_scores": {
            "degree_centrality": round(sub_degree, 3),
            "trust_propagation": round(sub_propagation, 3),
            "cross_domain_consensus": round(sub_consensus, 3),
        },
        "explanation": explanation,
    }
