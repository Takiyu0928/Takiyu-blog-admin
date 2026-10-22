# 风格派 × 浮世绘：维护提示词

参考：[TasteUX 已确认组合](https://tasteux.com/#mix=de-stijl+ukiyo-e)。以根目录 DESIGN.md 为准。

## 写代码用的提示词

```text
为 TakiyuUI 使用 De Stijl 骨架 × Ukiyo-e 表皮，仅调整视觉，不重做业务或表单交互。
--bg: #f7f4ec; --surface: #efeae0;
--ink: oklch(0.22 0.04 255); --muted: oklch(0.42 0.04 250);
--line: oklch(0.3 0.04 255); --accent: oklch(0.42 0.11 245);
--on-accent: #fcfaf4; --accent2: oklch(0.6 0.18 35); --accent3: oklch(0.74 0.11 75);
米白保持用户指定值；允许三个强调色。大部分米白，彩色格少于30%。
标题 Archivo Black 400 uppercase，字距0；中文标题700；正文 Archivo 400/600。
6px深靛水平垂直分区、无圆角无阴影；首页左侧任务与统计、右侧跨行竖画、下方最近文章。
复用现有 DOM；小屏先任务/统计/最近文章，再插图；不得横溢。
主要按钮普鲁士蓝配纸白；朱红只作无文字小色块；赭黄配深墨蓝，夜间也不改为浅色字。
/assets/ukiyo-stijl-v4.png：1024×1536、2:3、完整contain，不裁切不叠字；曲线只在图内。
页面不铺纸纹，无渐变/玻璃；交互箭头用→；保留手动深色、键盘焦点与reduced-motion。
保留写作/预览/发布设置、日期/source保存、11类配置与demo提示；不改API、鉴权、依赖、测试。
不要使用渐变文字、默认玻璃卡片、通用圆角阴影卡片网格。
```

## 主视觉提示词（规格记录，不在此任务执行生图）

```text
A vertical coastal woodblock print for a personal writing studio, ukiyo-e woodblock print, Edo period, flat color areas, fine dark indigo keylines, washi paper, asymmetric rectangular division by thick dark indigo horizontal and vertical lines, palette of Prussian blue, vermilion, ochre, washi cream and sumi ink, featuring great waves, banded clouds and pine branches. Portrait 2:3, generous cream areas, no lettering. Curves belong only to the illustrated waves, never to the enclosing grid.
Negative: diagonal structural lines, photorealistic, neon, 3d render, lens flare, heavy gradient, UI mockup, lettering
```
