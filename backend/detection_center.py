"""
恶意行为实时检测中心服务
提供行为监控、异常检测、检测报告等功能
"""
import os
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


def fetch_left_tree_data():
    """获取左侧树形数据（智能体集群）"""
    return {
        "tree_data": [
            {
                "id": "cluster-01",
                "name": "金融交易集群",
                "children": [
                    {
                        "id": "node-01",
                        "name": "支付网关Agent",
                        "children": [
                            {"id": "ev-001", "name": "支付签名验证异常"}
                        ]
                    },
                    {
                        "id": "node-02",
                        "name": "风控策略Agent",
                        "button": {"text": "查看规则", "icon": "/static/icons/rule.svg"},
                        "detail": {
                            "title": "风控策略Agent 检测规则",
                            "type": "rule",
                            "summary": "当前节点共绑定 4 条实时检测规则，覆盖身份一致性、行为速率、信任阈值与图异常传播。",
                            "items": [
                                {
                                    "rule_id": "R-101",
                                    "rule_name": "身份令牌复用检测",
                                    "description": "同一身份令牌在 60 秒内被超过 2 个不同智能体使用，判定为冒用。",
                                    "threshold": "token_reuse_count >= 2 / 60s",
                                    "action": "告警 + 重认证",
                                    "status": "enabled",
                                    "hits": 12
                                },
                                {
                                    "rule_id": "R-102",
                                    "rule_name": "异常行为速率限制",
                                    "description": "单个智能体在 5 分钟内 state_sync 调用次数超过基线 2 次/分钟。",
                                    "threshold": "state_sync > 10 / 5min",
                                    "action": "限流",
                                    "status": "enabled",
                                    "hits": 5
                                },
                                {
                                    "rule_id": "R-103",
                                    "rule_name": "跨域信任衰减阈值",
                                    "description": "跨集群调用后信任分在 3 跳内衰减至 0.5 以下。",
                                    "threshold": "trust_decay_3hop < 0.5",
                                    "action": "隔离",
                                    "status": "enabled",
                                    "hits": 3
                                },
                                {
                                    "rule_id": "R-104",
                                    "rule_name": "图神经网络异常传播",
                                    "description": "GNN 子图异常概率超过 0.9，且 SHAP 归因指向 token_validity。",
                                    "threshold": "gnn_anomaly_prob > 0.9",
                                    "action": "人工复核",
                                    "status": "enabled",
                                    "hits": 1
                                }
                            ]
                        }
                    }
                ]
            },
            {
                "id": "cluster-02",
                "name": "工业边缘集群",
                "button": {"text": "下钻拓扑", "icon": "/static/icons/topo.svg"},
                "detail": {
                    "title": "工业边缘集群子拓扑",
                    "type": "topology",
                    "summary": "工业边缘集群包含 3 层架构：传感器采集 → 边缘预处理 → 云端决策。当前检测到 1 条异常数据流。",
                    "nodes": [
                        {"id": "sensor-collector", "name": "传感器采集", "layer": "边缘层"},
                        {"id": "edge-processor", "name": "边缘预处理", "layer": "边缘层"},
                        {"id": "ml-inference", "name": "推理决策", "layer": "云端层"},
                        {"id": "auditor", "name": "审计节点", "layer": "控制层"}
                    ],
                    "edges": [
                        {"source": "sensor-collector", "target": "edge-processor", "status": "normal"},
                        {"source": "edge-processor", "target": "ml-inference", "status": "normal"},
                        {"source": "edge-processor", "target": "auditor", "status": "anomaly"},
                        {"source": "ml-inference", "target": "auditor", "status": "normal"}
                    ]
                }
            },
            {
                "id": "cluster-03",
                "name": "AI调度集群"
            }
        ]
    }


def fetch_right_tree_data():
    """获取右侧树形数据（风险实体）"""
    return {
        "tree_data": [
            {
                "id": "risk-01",
                "name": "高风险实体",
                "children": [
                    {"id": "ent-001", "name": "Agent-A987 (冒用)"},
                    {"id": "ent-002", "name": "Agent-B234 (信任漂移)"}
                ]
            },
            {
                "id": "prop-01",
                "name": "跨域传播路径",
                "children": [
                    {
                        "id": "path-01",
                        "name": "金融→工业链路",
                        "button": {"text": "溯源", "icon": "/static/icons/trace.svg"},
                        "detail": {
                            "title": "金融→工业链路攻击溯源",
                            "type": "trace",
                            "summary": "该链路还原了一次跨域协同攻击：金融集群的异常 token 被冒用后，通过边缘网关渗透至工业集群。",
                            "path": [
                                {"step": 1, "node": "支付网关Agent", "time": "2026-08-25 10:12:33", "event": "异常 auth 请求，token 复用"},
                                {"step": 2, "node": "风控策略Agent", "time": "2026-08-25 10:12:35", "event": "触发 R-101 规则，命中 2 次"},
                                {"step": 3, "node": "router", "time": "2026-08-25 10:12:40", "event": "跨域转发至工业网关"},
                                {"step": 4, "node": "edge-processor", "time": "2026-08-25 10:12:48", "event": "收到伪造 state_sync 指令"},
                                {"step": 5, "node": "auditor", "time": "2026-08-25 10:13:05", "event": "记录审计日志，标记异常传播"}
                            ],
                            "evidence": [
                                "token_validity SHAP 归因 −0.42",
                                "跨域调用缺少二次鉴权",
                                "state_sync 频率 17 次/分钟，基线 ≤2 次/分钟"
                            ],
                            "result": "已生成溯源报告并推送至审计看板"
                        }
                    }
                ]
            }
        ]
    }


def fetch_behavior_table_data():
    """获取行为流表格数据"""
    now = datetime.now()
    rows = []
    for i in range(20):
        ts = (now - timedelta(minutes=i * 3)).strftime("%Y-%m-%d %H:%M:%S")
        rows.append({
            "timestamp": ts,
            "subject_id": f"Agent-{str(1000 + i)[-3:]}",
            "action_type": ["auth", "transfer", "query", "sync"][i % 4],
            "semantic_tag": ["identity", "consensus", "intent", "state"][i % 4],
            "risk_score": round(30 + (i * 2.3) % 65, 1),
            "status": ["normal", "warning", "alert"][i % 3]
        })
    return {"rows": rows}


def fetch_detection_form_schema():
    """获取检测表单配置"""
    return {
        "fields": [
            {"name": "检测策略名称", "type": "text", "required": True},
            {"name": "检测模式", "type": "select", "options": ["实时流式", "批处理回溯", "混合模式"]},
            {"name": "智能体集群", "type": "select", "options": ["金融交易集群", "工业边缘集群", "AI调度集群"]},
            {"name": "异常行为阈值", "type": "number", "min": 0.1, "max": 1.0, "step": 0.05, "default": 0.75},
            {"name": "信任衰减阈值", "type": "number", "min": 0.01, "max": 0.5, "step": 0.01, "default": 0.15},
            {"name": "图拓扑敏感度", "type": "slider", "min": 1, "max": 10, "default": 7},
            {"name": "语义规则集", "type": "multi-select", "options": ["身份一致性", "意图合理性", "状态时序性", "共识收敛性"]},
            {"name": "时间窗口", "type": "duration", "default": "5m"},
            {"name": "响应动作", "type": "select", "options": ["告警", "限流", "隔离", "重认证", "自动修复"]},
            {"name": "检测深度", "type": "number", "min": 1, "max": 8, "default": 4},
            {"name": "高级配置", "type": "json", "placeholder": '{"gcn_layers": 2, "explainability": true}'},
            {"name": "备注说明", "type": "textarea", "rows": 2}
        ]
    }


def fetch_markdown_report():
    """获取Markdown格式检测报告"""
    return """##  实时检测报告（2024-06-12T14:28:33Z）

**攻击链路还原**  
`Agent-012 → Agent-045 → Agent-088`：身份令牌被复用，跨集群调用无二次鉴权。

**信任衰减路径**  
`初始信任=0.92 → 0.68（+3跳）→ 0.31（+6跳）→ 0.14（+9跳）`

**关键行为证据**  
- `Agent-045` 在 `2024-06-12T14:25:11Z` 发起 **17次非预期`state_sync`请求**（基线：≤2次/分钟）
- 语义标签偏离度：`intent="reconfigure"` vs 实际执行 `"bypass_auth"`（置信度 98.3%）

**可审计决策依据**  
> 图神经网络GNN输出异常概率：0.992  
> 可解释模块生成SHAP归因：`token_validity=−0.42`, `call_pattern=−0.38`  
> 符合《多智能体安全白皮书 v2.3》第7.2条协同攻击判定标准
"""


def fetch_line_chart_data_1():
    """获取异常趋势图表数据"""
    now = datetime.now()
    hours = [(now - timedelta(hours=i)).strftime("%H:%M") for i in range(6, -1, -1)]
    return {
        "title": "多智能体协同异常分布与攻击模式演化趋势",
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
            "name": "异常事件数量",
            "nameLocation": "middle",
            "nameGap": 30
        },
        "series": [
            {"name": "隐蔽协同攻击", "data": [12, 15, 18, 22, 25, 20, 16], "type": "line", "itemStyle": {"color": "#ff6b6b"}},
            {"name": "身份冒用攻击", "data": [8, 10, 14, 18, 16, 12, 9], "type": "line", "itemStyle": {"color": "#4ecdc4"}},
            {"name": "信任漂移异常", "data": [5, 7, 10, 15, 18, 14, 10], "type": "line", "itemStyle": {"color": "#45b7d1"}},
            {"name": "行为语义偏离", "data": [10, 12, 16, 20, 22, 18, 14], "type": "line", "itemStyle": {"color": "#96ceb4"}}
        ],
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "cross"}},
        "legend": {"top": "bottom", "data": ["隐蔽协同攻击", "身份冒用攻击", "信任漂移异常", "行为语义偏离"]},
        "grid": {"left": "3%", "right": "4%", "bottom": "15%", "top": "10%", "containLabel": True}
    }


def fetch_line_chart_data_2():
    """获取智能体深度分析图表数据"""
    agents = [f"Agent-{str(1 + i).zfill(2)}" for i in range(8)]
    return {
        "title": "智能体异常行为深度分析",
        "chart_type": "line",
        "xAxis": {"type": "category", "data": agents},
        "yAxis": {"type": "value", "name": "评分/偏离度", "min": 0, "max": 100},
        "series": [
            {"name": "信任评分", "data": [85, 72, 90, 65, 78, 82, 45, 88], "type": "line"},
            {"name": "行为语义偏离度", "data": [12, 28, 8, 35, 22, 18, 55, 10], "type": "line"},
            {"name": "可疑关联度", "data": [5, 15, 3, 25, 12, 8, 40, 7], "type": "line"}
        ],
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "legend": {"data": ["信任评分", "行为语义偏离度", "可疑关联度"], "top": "10%"},
        "grid": {"left": "3%", "right": "4%", "bottom": "3%", "containLabel": True}
    }


def fetch_calendar_events():
    """获取日历事件数据"""
    base_date = datetime(2026, 5, 1)
    events = []
    for i in range(10):
        dt = base_date + timedelta(days=i * 2 + 1)
        events.append({
            "date": dt.strftime("%Y-%m-%d"),
            "title": ["巡检任务", "策略更新", "模型重训", "信任评估", "日志审计"][i % 5],
            "type": ["maintenance", "config", "ml", "trust", "audit"][i % 5],
            "status": ["completed", "pending", "failed"][i % 3]
        })
    return {"month": "2026-05", "events": events}


# API路由
@app.route('/api/v1/left-tree', methods=['GET'])
def get_left_tree():
    return jsonify(fetch_left_tree_data())


@app.route('/api/v1/right-tree', methods=['GET'])
def get_right_tree():
    return jsonify(fetch_right_tree_data())


@app.route('/api/v1/behavior-table', methods=['GET'])
def get_behavior_table():
    return jsonify(fetch_behavior_table_data())


@app.route('/api/v1/detection-form-schema', methods=['GET'])
def get_detection_form_schema():
    return jsonify(fetch_detection_form_schema())


@app.route('/api/v1/markdown-report', methods=['GET'])
def get_markdown_report():
    return jsonify({"content": fetch_markdown_report()})


@app.route('/api/v1/chart/abnormal-trend', methods=['GET'])
def get_abnormal_trend():
    return jsonify(fetch_line_chart_data_1())


@app.route('/api/v1/chart/agent-deep-analysis', methods=['GET'])
def get_agent_deep_analysis():
    return jsonify(fetch_line_chart_data_2())


@app.route('/api/v1/calendar-events', methods=['GET'])
def get_calendar_events():
    return jsonify(fetch_calendar_events())


# 检测策略下发（接收前端配置表单，返回确认回执）
SUBMISSIONS = []


@app.route('/api/v1/detection-config', methods=['POST'])
def post_detection_config():
    payload = request.get_json(silent=True) or {}
    SUBMISSIONS.append(payload)
    return jsonify({
        "status": "accepted",
        "message": "检测策略已下发至检测中心",
        "config_id": f"DC-{len(SUBMISSIONS):04d}",
        "received_at": datetime.now().isoformat(),
        "items": payload,
    })


@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


if __name__ == '__main__':
    os.makedirs('static/icons', exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=False)
