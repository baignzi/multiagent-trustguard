# 快速开始指南

## 5分钟快速启动

### Windows用户

1. **双击运行** `start.bat`
2. 等待依赖安装完成
3. 系统会自动打开3个命令行窗口：
   - Detection Center (端口5000)
   - Agent Registry (端口8000)
   - Frontend (端口3000，如果安装了Node.js)

4. 访问以下地址：
   - 前端界面: http://localhost:3000
   - API文档: http://localhost:8000/docs
   - 检测API: http://localhost:5000

### Mac/Linux用户

```bash
cd project
chmod +x start.sh
./start.sh
```

---

## 手动启动（推荐用于开发）

### 步骤1: 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 步骤2: 启动后端服务

**终端1 - 智能体注册服务**:
```bash
python agent_registry.py
```
访问 Swagger UI: http://localhost:8000/docs

**终端2 - 检测中心服务**:
```bash
python detection_center.py
```

### 步骤3: 安装前端依赖（可选）

```bash
cd frontend
npm install
```

### 步骤4: 启动前端（可选）

```bash
npm start
```
访问: http://localhost:3000

---

## 测试API接口

### 使用curl测试

**注册智能体**:
```bash
curl -X POST http://localhost:8000/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent-001",
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
  }'
```

**获取智能体树**:
```bash
curl http://localhost:8000/api/tree
```

**获取行为流数据**:
```bash
curl http://localhost:5000/api/v1/behavior-table
```

**获取检测报告**:
```bash
curl http://localhost:5000/api/v1/markdown-report
```

---

## 常见问题

### Q1: Python依赖安装失败？

**A**: 确保已安装Python 3.8+，并升级pip：
```bash
python -m pip install --upgrade pip
```

### Q2: 端口被占用？

**A**: 修改对应服务文件中的端口号：
- `agent_registry.py`: 最后一行修改 `port=8000`
- `detection_center.py`: 最后一行修改 `port=5000`

### Q3: 前端无法启动？

**A**: 
1. 确认已安装Node.js 16+
2. 删除 `node_modules` 文件夹后重新运行 `npm install`
3. 清除npm缓存: `npm cache clean --force`

### Q4: 数据库文件在哪里？

**A**: SQLite数据库文件 `agents.db` 会在首次运行时自动创建在 `backend/` 目录下

### Q5: 如何切换到MySQL？

**A**: 设置环境变量：
```bash
export DATABASE_URL="mysql+pymysql://user:password@localhost:3306/agent_db"
```
然后安装PyMySQL：
```bash
pip install pymysql
```

---

## 下一步

1. 阅读 [README.md](README.md) 了解完整功能
2. 阅读 [ARCHITECTURE.md](ARCHITECTURE.md) 了解技术架构
3. 访问 Swagger UI 探索所有API接口
4. 查看源代码了解实现细节

---

## 技术支持

如遇问题，请检查：
1. Python/Node.js版本是否符合要求
2. 所有依赖是否正确安装
3. 端口是否被其他程序占用
4. 查看命令行窗口的错误日志
