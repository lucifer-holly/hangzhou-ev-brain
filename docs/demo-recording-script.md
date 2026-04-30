# Demo Recording Script（3-4 分钟）

这份稿子用于录制项目 demo。  
**中文部分是录屏操作提示和讲解重点，不需要读出来。**  
**English Script 是真正口播内容，尽量保持简单、自然、口语化。**

---

## 0:00-0:20 开场：首页刚进入

### 画面怎么做

打开系统，停在城市端首页，也就是 `City Overview · 城市总览`。  
先不要点东西，让观众看到完整大屏。

### 重点讲什么

先用一句话告诉观众：这是一个杭州充电桩城市管理 demo，有实时数据、AI 预测、城市端、运营商端、车主端。

### English Script

Hi everyone, this is **Zhishu**, a smart EV charging city brain demo for Hangzhou.

It shows how a city can monitor charging piles, predict future demand, and support different users, including city managers, operators, and drivers.

All the data here is synthetic, but the system flow is complete: frontend dashboard, backend API, real-time updates, and AI models.

---

## 0:20-1:05 首页总览：先讲整体布局

### 画面怎么做

鼠标从上到下慢慢扫一遍：

1. 顶部 logo、系统状态、天气、时间、`Switch Console`
2. 中间 KPI：在线桩、实时功率、故障、利用率
3. 大地图
4. 右侧实时事件流
5. 底部图表和 `AI Models`

### 重点讲什么

这里不要讲太复杂。重点说：这个页面是城市管理者第一眼看到的总览，用来快速判断全城充电网络是否正常。

### English Script

After logging in, we first arrive at the **city overview page**.

This page is designed for city managers. The goal is to give a quick picture of the whole charging network.

At the top, we can see system status, weather, time, and the console switcher.

Here are the key numbers: online piles, live power, current faults, and utilization rate.

The large map shows charging piles across Hangzhou. Each point represents one pile, and the color shows its current status, like idle, charging, fault, or offline.

On the right side, we have a live event stream. It updates when new alerts or status changes happen.

At the bottom, we also show summary charts and the AI model cards.

---

## 1:05-1:45 首页预测功能：Forecast

### 画面怎么做

点击右上模式切换里的 **预测 Forecast**。  
等待它出现预测结果，比如：

- `未来 1 小时预测 · LSTM 模型`
- `[FORECAST]`
- 预测利用率
- 预测完成的 toast 提示

### 重点讲什么

这是首页最重要的一段。  
重点讲：点击 Forecast 后，系统不是看“现在”，而是预测“未来 1 小时”。  
用非常简单的话解释 LSTM：它根据历史和当前数据预测未来需求。

### English Script

Now I will switch from live mode to **Forecast** mode.

When I click this button, the system calls the LSTM demand prediction model.

Instead of only showing the current situation, the map now shows the predicted utilization for the next one hour.

This helps city managers see possible pressure before it happens.

For example, if one area is going to become busy soon, the city can prepare earlier, such as guiding traffic, adjusting charging strategy, or coordinating operators.

So the key idea is simple: we do not only react to problems. We try to predict them first.

---

## 1:45-2:50 左侧边栏功能：一个一个快速展示

### 画面怎么做

按左侧顺序点击，每个页面停大约 8-10 秒。  
不用每页讲太久，只讲“这个页面解决什么问题”。

展示顺序：

1. `Overview · 总览`
2. `Heatmap · 热力图`
3. `Site Selection · 选址`
4. `Grid Coordination · 电网协同`
5. `Compliance · 合规审计`
6. `Emergency · 应急响应`
7. `Subsidy · 补贴评估`

### 1. Overview 总览

#### 操作

如果已经在首页，可以不用点，简单指一下左侧 `Overview`。

#### English Script

The first module is **Overview**.

This is the main control room for the city. It gives a real-time summary of the whole charging network.

### 2. Heatmap 热力图

#### 操作

点击 `Heatmap · 热力图`。

#### 重点

讲“哪里需求高，哪里压力大”。

#### English Script

The second module is **Heatmap**.

This page shows demand and supply pressure on the city map.

It helps us quickly understand which areas are busy, which areas are under-used, and how the pressure changes over time.

### 3. Site Selection 选址

#### 操作

点击 `Site Selection · 选址`。  
如果页面里能点地图，可以点一下候选位置。

#### 重点

讲“用 AI 帮忙判断新桩建在哪里比较好”。

#### English Script

The third module is **Site Selection**.

This is for deciding where to build new charging piles.

We can choose a candidate location on the map, and the AI model predicts its future utilization.

It also explains the result with SHAP, so we can see why this place is good or bad.

For example, nearby population, office areas, and existing piles can all affect the score.

### 4. Grid Coordination 电网协同

#### 操作

点击 `Grid Coordination · 电网协同`。

#### 重点

讲“电网压力大时，系统怎么分配降功率任务”。

#### English Script

The fourth module is **Grid Coordination**.

This page focuses on the power grid.

When the grid load is too high, the system calculates how to reduce charging power across different operators.

The goal is to reduce peak pressure while keeping the service as fair as possible.

### 5. Compliance 合规审计

#### 操作

点击 `Compliance · 合规审计`。

#### 重点

讲“监管不同运营商表现”。

#### English Script

The fifth module is **Compliance**.

This page compares different charging operators.

It checks availability, fault response time, and abnormal pricing.

Then it gives each operator a rating, such as A, B, C, or D.

This is useful for city-level supervision.

### 6. Emergency 应急响应

#### 操作

点击 `Emergency · 应急响应`。  
如果页面有事件按钮，可以点一个事件触发器。

#### 重点

讲“遇到突发事件，系统给处理预案”。

#### English Script

The sixth module is **Emergency Response**.

This page is used for special events, such as bad weather, large traffic events, or sudden failures.

After we trigger an event, the system highlights the affected area and gives a response plan.

For example, it can suggest user guidance, temporary power limits, or mobile charging support.

### 7. Subsidy 补贴评估

#### 操作

点击 `Subsidy · 补贴评估`。

#### 重点

讲“政府补贴有没有真的有效”。

#### English Script

The last city module is **Subsidy Evaluation**.

This page helps the government understand whether a subsidy policy really works.

It compares subsidized piles with control groups and estimates the real improvement.

So the city can decide where to continue subsidies and where to reduce the budget.

---

## 2:50-3:35 Switch Console：运营商端和车主端

### 画面怎么做

回到右上角，点击 `Switch Console · 切换端`。

先点：

1. `运营商 Operator`
2. 再点右上 `Switch Console`
3. 点 `车主端 Driver`

### 运营商端 Operator

#### 重点

讲“同一套系统，换成运营商视角，只看自己的桩、收益、告警、排名”。

#### English Script

Now I will switch to the **Operator Console**.

This view is for charging operators.

Different from the city view, the operator mainly cares about its own piles.

Here we can see my pile count, live power, today’s alerts, utilization ranking, pile map, event list, revenue, and benchmark comparison.

So this page is more like a daily operation dashboard for a charging company.

### 车主端 Driver

#### 重点

讲“车主不是看监管数据，而是找附近充电桩、看等待时间、预约”。

#### English Script

Next, I will switch to the **Driver App**.

This is a mobile-style interface for normal EV drivers.

The driver can search nearby charging piles, check distance, price, and predicted waiting time.

The waiting time uses the LSTM forecast, so it is not only based on the current status.

The driver can also switch between map view and list view, and make a demo reservation.

---

## 3:35-4:00 结尾总结

### 画面怎么做

停在车主端，或者切回城市端首页都可以。  
如果想显得完整，建议最后切回城市端首页。

### 重点讲什么

最后总结三类用户：城市、运营商、车主。  
一句话收束：同一套数据，服务三个不同角色。

### English Script

To summarize, this demo connects three views.

The city console helps managers monitor and predict the whole network.

The operator console helps companies manage their own piles and performance.

The driver app helps users find and reserve charging piles more easily.

So the same data system supports city governance, operator efficiency, and driver experience at the same time.

That is the main idea of Zhishu.
