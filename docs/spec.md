# 智枢 · ZHISHU · HZ-EV Brain

> **杭州智慧充电城市大脑** — *From Pile to Brain · From Charging to Governing*

**Design Specification**
Version 1.0 · 2026-04-30

---

## 0. Executive Summary

**项目名**：智枢（ZHISHU · HZ-EV Brain）— 杭州智慧充电城市大脑

**项目类型**：研究生课程作业（CityU EIE 532 AIoT Technologies）+ 求职 GitHub portfolio

**优先级排序**：GitHub portfolio > 课程 PPT/视频。前者追求工程完成度与视觉冲击；后者作为附带产出（10 页正文 + 封面 + 致谢，最后做）。

**一句话定位**：以杭州为锚点，构建一个**演示驱动、可交互**的城市级 AIoT 充电治理平台，展示研究 / 算法 / 全栈工程能力。

**核心交付**：
- GitHub repo（双语 README + 一键 docker-compose 启动）
- 3-5 分钟 Demo 视频
- 12 页 PPT（最后做）

---

## 1. Background and Problem

### 1.1 痛点（三层）

| 用户层 | 现状痛点 |
|---|---|
| 🚗 **车主** | 多家运营商 App（国网 / 特来电 / 星星 / 蔚来…）信息孤岛；到达发现满员或故障；价格不透明 |
| 🏢 **运营商** | 仅看自家桩，竞品不可见；盲目选址（投建后才发现利用率低）；故障被动响应 |
| 🏛️ **城市管理**（终点） | 全市供需失衡看不见；电网负荷不可控；运营商监管手段弱；新建桩政策无数据支撑 |

### 1.2 为什么是杭州

- 杭州是阿里"城市大脑（City Brain）"全国第一个城市级 AIoT 治理平台样板地
- 多运营商竞争充分，分布在不同地理特征区域
- 真实场景丰富：互联网公司潮汐充电（未来科技城）、新区规划（钱塘新区）、节假日冲击（西湖景区/亚运场馆）

### 1.3 锚点区域

- **未来科技城**（西溪/阿里巴巴/网易）：成熟产业区，工作日下班充电高峰
- **钱塘新区**：新规划区，"该不该建桩"决策支持典型场景

---

## 2. Solution

### 2.1 思路

**统一数据底座 + 三层用户视角 + 6 个治理功能 + 4 个 AI 模型**。

车主端和运营商端是手段，城市管理端是终极价值。Thesis sentence：*"From Pile to Brain, From Charging to Governing."*

### 2.2 6 个治理功能（City Management Console 核心）

| # | 功能 | 一句话定位 | 算法 | 完成度目标 |
|---|---|---|---|---|
| 1 | 全城供需热力图 | 一眼看到"哪里挤、哪里空" | KDE 聚合 + LSTM 1h 预测 | 全功能 |
| 2 | **选址决策支持** ⭐ | "在这建 N 根桩，6 个月后利用率多少？" | XGBoost + SHAP 可解释 | 全功能（旗舰） |
| 3 | 电网协同削峰 | 电网告急时分配降功率指令 | scipy 线性规划 | 核心交互 |
| 4 | 运营商合规仪表盘 | SLA 审计 + 价格异常监控 | z-score 异常检测 | 核心交互 |
| 5 | 应急响应 | 大型事件下的应急调度 | 规则引擎 + LSTM 复用 | 看得到 + 能触发 |
| 6 | 补贴效果评估 | 政府补贴的 ROI 分析 | DID 因果推断 | 散点图 + 表格 |

---

## 3. System Architecture

### 3.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  USER LAYER  前端（3 套界面）                                │
│   🚗 Driver App     🏢 Operator Dashboard    🏛️ City Console│
│   (Web/H5)          (SaaS 浅色)              (主舞台:        │
│                                                深色 IOC 大屏 │
│                                                + 浅色详情页) │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST + WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  CLOUD LAYER  云端（FastAPI 主服务）                         │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │ FastAPI API  │  │ AI 推理服务  │  │ 数据治理     │     │
│   │ + WebSocket  │  │ • LSTM       │  │ • 合成数据   │     │
│   │ + MQTT 订阅  │  │ • XGB+SHAP   │  │   生成器     │     │
│   │ + Celery     │  │ • Autoencoder│  │ • 4 个 mock  │     │
│   │   规则引擎   │  │ • YOLOv8     │  │   运营商适配 │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Mosquitto MQTT broker  +  SQLite 嵌入式数据库       │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │ MQTT / HTTP
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  EDGE LAYER  边缘（独立展示，不入主数据流）                  │
│   ESP32-S3 (Wokwi) × 1 个示范桩                             │
│   • 传感器组（电压/电流/温度/占用/应变/惯性等）              │
│   • PID/Fuzzy 闭环控制                                       │
│   • TFLite Micro 异常检测                                    │
│   • MQTT 客户端                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 数据流（三条主线）

**🔼 上行**：合成器周期性生成 100 桩数据 → SQLite 入库 → AI 服务订阅 → WebSocket 推前端

**🔽 下行（治理动作）**：城市端按按钮 → 后端写规则 → MQTT 下发 → 桩响应

**↔ 异构数据治理**：4 mock 运营商适配器 → 统一 schema → 城市端聚合视图

---

## 4. Single Pile Design

### 4.1 硬件 BOM（仅在 Wokwi 单桩独立展示中实现）

| 组件 | 数量 | 在项目里干什么 |
|---|---|---|
| 电压传感器 | 1 | 测充电输出电压（0-1000V DC） |
| 电流传感器 | 1 | 测充电输出电流（0-300A DC） |
| PT100 RTD | 1 | 桩内功率电子柜温度 |
| NTC 热敏电阻 | 1 | 充电电缆温度（安全关键） |
| 应变片 | 1 | 充电枪头插拔力检测 |
| MPU6050（accel + gyro） | 1 | 桩体倾倒/破坏检测 |
| PIR 人体红外 | 1 | 检测车辆/人接近 |
| 摄像头 OV2640 | 1 | 占位识别 + 车牌识别 |
| DC 接触器 | 1 | 充电主回路通断 |
| PWM 散热风扇 | 1 | 散热（PWM 闭环温控） |
| 电缆电磁锁 | 1 | 充电中锁住插头 |
| RGB LED | 1 | 用户可见状态 |

### 4.2 信号处理流水线

```
ADC 12-bit → 抗混叠滤波（HW）→ FIR 移动平均（16 点）→ 3σ 离群剔除 → 线性校准 y=ax+b → 上报
1 kHz                                                   ↓
                                                       PSD 分析（评估去噪效果）
```

PT100 慢通道用 Callendar–Van Dusen 方程 + 4 线连接消除引线电阻。

### 4.3 PID 充电电流控制

充电跟踪 CC-CV 曲线（Constant Current → Constant Voltage）：

| 阶段 | 设定值 | 控制变量 | 操纵变量 |
|---|---|---|---|
| CC | I = 200A | 充电电流 | DC-DC 变换器 PWM 占空比 |
| CV | V = 410V | 充电电压 | 同上 |

**PID 公式**：`u(t) = Kp·e(t) + Ki·∫e dτ + Kd·de/dt`

CC 阶段整定参数（Z-N 法）：Kp = 0.5, Ki = 2.0, Kd = 0.01。

**数学示例**（PPT/文档展示）：
- I_target = 200A，t=0.50s 时 e(t) = 2A，∫e = 12 A·s，Δt = 0.05s
- u(0.50) = 0.5×2 + 2.0×12 + 0.01×(2−5)/0.05 = **24.4**

### 4.4 模糊逻辑安全兜底

PID 是主控，模糊逻辑并联做安全门，强制限制功率。

**输入**（3 个，每个 3 模糊集）：电缆温度、桩内温度、电网压力
**输出**：功率系数 k ∈ [0%, 100%]
**规则**：27 条 Mamdani 推理 + 中心法去模糊化

样例规则：
1. IF 电缆 = Hot → k = 30%
2. IF 电网 = High AND 电缆 = Warm → k = 60%（电网协同）
3. IF 全部 Cool → k = 100%

最终 PWM 占空比 = `clip(PID输出 × k_fuzzy, 0, 100%)`

### 4.5 Edge AI 异常检测

**Autoencoder 模型**：
- 输入：8 通道 × 32 时间步 = 256 维
- 网络：256 → 16（瓶颈）→ 256
- 量化部署：INT8 TFLite Micro，~50 KB，推理延迟 ~30 ms
- 阈值：训练集重建误差 99 分位数

**异常类型**（合成器注入）：
1. 电流突变（接触不良）
2. 温度异常上升（散热故障）
3. 加速度突变（撞桩/撬桩）
4. 应变片异常（暴力拔枪）

**双轨部署**：
- Edge：TFLite Micro 在 ESP32（Wokwi 演示）
- Cloud：同一份模型在 FastAPI 跑，对 100 个虚拟桩同时检测

---

## 5. City Management Console Design

### 5.1 IOC 首页布局（深色大屏）

```
┌──────────────────────────────────────────────────────────────────────┐
│ [LOGO] HZ-EV BRAIN · 杭州智慧充电城市大脑    [时间][天气][角色切换] │
├──────────────────────────────────────────────────────────────────────┤
│ [KPI 横条 4 卡] 在线桩 | 实时功率 | 今日告警 | 利用率                │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─左侧──────┐ ┌─中央地图（杭州 AMap 暗色）──┐ ┌─右侧──────────────┐│
│ │6 功能入口 │ │ • 桩位脉冲发光               │ │ 实时事件流（滚动）││
│ │1 热力图   │ │ • 区域热力叠加               │ │                   ││
│ │2 选址 AI  │ │ • 未来科技城/钱塘高亮        │ │                   ││
│ │3 电网协同 │ │                              │ │                   ││
│ │4 合规审计 │ │                              │ │                   ││
│ │5 应急响应 │ │                              │ │                   ││
│ │6 补贴评估 │ │                              │ │                   ││
│ │           │ │                              │ │                   ││
│ │系统状态   │ │                              │ │                   ││
│ └───────────┘ └──────────────────────────────┘ └───────────────────┘│
├──────────────────────────────────────────────────────────────────────┤
│ [底栏] 运营商占比饼图 | 24h 利用率曲线 | 异常类型环形图              │
└──────────────────────────────────────────────────────────────────────┘
       ↓ 点击 6 入口或地图任意元素 → 切换到 SaaS 浅色详情页
```

### 5.2 6 功能详情页规格

#### 功能 1：全城供需热力图
- 入口：左侧菜单 / 主页地图
- UI：杭州地图 + 桩位发光点（绿空闲/黄充电/红满员/灰故障）+ 区域热力叠加 + 时间滑块
- 算法：核密度估计（KDE）聚合区域供需比
- 交互：悬停看详情、点击进单桩页、切换实时/历史/预测模式（预测调用 LSTM）

#### 功能 2：选址决策支持（旗舰）
- 入口：左侧菜单
- UI：地图 + "候选选址"模式 → 点击放标记 → 右侧 SHAP 解释面板秒出预测
- 算法：XGBoost 回归 + SHAP value
- 输入特征（12 维）：lat/lng + 1km 内人口密度 + POI 数（商场/写字楼/住宅）+ 已有桩数 + 道路等级 + 运营商
- 输出：6 个月预期利用率 + 95% 置信区间 + Top 3 SHAP 特征贡献
- 交互：多候选并排对比、桩数滑块（5/10/20 根）、ROI 卡片

#### 功能 3：电网协同削峰
- UI：实时电网负荷曲线 + 警戒红线 + 4 运营商当前功率 + 推荐降负荷分配 + 动态定价建议
- 算法：scipy 线性规划，目标 min Σ(降功率比例 × 运营商权重)，约束 ① 总降负荷 ≥ X ② 单运营商降幅 ≤ 30%
- 交互：模拟电网告急按钮 + 看 LP 分配结果 + 5 秒动画看负荷压回

#### 功能 4：运营商合规仪表盘
- UI：4 运营商横向对比表 + 综合评级 A/B/C/D + 详细 drill-down
- 指标：可用率 SLA / 故障响应时间 / 价格异常次数 / 投诉数 / 综合得分
- 算法：z-score 检测价格偏离全市中位数 2σ
- 交互：时间窗口切换 / 排序筛选 / 导出 PDF 报告

#### 功能 5：应急响应
- UI：事件触发器（亚运/演唱会/春节/台风）→ 地图变红色告警态 → 处置预案弹窗
- 算法：YAML 配置预案 + 规则引擎匹配 + LSTM 复用预测影响范围
- 交互：触发事件 → 看动画演变 + 推荐动作

#### 功能 6：补贴效果评估
- UI：散点图（补贴金额 × 利用率提升）+ ROI per yuan 表格 + 政策建议卡片
- 算法：DID 因果推断（合成数据预先标好 treatment/control 组）
- 交互：时间窗口切换 / 按运营商筛选 / 下钻

### 5.3 Design System

#### IOC 深色（首页）
- BG: `#0A0E1A` → `#1A2238` 径向渐变
- Panel: `rgba(20,30,60,0.7)` + backdrop-blur
- Accent cyan: `#00D4FF`（主强调）
- Accent blue: `#4A9EFF`（副强调）
- Warning: `#FFB800`，Danger: `#FF6B35`，Success: `#00FF94`
- Text: `#FFFFFF` / `#A0B0CC` / `#5A6680`
- Title font: `Orbitron`, `Manrope`
- Body font: `Inter`, `PingFang SC`
- Mono font: `JetBrains Mono`

#### SaaS 浅色（详情页）
- BG: `#FFFFFF` / `#F8FAFC`
- Border: `#E2E8F0`
- Accent: `#2563EB`
- Text: `#0F172A`

#### 视觉装饰
- 切角科技边框（CSS clip-path）
- 数字脉冲发光（box-shadow + keyframes）
- 滚动事件流（CSS marquee 或 Framer Motion）
- 数字滚动动画（react-countup）
- 地图桩点脉冲圆环
- 扫描线动效

#### 设计参考
阿里 ET 城市大脑 / 海康 iVMS / 华为 IOC / 阿里 DataV-React。

---

## 6. Communication Protocol Selection

### 6.1 三个 100m 场景

| 杭州场景 | 距离 | 环境 |
|---|---|---|
| 商场地下车库 | 100-300m | 重混凝土屏蔽 |
| 写字楼地面停车 | 50-150m | 开阔少遮挡 |
| 住宅小区充电 | 50-200m | 中等遮挡 |
| 互联网公司园区 | 200-500m | 开阔大尺度 |

### 6.2 协议对比

| 协议 | 频段 | TX | RX 灵敏度 | FSPL@100m | 室内链路余量 | 室内速率 |
|---|---|---|---|---|---|---|
| WiFi 802.11n | 2.4 GHz | 20 dBm | -85 dBm | 80 dB | 5 dB | 1-5 Mbps |
| BLE 5.0 | 2.4 GHz | 10 dBm | -94 dBm | 80 dB | 4 dB | 1 Mbps |
| Zigbee | 2.4 GHz | 4 dBm | -100 dBm | 80 dB | 4 dB | 250 Kbps |
| **LoRaWAN SF7** | 868 MHz | 14 dBm | -123 dBm | 71 dB | **51 dB** ⭐ | 5 Kbps |
| **LoRaWAN SF12** | 868 MHz | 14 dBm | -137 dBm | 71 dB | **65 dB** ⭐ | 0.3 Kbps |
| **NB-IoT** | 700-900 MHz | 23 dBm | -141 dBm | 73 dB | **76 dB** ⭐ | 26 Kbps |
| 4G LTE | 1.8 GHz | 23 dBm | -100 dBm | 78 dB | 30 dB | 10 Mbps |
| 5G NR FR1 | 3.5 GHz | 23 dBm | -94 dBm | 84 dB | 18 dB | 100 Mbps |

### 6.3 选型决策

```
桩内 (距离 < 3m) → I²C / SPI
桩 ↔ 本地网关 (100m 关键) → LoRaWAN SF7 (大商场/居住区) / Zigbee mesh (开阔园区)
网关 ↔ 云 (远距离) → NB-IoT (基础) / 4G LTE (大数据) + MQTT over TCP
```

### 6.4 Shannon 容量推导（两个代表案例）

**WiFi 2.4G 在地下车库 100m**（B = 20 MHz, SNR = 5 dB）：
- C = 20×10⁶ · log₂(1 + 3.16) = 41 Mbps 理论；实际有效吞吐 < 5 Mbps
- BER ≈ 7.7×10⁻⁴ at SNR=5dB

**LoRaWAN SF7 在地下车库 100m**（B = 125 KHz, SNR = -7.5 dB）：
- 数据率 5.47 Kbps；BER < 10⁻⁵

落地：`docs/radio-link-analysis.md`（约 1200 字，含完整推导）

---

## 7. AI Models

### 7.1 总览

| 模型 | 用途 | 框架 | 部署 | 参数量 |
|---|---|---|---|---|
| LSTM | 需求预测 | PyTorch | FastAPI endpoint | ~50K |
| XGBoost + SHAP | 选址决策 | xgboost + shap | FastAPI endpoint | ~100 trees |
| Autoencoder | 异常检测 | PyTorch → TFLite | Edge + Cloud 双轨 | ~70K |
| YOLOv8 | 占位识别 | Ultralytics 预训练 | FastAPI 按需 | ~3M (n 版) |

### 7.2 LSTM 需求预测

- 输入：(24, 8) — 过去 24h × 8 特征（占用率/功率/时间编码/工作日 flag/天气/邻近桩等）
- 输出：下 1h 占用率（标量）+ 置信区间
- 网络：LSTM(64, 2 层) → Dense(32) → Dense(1) → Sigmoid
- 训练：100 桩 × 30 天 = 72K 样本，MSE loss，Adam lr=1e-3，20 epochs，CPU 5 分钟
- 评估：MAE < 0.08（合成数据规律性强）

### 7.3 XGBoost + SHAP 选址决策（旗舰）

- 输入：候选点 12 维特征向量
- 输出：6 个月预期利用率 + 置信区间 + SHAP top-3
- 训练数据：100 真桩 + 1000 虚拟桩历史，特征工程 + Gaussian 噪声
- 评估：R² > 0.85
- SHAP：TreeExplainer，前端展示"特征贡献条形图"

### 7.4 Autoencoder 异常检测

- 网络：256 → 16 (bottleneck) → 256
- 训练：30 天正常数据，PyTorch，MSE，Adam，30 epochs
- 阈值：训练集重建误差 99 分位数
- 部署：PyTorch (Cloud) + ONNX → TFLite INT8 (Edge)
- 评估：注入异常上 F1 > 0.90

### 7.5 YOLOv8 占位识别

- 不训练，直接用 Ultralytics yolov8n.pt（COCO 预训练）
- 推理一张图 < 200ms（CPU）
- 前端 demo：单桩详情页"运行 YOLO"按钮 → 后端推理 → 返回检测框

### 7.6 4 模型 → 6 功能映射

```
合成数据生成器 (后端核心)
    │
    ├─→ 功能 1 热力图 ───── KDE + ⚙️ LSTM 预测
    ├─→ 功能 2 选址 ─────── ⚙️ XGBoost + SHAP ⭐
    ├─→ 功能 3 电网协同 ── 线性规划
    ├─→ 功能 4 合规审计 ── ⚙️ Autoencoder + z-score
    ├─→ 功能 5 应急响应 ── 规则引擎 + ⚙️ LSTM 复用
    └─→ 功能 6 补贴评估 ── DID 统计

单桩详情页
    └─→ ⚙️ YOLOv8 占位识别 + ⚙️ Autoencoder
```

---

## 8. Repository Structure

```
hz-ev-brain/
├── README.md                          # 双语 hero（含 demo 视频嵌入）
├── README.zh.md
├── LICENSE                             # MIT
├── docker-compose.yml                  # 一键启动
├── .env.example
│
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── ai-models.md
│   ├── radio-link-analysis.md
│   ├── design-system.md
│   └── images/
│
├── contracts/                          # ★ Spec-Driven Design
│   ├── openapi.yaml
│   ├── asyncapi.yaml
│   └── operators/
│       ├── state-grid.schema.json
│       ├── teld.schema.json
│       ├── starcharge.schema.json
│       └── nio.schema.json
│
├── backend/
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── api/                # FastAPI routers + WebSocket
│   ├── synth/              # 合成数据生成器（含通信故障注入）
│   ├── adapters/           # 4 个 mock 运营商适配器
│   ├── ai/                 # 4 个 AI 模型
│   ├── mqtt/               # MQTT 订阅器
│   ├── db/                 # SQLite schema
│   └── tests/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── Dockerfile
│   └── src/
│       ├── design-tokens/
│       ├── components/{ui, ioc, map, charts}
│       │   └── map/{MapProvider.tsx, AMapMap.tsx, OSMMap.tsx}
│       ├── pages/
│       │   ├── city-console/  # IOC 首页 + 6 详情页
│       │   ├── operator/
│       │   └── driver/
│       ├── hooks/
│       ├── stores/
│       └── api/
│
├── firmware/
│   └── pile-simulator/     # Wokwi ESP32（独立展示）
│       ├── platformio.ini
│       ├── diagram.json
│       ├── src/
│       └── models/
│
├── infra/
│   └── mosquitto/
│
├── scripts/
│   ├── demo.sh
│   ├── seed_data.sh
│   └── train_all_models.sh
│
└── ppt/
    └── HZ-EV-Brain.pptx (deferred)
```

**关键工程信号**（HR / 面试官扫一眼能注意到）：
- `contracts/` 一级目录 → "我懂 Contract-First Development"
- `docs/` 5 篇 markdown → "我会写技术文档"
- `frontend/components/map/MapProvider.tsx` → "我会做架构解耦"
- `scripts/train_all_models.sh` → "我懂工程化 reproducibility"

---

## 9. Demo Video Script (3-5 min)

| 时间 | 画面 | 旁白 |
|---|---|---|
| 0:00-0:20 | IOC 大屏首页 + 杭州地图脉冲 | 引子：杭州充电运营商孤岛问题 |
| 0:20-0:40 | 架构图 | 三层 AIoT 架构介绍 |
| 0:40-1:10 | 首页地图 + LSTM 预测模式切换 | 功能 1：热力图 + 预测 |
| 1:10-2:00 | 选址决策页 + SHAP 面板 ⭐ | 功能 2：XGBoost + SHAP（重头戏） |
| 2:00-2:30 | 电网告急触发 → LP 分配动画 | 功能 3：电网协同 |
| 2:30-2:50 | 合规审计页（浅色 SaaS） | 功能 4：合规 + 价格异常 |
| 2:50-3:10 | 亚运事件触发 → 场馆周边变红 | 功能 5：应急响应 |
| 3:10-3:30 | 补贴 DID 散点图 | 功能 6：补贴评估 |
| 3:30-3:50 | 单桩详情 + YOLO 推理 + Wokwi 链接 | 边缘 AI 演示 |
| 3:50-4:30 | 技术栈 + GitHub QR | 收尾 |

---

## 10. PPT 12-page Outline (deferred)

1. Cover
2. Background & Problem（三层痛点）
3. Literature Survey（现有 App 对比 + 学术引用）
4. Idea of Solution（"城市大脑·充电模块"）
5. System Architecture（三层架构图）
6. Sensor & Actuator（单桩 BOM）
7. Data Processing + Communication（信号流水线 + 100m 协议表）
8. Control Method（PID + Fuzzy + LP）
9. AI / Mobile / Cloud（4 模型 + 3 端 + 自建云方案）
10. Results & Demo（截图 + 模型评估 + 视频 QR）
11. Conclusion + Future Work（GitHub 链接 + 高速联动等）
12. Thanks

---

## 11. Implementation Roadmap (11 Spawned Sub-conversations)

**Phase 1（串行）**
- Spawn 1: Backend Foundation（FastAPI + 合成数据生成器 + SQLite + docker-compose）
- Spawn 2: API Contracts（OpenAPI + AsyncAPI + 4 运营商 JSON Schema）

**Phase 2（并行）**
- Spawn 3: Frontend Foundation（React + TS + Tailwind + shadcn + AMap MapProvider 抽象 + design tokens + routing）
- Spawn 4: AI Models Training（LSTM + XGBoost+SHAP + Autoencoder + YOLO 集成）

**Phase 3（串行）**
- Spawn 5: City Console - IOC 首页 ⭐（最重要的视觉呈现）
- Spawn 6: City Console - 6 功能详情页

**Phase 4（并行）**
- Spawn 7: Operator + Driver 简化端
- Spawn 8: Wokwi ESP32 firmware
- Spawn 9: Documentation（README + 5 篇 docs）

**Phase 5**
- Spawn 10: Demo Video storyboard + 旁白稿
- Spawn 11: PPT 12 页生成

**预估总时长**：8-12 个工作日（看每天投入）

---

## 12. Constraints and Decisions Log

| 决定 | 原因 |
|---|---|
| 不用 ThingsBoard | 重型 Java 服务，启动慢；自建 FastAPI 更利 portfolio |
| 不用 TimescaleDB / Redis / Nginx | 演示场景不需要；SQLite + asyncio 足够 |
| 100% 合成数据 | 无真实运营商 API；保留 contracts/ 展示 spec design 能力 |
| Wokwi ESP32 独立展示 | 不参与主数据流；避免增加耦合复杂度 |
| YOLO 不自训 | 节省时间，预训练 yolov8n 完全够 demo |
| 高德地图为主，OSM 备 | 杭州地理准确性 + 中文 POI |
| 前端 70% 工作量 | Dashboard 是 portfolio 的"脸" |
| 删除教材引用 | 项目独立性 + 工业风格 |

---

## 13. Out of Scope（明确不做）

- 真实运营商 API 接入
- 用户认证 / 权限管理 / HTTPS
- 生产级日志 / 监控 / 告警
- 高速公路 / 跨城联动场景
- 移动 App 原生开发（Driver 端是 H5）
- ESP32 真实硬件（仅 Wokwi 模拟）
- 数据库迁移 / 性能优化
- 国际化（除 README 双语外，UI 仅中文）

---

## 14. Acceptance Criteria

每个 Spawn 完成后必须满足：

- [ ] 代码能跑通（无导入错误，docker-compose up 成功）
- [ ] 与已有模块兼容（API schema 不冲突）
- [ ] 关键产物落到正确路径
- [ ] 该模块自己的 README 已写
- [ ] 关键算法有注释

整个项目交付时必须满足：

- [ ] `docker-compose up` 一行启动整套 demo
- [ ] 6 个治理功能全部能进入 + 能交互
- [ ] 4 个 AI 模型推理能跑（结果合理）
- [ ] 双语 README + 5 篇 docs 完整
- [ ] Demo 视频上传（链接放 README 顶部）
- [ ] PPT 12 页（最后做）
