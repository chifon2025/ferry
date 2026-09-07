# 小舟試玩原創素材

兩張素材皆由內建 image_gen 生成一次，未使用外部音樂或圖片。由資產專用代理生成，主代理檢查原圖後使用 Sharp 縮放、編碼；未以程式重畫素材。

輸出：`art/boat-river.webp`（720×1080，27,472 bytes）；`art/boat-skiff.webp`（84×240，RGBA，10,782 bytes）。小舟保留透明度，僅裁去透明邊界。背景燈位在中央偏左上方，遊戲渡口標記配合其 x 位置設置在河面前方。

生成原檔位於 `C:/Users/USER/.codex/generated_images/01a07a55-b280-7801-889d-9c1ddd141572/`：
- `exec-17a7f24a-8618-47d1-893a-4a767b7615ec.png`，1024×1536 RGB。
- `exec-c35ff883-c90b-4b22-a272-f519747af7ca.png`，948×1659 真實 RGBA。

## 河面完整提示詞

```text
Use case: illustration-story
Asset type: portrait 2:3 mobile ferry game background.
Scene/backdrop: a quiet night river, mostly uninterrupted deep petrol teal water; subtle painted ripples and delicate reflected moonlight.
Style/medium: softly hand-painted sophisticated Chinese illustrated storybook atmosphere, gentle brush texture, quiet and readable.
Composition/framing: top-down very slightly angled view, portrait 2:3. Central 85% of image width must remain uninterrupted open navigable water. Narrow dark riverbanks only at the far left and right edges. One tiny warm amber landing light at upper center near 12% of image height.
Lighting/mood: subdued moonlit teal, tiny warm amber accent, no bright white glare.
Constraints: no boat, no people, no lettering, no UI, no rocks or obstacles in water. Do not crowd the open playable water. Produce exactly one image.
```

## 小舟完整提示詞

```text
Use case: stylized-concept
Asset type: transparent RGBA wooden skiff sprite for a mobile ferry game, intended display approximately 40 by 70 pixels.
Subject: one isolated small wooden skiff made of warm walnut wood, one small amber lantern near its bow.
Style/medium: softly hand-painted sophisticated Chinese illustrated storybook style; simple crisp silhouette legible when tiny.
Composition/framing: overhead top-down view, long axis exactly vertical, pointed bow directed toward TOP of image, centered. Full boat visible with transparent margins.
Scene/backdrop: genuinely transparent background with actual RGBA alpha, not a drawn checkerboard.
Constraints: no person, no water, no background, no wake, no ground plane, no text, no watermark, no cropped parts. Preserve alpha transparency around the entire boat. Produce exactly one image.
```
