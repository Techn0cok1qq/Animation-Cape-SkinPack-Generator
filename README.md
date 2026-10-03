# Animation Cape Skin Pack Gen

GIFまたは短いMP4とMinecraftスキンPNGから、マント用フレームとPCKパックを作るブラウザーアプリケーションです。

GIF/MP4の各フレームを`TemplateCapes.png`へ合成し、各フレームに対応するスキンとcape PNGを1組ずつPCKへ格納します。PNG連番ZIPも引き続き保存できます。

## Features

- GIFのフレーム分割、MP4のフレーム抽出（12 fps）
- テンプレート画像への自動合成
- `cape0.png`からの連番PNG作成とZIP保存
- スキン複数選択と`Hero 01`形式の連番名
- パック名とPACKIDの指定
- スキンとマントフレームの1対1ペアを含むPCKをメモリー上に生成
- Big Endian / Little Endianの選択
- 「PCKを保存」ボタンを押したときだけPCKをダウンロード
- Minecraftスキン用3Dビューアーでスキンとマントをプレビュー
- 展開図と空のアセット案内を隠した3D専用表示
- 3Dモデルのドラッグ回転とGIFフレーム再生（再生中も回転可能）
- 日本語 / 英語UI、ブラウザー内でのローカル処理

## Project Structure

```text
AnimationCapeTool/
├── index.html              # アプリケーションの画面構造
├── style.css               # UIとプレビュー領域のスタイル
├── script.js               # フレーム抽出、合成、再生、ZIP生成
├── start-server.bat        # Windows用ローカルサーバー起動スクリプト
└── image/
    └── TemplateCapes.png   # 合成元テンプレート
```

## Local Development

### Option 1: Windowsで起動する

`start-server.bat`をダブルクリックしてください。

このスクリプトはプロジェクト直下でHTTPサーバーを起動し、次のURLをブラウザーで開きます。

### Option 2: Pythonから起動する

プロジェクトフォルダーで次を実行します。

```powershell
py -m http.server 8000
```

その後、ブラウザーで`http://localhost:8000/index.html`を開きます。

### Option 3: VS Code Live Server

VS Codeで`index.html`を開き、Live Server拡張機能の「Go Live」を実行します。

## Important: Do Not Open with `file://`

`index.html`をChromeへ直接ドラッグしたり、ダブルクリックして`file://`で開くと、ES Moduleの読み込みがブラウザーのセキュリティ制限により失敗する場合があります。

必ず`http://localhost`または公開済みの`https://`から起動してください。

## Processing Flow

```text
GIF / MP4と1枚以上のスキンPNGを選択
        ↓
フレームをブラウザー内で抽出
        ↓
各フレームをTemplateCapes.pngへ合成
        ↓
PNGサイズを確認し、必要に応じて縮小
        ↓
ZIP用のcape0.png, cape1.png, ... とPCK内のID対応アセットを作成
        ↓
PCKを生成し、「PCKを保存」ボタンからダウンロード
```

スキン名は入力した接頭辞に`01`、`02`の連番を付けます。PCK内では各`dlcskin<ID>.png`に対応する`dlccape<ID>.png`を格納し、`CAPEPATH`もそのファイルを参照します。PNG ZIP内のフレーム名は`cape0.png`、`cape1.png`の連番です。スキン画像の枚数がフレーム数より少ない場合は、選択したスキンを繰り返し使います。設定を変更した後は「変換する」を押すとPCKを作り直します。

## External Libraries

外部ライブラリはCDNから読み込みます。

- [JSZip](https://stuk.github.io/jszip/)：PNGフレームのZIP生成
- [gifuct-js](https://github.com/matt-way/gifuct-js)：GIFの解析とフレーム分割
- [skinview3d](https://github.com/bs-community/skinview3d)：Minecraftスキンとマントの3D表示

依存関係は`package.json`で管理していないため、現状はビルド処理なしの静的サイトとして動作します。

## Licenses



- JSZip 3.10.1：MIT OR GPL-3.0。Copyright © 2009–2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso。 [License](https://github.com/Stuk/jszip/blob/main/LICENSE.markdown)
- gifuct-js 2.1.2：MIT。Copyright © 2015 Matt Way。 [License](https://github.com/matt-way/gifuct-js/blob/master/LICENSE)
- skinview3d 3.4.2：MIT。Copyright © 2014–2018 Kent Rasmussen、© 2017–2022 Haowei Wen、Sean Boult and contributors。 [License](https://github.com/bs-community/skinview3d/blob/master/LICENSE)

## Deployment

静的ホスティングサービスへプロジェクトフォルダー全体をアップロードしてください。

対応例：

- Netlify Drop
- GitHub Pages
- Cloudflare Pages
- Vercel Static Deployment

公開時に必要なファイルは次のとおりです。

```text
index.html
style.css
script.js
image/TemplateCapes.png
```

`start-server.bat`はローカル開発用なので、公開サイトには必須ではありません。

## Template Specification

現在のテンプレートは次の仕様で使用しています。

- ファイル名：`image/TemplateCapes.png`
- 実画像サイズ：512 × 288 px
- 合成位置：`x=6, y=6`
- 合成領域：60 × 96 px

テンプレートを変更する場合は、ファイル名を`TemplateCapes.png`に合わせてください。画像サイズを変更する場合は、`script.js`の`TARGET`設定と表示仕様も確認してください。

## Notes

- 変換処理はサーバーへファイルをアップロードせず、ブラウザー上で実行します。
- 長時間のMP4や高フレームレートのGIFは、多数のPNGを生成するためメモリを多く使用します。
- PNGは可逆形式のため、画像内容によっては35KB以下に収めるために合成画像内の素材表示サイズが縮小されます。
- CDNが利用できない環境ではGIF変換、ZIP生成、3Dプレビューが動作しません。
