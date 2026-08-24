import React, { useState, useEffect } from 'react';
import './styles/index.css';

const TreeNode = ({ node, onToggle, expandedNodes, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(expandedNodes.has(node.id));
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isLeaf = !hasChildren;

  useEffect(() => {
    setIsExpanded(expandedNodes.has(node.id));
  }, [expandedNodes, node.id]);

  const toggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
      onToggle(node.id, !isExpanded);
    }
  };

  return (
    <div className="tree-node" style={{ marginLeft: `${level * 20}px` }}>
      <div className="tree-node-header" onClick={toggle}>
        {hasChildren && (
          <span className={`tree-toggle ${isExpanded ? 'expanded' : ''}`}>▸</span>
        )}
        <span className="tree-node-name">{node.name}</span>
        {node.button && (
          <button className="tree-button">
            <img src={node.button.icon} alt={node.button.text} className="button-icon" />
            {node.button.text}
          </button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              onToggle={onToggle}
              expandedNodes={expandedNodes}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TreeView = ({ data, title, onNodeClick }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set(['cluster-01', 'cluster-02']));

  const handleToggle = (id, isExpanded) => {
    const newSet = new Set(expandedNodes);
    if (isExpanded) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setExpandedNodes(newSet);
  };

  return (
    <div className="tree-container">
      <h3 className="tree-title">{title}</h3>
      <div className="tree-root">
        {Array.isArray(data) &&
          data.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              onToggle={handleToggle}
              expandedNodes={expandedNodes}
            />
          ))}
      </div>
    </div>
  );
};

const FormField = ({ field, value, onChange }) => {
  const handleChange = e => {
    onChange(field.name, e.target.value);
  };

  if (field.type === 'select' || field.type === 'multi-select') {
    return (
      <div className="form-group">
        <label>{field.name}</label>
        {field.type === 'select' ? (
          <select value={value || ''} onChange={handleChange}>
            <option value="">请选择</option>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <select multiple value={value || []} onChange={handleChange}>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  if (field.type === 'slider') {
    return (
      <div className="form-group">
        <label>{field.name} ({value || field.default})</label>
        <input
          type="range"
          min={field.min}
          max={field.max}
          value={value || field.default}
          onChange={handleChange}
        />
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="form-group">
        <label>{field.name}</label>
        <input
          type="number"
          step={field.step || 'any'}
          min={field.min}
          max={field.max}
          value={value || field.default}
          onChange={handleChange}
        />
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="form-group">
        <label>{field.name}</label>
        <textarea
          rows={field.rows || 3}
          value={value || ''}
          onChange={handleChange}
        />
      </div>
    );
  }

  if (field.type === 'json') {
    return (
      <div className="form-group">
        <label>{field.name}</label>
        <textarea
          rows="3"
          placeholder={field.placeholder}
          value={value || ''}
          onChange={handleChange}
        />
      </div>
    );
  }

  if (field.type === 'duration') {
    return (
      <div className="form-group">
        <label>{field.name}</label>
        <input
          type="text"
          placeholder="e.g., 5m, 1h, 30s"
          value={value || field.default}
          onChange={handleChange}
        />
      </div>
    );
  }

  return (
    <div className="form-group">
      <label>{field.name}</label>
      <input
        type="text"
        value={value || ''}
        onChange={handleChange}
        required={field.required}
      />
    </div>
  );
};

export { TreeView, FormField };
export default TreeNode;
