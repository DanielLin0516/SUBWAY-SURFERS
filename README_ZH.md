# SUBWAY-SURFERS

中文 ｜ [English](./README.md)

用 three.js 和 TypeScript 做的三跑道无限跑酷。

> 线上体验地址 <https://subway-surfers-threejs.vercel.app/> 在这个分支部署之前，仍然是**旧版**。

## 操作

| | 键盘 | 手机 |
|---|---|---|
| 换道 | ← → 或 A D | 左右滑 |
| 跳 | ↑、W 或空格 | 上滑 |
| 滑铲（空中按：快速落地再滑铲） | ↓ 或 S | 下滑 |
| 暂停 | Esc 或 P | 暂停键 |
| 音效开关 | M | 音效键 |

手指一移动到位就触发，不用等抬起；同一次触摸可以连滑两次。直屏、横屏都能玩。

## 功能

- **跑道式碰撞**：每个障碍是「沿跑道的区间 × 所在跑道 × 高度区间」，玩家是一个小盒子，用区间比较，结果确定、可重复。宽容处理：离开跑道时擦到角不算；换道撞到侧面会被弹回并踉跄（4.5 秒内踉跄两次才被抓）；从上方落到低障碍或车顶上可以站上去。
- **障碍**：低路障（跳）、栏杆（跳或滑）、高门架（滑）、列车（躲开，或从斜坡跑上车顶）。
- **手感**：换道快且有缓动（0.15 秒）、空中可换道、跳跃输入缓冲（落地前按跳也算）、土狼时间、快速下落、滑铲中可直接起跳、速度从 12 慢慢加到 27 m/s。
- **无限地图**：每段约 100 米，用之前先做一次路径搜索，确保一定有路可走；难度随距离提高；金币沿着这条路摆放。
- **金币、分数倍率**（每 800 米加一）、**最高纪录**和金币总数存在 localStorage。
- **道具**：磁铁、弹簧鞋（可以直接跳上车顶）、双倍得分。
- **声音**：全部用 WebAudio 合成（不载入音频文件），背景节奏会随速度加快。
- **画面**：加载画面（按真实下载字节显示进度）、开始、暂停、结果画面；繁中、简中、英文，按浏览器语言自动选择。
- **性能**：重复的东西都用 InstancedMesh，每帧按游戏状态重写（游戏中不新建物件）；光源固定，开始前把所有着色器编译好；像素比最多 2，帧率低时自动降低。

## 开发

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 打包到 dist/
npm run preview    # 在 http://localhost:4173 预览 dist/
```

### 模型

`public/assets/core.glb`（主角、列车、路障、金币，首屏必需）和 `public/assets/scenery.glb`（房子，背景加载）由 `art/source-glb/` 里的原始模型用 Blender 生成：

```bash
npm run assets     # Blender 后台模式跑 tools/build_assets.py，再跑 tools/slim_glb.mjs
```

### 测试

测试用无头 Chrome 加 DevTools 协议驱动打包好的游戏。网址带 `?test` 时会有 `window.__run`（推进时间、放置障碍、模拟输入、读取状态）。

```bash
npm run build && npm run preview &
google-chrome --headless=new --remote-debugging-port=9222 &
CDP_PORT=9222 GAME_URL=http://127.0.0.1:4173/ node tests/e2e.mjs     # 碰撞、手感、地图、物件池、着色器
CDP_PORT=9222 GAME_URL=http://127.0.0.1:4173/ node tests/input.mjs   # 滑动和按键
```

## 目录

```
src/sim/      游戏规则，不依赖 three.js：sim.ts（玩家、碰撞、拾取）、track.ts（地图 + 路径搜索）
src/view/     three.js：world.ts（场景、镜头）、player.ts、pools.ts（实例化）、fx.ts、textures.ts
src/          main.ts（状态、主循环、测试入口）、ui.ts、input.ts、audio.ts、i18n.ts、storage.ts
tools/        build_assets.py（Blender）、slim_glb.mjs
tests/        浏览器测试
```
