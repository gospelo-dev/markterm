# クイックスタート

## 0. 前提

- Node.js 20 以上（`node --version` で確認）、または Bun 1.1 以上（`bun --version` で確認）。
- 画像プロトコルに対応したターミナル。全画面のビューアを使うには、Ghostty、Kitty、WezTerm、または Kitty グラフィックスに対応した iTerm2（3.7.2 で動作確認済み）が必要です。古い iTerm2 や Sixel 対応ターミナルなど、それ以外のターミナルでは画像表示モードになります。一覧は README を参照してください。
- ネットワーク接続。初回（Chromium のダウンロード）と、Mermaid ダイアグラムを含むレンダリングのたび、ビューアで PDF を表示するときに必要です（MermaidJS と pdf.js は CDN からロードされます）。

## 1. markterm をインストール

```bash
npm install -g markterm
# または: bun install -g markterm
```

`markterm` コマンドは Node.js で実行されます。Node.js がない環境では、以降の手順の `markterm` を `bunx --bun markterm` に置き換えてください。

## 2. Chromium をインストール

markterm は Playwright を使ってヘッドレスブラウザで Markdown をレンダリングします。

```bash
npx playwright install chromium
# または: bunx playwright install chromium
```

## 3. (Sixel のみ) libsixel をインストール

Sixel プロトコルのターミナル (foot, xterm, mlterm, Konsole, mintty, Black Box) で画像表示モードを使う場合のみ必要です。`img2sixel` がないと、markterm は PNG ファイルの保存にフォールバックします。

```bash
# macOS
brew install libsixel

# Debian / Ubuntu
sudo apt install libsixel-bin

# Fedora
sudo dnf install libsixel-utils
```

## 4. 動作確認

```bash
# 検出されたプロトコルを確認
markterm --help

# ファイルを開く
markterm README.md
```

Ghostty、Kitty、WezTerm、Kitty グラフィックス対応の iTerm2 では、`markterm README.md` で全画面のビューアが開きます。`j`/`k` やマウスホイールでスクロールし、リンクをクリックでき、`q` で終了します。それ以外のターミナルでは、文書を 1 枚の画像として表示します。`markterm --help` は `Detected terminal protocol: kitty` のような行を表示します。`file` と表示される場合は、下のトラブルシューティングを参照してください。

## 使用例

### ビューアで文書を読む

```bash
markterm document.md
```

| キー | 動作 |
|------|------|
| `j` / `k`、矢印キー、マウスホイール | スクロール |
| `Space` / `b` | 1 ページ下 / 上 |
| `g` / `G` | 先頭 / 末尾 |
| クリック | リンクを開く（`.md`、`.html`、画像、`.pdf` はビューア内で開く） |
| `h` | 戻る |
| `+` / `-` / `0` | ズームイン / ズームアウト / リセット |
| `r` | ファイルを再読み込み |
| `s` / `p` | HTML / PNG として保存 |
| `q` | 終了 |

### HTML・画像・PDF を開く

```bash
markterm page.html
markterm screenshot.png
markterm paper.pdf
```

### ビューアの代わりに 1 枚の画像を表示する

```bash
markterm document.md -i

# 50% ズーム: 内容は縮小され、画像はターミナル幅いっぱいに表示
markterm document.md -i -z 50
```

### テーマを強制する

markterm は既定でターミナルの背景色と前景色を読み取り、そこからテーマを組み立てます。`-t <name>` を指定すると代わりに組み込みテーマを使い、背景色・前景色・リンク色をまとめて設定します。テーマ名の一覧は `markterm --help` または README で確認できます。

```bash
markterm document.md -t light
markterm document.md -t dracula

# テーマとフォントを既定にする（シェルの設定ファイルに追記）
export MARKTERM_THEME=dracula
export MARKTERM_FONT="Noto Sans JP"
export MARKTERM_CODE_FONT="JetBrains Mono"
```

コマンドラインオプション（`-t`、`--font`、`--code-font`）はこれらの環境変数より優先されます。

### 色を直接指定する

```bash
markterm document.md --bg "#282c34" --fg "#abb2bf"
```

### ファイルに保存

```bash
markterm document.md -o preview.png
markterm document.md -o preview.html   # 画像を埋め込んだ自己完結の HTML ページ
```

### MermaidJS バージョンを変更

```bash
markterm document.md --mermaid 12.0.0
```

### 画像表示モードのプロトコルを強制指定

```bash
# iTerm2 で Sixel を使用
markterm document.md -i -p sixel

# iTerm2 のインライン画像を明示的に使用
markterm document.md -p iterm2

# インライン表示せず、PNG を保存してパスだけ表示
markterm document.md -p file
```

### 標準入力からパイプ

```bash
echo "# Hello World" | markterm
```

パイプで入力すると標準入力が TTY ではなくなるため、色の自動検出は行われず、`dark` テーマが使われます。明るいターミナルでは `-t light`（または別のテーマ）を付けてください。ビューアのキー入力はターミナルから読むので、この場合もビューアは使えます。

## トラブルシューティング

### ビューアが開かず、画像が表示される

ビューアを開くには、標準出力が Kitty グラフィックス対応のターミナルで、tmux/screen の外で、`-i` も `-o` も付けずに実行する必要があります。検出結果を確認してください。

```bash
markterm --help                 # "Detected terminal protocol" を確認
```

- 出力をパイプやリダイレクトに送っている（`markterm doc.md | less` など）：意図どおり画像表示モードになります。
- tmux や screen の中：マルチプレクサの外で実行するか、ビューアが動作する [herdr](https://herdr.dev/) を使ってください。
- iTerm2：Kitty グラフィックスの問い合わせに応答した場合のみビューアを開きます（3.7.2 は応答します）。古いバージョンでは画像表示モードになります。

### 画像の代わりに `Saved to: /tmp/markterm-....png` と表示される

ターミナルが自動検出されなかったか、Sixel と判定されたものの `img2sixel` がありません。検出結果を確認し、必要ならプロトコルを強制指定してください。

```bash
markterm --help                 # "Detected terminal protocol" を確認
markterm document.md -p kitty   # または iterm2, sixel
```

環境変数で設定することもできます。

```bash
export MARKTERM_PROTOCOL=kitty
```

tmux や screen の中では、画像のエスケープシーケンスが通常は外側のターミナルに届かないため、markterm はファイル保存にフォールバックします。マルチプレクサの外で実行してください。

### "browserType.launch: Executable doesn't exist at .../chromium_headless_shell-NNNN" と表示される

markterm が使う Playwright が、インストールされていない Chromium のビルドを探しています。markterm と一緒にインストールされた Playwright と、Chromium をダウンロードした Playwright のバージョンが違う場合に起こります。markterm を更新したあとや、古い Playwright が別に残っている場合などです。markterm 0.4 には Playwright 1.63 以上が必要です。

```bash
# markterm を入れ直して新しい Playwright を使うようにし、その Chromium をダウンロード
npm install -g markterm
npx playwright install chromium
```

それでも古いビルド番号が表示される場合は、`npm ls -g playwright` で markterm が読み込む Playwright のバージョンを確認し、そのバージョン用の Chromium を `npx playwright@<バージョン> install chromium` でインストールしてください。

### "Sixel display requires img2sixel" と表示される

libsixel をインストールしてください（手順 3 を参照）。

### 色がターミナルと合わない

自動検出には、標準入力と標準出力の両方が TTY であること、そしてターミナルが `OSC 10`/`OSC 11` の問い合わせに 500 ms 以内に応答することが必要です。Markdown をパイプで渡した、出力をリダイレクトした、ターミナルが応答しない、のいずれかの場合は `dark` テーマが使われます。`-t` でテーマを選ぶか、`--bg` と `--fg` で色を固定してください。

### 文字が小さすぎる・大きすぎる

ビューアでは `+` か `-` を押してください。画像表示モードでは、自動の幅を「列数 × 8 px ÷ scale」で推定しており、細めのフォントを前提にしています。幅かズームを調整してください。

```bash
markterm document.md -i -w 1200
markterm document.md -i -z 75
```

### Mermaid ダイアグラムが生テキストのまま表示される、PDF が表示されない

インターネット接続を確認してください（MermaidJS と pdf.js は CDN からロードされます）。markterm はダイアグラムの描画を最大 10 秒待ち、その後ページをそのまま撮影します。選択した MermaidJS バージョンで構文エラーになる場合は、`--mermaid` で別のバージョンを試してください。

### 一時ファイルが溜まる

画像表示モードでは、実行のたびに `$TMPDIR/markterm-<タイムスタンプ>.png` が書き出され、削除されません。次のコマンドで掃除できます。

```bash
rm "${TMPDIR:-/tmp}"/markterm-*.png
```
