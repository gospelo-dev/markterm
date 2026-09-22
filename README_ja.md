# markterm

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/hero.jpg?raw=true" alt="markterm: どんなターミナルでも Markdown をインライン表示" width="820"></p>

Markdown + MermaidJS をターミナル上にインライン画像として表示するCLIツール。

Markdownファイルをスタイリング付きでレンダリングし、MermaidJSダイアグラムも含めてターミナルに直接インライン画像として表示します。

## 対応ターミナル

| プロトコル | ターミナル |
|-----------|-----------|
| Kitty Graphics | Ghostty, Kitty, WezTerm |
| iTerm2 IIP | iTerm2 |
| Sixel | foot, xterm, mlterm, Konsole, mintty (Git Bash), Black Box |

## インストール

```bash
bun install -g markterm

# レンダリングに Chromium が必要
bunx playwright install chromium

# Sixel ターミナルの場合のみ
# macOS:  brew install libsixel
# Linux:  apt install libsixel-bin
```

## 使い方

```bash
# ターミナルにインライン表示
markterm README.md

# 50%に縮小表示（横幅フル）
markterm README.md -z 50

# ライトテーマ
markterm README.md -t light

# PNGファイルに保存
markterm README.md -o output.png

# 標準入力から読み込み
cat README.md | markterm
```

## オプション

```
-t, --theme <dark|light>       カラーテーマ (デフォルト: dark)
-w, --width <auto|px>          ビューポート幅 (デフォルト: auto)
    --font-size <px>           本文フォントサイズ (デフォルト: 16)
-s, --scale <factor>           デバイススケール係数 (デフォルト: 2)
    --mermaid <version>        MermaidJS バージョン (デフォルト: 11.16.0)
-z, --zoom <percent>           ズーム: 1-100% (デフォルト: 100)
-p, --protocol <name>          プロトコル強制: kitty, iterm2, sixel, file
-o, --output <file.png>        PNGファイルに保存
-h, --help                     ヘルプ表示
-v, --version                  バージョン表示
```

## 仕組み

1. **marked** がMarkdownをHTMLに変換（MermaidJS用カスタム拡張付き）
2. **Playwright** がヘッドレスChromiumでHTMLをレンダリング（MermaidJSはCDNからロード）
3. ページをPNGスクリーンショットとしてキャプチャ
4. 適切な画像プロトコル（自動検出）でターミナルに転送

## MermaidJS サポート

MermaidJSはCDNから直接ロードするため、指定したバージョンを常に利用できます。全ダイアグラムタイプに対応:

- Flowchart, Sequence, Class, State, ER, Gantt, Pie, Git Graph など
- デフォルト: MermaidJS v11.16.0（`--mermaid <version>` で変更可能）

## 環境変数

| 変数 | 説明 |
|------|------|
| `MARKTERM_PROTOCOL` | 自動検出を上書き (`kitty`, `iterm2`, `sixel`, `file`) |

## ライブラリとしての利用

```typescript
import { markdownToImage, dispose } from "markterm"

const png = await markdownToImage("# Hello\n\n```mermaid\ngraph LR\n  A-->B\n```", {
  theme: "dark",
  width: 800,
})

await Bun.write("output.png", png)
await dispose()
```

## ライセンス

MIT
