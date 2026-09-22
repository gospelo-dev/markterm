# クイックスタート

## 1. markterm をインストール

```bash
bun install -g markterm
```

## 2. Chromium をインストール

markterm は Playwright を使用してヘッドレスブラウザで Markdown をレンダリングします。

```bash
bunx playwright install chromium
```

## 3. (Sixel のみ) libsixel をインストール

Sixel プロトコルのターミナル (foot, xterm, mlterm, Konsole, mintty, Black Box) を使用する場合のみ必要です。

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

# テストファイルをレンダリング
markterm README.md
```

## 使用例

### 基本表示

```bash
markterm document.md
```

### 長いドキュメントを縮小表示

```bash
# 50% ズーム - コンテンツが縮小され、画像はターミナル幅いっぱいに表示
markterm document.md -z 50
```

### ライトテーマ

```bash
markterm document.md -t light
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

# iTerm2 IIP を明示的に使用
markterm document.md -p iterm2
```

### 標準入力からパイプ

```bash
echo "# Hello World" | markterm
```

## トラブルシューティング

### "Terminal protocol not supported" と表示される

ターミナルが自動検出されていません。プロトコルを強制指定してください:

```bash
markterm --help  # "Detected terminal protocol" を確認
markterm document.md -p kitty   # または iterm2, sixel
```

環境変数で設定することもできます:

```bash
export MARKTERM_PROTOCOL=kitty
```

### "Sixel display requires img2sixel" と表示される

libsixel をインストールしてください（手順 3 を参照）。

### 画像がターミナル幅いっぱいに表示されない

幅やズームを調整してみてください:

```bash
markterm document.md -w 1200
markterm document.md -z 75
```

### Mermaid ダイアグラムが表示されない

インターネット接続が必要です（MermaidJS は CDN からロードされます）。オフラインの場合、Markdown はレンダリングされますが Mermaid ブロックはテキストのまま表示されます。
