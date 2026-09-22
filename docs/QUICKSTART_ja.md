# クイックスタート

## 0. 前提

- Bun 1.1 以上（`bun --version` で確認）。markterm は Node.js では動作しません。
- 画像プロトコルに対応したターミナル: Ghostty、Kitty、WezTerm、iTerm2、または Sixel 対応ターミナル。一覧は README を参照してください。
- ネットワーク接続。初回（Chromium のダウンロード）と、Mermaid ダイアグラムを含むレンダリングのたび（CDN からロード）に必要です。

## 1. markterm をインストール

```bash
bun install -g markterm
```

## 2. Chromium をインストール

markterm は Playwright を使ってヘッドレスブラウザで Markdown をレンダリングします。

```bash
bunx playwright install chromium
```

## 3. (Sixel のみ) libsixel をインストール

Sixel プロトコルのターミナル (foot, xterm, mlterm, Konsole, mintty, Black Box) を使う場合のみ必要です。`img2sixel` がないと、markterm は PNG ファイルの保存にフォールバックします。

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
# 検出されたプロトコルとターミナル列数を確認
markterm --help

# テストファイルをレンダリング
markterm README.md
```

`markterm --help` は `Detected terminal protocol: kitty` のような行を表示します。`file` と表示される場合は、下のトラブルシューティングを参照してください。

## 使用例

### 基本表示

```bash
markterm document.md
```

### 長いドキュメントを縮小表示

```bash
# 50% ズーム: 内容は縮小され、画像はターミナル幅いっぱいに表示
markterm document.md -z 50
```

### テーマを強制する

markterm は既定でターミナルの背景色と前景色を読み取り、そこからテーマを組み立てます。`-t` はその検出ができない場合（標準入力からのパイプなど）にだけ効きます。

```bash
markterm document.md -t light
```

### 色を直接指定する

```bash
markterm document.md --bg "#282c34" --fg "#abb2bf"
```

### ファイルに保存

```bash
markterm document.md -o preview.png
```

### MermaidJS バージョンを変更

```bash
markterm document.md --mermaid 12.0.0
```

### プロトコルを強制指定

```bash
# iTerm2 で Sixel を使用
markterm document.md -p sixel

# iTerm2 のインライン画像を明示的に使用
markterm document.md -p iterm2

# インライン表示せず、PNG を保存してパスだけ表示
markterm document.md -p file
```

### 標準入力からパイプ

```bash
echo "# Hello World" | markterm
```

パイプで入力すると標準入力が TTY ではなくなるため、色の自動検出は行われず、`-t` のフォールバックテーマ（既定は `dark`）が使われます。明るいターミナルでは `-t light` を付けてください。

## トラブルシューティング

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

### "Sixel display requires img2sixel" と表示される

libsixel をインストールしてください（手順 3 を参照）。

### 色がターミナルと合わない

自動検出には、標準入力と標準出力の両方が TTY であること、そしてターミナルが `OSC 10`/`OSC 11` の問い合わせに 500 ms 以内に応答することが必要です。Markdown をパイプで渡した、出力をリダイレクトした、ターミナルが応答しない、のいずれかの場合は `-t` のフォールバックが使われます。`-t light` を付けるか、`--bg` と `--fg` で色を固定してください。

### 画像がターミナル幅いっぱいにならない、文字が小さすぎる・大きすぎる

自動の幅は「列数 × 8 px ÷ scale」で推定しており、細めのフォントを前提にしています。幅かズームを調整してください。

```bash
markterm document.md -w 1200
markterm document.md -z 75
```

### Mermaid ダイアグラムが生テキストのまま表示される

インターネット接続を確認してください（MermaidJS は CDN からロードされます）。markterm はダイアグラムの描画を最大 10 秒待ち、その後ページをそのまま撮影します。選択した MermaidJS バージョンで構文エラーになる場合は、`--mermaid` で別のバージョンを試してください。

### 一時ファイルが溜まる

実行のたびに `$TMPDIR/markterm-<タイムスタンプ>.png` が書き出され、削除されません。次のコマンドで掃除できます。

```bash
rm "${TMPDIR:-/tmp}"/markterm-*.png
```
