# HZ-EV Brain — Claude Code Project Memory

> 本文件被 Claude Code 自动加载为项目级 context。新对话开始时不需要重述项目背景。

## 项目身份

**项目**：HZ-EV Brain（杭州智慧充电城市大脑）
**性质**：研究生课程作业（CityU EIE 532 AIoT Technologies）+ 求职 GitHub portfolio
**优先级**：GitHub portfolio 完成度 > 课程 PPT/视频
**核心目标**：以 Hangzhou 为锚点，构建一个**演示驱动、可交互**的城市级 AIoT 充电治理平台。

**完整设计在** `docs/spec.md` —— 任何具体功能/接口/算法疑问优先查这份。

## 关键约束（不要重新讨论）

1. **数据**：100% 合成数据，无真实 API。但 `contracts/` 目录保留 OpenAPI / AsyncAPI / 4 份运营商 JSON Schema，展示 spec-driven design 能力。
2. **部署**：本地 `docker-compose up` 一行启动，不上线生产。
3. **完成度分配**：前端 70% / 后端 20% / 边缘 10%——前端 dashboard 是 portfolio 的脸。
4. **不用**：ThingsBoard、TimescaleDB、Redis、Nginx、Auth、HTTPS。
5. **必须用**：FastAPI + SQLite + Mosquitto + PyTorch + xgboost + shap + Ultralytics YOLO + React + TS + Vite + Tailwind + shadcn/ui + ECharts + AMap (高德 JS API 2.0) + ESP32 (Wokwi)。

## 系统架构

三层：
- **Edge**：ESP32-S3 (Wokwi) + 传感器 + PID + Fuzzy + TFLite Micro 异常检测。**独立展示，不入主数据流**。
- **Cloud**：FastAPI + 合成数据生成器（100 桩 × 30 天 + 实时滚动 + 通信故障注入）+ 4 AI 模型 + Mosquitto + SQLite。
- **User**：3 套 React 前端（City Console 主、Operator、Driver）。

## 6 个治理功能（City Console 核心）

1. 全城供需热力图（KDE + LSTM）
2. **选址决策支持**（XGBoost + SHAP）⭐ 旗舰
3. 电网协同削峰（线性规划）
4. 运营商合规仪表盘（z-score 异常）
5. 应急响应（规则引擎 + LSTM 复用）
6. 补贴效果评估（DID 因果推断）

## 4 个 AI 模型

| 模型 | 用途 | 框架 | 部署 |
|---|---|---|---|
| LSTM | 需求预测 | PyTorch | FastAPI |
| XGBoost + SHAP | 选址决策 | xgboost + shap | FastAPI |
| Autoencoder | 异常检测 | PyTorch → TFLite | Edge + Cloud |
| YOLOv8 | 占位识别 | Ultralytics 预训练 | FastAPI 按需 |

## Design System

### IOC 深色（City Console 首页）
```
--bg-deep:        #0A0E1A
--bg-panel:       rgba(20,30,60,0.7)
--accent-cyan:    #00D4FF
--accent-blue:    #4A9EFF
--warning:        #FFB800
--danger:         #FF6B35
--success:        #00FF94
--text-primary:   #FFFFFF
--text-secondary: #A0B0CC

font-title: 'Orbitron', 'Manrope'
font-body:  'Inter', 'PingFang SC'
font-mono:  'JetBrains Mono'
```

### SaaS 浅色（详情页）
```
--bg-light:       #FFFFFF / #F8FAFC
--accent-primary: #2563EB
--text-dark:      #0F172A
```

### 视觉装饰
切角科技边框 / 数字脉冲发光 / 滚动事件流 / 数字滚动动画 / 地图桩点脉冲 / 扫描线动效。

参考：阿里 ET 城市大脑 / 海康 iVMS / 华为 IOC / 阿里 DataV-React。

## Repo 路径约定

```
hz-ev-brain/
├── CLAUDE.md         # 本文件
├── README.md         # 双语 hero
├── docker-compose.yml
├── .env.example
├── docs/             # spec.md + 4 篇 docs
├── contracts/        # OpenAPI + AsyncAPI + 4 运营商 schema
├── backend/          # FastAPI + 合成器 + AI 模型 + MQTT
├── frontend/         # React + TS + AMap
├── firmware/         # Wokwi ESP32（独立展示）
├── infra/            # Mosquitto 配置
└── scripts/          # 一键脚本
```

## 11 个 Spawn 路线图

**Phase 1（串行）**：1 Backend Foundation → 2 API Contracts
**Phase 2（并行）**：3 Frontend Foundation || 4 AI Models
**Phase 3（串行）**：5 City IOC Homepage → 6 6 Detail Pages
**Phase 4（并行）**：7 Operator+Driver || 8 Wokwi || 9 Docs
**Phase 5**：10 Demo Video → 11 PPT

每个 spawn 是一个独立的 Claude Code session，启动方式：
```bash
cd /Users/holly/Desktop/EEE\ 532/hz-ev-brain
claude
# 然后粘贴该 spawn 的 prompt
```

## 对话约定

### 语言
- 回复用**中文**
- 代码、文件名、API 路由、变量名用**英文**
- 注释可以中英混用

### 代码规范
- Python：black + ruff，强制 type hints，公共函数有 docstring
- TypeScript：strict 模式，ESLint + Prettier
- 每个目录有 README.md 解释职责 + 用法

### 严格遵守
- 所有 API schema 改动必须先改 `contracts/openapi.yaml` 再改代码
- 前端不能引入新的 UI 组件库（已锁定 shadcn/ui + Tailwind）
- 后端不能引入新的 AI 框架（已锁定 PyTorch + xgboost + Ultralytics）
- Design token 不能临时改（必须在 `frontend/src/design-tokens/` 集中维护）

### 不要做
- 不要建议用 ThingsBoard / Kafka / Redis / 复杂数据库
- 不要做 Auth、HTTPS、生产级日志
- 不要在 main repo 之外写代码
- 不要重启已经定下的架构讨论

## 验收标准（每个 spawn 完成后必检）

- [ ] 代码能跑通（`docker-compose up` 不报错；前端 `npm run dev` 不报错）
- [ ] 与已有模块兼容（API schema 不冲突）
- [ ] 关键产物落到正确路径
- [ ] 该模块自己的 README 已写

## 关键参考

- 设计参考：阿里 ET 城市大脑 / 海康 iVMS / 华为 IOC / 阿里 DataV-React
- 杭州地理：未来科技城（西溪/阿里巴巴）+ 钱塘新区
- 高德 JS API 2.0：key 配在 `.env` 的 `VITE_AMAP_KEY`

## 如果要查具体设计细节

读 `docs/spec.md`，14 章包含：
- Background + Solution
- 三层架构 + 数据流
- 单桩硬件 BOM + PID + Fuzzy + Edge AI
- 6 功能详情页规格
- 100m 协议对比 + Shannon 推导
- 4 AI 模型详细设计
- Repo 结构 + Demo 脚本 + Spawn 路线图
- 决策日志 + Out of Scope + 验收标准
