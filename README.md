# 楽屋シリーズ

吹奏楽の団体のためのツール集「楽屋シリーズ」を公開するためのリポジトリです。
**フォルダ1つが、ツール1つ**です。どのツールも、そのフォルダの `index.html` 1つで動き、ほかのフォルダのファイルは読み込みません。
`https://bamiriunei-arch.github.io/` を開くと、入口の楽屋（`gakuya/`）に移ります。

## ツール

| ツール | フォルダ | 公開ページ | できること |
| --- | --- | --- | --- |
| 楽屋 | [`gakuya/`](gakuya/) | https://bamiriunei-arch.github.io/gakuya/ | 吹奏楽の団体のためのツール集「楽屋シリーズ」の入口。部員・曲・楽器のデータを入れておくと、全部のツールで使える |
| 本番逆算スケジュール | [`gyakusan/`](gyakusan/) | https://bamiriunei-arch.github.io/gyakusan/ | 演奏会・コンクールの日付から、会場予約・チラシ・プログラム・運搬などの準備の締め切りを逆算して並べる |
| 楽譜ライブラリ | [`gakufu/`](gakufu/) | https://bamiriunei-arch.github.io/gakufu/ | 吹奏楽の団体が持っている楽譜の台帳。パート譜の欠け、レンタルの返却期限、演奏した記録、今の部員でできる曲がわかる |
| テンポマップ | [`tempomap/`](tempomap/) | https://bamiriunei-arch.github.io/tempomap/ | 区間ごとの小節数・拍子・テンポから演奏時間を計算し、コンクールなどのカット案を比べる。テンポの変化どおりに鳴る練習用クリックつき |
| コウバン | [`kouban/`](kouban/) | https://bamiriunei-arch.github.io/kouban/ | 吹奏楽の演奏会で、曲ごとに誰がどのパートを受け持つかを決めて確かめる香盤表ツール |
| 楽器決め・編成計画 | [`gakkigime/`](gakkigime/) | https://bamiriunei-arch.github.io/gakkigime/ | 新入部員の楽器の割り振り案を、希望と定員から理由つきで出す。今の学年構成から、来年・再来年のパートの人数を予測する |
| 仕込み図 | [`shikomi/`](shikomi/) | https://bamiriunei-arch.github.io/shikomi/ | 演奏会の音響・照明の打合せ資料を作る。使うものを選ぶとインプットリストができ、配置図にマイクを置き、きっかけ表を作れる |
| 楽器台帳 | [`gakki/`](gakki/) | https://bamiriunei-arch.github.io/gakki/ | 楽器・備品の台帳。状態、修理・点検・貸し出しの記録、借りた時点の写真、QRコードのラベル、リードなど消耗品の在庫 |
| 搬入出リスト | [`hannyu/`](hannyu/) | https://bamiriunei-arch.github.io/hannyu/ | 演奏会やコンクールの楽器運搬。運ぶものの一覧、車の割り当て、積む順、行き帰りのチェックをスマホで |
| 合奏ノート | [`gassou/`](gassou/) | https://bamiriunei-arch.github.io/gassou/ | 合奏ごとに自由に書けるノートと、合奏の録音への小節の目印・時刻つきコメント。コメントはパートごとに書き出せる。録音は端末の中だけで扱う |

前からあるツールは、別のリポジトリのままです：バミリ（`bamiri`）、ドリルボード（`drillboard`）。
どちらも同じ `bamiriunei-arch.github.io` の下にあるので、楽屋のバックアップにも入ります。

## 更新のしかた

- **1つのツールを直したとき**：GitHub でそのフォルダ（例：`kouban`）を開き、「Add file」→「Upload files」で新しい `index.html` を上げて「Commit changes」
- **いくつかまとめて**：リポジトリのいちばん上で「Add file」→「Upload files」を開き、フォルダごと（例：`kouban` と `gakufu`）ドラッグして「Commit changes」。同じ名前のファイルが上書きされます
- 数分すると公開ページが新しくなります。「Actions」タブで、自動テストが緑のチェック（✓）になっているか見ます
  - 赤い × のときは、押すとどのツールのどのテストが失敗したか見られます
- GitHub の画面から1回に上げられるのは100ファイルまでです

各 `index.html` の中の「楽屋シリーズ 共通部品 ここから〜ここまで」は、全ツールで同じ内容です。
1つのツールだけを直すときは、その外側を直します。共通部品を変えるときは、全部のフォルダの `index.html` をそろえて変え、`GKY.VERSION` を上げます。

## 自動テスト

GitHub に上げるたびに、全ツールのテストが自動で動きます（`.github/workflows/test.yml`）。
自分のパソコンで動かすときは、Node.js（20以上）と Python 3 を入れて、このリポジトリのいちばん上で：

```
npm install
npx playwright install chromium
node test-all.js            … 全ツール
node test-all.js kouban     … 1つだけ
```

## いちばん上のファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 楽屋（`gakuya/`）へ移るだけのページ |
| `.nojekyll` | GitHub Pages に、ファイルを手を加えずそのまま配ってもらうための印（中身は空） |
| `.github/workflows/test.yml` | GitHub に上げるたびに自動テストを動かす設定 |
| `package.json`・`test-all.js` | 自動テストの道具と、全ツールを順に調べるしくみ |
| `.gitignore` | GitHub に上げないもの（テストの結果など） |

楽屋のデータ（部員・曲・楽器）の形と、各ツールのデータの保存場所は、`gakuya/README.md` にあります。
