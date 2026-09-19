# MarketLens

[English](README.md) | [日本語](README.ja.md) | **简体中文**

MarketLens 是一款基于 Tauri 2 的股票行情应用，支持 Windows、macOS 和 Android。界面并排显示两张 TradingView 图表，默认标的为 SPY 和 QQQ，默认周期为 5 分钟。绘图工具栏可用于添加水平线等标注。通过汉堡菜单打开自选股列表，在图表上方输入股票代码或点击列表中的股票，即可切换图表。

## HTML 演示

直接在浏览器中打开 [demo.html](demo.html)，无需构建即可体验界面。可以试用自选股排序、候选股票卡片、代码输入、侧边栏开关和主题切换。演示中的价格与候选评分仅为示例。TradingView 图表需要联网，某些浏览器环境可能会限制嵌入内容。

## 主要功能

- 显示所提供截图中的 21 只股票，并按相对前收盘价的涨跌幅从高到低排序。
- 在自选股列表中显示股票代码、当前价格和涨跌幅。
- 根据所提供的 PBInvesting 逻辑说明，分别展示 3 只强势候选股和 3 只弱势候选股。
- 两张独立的 TradingView 图表、保存所选代码、手动刷新，以及每两分钟自动刷新报价。
- 默认使用深色主题，并保存浅色／深色主题偏好。
- 保存盘前盘后时段、VWAP 和 8 EMA 的图表设置，并在切换股票时重新应用。

## 本地运行

先安装 [Rust](https://www.rust-lang.org/tools/install)、[Tauri 的依赖环境](https://tauri.app/start/prerequisites/)和 [pnpm](https://pnpm.io/installation)，然后在项目根目录运行：

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

各平台的依赖、构建命令和产物位置见 [BUILDING.md](BUILDING.md)（日文）。`pnpm dev` 可在浏览器中打开前端。开发模式通过 Vite 代理获取报价；打包后的 Tauri 应用通过 Rust 获取报价。

## 报价与候选股排序

图表使用 TradingView 嵌入式组件。侧边栏另行从 Yahoo Finance 的公开图表接口获取包含盘前盘后时段的 1 分钟数据。该接口并非官方授权的数据服务，报价可能延迟、受到访问限制或无法获取。无法获取价格时，应用会显示不可用，不会填入虚构数字。常规交易时段以外，报价和候选股计算可能采用不同交易时段的价格。

候选股的暂定评分以 QQQ 为基准，并将 QQQ、SPY 和 IWM 排除在候选股排名之外。常规交易时段的评分结合：相对当日首根 K 线的收益率（45%）、最近 5 分钟的相对收益率（30%）、相对近似 VWAP 的位置（15%，VWAP 由收盘价近似计算），以及最近成交量与此前 20 根 K 线的比较（10%）。盘前评分以前收盘价为基准，结合相对跳空幅度（70%）和近期相对动量（30%）。新候选股需要连续两次刷新都比现有候选股高出至少 5 分，才会替换现有候选股。这些分数只是实现中的估算值，不代表价格预测或交易信号。

说明资料中的盘前高低点（PMH/PML）、更严格的相对成交量和流动性筛选尚未在这个 MVP 中实现。正式使用需要可靠的盘中数据提供方。

## TradingView 组件的限制

免费嵌入式组件不会向 MarketLens 提供完整的图表布局。应用无法保存或恢复在 TradingView 内绘制的图形或修改的指标设置。切换主题或股票时会重新加载图表，这些修改也会丢失。要完整保存布局，需要取得 TradingView Advanced Charts 库的使用权限，并接入独立的数据源和存储服务。

8 EMA 的周期设置会生效，但免费组件对单个指标颜色的覆盖设置支持不稳定，因此 MarketLens 无法保证 VWAP 默认显示为黄色。TradingView 内部的股票选择器也不会同步控制 MarketLens 的侧边栏。

## 项目结构

- `src/main.ts`：界面、图表和报价刷新
- `src/market.ts`：涨跌幅、VWAP 和候选股评分计算
- `src-tauri/src/lib.rs`：报价获取与数据整理
- `src/style.css`：桌面与移动端布局
- `demo.html`：独立 HTML 演示
- `BUILDING.md`：各平台构建指南（日文）
