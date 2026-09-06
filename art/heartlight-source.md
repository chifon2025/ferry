# 心燈庭園素材紀錄

2026-09-07，內建 image_gen 單次生成，依已確認的三態概念圖重構成單張背景。工具輸出 941 × 1672 PNG；主代理檢視後，以 Sharp 轉成 900 × 1599 WebP，159,476 bytes。

上線素材：heartlight-garden.webp。原始輸出保留於 C:/Users/USER/.codex/generated_images/01a07805-6d72-77d0-b3de-664a125e0763/exec-926898aa-e915-46ad-9593-f399cec63835.png。

## 最終提示詞

Use case: precise-object-edit
Asset type: production portrait illustrated website background, a single full-bleed scene with no interface.
Input image: reference/edit source is the approved three-screen concept. Use ONLY the LEFT screen's garden as the visual source; extract and recompose its garden into ONE standalone portrait image, aspect ratio 9:16 preferred (2:3 acceptable), with no frame or surrounding page.
Primary request: preserve the exquisite warm cream paper-sculpture and matte ceramic miniature garden, textured ivory paper, soft sculptural depth, calm peach layered hills, sage foliage, tactile moss, tiny cream and peach flowers around the edges. A sage-leaved tree curves inward from the upper-left edge. A small softly glowing arched doorway sits in the middle distance beside the garden path. A large cream round stone pedestal is centered at x50%, y72%; its entire upper surface is completely EMPTY and clean so a separate interactive amber light can be added in code later.
Composition: single full-bleed portrait camera view into the miniature garden. Maintain the beautiful depth and softness of the left approved screen. Keep the top 12% relatively open cream sky for a later title and menu; keep x15-85%, y35-47% quiet, gently textured light space for later HTML text. Keep the bottom 12% a quiet ivory garden path for a later control hint. Edge foliage may softly frame the scene without invading those reserved reading zones. The empty pedestal must remain clearly visible with its elliptical top approximately centered at y72%.
Lighting/mood: warm diffuse daylight, peaceful and intimate, delicate ambient shadows, restrained luminous amber light only inside the distant tiny doorway.
Constraints: remove ALL lettering, labels, menus, buttons, UI, screen borders and rounded cards from the source. Remove the entire foreground glowing amber object and all of its orbit rings and light trails. Do not generate any foreground glowing sphere, glowing pebble, lantern, filament ribbon, floating trail, or object on the pedestal. No people. No text, logo, watermark, phone, triptych, collage, or multiple panels. Output exactly one full-bleed garden image.

## 配樂

music/heartlight-warm-strings.mp3 為先前主公確認的 60 秒原創合成曲《回暖》。原始生成腳本在 designs/render-heartlight-music.py；編碼腳本在 tools/encode-heartlight-music.py，使用 lameenc 1.8.4，以 128 kbps 立體聲編碼。正式網站無執行期依賴，沒有外部錄音或串流來源。
