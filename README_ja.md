# markterm

[![License: MIT](https://img.shields.io/badge/License-MIT-1E90FF.svg?style=flat)](https://github.com/gospelo-dev/markterm/blob/main/LICENSE) [![Mermaid](https://img.shields.io/badge/Mermaid-11.16.0_(default)-FF3670.svg?style=flat&logo=mermaid&logoColor=white)](https://mermaid.js.org/) [![Playwright](https://img.shields.io/badge/Playwright-Chromium-2EAD33.svg?style=flat&logo=playwright&logoColor=white)](https://playwright.dev/)

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/hero.jpg?raw=true" alt="markterm: どんなターミナルでも Markdown をインライン表示" width="820"></p>

Markdown + MermaidJS をターミナル上にインライン画像として表示する CLI ツール。

Markdown ファイルをヘッドレス Chromium でスタイリング付きにレンダリングし、MermaidJS ダイアグラムも含めた PNG を、ターミナル固有の画像プロトコルで直接表示します。配色はターミナル自身の背景色と前景色に追従するので、プレビューがターミナルの一部のように見えます。

手順を追ったセットアップは [docs/QUICKSTART_ja.md](docs/QUICKSTART_ja.md) を参照してください。English: [README.md](README.md)

## 動作要件

| 要件 | 補足 |
|------|------|
| Bun 1.1 以上 | markterm は Bun アプリケーションです。Node.js では動作しません。 |
| Chromium | `bunx playwright install chromium` で一度だけインストールします。実行のたびにヘッドレスブラウザが起動します。 |
| ネットワーク接続 | MermaidJS はレンダリング時に jsDelivr CDN からロードします。オフラインでは Mermaid ブロックは生テキストのまま表示されます。 |
| `img2sixel`（Sixel ターミナルのみ） | libsixel に含まれます。Kitty Graphics と iTerm2 のターミナルでは不要です。 |

## 対応ターミナル

| プロトコル | ターミナル | 自動検出の条件 |
|-----------|-----------|----------------|
| Kitty Graphics | Ghostty, Kitty, WezTerm | `TERM=xterm-ghostty`、`TERM_PROGRAM` に `ghostty` / `kitty` / `WezTerm` を含む、または `GHOSTTY_RESOURCES_DIR`、`GHOSTTY_BIN_DIR`、`KITTY_WINDOW_ID`、`KITTY_PID`、`WEZTERM_PANE` のいずれかが設定されている |
| iTerm2 Inline Images | iTerm2 | `TERM_PROGRAM=iTerm.app` または `LC_TERMINAL=iTerm2` |
| Sixel | foot, xterm, mlterm, Konsole, mintty (Git Bash), Black Box | `TERM_PROGRAM` に `foot` / `mlterm` / `konsole` / `mintty` / `blackbox` を含む、または `TERM=xterm`。かつ `img2sixel` が `PATH` にある場合のみ選択 |
| file（フォールバック） | すべて | 上記のいずれにも該当しない場合。インライン表示の代わりに PNG を一時ファイルに保存してパスを表示します |

検出は表の順に行われます。`markterm --help` で現在のターミナルで検出されたプロトコルを確認できます。tmux や screen などのマルチプレクサは特別扱いしていません。画像のエスケープシーケンスは通常マルチプレクサを通過しないため、その中では `file` フォールバックになると考えてください。

## インストール

```bash
bun install -g markterm

# レンダリングに Chromium が必要（初回のみ）
bunx playwright install chromium

# Sixel ターミナルの場合のみ
# macOS:  brew install libsixel
# Linux:  apt install libsixel-bin
```

## 使い方

```bash
# ターミナルにインライン表示
markterm README.md

# 50% に縮小表示（内容は縮小、画像はターミナル幅いっぱい）
markterm README.md -z 50

# 表示せず PNG ファイルに保存
markterm README.md -o output.png

# 標準入力から読み込み
cat README.md | markterm

# 自動検出が使えないときにライトテーマを指定
cat README.md | markterm -t light

# 色を直接指定
markterm README.md --bg "#ffffff" --fg "#1e1e2e"
```

標準入力から Markdown を読む場合、ターミナル色の自動検出は行われず（[テーマ](#テーマ) を参照）、`-t` で選んだフォールバックテーマが使われます。

## オプション

```
-t, --theme <dark|light>       色の自動検出に失敗したときのフォールバックテーマ (デフォルト: dark)
    --bg <#hex>                背景色。検出値を上書き
    --fg <#hex>                前景色。検出値を上書き
-w, --width <auto|px>          ビューポート幅 (CSS px)。auto はターミナルから推定 (デフォルト: auto)
    --font-size <px>           本文フォントサイズ (CSS px) (デフォルト: 16)
-s, --scale <factor>           Chromium に渡すデバイススケール係数 (デフォルト: 2)
    --mermaid <version>        jsDelivr からロードする MermaidJS バージョン (デフォルト: 11.16.0)
-z, --zoom <percent>           表示ズーム 1-100 (デフォルト: 100)
-p, --protocol <name>          画像プロトコルを強制: kitty, iterm2, sixel, file
-o, --output <file.png>        表示せず PNG をファイルに保存
-h, --help                     ヘルプ、検出プロトコル、ターミナル列数を表示
-v, --version                  バージョン表示
```

位置引数: Markdown ファイルのパス。省略時は標準入力から読み込みます。

プロトコルの優先順位: `-p` > `MARKTERM_PROTOCOL` > 自動検出。

## テーマ

markterm は固定の配色を持ちません。実行のたびにターミナルへ色を問い合わせ、その結果からページのスタイルを組み立てます。

1. 背景色を `OSC 11`、前景色を `OSC 10`、リンク色に使うパレットの青を `OSC 4;4` で問い合わせます。各問い合わせは応答を最大 500 ms 待ちます。
2. 背景色と前景色から、コードブロックの背景、表の罫線色を導出し、背景の輝度から MermaidJS のテーマ（`dark` または `default`）を選びます。
3. `--bg` と `--fg` は検出値を個別に上書きします。両方を指定した場合はターミナルへの問い合わせを行わず、リンク色は `#89b4fa` になります。
4. 問い合わせに失敗した、または問い合わせできない場合は、`-t` で選んだフォールバックテーマを使います。`dark` は Catppuccin 風（`#1e1e2e` 地に `#cdd6f4`）、`light` は `#ffffff` 地に `#1e1e2e` です。

自動検出には標準入力と標準出力の両方が TTY である必要があります。そのため、Markdown をパイプで渡した場合、出力をリダイレクトした場合、一部のマルチプレクサ内では検出が行われません。その場合は `-t` または `--bg`/`--fg` を使ってください。

## 幅とズーム

ページは CSS px 単位のビューポート幅でレイアウトされ、その `--scale` 倍の解像度で撮影されます。

- `-w auto` は「ターミナル列数 × 8 px ÷ scale」で幅を推定します。ターミナルからピクセル寸法は取得しないため、フォントが広い環境では `-w` の明示指定が必要になることがあります。
- `-w <px>` はビューポート幅を直接指定します。
- `-z <percent>` はビューポート幅を `100 ÷ zoom` 倍にします。`-z 50` ならページを 2 倍の幅でレイアウトしてからターミナル幅で表示するので、内容が半分の大きさに見えます。画面上の画像の幅は変わりません。
- 画像はターミナルの列数を指定して転送されるため、Kitty Graphics と iTerm2 では常にターミナル幅いっぱいに表示されます。Sixel はピクセルサイズそのままで出力します。

## 出力と一時ファイル

- レンダリングした PNG は常に `$TMPDIR/markterm-<タイムスタンプ>.png`（`TMPDIR` 未設定時は `/tmp/`）に書き出されます。markterm はこれらを削除しません。
- インライン表示時: 画像のエスケープシーケンスを標準出力に書き、その後に一時ファイルのパスを標準エラー出力に表示します。
- `-o <file>`: 指定パスに PNG を書き、`Saved to <file> (<bytes> bytes)` を表示します。インライン表示は行いません。
- `file` プロトコル時、または `img2sixel` のない Sixel 環境: 表示は行わず、`Saved to: <一時ファイルのパス>` を表示するので、別のビューアで開けます。

終了コード: 成功時 `0`、入力ファイルが存在しない、または Markdown が空の場合 `1`。

## 仕組み

1. **marked** が Markdown を HTML に変換します。` ```mermaid ` フェンスを `<pre class="mermaid">` に変換するカスタム拡張付きです
2. **Playwright** がヘッドレス Chromium で HTML を開き、CDN の MermaidJS を読み込んで、すべての Mermaid ブロックが SVG になるまで待ちます（最大 10 秒。超過した場合は未変換のブロックがあっても続行します）
3. `<body>` 要素を PNG スクリーンショットとして撮影します
4. 選択された画像プロトコルで PNG をターミナルに転送します

## MermaidJS サポート

MermaidJS はレンダリング時に jsDelivr CDN からロードするため、`--mermaid <version>` で公開済みの任意のバージョンを指定できます。

| MermaidJS バージョン | 状態 |
|---------------------|------|
| 11.16.0 | デフォルト。`--mermaid` 未指定時に使用。動作確認済み。 |
| 12.0.0 | 2026-09-22 時点の最新リリース。`--mermaid 12.0.0` で動作確認済み。 |
| その他 | jsDelivr で取得できるバージョンなら指定可能。個別の動作確認はしていません。 |

選択した MermaidJS バージョンが提供する全ダイアグラムタイプに対応: Flowchart, Sequence, Class, State, ER, Gantt, Pie, Git Graph など。Mermaid のテーマは自動で選ばれます（暗い背景なら `dark`、明るい背景なら `default`）。

## 環境変数

| 変数 | 説明 |
|------|------|
| `MARKTERM_PROTOCOL` | 自動検出を上書き (`kitty`, `iterm2`, `sixel`, `file`)。`-p` はこの変数より優先されます。 |
| `TMPDIR` | 一時 PNG の出力先ディレクトリ。デフォルトは `/tmp/`。 |

## ライブラリとしての利用

markterm は Bun からライブラリとしても利用できます。エントリポイントは TypeScript ソースなので、Bun（または TypeScript を扱えるバンドラ）が必要です。

```typescript
import { markdownToImage, dispose, fallbackTheme } from "markterm"

const png = await markdownToImage("# Hello\n\n```mermaid\ngraph LR\n  A-->B\n```", {
  colors: fallbackTheme("dark"),
  width: 800,
  fontSize: 16,
  deviceScaleFactor: 2,
  mermaidVersion: "11.16.0",
})

await Bun.write("output.png", png)
await dispose() // 共有 Chromium インスタンスを終了
```

TTY 上で現在のターミナルの色に合わせるには、`fallbackTheme("dark")` を次のように置き換えます。

```typescript
import { queryTerminalColors, deriveTheme, fallbackTheme } from "markterm"

const detected = await queryTerminalColors()
const colors = detected
  ? deriveTheme(detected.bg, detected.fg, detected.blue)
  : fallbackTheme("dark")
```

公開 API:

| エクスポート | 説明 |
|-------------|------|
| `markdownToImage(source, options?)` | Markdown を PNG の `Uint8Array` にレンダリング。オプション: `width`, `fontSize`, `fontFamily`, `colors`, `mermaidVersion`, `deviceScaleFactor` |
| `dispose()` | 共有 Chromium インスタンスを終了。処理の最後に一度呼ぶ |
| `renderMarkdown(source)` | Markdown を HTML 文字列に変換（marked + Mermaid 拡張） |
| `buildHtml(html, options?)` | 変換済み HTML をスタイル付きページテンプレートで包む |
| `detectProtocol()` | 現在のターミナルのプロトコルを返す: `kitty`, `iterm2`, `sixel`, `file` |
| `displayInline(png, { protocol? })` | PNG をインライン表示するエスケープシーケンス文字列を組み立てる。`file` の場合は `null` |
| `getTerminalSize()` | ターミナルの列数と行数（`pixelWidth`/`pixelHeight` はこのバージョンでは常に `null`） |
| `estimateViewportWidth(scale)` | `-w auto` の推定ロジック |
| `queryTerminalColors()` | OSC で `bg`, `fg`, `blue` を問い合わせる。stdin/stdout が TTY でない、または応答がない場合は `null` |
| `deriveTheme(bg, fg, blue)` | 3 つの HEX 色から `ThemeColors` を組み立てる |
| `fallbackTheme("dark" \| "light")` | 組み込みの `ThemeColors` |
| `isDark(hex)` | Mermaid テーマの選択に使う輝度判定 |

型: `ScreenshotOptions`, `TemplateOptions`, `ThemeColors`, `TerminalColors`, `TerminalSize`, `Protocol`

## ライセンス

MIT
