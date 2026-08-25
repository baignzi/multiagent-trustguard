import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import './styles/index.css';

const TABS = [
  { id: 'metadata', label: '元数据监控' },
  { id: 'graph', label: '交互图谱' },
  { id: 'policies', label: '策略编排' },
  { id: 'audit', label: '溯源看板' },
];

const App = () => {
  // 组织树与智能体详情
  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [agentDetail, setAgentDetail] = useState(null);

  // 监控图表
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);

  // 注册表单
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    agent_id: '',
    agent_type: '',
    behavior_semantic_tags: [],
    communication_context: '',
    gnn_features: {},
    node_topology_relations: '',
    anomaly_behavior_flag: 0,
    policy_binding: '',
    audit_log_level: 'INFO',
    data_version: '1.0.0',
    config_file: ''
  });

  // 模块导航与数据
  const [activeTab, setActiveTab] = useState('metadata');

  // 交互图谱
  const [graphData, setGraphData] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);

  // 策略编排
  const [policies, setPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    name: '',
    description: '',
    rule_type: 'threshold',
    params: '{"threshold": 60}',
    priority: 50,
  });

  // 溯源看板
  const [auditTrace, setAuditTrace] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);

  const loadTree = () => {
    setTreeLoading(true);
    setTreeError(null);
    fetch('/api/tree')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTreeData(data);
        } else {
          console.error('Invalid tree data format:', data);
          setTreeError('后端返回的组织树数据为空或格式不正确');
          setTreeData([]);
        }
      })
      .catch(err => {
        console.error('Failed to fetch tree:', err);
        setTreeError(`获取组织树失败：${err.message}。请确认后端服务已启动（http://localhost:8000）。`);
        setTreeData([]);
      })
      .finally(() => setTreeLoading(false));
  };

  useEffect(() => {
    loadTree();
  }, []);

  useEffect(() => {
    setChartLoading(true);
    setChartError(null);
    fetch('/api/chart/metadata-monitoring')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        setChartData(data);
        setChartLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch chart:', err);
        setChartError('获取监控图表失败：' + err.message);
        setChartLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedNode && selectedNode.leaf) {
      fetch(`/api/agent/${selectedNode.id}`)
        .then(res => {
          if (!res.ok) {
            return generateMockAgentDetail(selectedNode.id);
          }
          return res.json();
        })
        .then(data => setAgentDetail(data))
        .catch(err => console.error('Failed to fetch agent detail:', err));
    } else {
      setAgentDetail(null);
    }
  }, [selectedNode]);

  // 根据当前 Tab 和选中节点加载对应数据
  useEffect(() => {
    if (activeTab === 'graph') {
      loadGraph();
    } else if (activeTab === 'policies') {
      loadPolicies();
    } else if (activeTab === 'audit') {
      if (selectedNode && selectedNode.leaf) {
        loadAuditTrace(selectedNode.id);
      } else {
        setAuditTrace(null);
        setAuditError(null);
      }
    }
  }, [activeTab, selectedNode]);

  const generateMockAgentDetail = (agentId) => {
    const now = new Date();
    const trustEvolution = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - (6 - i));
      trustEvolution.push({
        date: dt.toISOString().split('T')[0],
        score: Math.round((80 + Math.random() * 15) * 10) / 10,
        anomalies: Math.max(0, Math.floor(Math.random() * 5))
      });
    }

    return Promise.resolve({
      agent_id: agentId,
      registered_at: new Date(now.getTime() - 86400000 * 30).toISOString(),
      trust_score: Math.round((82 + Math.random() * 13) * 10) / 10,
      behavior_summary: `Type: ${agentId}. Active in simulated environment.`,
      trust_evolution: trustEvolution,
      explanation_tags: ["GNN-degree-centrality", "trust-propagation-path", "cross-domain-consensus"],
      gnn_explanation: "Trust score derived via GraphSAGE on 3 key subgraphs; weighted by node degree and inter-domain edge reliability."
    });
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setIsRegistering(true);
    fetch('/api/agent/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerForm)
    })
      .then(res => res.json())
      .then(data => {
        alert(`注册成功：${data.agent_id}, 初始信任分：${data.trust_score}`);
        setIsRegistering(false);
        loadTree();
        setRegisterForm({
          agent_id: '',
          agent_type: '',
          behavior_semantic_tags: [],
          communication_context: '',
          gnn_features: {},
          node_topology_relations: '',
          anomaly_behavior_flag: 0,
          policy_binding: '',
          audit_log_level: 'INFO',
          data_version: '1.0.0',
          config_file: ''
        });
      })
      .catch(err => {
        alert('注册失败：' + err.message);
        setIsRegistering(false);
      });
  };

  // ---------------- 交互图谱 ----------------
  const loadGraph = () => {
    setGraphLoading(true);
    setGraphError(null);
    fetch('/api/graph/interaction')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setGraphData(data);
        setGraphLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch graph:', err);
        setGraphError('获取交互图谱失败：' + err.message);
        setGraphLoading(false);
      });
  };

  // ---------------- 策略编排 ----------------
  const loadPolicies = () => {
    setPoliciesLoading(true);
    fetch('/api/policies')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setPolicies(Array.isArray(data) ? data : []);
        setPoliciesLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch policies:', err);
        alert('获取策略列表失败：' + err.message);
        setPoliciesLoading(false);
      });
  };

  const createPolicy = (e) => {
    e.preventDefault();
    let params = {};
    try {
      params = JSON.parse(policyForm.params);
    } catch {
      alert('策略参数必须是合法 JSON');
      return;
    }
    fetch('/api/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: policyForm.name,
        description: policyForm.description,
        rule_type: policyForm.rule_type,
        params,
        priority: parseInt(policyForm.priority, 10),
      })
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(() => {
        setPolicyForm({ name: '', description: '', rule_type: 'threshold', params: '{"threshold": 60}', priority: 50 });
        loadPolicies();
      })
      .catch(err => alert('创建策略失败：' + err.message));
  };

  const togglePolicy = (id, enabled) => {
    fetch(`/api/policies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled })
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(() => loadPolicies())
      .catch(err => alert('更新策略失败：' + err.message));
  };

  const deletePolicy = (id) => {
    if (!window.confirm('确定删除该策略吗？')) return;
    fetch(`/api/policies/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(() => loadPolicies())
      .catch(err => alert('删除策略失败：' + err.message));
  };

  // ---------------- 溯源看板 ----------------
  const loadAuditTrace = (agentId) => {
    setAuditLoading(true);
    setAuditError(null);
    fetch(`/api/audit/trace/${agentId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setAuditTrace(data);
        setAuditLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch audit trace:', err);
        setAuditError('获取审计时间线失败：' + err.message);
        setAuditLoading(false);
      });
  };

  // ---------------- 渲染函数 ----------------
  const renderTree = (nodes) => {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return <div className="placeholder" style={{padding: '20px'}}>暂无组织树数据</div>;
    }
    return nodes.map(node => {
      const isSelected = selectedNode && selectedNode.id === node.id;
      const isLeaf = !node.children || node.children.length === 0;
      return (
        <div key={node.id} className="tree-node">
          <div
            className={`tree-label ${isSelected ? 'selected' : ''} ${isLeaf ? 'leaf' : ''}`}
            onClick={() => handleNodeClick({...node, leaf: isLeaf})}
            title={isLeaf ? '点击查看信任评估详情' : '点击展开/选择'}
          >
            {node.name}
            {isLeaf && <span className="leaf-badge">智能体</span>}
            {node.button && (
              <button className="tree-button">
                <img src={node.button.icon} alt={node.button.text} width="16" height="16" />
                {node.button.text}
              </button>
            )}
          </div>
          {node.children && node.children.length > 0 && (
            <div className="tree-children">
              {renderTree(node.children)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderChart = () => {
    if (chartLoading) {
      return <div className="placeholder">正在加载监控图表...</div>;
    }
    if (chartError) {
      return (
        <div className="error-box">
          <p>{chartError}</p>
          <button onClick={() => {
            setChartLoading(true);
            setChartError(null);
            fetch('/api/chart/metadata-monitoring')
              .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
              .then(setChartData)
              .catch(err => setChartError('获取监控图表失败：' + err.message))
              .finally(() => setChartLoading(false));
          }}>重新加载</button>
        </div>
      );
    }
    if (!chartData || !Array.isArray(chartData.series) || chartData.series.length === 0) {
      return <div className="placeholder">暂无监控数据</div>;
    }

    const W = 880, H = 340;
    const padL = 60, padR = 30, padT = 30, padB = 70;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const xLabels = chartData.xAxis.data;
    const n = xLabels.length;
    const xStep = n > 1 ? innerW / (n - 1) : 0;
    let allMax = 0, allMin = Infinity;
    chartData.series.forEach(s => {
      s.data.forEach(v => {
        if (v > allMax) allMax = v;
        if (v < allMin) allMin = v;
      });
    });
    if (allMin === Infinity) allMin = 0;
    const range = allMax - allMin || 1;
    const yMax = Math.ceil((allMax + range * 0.1) / 10) * 10;
    const yMin = Math.max(0, Math.floor((allMin - range * 0.1) / 10) * 10);
    const ySpan = yMax - yMin || 1;
    const yToPx = (v) => padT + innerH - ((v - yMin) / ySpan) * innerH;
    const xToPx = (i) => padL + i * xStep;
    const yTicks = 5;
    const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (ySpan * i) / yTicks);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        {yTickValues.map((v, i) => {
          const y = yToPx(v);
          return (
            <g key={`yt${i}`}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#eee" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#666">{Math.round(v)}</text>
            </g>
          );
        })}
        {xLabels.map((label, i) => (
          <text key={`xt${i}`} x={xToPx(i)} y={H - padB + 18} textAnchor="middle" fontSize="11" fill="#666">{label}</text>
        ))}
        <text x={padL - 40} y={padT - 10} fontSize="12" fill="#333" fontWeight="600">{yMin}–{yMax}</text>
        <text x={W - padR} y={H - 12} textAnchor="end" fontSize="12" fill="#666">{chartData.yAxis.name || ''}</text>
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="12" fill="#666">{chartData.xAxis.name || ''}</text>

        {chartData.series.map((s, si) => {
          const color = (s.itemStyle && s.itemStyle.color) || '#1a73e8';
          const points = s.data.map((v, i) => `${xToPx(i)},${yToPx(v)}`).join(' ');
          return (
            <g key={`s${si}`}>
              <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
              {s.data.map((v, i) => (
                <circle key={`pt${si}-${i}`} cx={xToPx(i)} cy={yToPx(v)} r="3" fill={color}>
                  <title>{`${s.name} @ ${xLabels[i]}: ${v}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {chartData.series.map((s, i) => {
          const color = (s.itemStyle && s.itemStyle.color) || '#1a73e8';
          const lx = padL + i * 130;
          const ly = H - 20;
          return (
            <g key={`lg${i}`}>
              <rect x={lx} y={ly - 8} width="14" height="3" fill={color} />
              <text x={lx + 20} y={ly} fontSize="12" fill="#333">{s.name}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderMarkdownContent = () => {
    if (!agentDetail) {
      return (
        <div className="placeholder">
          <h3>请选择左侧智能体节点查看元数据</h3>
          <p>支持动态渲染标题、列表、代码块与行内格式</p>
        </div>
      );
    }

    const mdContent = `## 智能体元数据详情

**身份标识**: \`${agentDetail.agent_id}\`  
**注册时间**: ${new Date(agentDetail.registered_at).toLocaleString()}  
**当前信任评分**: **${agentDetail.trust_score} / 100**

### 行为摘要
${agentDetail.behavior_summary}

### 信任评分演化（近7日）
| 日期 | 评分 | 异常数 |
|------|------|--------|
${agentDetail.trust_evolution.map(d => `| ${d.date} | ${d.score} | ${d.anomalies} |`).join('\n')}

### 可解释性依据标签
- ${agentDetail.explanation_tags.join('\n- ')}

### 图神经网络说明
\`\`\`python
# 信任传播路径权重计算
score = sum([w * gnn_subgraph_score(sub) for w, sub in zip(weights, subgraphs)])
\`\`\`
${agentDetail.gnn_explanation}
`;

    return <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{mdContent}</Markdown>;
  };

  // ---------------- 交互图谱视图 ----------------
  const renderGraphView = () => {
    if (graphLoading) return <div className="placeholder">正在加载交互图谱...</div>;
    if (graphError) return <div className="error-box">{graphError} <button onClick={loadGraph}>重新加载</button></div>;
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return <div className="placeholder">暂无交互图谱数据</div>;
    }

    const W = 760, H = 460;
    const cx = W / 2, cy = H / 2;
    const radius = 170;
    const n = graphData.nodes.length;
    const coords = {};
    graphData.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      coords[node.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });

    const suspiciousSet = new Set();
    (graphData.suspicious_edges || []).forEach(e => {
      suspiciousSet.add(`${e.source}-${e.target}`);
      suspiciousSet.add(`${e.target}-${e.source}`);
    });

    return (
      <div className="graph-view">
        <h2>跨智能体交互图谱</h2>
        <div className="graph-summary">
          节点：{graphData.summary.node_count} &nbsp;|&nbsp;
          边：{graphData.summary.edge_count} &nbsp;|&nbsp;
          异常节点：{graphData.summary.anomaly_count} &nbsp;|&nbsp;
          可疑连边：{graphData.summary.suspicious_edge_count}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="graph-svg">
          {/* 边 */}
          {graphData.links.map((link, idx) => {
            const s = coords[link.source];
            const t = coords[link.target];
            if (!s || !t) return null;
            const isSuspicious = suspiciousSet.has(`${link.source}-${link.target}`);
            return (
              <line
                key={`edge-${idx}`}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={isSuspicious ? '#f5222d' : '#bfbfbf'}
                strokeWidth={isSuspicious ? 2 : 1}
                strokeDasharray={isSuspicious ? '5,3' : ''}
              />
            );
          })}
          {/* 节点 */}
          {graphData.nodes.map((node) => {
            const pos = coords[node.id];
            const isAnomaly = node.anomaly > 0;
            const r = Math.max(6, Math.min(16, 6 + node.degree / 3));
            return (
              <g key={`node-${node.id}`}>
                <circle
                  cx={pos.x} cy={pos.y} r={r}
                  fill={isAnomaly ? '#f5222d' : '#1a73e8'}
                  stroke="#fff" strokeWidth="2"
                />
                <text x={pos.x} y={pos.y + r + 14} textAnchor="middle" fontSize="11" fill="#333">
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="graph-legend">
          <span><i className="dot blue" /> 正常节点</span>
          <span><i className="dot red" /> 异常节点</span>
          <span><i className="line gray" /> 普通连边</span>
          <span><i className="line red dashed" /> 可疑连边</span>
        </div>
      </div>
    );
  };

  // ---------------- 策略编排视图 ----------------
  const renderPoliciesView = () => {
    return (
      <div className="policies-view">
        <h2>防御策略编排平台</h2>

        <div className="policy-form-section">
          <h3>新建策略</h3>
          <form onSubmit={createPolicy} className="policy-form">
            <div className="form-row">
              <label>策略名称</label>
              <input
                type="text"
                value={policyForm.name}
                onChange={e => setPolicyForm({...policyForm, name: e.target.value})}
                required
              />
            </div>
            <div className="form-row">
              <label>策略描述</label>
              <input
                type="text"
                value={policyForm.description}
                onChange={e => setPolicyForm({...policyForm, description: e.target.value})}
              />
            </div>
            <div className="form-row">
              <label>规则类型</label>
              <select
                value={policyForm.rule_type}
                onChange={e => setPolicyForm({...policyForm, rule_type: e.target.value})}
              >
                <option value="threshold">阈值触发</option>
                <option value="rate_limit">速率限制</option>
                <option value="anomaly_detect">异常检测</option>
              </select>
            </div>
            <div className="form-row">
              <label>参数（JSON）</label>
              <input
                type="text"
                value={policyForm.params}
                onChange={e => setPolicyForm({...policyForm, params: e.target.value})}
              />
            </div>
            <div className="form-row">
              <label>优先级</label>
              <input
                type="number"
                value={policyForm.priority}
                onChange={e => setPolicyForm({...policyForm, priority: e.target.value})}
              />
            </div>
            <div className="form-actions">
              <button type="submit">创建策略</button>
            </div>
          </form>
        </div>

        <div className="policy-list-section">
          <h3>策略列表 {policiesLoading && <span className="loading-text">加载中...</span>}</h3>
          {policies.length === 0 && !policiesLoading && <div className="placeholder">暂无策略</div>}
          {policies.length > 0 && (
            <table className="policy-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>描述</th>
                  <th>参数</th>
                  <th>优先级</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {policies.map(p => (
                  <tr key={p.id} className={p.enabled ? '' : 'disabled-row'}>
                    <td>{p.name}</td>
                    <td>{p.rule_type}</td>
                    <td>{p.description}</td>
                    <td><code>{JSON.stringify(p.params)}</code></td>
                    <td>{p.priority}</td>
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={p.enabled === 1}
                          onChange={() => togglePolicy(p.id, p.enabled)}
                        />
                        <span className="slider" />
                      </label>
                    </td>
                    <td>
                      <button className="btn-danger" onClick={() => deletePolicy(p.id)}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // ---------------- 溯源看板视图 ----------------
  const renderAuditView = () => {
    if (!selectedNode || !selectedNode.leaf) {
      return (
        <div className="placeholder">
          <h3>请在左侧组织树选择一个智能体节点</h3>
          <p>溯源看板需要基于单个智能体的行为证据生成审计时间线</p>
        </div>
      );
    }
    if (auditLoading) return <div className="placeholder">正在加载审计时间线...</div>;
    if (auditError) return <div className="error-box">{auditError} <button onClick={() => loadAuditTrace(selectedNode.id)}>重新加载</button></div>;
    if (!auditTrace || !auditTrace.events || auditTrace.events.length === 0) {
      return <div className="placeholder">该智能体暂无审计事件</div>;
    }

    return (
      <div className="audit-view">
        <h2>全链路溯源看板：{auditTrace.agent_id}</h2>
        <div className="audit-summary">
          事件总数：{auditTrace.event_count} &nbsp;|&nbsp;
          异常事件：{auditTrace.anomaly_count}
        </div>
        <div className="audit-timeline">
          {auditTrace.events.map((evt, idx) => (
            <div key={idx} className={`timeline-item ${evt.level.toLowerCase()} ${evt.anomaly ? 'anomaly' : ''}`}>
              <div className="timeline-time">{new Date(evt.ts).toLocaleString()}</div>
              <div className="timeline-dot" />
              <div className="timeline-content">
                <span className={`event-type ${evt.type}`}>{evt.type}</span>
                <span className="event-level">{evt.level}</span>
                <p>{evt.message}</p>
                {evt.score !== null && evt.score !== undefined && (
                  <span className="event-score">得分/信任分：{typeof evt.score === 'number' ? evt.score.toFixed(2) : evt.score}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---------------- 主渲染 ----------------
  return (
    <div className="app-container">
      <div className="module-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="layout">
        <div className="panel left-panel">
          <h2>智能体组织结构树</h2>
          {treeLoading && <div className="placeholder">正在加载组织树...</div>}
          {!treeLoading && treeError && (
            <div className="error-box">
              <p>{treeError}</p>
              <button onClick={loadTree}>重新加载</button>
            </div>
          )}
          {!treeLoading && !treeError && (
            <div className="tree-container">{renderTree(treeData)}</div>
          )}
        </div>

        <div className="panel right-panel">
          {activeTab === 'metadata' && (
            <>
              <h2>智能体元数据详情</h2>
              <div className="markdown-content">{renderMarkdownContent()}</div>
            </>
          )}
          {activeTab === 'graph' && renderGraphView()}
          {activeTab === 'policies' && renderPoliciesView()}
          {activeTab === 'audit' && renderAuditView()}
        </div>
      </div>

      {activeTab === 'metadata' && (
        <div className="submodule">
          <h2>元数据配置</h2>
          <div className="chart-section">
            <h3>分布式多智能体系统元数据监控仪表板</h3>
            <div className="echarts-container">{renderChart()}</div>
          </div>
          <div className="form-section">
            <h3>新智能体注册表单</h3>
            <form onSubmit={handleRegisterSubmit} className="dynamic-form">
              <div className="form-row">
                <label>智能体ID *</label>
                <input
                  type="text"
                  value={registerForm.agent_id}
                  onChange={e => setRegisterForm({...registerForm, agent_id: e.target.value})}
                  required
                />
              </div>
              <div className="form-row">
                <label>智能体类型 *</label>
                <input
                  type="text"
                  value={registerForm.agent_type}
                  onChange={e => setRegisterForm({...registerForm, agent_type: e.target.value})}
                  required
                />
              </div>
              <div className="form-row">
                <label>行为语义标签</label>
                <input
                  type="text"
                  placeholder='["validator", "encrypted"]'
                  value={JSON.stringify(registerForm.behavior_semantic_tags)}
                  onChange={e => {
                    try {
                      setRegisterForm({...registerForm, behavior_semantic_tags: JSON.parse(e.target.value)});
                    } catch {}
                  }}
                />
              </div>
              <div className="form-row">
                <label>通信上下文</label>
                <input
                  type="text"
                  value={registerForm.communication_context}
                  onChange={e => setRegisterForm({...registerForm, communication_context: e.target.value})}
                />
              </div>
              <div className="form-row">
                <label>图神经网络特征</label>
                <textarea
                  rows="2"
                  value={JSON.stringify(registerForm.gnn_features, null, 2)}
                  onChange={e => {
                    try {
                      setRegisterForm({...registerForm, gnn_features: JSON.parse(e.target.value)});
                    } catch {}
                  }}
                />
              </div>
              <div className="form-row">
                <label>节点拓扑关系</label>
                <input
                  type="text"
                  value={registerForm.node_topology_relations}
                  onChange={e => setRegisterForm({...registerForm, node_topology_relations: e.target.value})}
                />
              </div>
              <div className="form-row">
                <label>异常行为标记</label>
                <select
                  value={registerForm.anomaly_behavior_flag}
                  onChange={e => setRegisterForm({...registerForm, anomaly_behavior_flag: parseInt(e.target.value)})}
                >
                  <option value={0}>正常</option>
                  <option value={1}>轻度异常</option>
                  <option value={2}>严重异常</option>
                </select>
              </div>
              <div className="form-row">
                <label>策略绑定</label>
                <input
                  type="text"
                  value={registerForm.policy_binding}
                  onChange={e => setRegisterForm({...registerForm, policy_binding: e.target.value})}
                />
              </div>
              <div className="form-row">
                <label>审计日志级别</label>
                <select
                  value={registerForm.audit_log_level}
                  onChange={e => setRegisterForm({...registerForm, audit_log_level: e.target.value})}
                >
                  <option value="DEBUG">DEBUG</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="ERROR">ERROR</option>
                </select>
              </div>
              <div className="form-row">
                <label>数据版本</label>
                <input
                  type="text"
                  value={registerForm.data_version}
                  onChange={e => setRegisterForm({...registerForm, data_version: e.target.value})}
                />
              </div>
              <div className="form-row">
                <label>配置文件路径</label>
                <input
                  type="text"
                  value={registerForm.config_file}
                  onChange={e => setRegisterForm({...registerForm, config_file: e.target.value})}
                />
              </div>
              <div className="form-actions">
                <button type="submit" disabled={isRegistering}>
                  {isRegistering ? '注册中...' : '注册智能体'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

export default App;
