# markterm

[![License: MIT](https://img.shields.io/badge/License-MIT-1E90FF.svg?style=flat)](https://github.com/gospelo-dev/markterm/blob/main/LICENSE) [![Mermaid](https://img.shields.io/badge/Mermaid-11.16.0_(default)-FF3670.svg?style=flat&logo=mermaid&logoColor=white)](https://mermaid.js.org/) [![Playwright](https://img.shields.io/badge/Playwright-Chromium-2EAD33.svg?style=flat&logo=playwright&logoColor=white)](https://playwright.dev/) [![Ghostty](https://img.shields.io/badge/Ghostty-supported-1C1C1C.svg?style=flat)](https://ghostty.org/) [![iTerm2](https://img.shields.io/badge/iTerm2-supported-000000.svg?style=flat)](https://iterm2.com/) [![herdr](https://img.shields.io/badge/herdr-supported-8B5CF6.svg?style=flat)](https://herdr.dev/)

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/hero.jpg?raw=true" alt="markterm: どんなターミナルでも Markdown をインライン表示" width="820"></p>

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/demo.gif?raw=true" alt="markterm デモ: Ghostty で README.md をインライン表示" width="820"></p>

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
| iTerm2 Inline Images | iTerm2 (1 MiB を超える描画結果は 3.5 以降) | `TERM_PROGRAM=iTerm.app` または `LC_TERMINAL=iTerm2` |
| Sixel | foot, xterm, mlterm, Konsole, mintty (Git Bash), Black Box | `TERM_PROGRAM` に `foot` / `mlterm` / `konsole` / `mintty` / `blackbox` を含む、または `TERM=xterm`。かつ `img2sixel` が `PATH` にある場合のみ選択 |
| file（フォールバック） | すべて | 上記のいずれにも該当しない場合。インライン表示の代わりに PNG を一時ファイルに保存してパスを表示します |

検出は表の順に行われます。`markterm --help` で現在のターミナルで検出されたプロトコルを確認できます。

**マルチプレクサ**: [herdr](https://herdr.dev/) に対応しています。herdr セッション内ではインライン画像が特別な設定なしでそのまま表示されます。tmux と screen は検出されますが、画像のエスケープシーケンスが確実に通過しないためインライン表示を無効にし、PNG を保存してパスを表示します。画像表示を利用するには tmux/screen から herdr への移行を検討してください。

iTerm2 で `-p kitty` を強制しても表示されません (iTerm2 3.7.2 で確認。何も描画されない)。iTerm2 では自動検出される `iterm2` プロトコルを使ってください。

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
- **縦長の文書**: ターミナルには 1 枚のインライン画像の大きさに上限があります。Ghostty は高さ 10000 px を超える Kitty Graphics 画像を受け付けず、iTerm2 は 10000 px 以上の画像を受け付けないうえ、1 枚あたり最大 255 行までしか表示しません。描画結果が上限より高い場合、markterm は横帯に分割して順に転送するので、文書は 1 枚の連続した画像として表示されます。帯の高さは Kitty Graphics では 10000 px 以下、iTerm2 では現在のターミナル幅で 255 行に収まる高さ (幅 640 px の描画を 80 列に表示する場合で約 3300 px) です。切断位置は Chromium で実測し、ブロック間の余白に置きます。ブロック自体が帯より高い場合は表の行、リストの項目、テキストの行の境界で切ります。画像や図の内部で切ることはありません。継ぎ目にはターミナル側の都合で最大 1 行分の空白が入ることがあります。横方向は分割しないため、`--width × --scale` は 10000 px 未満にしてください。Sixel は分割しません。一時ファイルと `-o` には常に分割前の 1 枚を書き出します。
- **iTerm2 での大きな画像**: iTerm2 は 1 つの制御シーケンスを 1 MiB までしか受け付けません。base64 のペイロードがそれを超える帯は、iTerm2 3.5 で導入された分割形式 (`MultipartFile`、`FilePart`、`FileEnd`) で送ります。それ以下の場合は従来の単一の `File=` シーケンスを使うので、古い iTerm2 でも動作します。

## 出力と一時ファイル

- レンダリングした PNG は常に `$TMPDIR/markterm-<タイムスタンプ>.png`（`TMPDIR` 未設定時は `/tmp/`）に書き出されます。markterm はこれらを削除しません。
- インライン表示時: 画像のエスケープシーケンスを標準出力に書き、その後に一時ファイルのパスを標準エラー出力に表示します。
- `-o <file>`: 指定パスに PNG を書き、`Saved to <file> (<bytes> bytes)` を表示します。インライン表示は行いません。
- `file` プロトコル時、または `img2sixel` のない Sixel 環境: 表示は行わず、`Saved to: <一時ファイルのパス>` を表示するので、別のビューアで開けます。

終了コード: 成功時 `0`、入力ファイルが存在しない、または Markdown が空の場合 `1`。

## 仕組み

1. **marked** が Markdown を HTML に変換します。` ```mermaid ` フェンスを `<pre class="mermaid">` に変換するカスタム拡張付きです
2. **Playwright** がヘッドレス Chromium で HTML を開き、CDN の MermaidJS を読み込んで、すべての Mermaid ブロックが SVG になるまで待ちます（最大 10 秒。超過した場合は未変換のブロックがあっても続行します）
3. `<body>` 要素を PNG スクリーンショットとして撮影します。Kitty Graphics と iTerm2 で高さがターミナルの上限を超える場合は、実測したブロック境界で切った帯も撮影します ([幅とズーム](#幅とズーム) を参照)
4. 選択された画像プロトコルで PNG (分割時は各帯を順に) をターミナルに転送します

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
| `markdownToImageBands(source, options)` | `markdownToImage` に `maxBandHeight` (px) を加えたもの。`{ png, bands }` を返す。`png` は全体、`bands` は実測したブロック境界で切った高さ `maxBandHeight` 以下の横帯。分割が不要なら `bands` は 1 要素 (`=== png`) |
| `measureCutCandidates(source, options?)` | レンダリングして `{ height, candidates }` を返す。body の高さと、markterm が切断候補とみなす位置 (CSS px)。デバッグ用 |
| `chooseCuts(candidates, totalHeight, maxBand)` | 帯の決定そのもの。貪欲法で届く範囲の最も低い候補を選び、候補がなければ上限で切る。純粋関数 |
| `dispose()` | 共有 Chromium インスタンスを終了。処理の最後に一度呼ぶ |
| `renderMarkdown(source)` | Markdown を HTML 文字列に変換（marked + Mermaid 拡張） |
| `buildHtml(html, options?)` | 変換済み HTML をスタイル付きページテンプレートで包む |
| `detectProtocol()` | 現在のターミナルのプロトコルを返す: `kitty`, `iterm2`, `sixel`, `file` |
| `detectMultiplexer()` | 環境変数 `TMUX` と `STY` に基づき `"tmux"`、`"screen"`、または `null` を返す |
| `displayInline(png, { protocol? })` | PNG をインライン表示するエスケープシーケンス文字列を組み立てる。`file` の場合は `null`。`png` には帯の配列も渡せ、縦に連続して表示されるよう連結される |
| `maxBandHeightFor(protocol, pixelWidth)` | CLI がプロトコルごとに使う `maxBandHeight`。`kitty` は `KITTY_MAX_IMAGE_DIMENSION`、`iterm2` は `iterm2MaxBandHeight(pixelWidth, 列数)`、`sixel` と `file` は `null` |
| `KITTY_MAX_IMAGE_DIMENSION` | `10000`。Ghostty が Kitty Graphics 画像に課す 1 辺の上限 |
| `ITERM2_MAX_IMAGE_DIMENSION`、`ITERM2_MAX_ROWS`、`iterm2MaxBandHeight(pixelWidth, cols)` | iTerm2 の上限 (`10000`、到達した時点で拒否。1 枚あたり `255` 行) と、幅 `pixelWidth` の描画を `cols` 列で 255 行に収める帯の高さ |
| `getTerminalSize()` | ターミナルの列数と行数（`pixelWidth`/`pixelHeight` はこのバージョンでは常に `null`） |
| `estimateViewportWidth(scale)` | `-w auto` の推定ロジック |
| `queryTerminalColors()` | OSC で `bg`, `fg`, `blue` を問い合わせる。stdin/stdout が TTY でない、または応答がない場合は `null` |
| `deriveTheme(bg, fg, blue)` | 3 つの HEX 色から `ThemeColors` を組み立てる |
| `fallbackTheme("dark" \| "light")` | 組み込みの `ThemeColors` |
| `isDark(hex)` | Mermaid テーマの選択に使う輝度判定 |

型: `ScreenshotOptions`, `BandOptions`, `ImageBands`, `MeasuredCandidates`, `TemplateOptions`, `ThemeColors`, `TerminalColors`, `TerminalSize`, `Protocol`, `Multiplexer`

## ライセンス

MIT
