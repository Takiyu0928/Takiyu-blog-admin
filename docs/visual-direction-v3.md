# TakiyuUI visual direction v3

主 · Minimalism（骨架），副 · Ukiyo-e（表皮）。

大面积留白，只放一张木版画。style-mix 用于限制母题归属：海岸、松树、波纹、纸纹只留在独立艺术品中，不进入导航、表格、按钮和页面底纹。按用户要求用宁静海岸替代技能样例的巨浪、题签和红印章；既定 token 保持不变。

## Asset and evidence

- Project file: public/assets/ukiyo-editorial-v3.png
- Application URL: /assets/ukiyo-editorial-v3.png
- Native image: 1536x1024 PNG, horizontal 3:2.
- Built-in image_gen was actually invoked once and returned a visible image. No external API or SVG substitute.
- The tool exposes no specific image-model selector; no exact model version is claimed.
- Visual inspection: generous warm cream sky; lower coastal scene with layered mountains, fine water lines, pine shore and one boat; no visible text, red seal, watermark or giant wave.
- Original provenance only: C:/Users/Takiyu's rog/.codex/generated_images/01a16270-bb97-7213-9e2b-3b91a96c67a2/exec-f01bc38b-765f-4fae-95b9-f15d548e1d6c.png
- Initial sandbox copy failed despite an exact-file permission grant: workspace-write sandbox has no writable root capability SIDs. A scoped elevated Copy-Item then succeeded, and the project PNG exists at 3110552 bytes.
- Runtime consumers must use the project URL, not the .codex provenance path.

## Five implementation specifications

1. **Layout and proportion:** follow the latest Astra plan: top text navigation, centered single-column task view, and real draft continuation as the homepage priority. One artwork on the homepage only, visually secondary to the draft task; no login-page reuse, full-page background, or repeated cards.
2. **Size and crop:** artwork width 360–440px, native 3:2 height 240–293.3px. Use its native aspect ratio and contain, never stretch or cover-crop. If a 440x300 panel is required, center a 440x293.3 image with about 3.3px spare space above/below. Retain the boat and left coast.
3. **Whitespace:** separate artwork from task copy/controls by 32–48px; do not overlay UI or text on its upper approximately half of unprinted sky. Align it with the centered content grid, not a fixed viewport right column. Keep surrounding page space clean and untextured.
4. **Geometry and type:** zero corner radius, 1px rules, no shadows. Instrument Sans, 12px metadata / 15px body-navigation / 32px heading; weight 400 body, 500 heading. Chinese fallback PingFang SC / Noto Sans SC / sans-serif. No cartouche or calligraphic UI.
5. **Color and material boundary:** fixed tokens below; one blue UI accent. Paper texture and woodcut lines only inside the PNG. No red seal, neon, decorative wave icons, rough SVG, gradient text, glass cards, or ornamental wave-pattern backgrounds.

## Fixed tokens

- bg: oklch(.93 .03 85)
- surface: oklch(.89 .035 80)
- ink: oklch(.22 .04 255)
- muted: oklch(.42 .04 250)
- line: oklch(.3 .04 255)
- accent: oklch(.42 .11 245)
- onAccent: oklch(.96 .02 85)

Do not replace these with bitmap-sampled colors. The generated artwork interprets the restricted palette artistically; exact per-pixel token matching is not claimed.

## Actual generation prompt (verbatim)

```text
Use case: stylized-concept
Asset type: one standalone fine-art raster woodblock print for a small editorial artwork panel, NOT a website screenshot or UI mockup.
Primary request: a serene Japanese coast, delicate rippling sea, distant low mountains, and one tiny traditional wooden boat; an original, mature, finely crafted Edo-period ukiyo-e landscape print.
Scene/backdrop: quiet coastal inlet, restrained layered distant mountains near a low horizon, a gently curving shoreline in the lower part, one small boat resting off-center on calm water. No crashing or monumental waves.
Style/medium: authentic Edo woodblock print aesthetics, a refined aizuri-e impression, flat printed pigment areas, exceptionally fine hand-carved indigo keylines and many delicate rhythmically varied water lines; subtle traditional bokashi on the water and distant mountains, never digital airbrush. Elegant precise artisanal printmaking, not rough gouging.
Composition/framing: complete horizontal 3:2 artwork, straight-on full composition, no perspective mockup. The coast and sea occupy the lower 45-50 percent; approximately the upper 50 percent is generous warm unprinted washi-cream sky with almost no markings. Small off-center focal boat, quiet balance, substantial negative space. Keep the complete scene usable at about 460 by 320 pixels, with refined detail visible at larger sizes. No ornamental border, no frame, no surrounding wall, no typography space treatment.
Lighting/mood: tranquil, contemplative, spacious, understated and sophisticated.
Color palette: exclusively Prussian blue, deep ink indigo, and warm washi cream, with dilute blue tonal variations. No red, vermilion, orange, green, gold or additional accent colors.
Materials/textures: subtle authentic warm washi fiber texture, restrained irregular pigment absorption and slight block-print character; clean well-preserved paper, not distressed, stained, torn or heavily grained.
Text: none.
Constraints: a finished independent artwork only, opaque paper background; no text, Japanese characters, signatures, title cartouches, red seals, logos or watermark.
Avoid: website, dashboard, browser chrome, UI, collage, busy decorative clutter, generic Great Wave imitation, giant curling wave, wave emoji, coarse SVG, flat vector cartoon, thick clumsy contours, 3D render, neon, photorealistic photography, lens flare, cast shadows, heavy gradients, excessive distressing.
```

The prompt's 460x320 intended panel predates the final layout update. The delivered 3:2 image supports the revised 360–440x240–293.3 size without cropping or regeneration.

## Verification boundary

Only the PNG and this visual handoff document are in scope. No application implementation, business-logic review, browser integration tests, commit or push. The generated image was visually inspected inline; project file readback remains part of delivery verification. Actual homepage integration and fine-line readability at final size must be checked by the implementation/review roles. No claim is made that this is a historical original print or that application tests passed.

