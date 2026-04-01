# ビアログ（Beer Log）  
日本市場向けクラフトビールレビューアプリ


---


## 概要
本アプリケーションは、日本市場向けに開発したクラフトビールレビューサービスである。
 ユーザーはビールおよび醸造所の検索、レビュー投稿、管理を行うことができる。
既存のビールレビューサービスの多くは海外発であり、評価基準が欧米の嗜好に偏っているという課題がある。
 そのため、本アプリケーションでは、日本人ユーザーの嗜好に基づいた評価体験を提供することを目的としている。
本システムは、フロントエンドとバックエンドを分離した構成（Decoupled Architecture）を採用し、拡張性および保守性を考慮した設計とした。
フロントエンドにはNext.js、バックエンドにはExpressおよびPostgreSQLを採用したフルスタック構成で開発している。
---


## 技術スタック


### フロントエンド
- Next.js（App Router）
- TypeScript
- Zod（バリデーション）
- React Hook Form
- useActionState（Server Actions）


### バックエンド
- Node.js
- Express
- Zod（バリデーション）
- REST API


### データベース
- PostgreSQL


---


## 認証・セキュリティ


- bcryptによるパスワードハッシュ化
- JWT認証
- HTTPS Only Cookieによるセキュリティ対策（XSS対策）
- ロールベースの権限管理
  - 一般ユーザー：自身の投稿の作成・編集
  - 管理者ユーザー：全データの閲覧・編集・削除（論理削除／物理削除／復元）
- レート制限
- CORS設定（クロスオリジンアクセス制御）


---


## アーキテクチャ


- フロントエンド／バックエンド分離構成による高い保守性
- ExpressによるREST API設計
- PostgreSQLによるリレーショナルデータベース設計
  - Users
  - Beers
  - Breweries
  - Reviews
  - Review Pictures
  - Recent Activity


---


## 主な機能


### 基本機能
- ビール・醸造所一覧表示
- レビュー投稿・管理機能
- 検索機能
- 管理者向け管理画面


### 検索機能
- SQLのLIKE句を用いたキーワード検索
- limit / offsetによるページネーション


### レンダリング最適化
- SSG（静的生成）
  - ビール・醸造所ページ（SEO対策）


- CSR（クライアントサイドレンダリング）
  - レビュー一覧など動的コンテンツ
  - ユーザー体験の向上


### フォーム機能
- テキストフォーム
  - useActionStateを利用
  - サーバー／クライアント両方でのバリデーション


- 画像アップロードフォーム
  - React Hook Formを利用
  - フロントエンドでの画像バリデーション対応


### ページネーション戦略
- カーソルページネーション
  - アクティビティフィードに使用
  - 無限スクロールに最適化


- オフセットページネーション（limit / offset）
  - ビール・ブルワリー・レビュー一覧に使用
  - URL共有・ブックマークに対応


---


## 設計上の工夫


- 画面の目的に応じてSSG / SSR / CSRを使い分け、表示速度とSEOの最適化を実現
- ユースケースごとにページネーション手法を使い分け、パフォーマンスとユーザー体験を向上
- フロントエンドとバックエンドを分離した構成により、スケーラビリティおよび保守性を確保
- JWTを用いた認証・認可機構を実装し、セキュアなユーザー管理を実現
- リレーショナルデータベースの特性を活かしたスキーマ設計により、データ整合性を担保
- コンポーネント設計およびAPI設計の統一により、再利用性と可読性を向上
- エラーハンドリングおよびバリデーションの統一により、アプリケーションの安定性を向上




---


## 今後の改善案


- 全文検索の導入（PostgreSQL tsvector など）
- ユーザーの行動履歴に基づくレコメンド機能
- 多言語対応
- 画像最適化およびCDN連携


---


## セットアップ手順


### 1. リポジトリのクローン
```bash
git clone https://github.com/brianamos93/beercomi
cd beercomi
```


## データベースセットアップ


本アプリケーションでは、PostgreSQLデータベースを使用する。


### 1. PostgreSQLの準備
任意の方法でPostgreSQLをセットアップし、起動する。
（例：ローカル環境、Docker、クラウドサービスなど）


### 2. データベースの作成
任意の名前でデータベースを作成する。


### 3. スキーマの初期化
以下のSQLファイルを実行し、データベースのスキーマを構築する。


```bash
/beercomi/sqlfiles/builddb.sql
```


#### 実行例
```bash
psql -U <ユーザー名> -d <データベース名> -f beercomi/sqlfiles/builddb.sql
```
パッケージのインストール


```bash
npm install


```


開発サーバー起動


```bash
npm run dev


```


本番ビルド・起動


```bash
npm run build


npm run start


```


環境変数の設定（フロントエンド）dot env




```bash
DB_URL=
DEBUG=
SECRET=
NODE_ENV=
ADMIN_PASSWORD=
REGULAR_PASSWORD=
PORT=
FRONT_END_URL=


```


##　バックエンド構成


beercomi（トップディレクトリ）
├── dataSeeding（テストデータをデータベースに投入するためのファイル）
├── restrequests（テスト用のRESTリクエストファイル）
├── sqlfiles（データベースを構築するためのSQLファイル）
├── src（APIのメインフォルダ）
│ ├── controllers（コントローラー）
│ ├── defs（TypeScriptの型定義）
│ ├── models（モデル）
│ ├── routes（ルーティング）
│ ├── schemas（Zodスキーマ）
│ ├── uploads（ファイルアップロード関連）
│ └── utils（ユーティリティファイル）
│ ├── libs（共通で使用される関数）
│ └── middleware（ミドルウェア）
└── tests（テストファイル）




## フロントエンドのGithubを見てください
```bash
https://github.com/brianamos93/beercomi_front
```

