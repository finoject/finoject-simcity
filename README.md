# 都市シミュレーション（SimCity 風）

ブラウザで動く都市シミュレーションゲーム。市長になって道路を敷き、住宅・商業・工業ゾーンを置いて街を育てます。時間を進めると RCI 需要・地価・雇用にもとづいて街が自動で発展します。

**公開URL:** https://finoject.github.io/finoject-simcity/

## 特徴
- 32×32 タイルの街づくり（道路／住宅／商業／工業／削除）
- クリック＆ドラッグ配置、再生／一時停止／速度 ×1〜×3、キーボード操作（1〜5・Space）
- 経済：建設コスト・税収・道路維持費・資金不足で建設不可
- 中規模シミュレーション：RCI 需要モデル・地価・汚染・雇用／失業（高失業は人口流出）

## 技術
- TypeScript + Vite + HTML5 Canvas（バックエンド不要・全てブラウザ内で完結）

## 開発
```bash
npm install
npm run dev      # 開発サーバー（http://localhost:5173）
npm run build    # 本番ビルド → docs/ に出力
```

## デプロイ
`npm run build` で `docs/` に静的ファイルを出力し、`main` ブランチに push すると
GitHub Pages（ソース = main / docs）に反映されます。
