import { defineConfig } from 'vite';

// GitHub Pages (finoject.github.io/finoject-simcity/) 用の設定。
// base はリポジトリ名に合わせる。build 成果物は docs/ に出力し、
// main ブランチの /docs を Pages のソースにする（Actions 不要・簡素）。
export default defineConfig({
  base: '/finoject-simcity/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
});
