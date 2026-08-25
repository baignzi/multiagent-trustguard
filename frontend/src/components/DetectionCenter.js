import React, { useState, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 恶意行为检测中心：消费 Flask Mock 服务 (:5000, /api/v1/*)
const DC_ENDPOINTS = {
  leftTree: '/api/v1/left-tree',
  rightTree: '/api/v1/right-tree',
  behaviorTable: '/api/v1/behavior-table',
  formSchema: '/api/v1/detection-form-schema',
  report: '/api/v1/markdown-report',
  abnormalTrend: '/api/v1/chart/abnormal-trend',
  agentDeepAnalysis: '/api/v1/chart/agent-deep-analysis',
  calendar: '/api/v1/calendar-events',
};

const STATUS_TEXT = { normal: '正常', warning: '预警', alert: '告警' };

// ---------------------------------------------------------------------------
// 通用 SVG 多折线图（与项目整体"无第三方图表库"约定一致）
// ---------------------------------------------------------------------------
const MultiLineChart = ({ data }) => {
  if (!data || !Array.isArray(data.series) || data.series.length === 0) {
    return <div className="placeholder">暂无图表数据</div>;
  }
  const W = 880, H = 340;
  const padL = 60, padR = 30, padT = 30, padB = 70;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xLabels = (data.xAxis && data.xAxis.data) || [];
  const n = xLabels.length;
  const xStep = n > 1 ? innerW / (n - 1) : 0;

  let allMax = 0, allMin = Infinity;
  data.series.forEach(s => (s.data || []).forEach(v => {
    if (v > allMax) allMax = v;
    if (v < allMin) allMin = v;
  }));
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
      {data.yAxis && data.yAxis.name && (
        <text x={W - padR} y={H - 12} textAnchor="end" fontSize="12" fill="#666">{data.yAxis.name}</text>
      )}
      {data.xAxis && data.xAxis.name && (
        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="12" fill="#666">{data.xAxis.name}</text>
      )}

      {data.series.map((s, si) => {
        const color = (s.itemStyle && s.itemStyle.color) || '#1a73e8';
        const points = (s.data || []).map((v, i) => `${xToPx(i)},${yToPx(v)}`).join(' ');
        return (
          <g key={`s${si}`}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
            {(s.data || []).map((v, i) => (
              <circle key={`pt${si}-${i}`} cx={xToPx(i)} cy={yToPx(v)} r="3" fill={color}>
                <title>{`${s.name} @ ${xLabels[i]}: ${v}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      {data.series.map((s, i) => {
        const color = (s.itemStyle && s.itemStyle.color) || '#1a73e8';
        const lx = padL + i * 140;
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

// ---------------------------------------------------------------------------
// 树节点（支持展开/折叠与操作按钮）
// ---------------------------------------------------------------------------
const DCTreeNode = ({ node, level = 0, onAction, onDetail }) => {
  const [open, setOpen] = useState(level < 1);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const handleBtnClick = (e) => {
    e.stopPropagation();
    if (node.detail && onDetail) {
      onDetail(node);
    } else {
      onAction(node.button.text, node.name);
    }
  };
  return (
    <div className="dc-tree-node">
      <div className="dc-tree-row">
        {hasChildren ? (
          <span
            className={`dc-tree-toggle ${open ? 'open' : ''}`}
            onClick={() => setOpen(o => !o)}
          >▸</span>
        ) : (
          <span className="dc-tree-toggle leaf" />
        )}
        <span className="dc-tree-name">{node.name}</span>
        {node.button && (
          <button
            className="dc-tree-btn"
            onClick={handleBtnClick}
          >{node.button.text}</button>
        )}
      </div>
      {hasChildren && open && (
        <div className="dc-tree-children">
          {node.children.map(c => (
            <DCTreeNode key={c.id} node={c} level={level + 1} onAction={onAction} onDetail={onDetail} />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 行为流表格
// ---------------------------------------------------------------------------
const BehaviorTable = ({ rows }) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <div className="placeholder">暂无行为流数据</div>;
  }
  const scoreClass = (v) => (v >= 75 ? 'alert' : v >= 50 ? 'warn' : 'ok');
  return (
    <div className="dc-table-wrap">
      <table className="dc-table">
        <thead>
          <tr>
            <th>时间戳</th>
            <th>主体 ID</th>
            <th>动作类型</th>
            <th>语义标签</th>
            <th>风险评分</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.timestamp}</td>
              <td>{r.subject_id}</td>
              <td>{r.action_type}</td>
              <td>{r.semantic_tag}</td>
              <td className={`dc-score ${scoreClass(r.risk_score)}`}>{r.risk_score}</td>
              <td>
                <span className={`dc-badge ${STATUS_TEXT[r.status] === '告警' ? 'alert' : STATUS_TEXT[r.status] === '预警' ? 'warn' : 'ok'}`}>
                  {STATUS_TEXT[r.status] || r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 安全运营日历
// ---------------------------------------------------------------------------
const DcCalendar = ({ cal }) => {
  if (!cal || !cal.month) return <div className="placeholder">暂无日历数据</div>;
  const [year, month] = cal.month.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsByDay = {};
  (cal.events || []).forEach(ev => {
    const day = parseInt(String(ev.date).split('-')[2], 10);
    (eventsByDay[day] = eventsByDay[day] || []).push(ev);
  });

  const typeColor = { maintenance: '#1a73e8', config: '#722ed1', ml: '#13c2c2', trust: '#52c41a', audit: '#faad14' };
  const typeLabel = { maintenance: '巡检', config: '配置', ml: '模型', trust: '信任', audit: '审计' };
  const weekHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="dc-calendar">
      <div className="dc-cal-month">{cal.month}</div>
      <div className="dc-cal-grid dc-cal-head">
        {weekHeaders.map(d => <div key={d} className="dc-cal-cell dc-cal-weekday">{d}</div>)}
      </div>
      <div className="dc-cal-grid">
        {cells.map((d, i) => {
          const evs = d ? eventsByDay[d] || [] : [];
          return (
            <div key={i} className={`dc-cal-cell ${d ? '' : 'empty'}`}>
              {d && <div className="dc-cal-day">{d}</div>}
              <div className="dc-cal-events">
                {evs.map((ev, j) => (
                  <span
                    key={j}
                    className={`dc-cal-event ${ev.status}`}
                    style={{ borderLeftColor: typeColor[ev.type] || '#999' }}
                    title={`${ev.title}（${ev.status}）`}
                  >
                    {typeLabel[ev.type] || ev.type}·{ev.title}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="dc-cal-legend">
        {Object.entries(typeLabel).map(([k, v]) => (
          <span key={k}><i style={{ background: typeColor[k] }} /> {v}</span>
        ))}
        <span><i className="ok" /> 已完成</span>
        <span><i className="warn" /> 待执行</span>
        <span><i className="alert" /> 失败</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------
const DetectionCenter = () => {
  const [data, setData] = useState({});
  const [status, setStatus] = useState({});
  const [toast, setToast] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [submitState, setSubmitState] = useState('idle');
  const [submitMsg, setSubmitMsg] = useState('');
  const [detailModal, setDetailModal] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const loadSection = useCallback((key, url) => {
    setStatus(s => ({ ...s, [key]: 'loading' }));
    fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => {
        setData(s => ({ ...s, [key]: d }));
        setStatus(s => ({ ...s, [key]: 'ok' }));
      })
      .catch(err => {
        console.error(`[DetectionCenter] 加载 ${key} 失败:`, err);
        setStatus(s => ({ ...s, [key]: 'error' }));
      });
  }, []);

  useEffect(() => {
    Object.entries(DC_ENDPOINTS).forEach(([key, url]) => loadSection(key, url));
  }, [loadSection]);

  // 表单 schema 到达后初始化表单值
  useEffect(() => {
    const schema = data.formSchema && data.formSchema.fields;
    if (schema && Object.keys(formValues).length === 0) {
      const init = {};
      schema.forEach(f => {
        if (f.type === 'multi-select') init[f.name] = [];
        else init[f.name] = f.default !== undefined ? f.default : '';
      });
      setFormValues(init);
    }
  }, [data.formSchema]); // eslint-disable-line

  const handleFieldChange = (name, value) => {
    setFormValues(s => ({ ...s, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(s => { const n = { ...s }; delete n[name]; return n; });
    }
  };

  const toggleMulti = (f, opt) => {
    const cur = Array.isArray(formValues[f.name]) ? formValues[f.name] : [];
    const next = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt];
    handleFieldChange(f.name, next);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const schema = (data.formSchema && data.formSchema.fields) || [];
    const errs = {};
    schema.forEach(f => {
      if (f.required) {
        const v = formValues[f.name];
        const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
        if (empty) errs[f.name] = '必填';
      }
    });
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast('请填写所有必填项');
      return;
    }
    setSubmitState('submitting');
    setSubmitMsg('');
    fetch('/api/v1/detection-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(res => {
        setSubmitState('success');
        setSubmitMsg(`检测策略已成功下发至检测中心（配置 ID：${res.config_id}）`);
        showToast('检测策略已成功下发');
      })
      .catch(err => {
        setSubmitState('error');
        setSubmitMsg('下发失败：' + err.message);
        showToast('下发失败，请确认检测中心服务(:5000)已启动');
      });
  };

  const renderField = (f) => {
    const value = formValues[f.name];
    const err = formErrors[f.name];
    let control;
    if (f.type === 'select') {
      control = (
        <select value={value || ''} onChange={e => handleFieldChange(f.name, e.target.value)}>
          <option value="">请选择</option>
          {(f.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    } else if (f.type === 'multi-select') {
      control = (
        <div className="dc-checkbox-group">
          {(f.options || []).map(opt => (
            <label key={opt} className="dc-checkbox">
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(opt)}
                onChange={() => toggleMulti(f, opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    } else if (f.type === 'slider') {
      control = (
        <div className="dc-slider">
          <input
            type="range"
            min={f.min} max={f.max}
            value={value || f.default}
            onChange={e => handleFieldChange(f.name, Number(e.target.value))}
          />
          <span className="dc-slider-val">{value || f.default}</span>
        </div>
      );
    } else if (f.type === 'number') {
      control = (
        <input
          type="number"
          step={f.step || 'any'}
          min={f.min} max={f.max}
          value={value}
          onChange={e => handleFieldChange(f.name, e.target.value)}
        />
      );
    } else if (f.type === 'duration') {
      control = (
        <input
          type="text"
          placeholder="e.g. 5m, 1h, 30s"
          value={value}
          onChange={e => handleFieldChange(f.name, e.target.value)}
        />
      );
    } else if (f.type === 'json' || f.type === 'textarea') {
      control = (
        <textarea
          rows={f.rows || 3}
          placeholder={f.placeholder || ''}
          value={value}
          onChange={e => handleFieldChange(f.name, e.target.value)}
        />
      );
    } else {
      control = (
        <input
          type="text"
          value={value}
          onChange={e => handleFieldChange(f.name, e.target.value)}
        />
      );
    }
    return (
      <div className="dc-field" key={f.name}>
        <label>
          {f.name}
          {f.required && <span className="dc-req">*</span>}
          {f.type === 'slider' && <span className="dc-hint">（{value || f.default}）</span>}
        </label>
        {control}
        {err && <span className="dc-field-err">{err}</span>}
      </div>
    );
  };

  // 概览卡片数据
  const clusterCount = (data.leftTree && data.leftTree.tree_data) ? data.leftTree.tree_data.length : 0;
  const riskCount = (data.rightTree && data.rightTree.tree_data) ? data.rightTree.tree_data.length : 0;
  const behaviorRows = (data.behaviorTable && data.behaviorTable.rows) ? data.behaviorTable.rows : [];
  const alertCount = behaviorRows.filter(r => r.status === 'alert').length;

  const renderTreePanel = (key, title) => {
    const st = status[key];
    const treeData = data[key] && data[key].tree_data;
    const onAction = (action, name) => showToast(`已触发「${action}」：${name}`);
    const onDetail = (node) => setDetailModal({ node });
    return (
      <div className="dc-panel">
        <h3>{title}</h3>
        {st === 'loading' && <div className="placeholder">加载中...</div>}
        {st === 'error' && (
          <div className="error-box">
            加载失败 <button onClick={() => loadSection(key, DC_ENDPOINTS[key])}>重试</button>
          </div>
        )}
        {st === 'ok' && (
          <div className="dc-tree">
            {(treeData || []).map(n => (
              <DCTreeNode key={n.id} node={n} onAction={onAction} onDetail={onDetail} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (key, render, title, extraHead) => {
    const st = status[key];
    return (
      <div className="dc-panel">
        <div className="dc-panel-head">
          <h3>{title}</h3>
          {extraHead}
        </div>
        {st === 'loading' && <div className="placeholder">加载中...</div>}
        {st === 'error' && (
          <div className="error-box">
            加载失败 <button onClick={() => loadSection(key, DC_ENDPOINTS[key])}>重试</button>
          </div>
        )}
        {st === 'ok' && render()}
      </div>
    );
  };

  const renderDetailModal = () => {
    if (!detailModal) return null;
    const { node } = detailModal;
    const detail = node.detail || {};

    const renderContent = () => {
      if (detail.type === 'rule') {
        return (
          <>
            <p className="dc-modal-summary">{detail.summary}</p>
            <table className="dc-modal-table">
              <thead>
                <tr>
                  <th>规则ID</th>
                  <th>规则名称</th>
                  <th>触发条件</th>
                  <th>响应动作</th>
                  <th>命中次数</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.rule_id}</td>
                    <td>{item.rule_name}</td>
                    <td><code>{item.threshold}</code></td>
                    <td>{item.action}</td>
                    <td>{item.hits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );
      }
      if (detail.type === 'topology') {
        return (
          <>
            <p className="dc-modal-summary">{detail.summary}</p>
            <div className="dc-modal-grid">
              <div>
                <h4>节点</h4>
                <ul className="dc-modal-list">
                  {(detail.nodes || []).map((n, i) => (
                    <li key={i}><strong>{n.name}</strong>（{n.layer}）</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>连接关系</h4>
                <ul className="dc-modal-list">
                  {(detail.edges || []).map((e, i) => (
                    <li key={i} className={e.status}>
                      {e.source} → {e.target}
                      {e.status === 'anomaly' && <span className="dc-modal-tag alert">异常</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        );
      }
      if (detail.type === 'trace') {
        return (
          <>
            <p className="dc-modal-summary">{detail.summary}</p>
            <div className="dc-modal-timeline">
              {(detail.path || []).map((step, i) => (
                <div key={i} className="dc-modal-timeline-item">
                  <div className="dc-modal-step">{step.step}</div>
                  <div className="dc-modal-step-body">
                    <div className="dc-modal-step-time">{step.time}</div>
                    <div className="dc-modal-step-node">{step.node}</div>
                    <div className="dc-modal-step-event">{step.event}</div>
                  </div>
                </div>
              ))}
            </div>
            <h4>关键证据</h4>
            <ul className="dc-modal-list">
              {(detail.evidence || []).map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
            <p className="dc-modal-result">{detail.result}</p>
          </>
        );
      }
      return <pre className="dc-modal-json">{JSON.stringify(detail, null, 2)}</pre>;
    };

    return (
      <div className="dc-modal-overlay" onClick={() => setDetailModal(null)}>
        <div className="dc-modal" onClick={e => e.stopPropagation()}>
          <div className="dc-modal-head">
            <h3>{detail.title || `${node.name} 详情`}</h3>
            <button className="dc-modal-close" onClick={() => setDetailModal(null)}>×</button>
          </div>
          <div className="dc-modal-body">
            {renderContent()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dc-container">
      {toast && <div className="dc-toast">{toast}</div>}
      {renderDetailModal()}

      <div className="dc-header">
        <h2>恶意行为实时检测中心</h2>
        <p className="dc-subtitle">
          融合行为语义分析、图神经网络与可解释信任模型，提供集群/风险实体监控、实时行为流、攻击模式演化与检测策略编排。
        </p>
      </div>

      <div className="dc-cards">
        <div className="dc-card">
          <div className="dc-card-value">{clusterCount}</div>
          <div className="dc-card-label">智能体集群</div>
        </div>
        <div className="dc-card">
          <div className="dc-card-value">{riskCount}</div>
          <div className="dc-card-label">风险实体域</div>
        </div>
        <div className="dc-card">
          <div className="dc-card-value">{behaviorRows.length}</div>
          <div className="dc-card-label">实时行为流</div>
        </div>
        <div className="dc-card alert">
          <div className="dc-card-value">{alertCount}</div>
          <div className="dc-card-label">告警事件</div>
        </div>
      </div>

      <div className="dc-grid-2">
        {renderTreePanel('leftTree', '智能体集群拓扑')}
        {renderTreePanel('rightTree', '风险实体与传播路径')}
      </div>

      <div className="dc-panel">
        <div className="dc-panel-head">
          <h3>实时行为流监控</h3>
          <button
            className="dc-refresh"
            onClick={() => loadSection('behaviorTable', DC_ENDPOINTS.behaviorTable)}
          >刷新</button>
        </div>
        {status.behaviorTable === 'loading' && <div className="placeholder">加载中...</div>}
        {status.behaviorTable === 'error' && (
          <div className="error-box">
            加载失败 <button onClick={() => loadSection('behaviorTable', DC_ENDPOINTS.behaviorTable)}>重试</button>
          </div>
        )}
        {status.behaviorTable === 'ok' && <BehaviorTable rows={behaviorRows} />}
      </div>

      <div className="dc-grid-2">
        {renderSection('abnormalTrend', () => <MultiLineChart data={data.abnormalTrend} />, '协同异常与攻击模式演化趋势')}
        {renderSection('agentDeepAnalysis', () => <MultiLineChart data={data.agentDeepAnalysis} />, '智能体异常行为深度分析')}
      </div>

      <div className="dc-grid-2">
        <div className="dc-panel">
          <h3>检测策略配置下发</h3>
          {status.formSchema === 'loading' && <div className="placeholder">加载表单配置中...</div>}
          {status.formSchema === 'error' && (
            <div className="error-box">
              加载失败 <button onClick={() => loadSection('formSchema', DC_ENDPOINTS.formSchema)}>重试</button>
            </div>
          )}
          {status.formSchema === 'ok' && (
            <form className="dc-form" onSubmit={handleSubmit}>
              {(data.formSchema.fields || []).map(renderField)}
              <div className="dc-form-actions">
                <button type="submit" disabled={submitState === 'submitting'}>
                  {submitState === 'submitting' ? '下发中...' : '下发检测策略'}
                </button>
              </div>
              {submitState === 'success' && <div className="dc-form-msg ok">{submitMsg}</div>}
              {submitState === 'error' && <div className="dc-form-msg alert">{submitMsg}</div>}
            </form>
          )}
        </div>

        {renderSection('report', () => (
          <div className="dc-report">
            <Markdown remarkPlugins={[remarkGfm]}>{data.report.content}</Markdown>
          </div>
        ), '实时检测报告')}
      </div>

      <div className="dc-panel">
        <h3>安全运营日历</h3>
        {status.calendar === 'loading' && <div className="placeholder">加载中...</div>}
        {status.calendar === 'error' && (
          <div className="error-box">
            加载失败 <button onClick={() => loadSection('calendar', DC_ENDPOINTS.calendar)}>重试</button>
          </div>
        )}
        {status.calendar === 'ok' && <DcCalendar cal={data.calendar} />}
      </div>
    </div>
  );
};

export default DetectionCenter;
