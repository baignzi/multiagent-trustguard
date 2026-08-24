#!/bin/bash
# 多智能体恶意行为防御与信任评估系统 - 启动脚本

echo "========================================="
echo "  多智能体恶意行为防御与信任评估系统"
echo "========================================="
echo ""

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python 3.8+"
    exit 1
fi

# 检查Node.js环境
if ! command -v node &> /dev/null; then
    echo "警告: 未找到Node.js，前端功能将不可用"
fi

# 安装后端依赖
echo "[1/4] 安装后端Python依赖..."
cd backend
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "错误: Python依赖安装失败"
    exit 1
fi
cd ..

# 安装前端依赖
if command -v npm &> /dev/null; then
    echo "[2/4] 安装前端Node.js依赖..."
    cd frontend
    npm install
    if [ $? -ne 0 ]; then
        echo "警告: Node.js依赖安装失败，前端可能无法正常运行"
    fi
    cd ..
else
    echo "[2/4] 跳过前端依赖安装(Node.js未安装)"
fi

# 启动后端服务
echo "[3/4] 启动后端服务..."
echo "  - Agent Registry Service: http://localhost:8000"
echo "  - Detection Center Service: http://localhost:5000"
echo ""

# 在后台启动Flask检测中心服务
cd backend
python detection_center.py &
DETECTION_PID=$!
cd ..

# 在后台启动FastAPI智能体注册服务
cd backend
python agent_registry.py &
REGISTRY_PID=$!
cd ..

echo "[4/4] 后端服务已启动"
echo ""

# 启动前端(如果Node.js可用)
if command -v npm &> /dev/null; then
    echo "启动前端开发服务器..."
    echo "  - Frontend: http://localhost:3000"
    echo ""
    cd frontend
    npm start &
    FRONTEND_PID=$!
    cd ..
else
    echo "前端服务未启动(Node.js未安装)"
    echo "您可以手动访问后端API:"
    echo "  - Swagger UI: http://localhost:8000/docs"
    echo "  - Detection API: http://localhost:5000"
fi

echo ""
echo "========================================="
echo "  系统启动完成!"
echo "========================================="
echo ""
echo "进程ID:"
echo "  - Detection Center (Flask): $DETECTION_PID"
echo "  - Agent Registry (FastAPI): $REGISTRY_PID"
if [ -n "$FRONTEND_PID" ]; then
    echo "  - Frontend (React): $FRONTEND_PID"
fi
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "kill $DETECTION_PID $REGISTRY_PID ${FRONTEND_PID:-} 2>/dev/null; echo '服务已停止'; exit" INT TERM

wait
