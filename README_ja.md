# markterm

[![License: MIT](https://img.shields.io/badge/License-MIT-1E90FF.svg?style=flat)](https://github.com/gospelo-dev/markterm/blob/main/LICENSE) [![Mermaid](https://img.shields.io/badge/Mermaid-11.16.0_(default)-FF3670.svg?style=flat&logo=mermaid&logoColor=white)](https://mermaid.js.org/) [![Playwright](https://img.shields.io/badge/Playwright-Chromium-2EAD33.svg?style=flat&logo=playwright&logoColor=white)](https://playwright.dev/) [![Ghostty](https://img.shields.io/badge/Ghostty-supported-1C1C1C.svg?style=flat)](https://ghostty.org/) [![Kitty](https://img.shields.io/badge/Kitty-supported-784421.svg?style=flat)](https://sw.kovidgoyal.net/kitty/) [![WezTerm](https://img.shields.io/badge/WezTerm-supported-4E49EE.svg?style=flat)](https://wezterm.org/) [![iTerm2](https://img.shields.io/badge/iTerm2-supported-000000.svg?style=flat)](https://iterm2.com/) [![herdr](https://img.shields.io/badge/herdr-supported-8B5CF6.svg?style=flat)](https://herdr.dev/)

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/hero.jpg?raw=true" alt="markterm: どんなターミナルでも Markdown をインライン表示" width="820"></p>

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/demo.gif?raw=true" alt="markterm デモ: ビューアで README.md を開き、スクロールしてリンクをたどる" width="820"></p>

Markdown + MermaidJS を、Web ページのようにレンダリングしてターミナルで表示。

markterm はヘッドレス Chromium で Markdown をフルスタイリング、MermaidJS ダイアグラム、シンタックスハイライト付きでレンダリングし、ターミナル自身の画像プロトコルを通じてターミナルに表示します。配色はターミナルの背景色と前景色に追従するので、ページがターミナルの一部のように見えます。

- **ビューア** (Kitty グラフィックス対応ターミナルではデフォルト): スクロール・ズーム・クリックで操作できる全画面のページです。他の Markdown、HTML、画像、PDF ファイルへのリンクはその場で開き、アニメーション GIF と WebP は再生され、ページは HTML または PNG として保存できます。
- **画像表示モード** (`-i`、またはそれ以外すべてのフォールバック): 文書を 1 枚のインライン画像として一度だけ表示し、続けてリンクの一覧を表示します。

手順を追ったセットアップは [docs/QUICKSTART_ja.md](docs/QUICKSTART_ja.md) を参照してください。English: [README.md](README.md)

## 動作要件

| 要件 | 補足 |
|------|------|
| Node.js 20 以上 または Bun 1.1 以上 | どちらのランタイムでも動作します。`markterm` コマンドは Node.js で実行されます。Node.js がない環境では `bunx --bun markterm` で実行してください。 |
| Chromium | `npx playwright install chromium`（または `bunx playwright install chromium`）で一度だけインストールします。実行のたびにヘッドレスブラウザが起動します。 |
| ネットワーク接続 | MermaidJS と、ビューアで PDF を表示するための pdf.js は、レンダリング時に jsDelivr CDN からロードします。オフラインでは Mermaid ブロックは生テキストのまま表示され、PDF は表示できません。 |
| `img2sixel`（Sixel ターミナルのみ） | libsixel に含まれます。Sixel ターミナルでの画像表示モードでのみ必要です。 |

## 対応ターミナル

markterm は、標準出力が Kitty グラフィックスを描画できるターミナルで、tmux/screen の外で、かつ `-i` も `-o` も指定されていない場合にビューアを開きます。それ以外の場合はすべて画像表示モードを使います。ちょうど `less` がターミナルではページ表示し、パイプでは出力するのと同じです。

| ターミナル | デフォルト | リンク上のマウスポインタ | 動作確認 |
|-----------|-----------|------------------------|---------|
| Ghostty | ビューア | 手のアイコン | 済み |
| Kitty | ビューア | 手のアイコン | 済み |
| WezTerm | ビューア | 変化なし (リンク先はステータス行に表示) | 済み |
| iTerm2 | Kitty グラフィックスの問い合わせに応答する場合はビューア (3.7.2 は応答する)。それ以外は画像表示モード | 変化なし (リンク先はステータス行に表示) | 3.7.2 |
| foot, xterm, mlterm, Konsole, mintty, Black Box | 画像表示モード (Sixel) | - | - |
| それ以外、パイプ、CI | 画像表示モード (PNG を保存しパスを表示) | - | - |

画像表示モードの画像プロトコルは、次の順序で検出されます。

| プロトコル | ターミナル | 自動検出の条件 |
|-----------|-----------|----------------|
| Kitty Graphics | Ghostty, Kitty, WezTerm | `TERM=xterm-ghostty`、`TERM_PROGRAM` に `ghostty` / `kitty` / `WezTerm` を含む、または `GHOSTTY_RESOURCES_DIR`、`GHOSTTY_BIN_DIR`、`KITTY_WINDOW_ID`、`KITTY_PID`、`WEZTERM_PANE` のいずれかが設定されている |
| iTerm2 Inline Images | iTerm2 (1 MiB を超える描画結果は 3.5 以降) | `TERM_PROGRAM=iTerm.app` または `LC_TERMINAL=iTerm2` |
| Sixel | foot, xterm, mlterm, Konsole, mintty (Git Bash), Black Box | `TERM_PROGRAM` に `foot` / `mlterm` / `konsole` / `mintty` / `blackbox` を含む、または `TERM=xterm`。かつ `img2sixel` が `PATH` にある場合のみ選択 |
| file（フォールバック） | すべて | 上記のいずれにも該当しない場合。インライン表示の代わりに PNG を一時ファイルに保存してパスを表示します |

`markterm --help` は現在のターミナルで検出されたプロトコルを表示します。iTerm2 の場合、markterm はターミナルに Kitty グラフィックスに対応しているか問い合わせ (1x1 の画像クエリに続けて Device Attributes リクエストを送るので、対応していないターミナルはすぐに応答します)、対応している場合のみビューアを開きます。`-p` または `MARKTERM_PROTOCOL` を指定するとこの問い合わせを省略します。

**マルチプレクサ**: [herdr](https://herdr.dev/) に対応しています。herdr セッション内では、ビューアもインライン画像も特別な設定なしでそのまま動作します（動作確認済み。リンク上でマウスポインタの形は変わりませんが、リンク先はステータス行に表示されます）。tmux と screen は検出され、markterm はそこでは画像表示モードを使います。画像のエスケープシーケンスが確実に通過しないため、PNG を保存してパスを表示します。画像表示を利用するには tmux/screen から herdr への移行を検討してください。

## インストール

```bash
npm install -g markterm
# または: bun install -g markterm
# Node.js がない環境では: bunx --bun markterm

# レンダリングに Chromium が必要（初回のみ）
npx playwright install chromium
# または: bunx playwright install chromium

# 画像表示モードで Sixel ターミナルを使う場合のみ
# macOS:  brew install libsixel
# Linux:  apt install libsixel-bin
```

## 使い方

```bash
# ビューアを開く (Ghostty, Kitty, WezTerm, Kitty グラフィックス対応の iTerm2)
markterm README.md

# ビューアは HTML・画像・PDF ファイルも開ける
markterm page.html
markterm diagram.png
markterm paper.pdf

# 代わりに 1 枚のインライン画像を表示
markterm README.md -i

# 自己完結した HTML ページとして、または PNG として保存
markterm README.md -o README.html
markterm README.md -o README.png

# 標準入力から Markdown を読み込む (キー入力はターミナルから読むのでビューアも動作する)
cat README.md | markterm

# ターミナルの色ではなく組み込みテーマを使う
markterm README.md -t solarized-light

# 色を直接指定
markterm README.md --bg "#ffffff" --fg "#1e1e2e"
```

標準入力から Markdown を読む場合、ターミナル色の自動検出は行われず（[テーマ](#テーマ) を参照）、`-t` で別のテーマを選ばない限り `dark` テーマが使われます。

## ビューア

ビューアはヘッドレス Chromium で文書をレンダリングし、ターミナルに収まる部分を Kitty グラフィックス画像として表示します。下部にはステータス行があります。スクロールとクリックはページ上の座標に変換されます。

### キー操作

| キー | 動作 |
|------|------|
| `j` / `k`、矢印キー、マウスホイール | スクロール |
| `Space` / `b`、`PgDn` / `PgUp` | 1 ページ下 / 上 |
| `g` / `G`、`Home` / `End` | 先頭 / 末尾 |
| クリック | リンクを開く |
| `h`、`Left`、`Backspace` | 戻る |
| `+` (または `=`)、`-`、`0` | ズームイン、ズームアウト、リセット |
| `r` | ファイルをディスクから再読み込み |
| `s` / `p` | HTML / PNG として保存 (Markdown のみ) |
| `q`、`Ctrl-C` | 終了 |

### リンク

- ローカルの `.md`、`.html`、画像、`.pdf` ファイルへのリンクはビューア内で開き、`h` で戻れる履歴を持ちます。フラグメント (`other.md#install`) を付けると、そのヘッダーまでスクロールします。
- ページ内リンク (`#section`) はページをスクロールします。見出しには GitHub 形式の id が付き、非 ASCII のものも対象です。
- それ以外のリンク (`https://`、`mailto:`、他のファイル) はシステムの既定のハンドラで開きます。
- リンクにカーソルを合わせると、ステータス行にリンク先が表示されます。Ghostty と Kitty ではマウスポインタも手の形に変わります (OSC 22)。

### ファイルの種類

| 種類 | 表示のされ方 |
|------|-------------|
| Markdown (`.md`, `.markdown`, 標準入力) | 画像表示モードと同じく、テーマ・フォント・シンタックスハイライト・MermaidJS 付きでレンダリング |
| HTML (`.html`, `.htm`) | そのままのページを、独自の CSS・画像・スクリプト込みで表示。`-t` とフォントのオプションは適用されません |
| 画像 (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.avif`, `.bmp`, `.ico`) | テーマの背景の中央に配置し、幅より大きい場合は縮小 |
| PDF (`.pdf`) | すべてのページを [pdf.js](https://mozilla.github.io/pdf.js/) (jsDelivr からロード) で描画し、ページ幅で縦に並べます。PDF 内のリンクはクリックできません |

HTML、画像、PDF ファイルにはビューアが必要です。画像表示モードでは markterm は終了コード `1` で終了し、理由を表示します。

### ズームと横幅

- `+` / `-` はブラウザと同じように 50% から 300% の間を段階的に変化します。ズームのたびにページを再レンダリングするため、文字はくっきりしたままです。ステータス行には 100% でないときにズーム率が表示されます。
- ターミナルより幅の広いページ (HTML ページでよくある) は、収まるまで自動的に縮小されます (最小 25%)。その後の `+` と `-` は、その自動調整された倍率を起点に動作し、選んだ値がそのまま保たれます。
- `-s` と `-z` は、画像表示モードと同じく初期のスケールとズームを設定します。
- ターミナルのフォントサイズの変更 (例えば Ghostty での `Cmd` + `+`) を検出し、新しいセルサイズでページを再レンダリングします。
- ウィンドウのリサイズ中は、サイズが 0.25 秒間安定するまで再レンダリングを待つため、ドラッグ中にちらつきません。

### アニメーション画像

画面上のアニメーション GIF と WebP は、最大 10 フレーム毎秒で再生されます。画面全体ではなく、画像が占めるセルだけをキャプチャしてページの上に描画します。直前に送ったフレームと同じ場合は再送しないため、静止画像には出力コストがかかりません。

### 保存

- `s` は現在の Markdown ページを自己完結した HTML ファイル (ローカル画像を埋め込み、Mermaid 図も描画済み) として保存し、`p` は現在の幅とズームでのページ全体を PNG として保存します。
- ファイルは Markdown ファイルと同じ名前で同じ場所に書き出されます (`README.html`、`README.png`)。標準入力の場合はカレントディレクトリに `markterm.html` / `markterm.png` として保存されます。既存のファイルは上書きされず、代わりに `README-2.html`、`README-3.html` のように連番が使われます。
- 保存は Markdown 文書向けの機能です。HTML、画像、PDF ファイルの場合、ビューアがその旨を表示します。

## オプション

```
-t, --theme <name>             ターミナルの色ではなく組み込みテーマを使う (テーマの節を参照)
    --bg <#hex>                背景色 (#rgb または #rrggbb)。検出値またはテーマの値を上書き
    --fg <#hex>                前景色 (#rgb または #rrggbb)。検出値またはテーマの値を上書き
-w, --width <auto|px>          画像表示モード: ビューポート幅 (CSS px)。auto はターミナルから推定 (デフォルト: auto)
    --font <family>            本文フォント。CSS の font-family リスト (例: "Noto Sans JP")
    --code-font <family>       インラインコードとコードブロックのフォント (例: "JetBrains Mono")
    --font-size <px>           本文フォントサイズ (CSS px) (デフォルト: 16)
    --no-highlight             コードブロックのシンタックスハイライトを無効にする
    --no-links                 画像表示モード: 画像のあとに文書内のリンク一覧を出力しない (リンク一覧の節を参照)
-i, --image                    ビューアを開かず、1 枚のインライン画像を表示する
-s, --scale <factor>           Chromium に渡すデバイススケール係数 (デフォルト: 2)
    --mermaid <version>        jsDelivr からロードする MermaidJS バージョン (デフォルト: 11.16.0)
-z, --zoom <percent>           表示ズーム 1-100 (デフォルト: 100)
-p, --protocol <name>          画像プロトコルを強制: kitty, iterm2, sixel, file
-o, --output <file>            表示せずファイルに保存: 画像は .png、自己完結ページは .html
-h, --help                     ヘルプ、検出プロトコル、ビューアのキー操作を表示
-v, --version                  バージョン表示
```

位置引数: ファイルパス (Markdown、ビューアでは HTML・画像・PDF も指定可能)。省略時は標準入力から Markdown を読み込みます。

プロトコルの優先順位: `-p` > `MARKTERM_PROTOCOL` > 自動検出。

テーマとフォントの優先順位: コマンドラインオプション > 環境変数（`MARKTERM_THEME`、`MARKTERM_FONT`、`MARKTERM_CODE_FONT`）> デフォルト。[環境変数](#環境変数) を参照してください。

### フォント

`--font` と `--code-font` には CSS の `font-family` リストを指定するので、複数のフォントを優先順に並べられます（`--font "Inter, Noto Sans JP"`）。末尾には汎用フォント（`--font` は `sans-serif`、`--code-font` は `monospace`）が自動で追加されるため、インストールされていないフォントを指定しても近いフォントで表示されます。フォントはヘッドレス Chromium がシステムにインストールされたフォントから探します。指定しない場合、本文はシステムの UI フォント、コードはブラウザ標準の等幅フォントになります。`;`、`{`、`}`、`<`、`>` を含む値は終了コード `1` で拒否されます。

## テーマ

markterm はデフォルトでは固定の配色を使いません。実行のたびにターミナルへ色を問い合わせ、その結果からページのスタイルを組み立てます。

1. 背景色を `OSC 11`、前景色を `OSC 10`、リンク色に使うパレットの青を `OSC 4;4` で問い合わせます。各問い合わせは応答を最大 500 ms 待ちます。
2. 背景色と前景色から、コードブロックの背景、表の罫線色を導出し、背景の輝度から MermaidJS のテーマ（`dark` または `default`）を選びます。
3. `--bg` と `--fg` は検出値を個別に上書きします。両方を指定した場合はターミナルへの問い合わせを行わず、リンク色は `#89b4fa` になります。
4. 問い合わせに失敗した、または問い合わせできない場合は、`dark` テーマを使います。

自動検出には標準入力と標準出力の両方が TTY である必要があります。そのため、Markdown をパイプで渡した場合、出力をリダイレクトした場合、一部のマルチプレクサ内では検出が行われません。その場合は `-t` または `--bg`/`--fg` を使ってください。

### 組み込みテーマ

`-t <name>` を指定すると、組み込みテーマから背景色・前景色・リンク色をまとめて設定し、ターミナルへの問い合わせは行いません。いつも同じテーマを使うなら `MARKTERM_THEME` を設定してください（シェルの設定ファイルに `export MARKTERM_THEME=nord` など）。`-t` はこの設定より優先されます。その上から `--bg` と `--fg` で個別の色を上書きすることもできます（`-t nord --bg "#000000"`）。

| 名前 | 背景色 | 前景色 | リンク色 | シンタックスハイライト (Shiki) |
|------|--------|--------|----------|-------------------------------|
| `dark` | `#1e1e2e` | `#cdd6f4` | `#89b4fa` | `catppuccin-mocha` |
| `light` | `#ffffff` | `#1e1e2e` | `#1e66f5` | `github-light-default` |
| `catppuccin-mocha` | `#1e1e2e` | `#cdd6f4` | `#89b4fa` | `catppuccin-mocha` |
| `catppuccin-latte` | `#eff1f5` | `#4c4f69` | `#1e66f5` | `catppuccin-latte` |
| `dracula` | `#282a36` | `#f8f8f2` | `#bd93f9` | `dracula` |
| `nord` | `#2e3440` | `#d8dee9` | `#81a1c1` | `nord` |
| `gruvbox-dark` | `#282828` | `#ebdbb2` | `#83a598` | `gruvbox-dark-medium` |
| `gruvbox-light` | `#fbf1c7` | `#3c3836` | `#076678` | `gruvbox-light-medium` |
| `solarized-dark` | `#002b36` | `#839496` | `#268bd2` | `solarized-dark` |
| `solarized-light` | `#fdf6e3` | `#657b83` | `#268bd2` | `solarized-light` |
| `tokyo-night` | `#1a1b26` | `#c0caf5` | `#7aa2f7` | `tokyo-night` |
| `one-dark` | `#282c34` | `#abb2bf` | `#61afef` | `one-dark-pro` |
| `github-dark` | `#0d1117` | `#e6edf3` | `#4493f8` | `github-dark-default` |
| `github-light` | `#ffffff` | `#1f2328` | `#0969da` | `github-light-default` |

テーマ名は `markterm --help` でも確認できます。存在しないテーマ名（`-t` または `MARKTERM_THEME`）や、16 進カラーでない `--bg`/`--fg` を指定すると終了コード `1` で終了します。

### シンタックスハイライト

言語名を書いたコードブロック（` ```ts `、` ```python `、` ```sh ` など）は、VS Code と同じ文法定義を使う [Shiki](https://shiki.style/) で色付けされます。色付けはレンダリング前にローカルで行うため、ネットワーク接続は不要です。

- 色はテーマに合わせて選ばれます。組み込みテーマでは上の表の Shiki テーマを使います。ターミナルから検出した色（または `--bg`/`--fg` で指定した色）の場合は、背景の輝度に応じて `github-dark-default` か `github-light-default` を選びます。`--bg` でテーマの明暗が入れ替わった場合も同じ規則で選び直します。
- コードブロックの背景はページのコード背景色のままで、文字色だけを Shiki が決めます。
- 言語名のないブロック、未対応の言語、Mermaid ブロックは従来どおり表示されます。
- `--no-highlight` で色付けを無効にできます。

## 画像表示モード

画像表示モードは、文書を 1 枚のインライン画像として表示します。`-i` を指定したとき、`-o` を指定したとき、出力をパイプしたとき、tmux/screen 内、Kitty グラフィックスに対応していないターミナルで使われます。

### 幅とズーム

ページは CSS px 単位のビューポート幅でレイアウトされ、その `--scale` 倍の解像度で撮影されます。

- `-w auto` は「ターミナル列数 × 8 px ÷ scale」で幅を推定します。ターミナルからピクセル寸法は取得しないため、フォントが広い環境では `-w` の明示指定が必要になることがあります。
- `-w <px>` はビューポート幅を直接指定します。
- `-z <percent>` はビューポート幅を `100 ÷ zoom` 倍にします。`-z 50` ならページを 2 倍の幅でレイアウトしてからターミナル幅で表示するので、内容が半分の大きさに見えます。画面上の画像の幅は変わりません。
- 画像はターミナルの列数を指定して転送されるため、Kitty Graphics と iTerm2 では常にターミナル幅いっぱいに表示されます。Sixel はピクセルサイズそのままで出力します。
- **縦長の文書**: ターミナルには 1 枚のインライン画像の大きさに上限があります。Ghostty は高さ 10000 px を超える Kitty Graphics 画像を受け付けず、iTerm2 は 10000 px 以上の画像を受け付けないうえ、1 枚あたり最大 255 行までしか表示しません。描画結果が上限より高い場合、markterm は横帯に分割して順に転送するので、文書は 1 枚の連続した画像として表示されます。帯の高さは Kitty Graphics では 10000 px 以下、iTerm2 では現在のターミナル幅で 255 行に収まる高さ (幅 640 px の描画を 80 列に表示する場合で約 3300 px) です。切断位置は Chromium で実測し、ブロック間の余白に置きます。ブロック自体が帯より高い場合は表の行、リストの項目、テキストの行の境界で切ります。画像や図の内部で切ることはありません。継ぎ目にはターミナル側の都合で最大 1 行分の空白が入ることがあります。横方向は分割しないため、`--width × --scale` は 10000 px 未満にしてください。Sixel は分割しません。一時ファイルと `-o` には常に分割前の 1 枚を書き出します。
- **iTerm2 での大きな画像**: iTerm2 は 1 つの制御シーケンスを 1 MiB までしか受け付けません。base64 のペイロードがそれを超える帯は、iTerm2 3.5 で導入された分割形式 (`MultipartFile`、`FilePart`、`FileEnd`) で送ります。それ以下の場合は従来の単一の `File=` シーケンスを使うので、古い iTerm2 でも動作します。
- 画像表示モードでは、iTerm2 は常に自身のインライン画像プロトコルを使います。iTerm2 で `-p kitty` を強制しても何も描画されません (iTerm2 3.7.2 で確認)。同じバージョンでもビューアの Kitty グラフィックスは動作します。

### 出力と一時ファイル

- レンダリングした PNG は常に `$TMPDIR/markterm-<タイムスタンプ>.png`（`TMPDIR` 未設定時は `/tmp/`）に書き出されます。markterm はこれらを削除しません。
- インライン表示時: 画像のエスケープシーケンスを標準出力に書き、続けてリンク一覧（後述）を出力します。一覧の `[0]` が一時ファイルです。`--no-links` を指定した場合は、代わりに一時ファイルのパスを標準エラー出力に表示します。
- `-o <file>.png`: 指定パスに PNG を書き、`Saved to <file> (<bytes> bytes)` を表示します。インライン表示とリンク一覧の出力は行いません。
- `-o <file>.html`: 代わりに自己完結した HTML ページを書き出します。ビューアが表示するページと同じ内容で、ローカル画像は data URI として埋め込まれ、Mermaid 図はあらかじめ SVG として描画されています。
- `file` プロトコル時、または `img2sixel` のない Sixel 環境: 表示は行わず、`Saved to: <一時ファイルのパス>` を表示するので、別のビューアで開けます。続けてリンク一覧を出力します。
- 出力先がターミナルの場合、表示するファイルパスはリンク一覧と同じく OSC 8 ハイパーリンクになり、クリックで開けます。

### リンク一覧

画像の中のリンクはクリックできないため、markterm は画像のあとにリンクを一覧表示します。`[0]` は生成した PNG そのもので、文書内のリンクは `[1]` から続きます。

```
Links:
  [0] Rendered image  file:///tmp/markterm-1790130710561.png
  [1] License: MIT  https://github.com/gospelo-dev/markterm/blob/main/LICENSE
  [2] docs/QUICKSTART_ja.md  file:///path/to/markterm/docs/QUICKSTART_ja.md
```

- `[0]` は文書にリンクがない場合も常に表示します。
- 標準出力がターミナルの場合、各 URL は [OSC 8 ハイパーリンク](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda) になり、対応するターミナル（Ghostty、iTerm2、Kitty、WezTerm、foot など）ではクリックで開けます。非対応のターミナルでは URL がそのまま表示されます。標準出力をリダイレクトした場合はプレーンテキストで出力します。
- リンクは文書に出てくる順に、同じ URL は 1 回だけ表示します。表示名はリンクのテキスト、リンク内が画像の場合（バッジなど）は画像の代替テキストです。
- 相対パスと絶対パスは Markdown ファイルのディレクトリ（標準入力の場合はカレントディレクトリ）を基準に解決し、`file://` の URL で表示します。
- ページ内アンカー（`#section`）とリンクでない画像は表示しません。HTML の `<a>` タグで書かれたリンクも対象外です。
- リンクのテキストと URL に含まれる制御文字は取り除くので、文書のリンクを通じてターミナルのエスケープシーケンスを埋め込まれることはありません。
- `--no-links` で一覧を出力しないようにできます。その場合、一時ファイルのパスは従来どおり単独の行で表示します。

終了コード: 成功時 `0`、入力ファイルが存在しない、Markdown が空、またはビューアでしか表示できないファイルの場合は `1`。

## 仕組み

1. **marked** が Markdown を HTML に変換します。` ```mermaid ` フェンスを `<pre class="mermaid">` に変換するカスタム拡張付きです。言語名のあるその他のコードブロックは **Shiki** が色付けします
2. **Playwright** がヘッドレス Chromium で HTML を開き、CDN の MermaidJS を読み込んで、すべての Mermaid ブロックが SVG になるまで待ちます（最大 10 秒。超過した場合は未変換のブロックがあっても続行します）
3. ビューアでは、ページの表示範囲をキャプチャして、ターミナルのセルに配置した Kitty グラフィックス画像として表示します。ターミナルのセルサイズを問い合わせ (`CSI 16 t`、iTerm2 の `ReportCellSize`、または `CSI 14 t`) て、ページがセルにぴったり合うようにします。マウスのクリックと移動 (SGR マウスレポーティング) はページ上の座標に変換してリンクを探します
4. 画像表示モードでは、`<body>` 要素を PNG スクリーンショットとして撮影します。Kitty Graphics と iTerm2 で高さがターミナルの上限を超える場合は、実測したブロック境界で切った帯も撮影します ([幅とズーム](#幅とズーム) を参照)。選択された画像プロトコルで PNG (分割時は各帯を順に) をターミナルに転送します

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
| `MARKTERM_THEME` | デフォルトの組み込みテーマ（`-t` と同じ）。`-t` が優先されます。空の値は無視されます。 |
| `MARKTERM_FONT` | デフォルトの本文フォント（`--font` と同じ）。`--font` が優先されます。 |
| `MARKTERM_CODE_FONT` | デフォルトのコードフォント（`--code-font` と同じ）。`--code-font` が優先されます。 |
| `TMPDIR` | 一時 PNG の出力先ディレクトリ。デフォルトは `/tmp/`。 |

## ライブラリとしての利用

markterm は Node.js または Bun からライブラリとしても利用できます。ES モジュールと TypeScript の型定義を同梱しています。

```typescript
import { writeFile } from "node:fs/promises"
import { markdownToImage, dispose, fallbackTheme } from "markterm"

const png = await markdownToImage("# Hello\n\n```mermaid\ngraph LR\n  A-->B\n```", {
  colors: fallbackTheme("dark"),
  width: 800,
  fontSize: 16,
  deviceScaleFactor: 2,
  mermaidVersion: "11.16.0",
})

await writeFile("output.png", png)
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
| `markdownToImage(source, options?)` | Markdown を PNG の `Uint8Array` にレンダリング。オプション: `width`, `fontSize`, `fontFamily`, `codeFontFamily`, `colors`, `mermaidVersion`, `deviceScaleFactor`, `highlight`（デフォルト `true`）。フォントの値はそのまま使われます（汎用フォントは追加されません）。Shiki のテーマは `colors.codeTheme`、未設定なら背景の輝度から選ばれます |
| `markdownToImageBands(source, options)` | `markdownToImage` に `maxBandHeight` (px) を加えたもの。`{ png, bands }` を返す。`png` は全体、`bands` は実測したブロック境界で切った高さ `maxBandHeight` 以下の横帯。分割が不要なら `bands` は 1 要素 (`=== png`) |
| `markdownToDocument(source, options?)` | ビューアが表示する HTML ページ。ウィンドウいっぱいに広がり、相対パスの画像とリンクを `basePath` に対して解決し、見出しに GitHub 形式の id を付けます。オプションは `markdownToImage` から `width` と `deviceScaleFactor` を除いたもの、加えて `basePath` |
| `markdownToStandaloneHtml(source, options?)` | 同じページを、`-o file.html` が書き出すのと同じ自己完結した HTML 文字列として返す。ローカル画像は data URI として埋め込み、Mermaid 図は SVG として描画済み。Chromium を使用 |
| `measureCutCandidates(source, options?)` | レンダリングして `{ height, candidates }` を返す。body の高さと、markterm が切断候補とみなす位置 (CSS px)。デバッグ用 |
| `chooseCuts(candidates, totalHeight, maxBand)` | 帯の決定そのもの。貪欲法で届く範囲の最も低い候補を選び、候補がなければ上限で切る。純粋関数 |
| `dispose()` | 共有 Chromium インスタンスを終了。処理の最後に一度呼ぶ |
| `renderMarkdown(source)` | Markdown を HTML 文字列に変換（marked + Mermaid 拡張）。シンタックスハイライトなし |
| `renderMarkdownHighlighted(source, { codeTheme })` | `renderMarkdown` と同じく変換し、コードブロックを指定した Shiki テーマで色付けする。非同期 |
| `buildHtml(html, options?)` | 変換済み HTML をスタイル付きページテンプレートで包む |
| `detectProtocol()` | 現在のターミナルのプロトコルを返す: `kitty`, `iterm2`, `sixel`, `file` |
| `detectMultiplexer()` | 環境変数 `TMUX` と `STY` に基づき `"tmux"`、`"screen"`、または `null` を返す |
| `displayInline(png, { protocol? })` | PNG をインライン表示するエスケープシーケンス文字列を組み立てる。`file` の場合は `null`。`png` には帯の配列も渡せ、縦に連続して表示されるよう連結される |
| `maxBandHeightFor(protocol, pixelWidth)` | CLI がプロトコルごとに使う `maxBandHeight`。`kitty` は `KITTY_MAX_IMAGE_DIMENSION`、`iterm2` は `iterm2MaxBandHeight(pixelWidth, 列数)`、`sixel` と `file` は `null` |
| `KITTY_MAX_IMAGE_DIMENSION` | `10000`。Ghostty が Kitty Graphics 画像に課す 1 辺の上限 |
| `ITERM2_MAX_IMAGE_DIMENSION`、`ITERM2_MAX_ROWS`、`iterm2MaxBandHeight(pixelWidth, cols)` | iTerm2 の上限 (`10000`、到達した時点で拒否。1 枚あたり `255` 行) と、幅 `pixelWidth` の描画を `cols` 列で 255 行に収める帯の高さ |
| `getTerminalSize()` | ターミナルの列数と行数（`pixelWidth`/`pixelHeight` はこのバージョンでは常に `null`） |
| `estimateViewportWidth(scale)` | `-w auto` の推定ロジック |
| `extractLinks(source, basePath?)` | 文書内のリンクを `MarkdownLink[]`（`{ text, href, url }`）で返す。[リンク一覧](#リンク一覧) で使うもの |
| `formatLinkList(links, { hyperlinks, image? })` | リンクを CLI と同じ番号付き一覧に整形する。`hyperlinks` が `true` なら OSC 8 ハイパーリンクを付ける。`image`（ファイルパス）を渡すと、そのファイルを `[0] Rendered image` として先頭に入れる |
| `formatFilePath(path, { hyperlinks })` | 表示用のファイルパス。`hyperlinks` が `true` なら、指定どおりのパスを表示しつつ絶対パスの `file://` URL へリンクする OSC 8 ハイパーリンクにする |
| `queryTerminalColors()` | OSC で `bg`, `fg`, `blue` を問い合わせる。stdin/stdout が TTY でない、または応答がない場合は `null` |
| `deriveTheme(bg, fg, blue, codeTheme?)` | 3 つの HEX 色と、省略可能な Shiki テーマ名から `ThemeColors` を組み立てる |
| `fallbackTheme("dark" \| "light")` | 組み込みの `ThemeColors` |
| `getTheme(name)` | 組み込みテーマ名（[組み込みテーマ](#組み込みテーマ) を参照）に対応する `ThemeColors`。不明な名前なら `null` |
| `THEME_NAMES` | `getTheme` が受け付けるすべての名前 |
| `normalizeHex(value)` | `"#rgb"` / `"#rrggbb"` を小文字の `"#rrggbb"` に正規化。16 進カラーでなければ `null` |
| `isDark(hex)` | Mermaid テーマの選択に使う輝度判定 |

型: `ScreenshotOptions`, `BandOptions`, `ImageBands`, `DocumentOptions`, `MeasuredCandidates`, `TemplateOptions`, `ThemeColors`, `TerminalColors`, `TerminalSize`, `Protocol`, `Multiplexer`

## ライセンス

MIT
