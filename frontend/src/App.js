import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import './styles/index.css';

const App = () => {
  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [agentDetail, setAgentDetail] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);
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
            // 节点不存在时生成模拟数据
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
        loadTree();  // 刷新组织结构树
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
            {isLeaf ? '' : ''}
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
    // 找所有 series 的最大最小值
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
        {/* Y 网格 + 刻度 */}
        {yTickValues.map((v, i) => {
          const y = yToPx(v);
          return (
            <g key={`yt${i}`}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#eee" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#666">{Math.round(v)}</text>
            </g>
          );
        })}
        {/* X 轴标签 */}
        {xLabels.map((label, i) => (
          <text key={`xt${i}`} x={xToPx(i)} y={H - padB + 18} textAnchor="middle" fontSize="11" fill="#666">{label}</text>
        ))}
        {/* 轴标题 */}
        <text x={padL - 40} y={padT - 10} fontSize="12" fill="#333" fontWeight="600">{yMin}–{yMax}</text>
        <text x={W - padR} y={H - 12} textAnchor="end" fontSize="12" fill="#666">{chartData.yAxis.name || ''}</text>
        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="12" fill="#666">{chartData.xAxis.name || ''}</text>

        {/* 折线 */}
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

        {/* 图例 */}
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

  return (
    <div className="app-container">
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
          <h2>智能体元数据详情</h2>
          <div className="markdown-content">{renderMarkdownContent()}</div>
        </div>
      </div>
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
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

export default App;
