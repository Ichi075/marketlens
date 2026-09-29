![并排显示 SPY 和 QQQ 图表的 MarketLens 界面](assets/marketlens-workspace.png)

# MarketLens

[English](README.md) | [日本語](README.ja.md) | **简体中文**

MarketLens 是一款基于 Tauri 2 的股票行情应用，支持 Windows、macOS 和 Android。界面并排显示两张 TradingView 图表，默认标的为 SPY 和 QQQ，默认周期为 5 分钟。绘图工具栏可用于添加水平线等标注。通过汉堡菜单打开自选股列表，在图表上方输入股票代码或点击列表中的股票，即可切换图表。

## HTML 演示

直接在浏览器中打开 [demo.html](demo.html)，无需构建即可体验界面。可以试用自选股排序、候选股票卡片、代码输入、侧边栏开关和主题切换。演示中的价格与候选评分仅为示例。TradingView 图表需要联网，某些浏览器环境可能会限制嵌入内容。

## 主要功能

- 显示所提供截图中的 21 只股票，并按相对前收盘价的涨跌幅从高到低排序。
- 在自选股列表中显示股票代码、当前价格和涨跌幅。
- 根据所提供的 PB Investing 逻辑说明，分别展示 3 只强势候选股和 3 只弱势候选股。
- 自动监控重要价位突破、已完成的5分钟K线确认、回测和方向反应。
- Active Setup状态时间线、仅在首次进入`SETUP_READY`时发送的系统通知，以及本地Paper Mode记录。
- 两张独立的 TradingView 图表、保存所选代码、手动刷新和分层报价刷新。
- 默认使用深色主题，并保存浅色／深色主题偏好。
- 保存盘前盘后时段、VWAP 和 8 EMA 的图表设置，并在切换股票时重新应用。

## 本地运行

先安装 [Rust](https://www.rust-lang.org/tools/install)、[Tauri 的依赖环境](https://tauri.app/start/prerequisites/)和 [pnpm](https://pnpm.io/installation)，然后在项目根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

各平台的依赖、构建命令和产物位置见[构建指南](BUILDING.zh-CN.md)。`pnpm dev` 可在浏览器中打开前端。开发模式通过 Vite 代理获取报价；打包后的 Tauri 应用通过 Rust 获取报价。

## Setup监控

现有Strong / Weak排名继续作为第一层筛选。正常交易时段内，Strong Top 3作为CALL候选，Weak Top 3作为PUT候选。PMH/PML取04:00–09:30 ET，PDH/PDL取前一交易日正常时段，VWAP使用当日正常时段的OHLC典型价格与成交量。缺少OHLC的K线会被排除，不会用收盘价补造。

状态依次为`CANDIDATE → BREAKOUT_DETECTED → BREAKOUT_CONFIRMED → RETEST_WAIT → RETEST_DETECTED → SETUP_READY`。CALL优先使用PMH、PDH、VWAP，PUT优先使用PML、PDL、VWAP。确认只使用突破之后已完成的5分钟K线；回测守住价位后，还需要下一根1分钟K线向目标方向反应。数据过旧时禁止新的READY通知。

PB Investing资料提供的是相对强弱、重要价位、5分钟确认和回测这一套定性流程。评分权重、容差、VWAP过滤、候选替换、数据时效和过期时间均为MarketLens为了量化与测试而制定的规则。`SETUP READY`仅表示条件匹配，不构成交易指令。

默认值集中在`src/config.ts`：全列表90秒刷新，活跃标的20秒刷新，回测容差0.15%，失效容差0.30%，Setup期限45分钟，候选离榜宽限10分钟，数据过旧阈值180秒。CALL与PUT默认都要求VWAP条件。

## 报价与候选股排序

图表使用 TradingView 嵌入式组件。侧边栏另行从 Yahoo Finance 的公开图表接口获取包含盘前盘后时段的 1 分钟数据。该接口并非官方授权的数据服务，报价可能延迟、受到访问限制或无法获取。无法获取价格时，应用会显示不可用，不会填入虚构数字。常规交易时段以外，报价和候选股计算可能采用不同交易时段的价格。

候选股评分以QQQ为基准，并将QQQ、SPY和IWM排除。所有数值权重与排名阈值都是MarketLens实现规则，并非PB Investing公开的数值。

应用启动时获取一次5天历史以建立前一交易日价位。之后全列表每90秒获取1天数据，活跃候选、Setup、SPY、QQQ和当前图表代码每20秒获取1天数据。`MarketDataProvider`隔离数据源代码，未来可用Polygon、Alpaca或Finnhub实现替换`YahooFinanceProvider`。Yahoo Finance图表接口并非官方授权的数据服务，不保证实时性、完整性或可用性。正式告警应使用可靠且有授权的市场数据。

MarketLens VWAP按正常交易时段的`(high + low + close) / 3 × volume`计算。TradingView可能采用不同的数据或时段规则，因此两者数值可能略有差异。

## TradingView 组件的限制

免费嵌入式组件不会向 MarketLens 提供完整的图表布局。应用无法保存或恢复在 TradingView 内绘制的图形或修改的指标设置。切换主题或股票时会重新加载图表，这些修改也会丢失。要完整保存布局，需要取得 TradingView Advanced Charts 库的使用权限，并接入独立的数据源和存储服务。

8 EMA 的周期设置会生效，但免费组件对单个指标颜色的覆盖设置支持不稳定，因此 MarketLens 无法保证 VWAP 默认显示为黄色。TradingView 内部的股票选择器也不会同步控制 MarketLens 的侧边栏。

## 项目结构

- `src/main.ts`：界面集成、图表和两级刷新调度
- `src/market.ts`：涨跌幅和候选股评分
- `src/setup.ts`：重要价位、5分钟聚合和纯状态机
- `src/config.ts`：排名与Setup阈值
- `src/provider.ts`：可替换数据源与Yahoo Finance实现
- `src/notifications.ts`：权限检查与去重系统通知
- `src/storage.ts`：Setup历史与Paper Mode
- `src-tauri/src/lib.rs`：报价获取与数据整理
- `src/style.css`：桌面与移动端布局
- `demo.html`：独立 HTML 演示
- `BUILDING.zh-CN.md`：各平台构建指南
