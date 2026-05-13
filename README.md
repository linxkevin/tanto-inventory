# Tanto Inventory System

Tanto Gyoza and Ramen Bar の在庫管理システムです。

## 構成

```
tanto-inventory/
├── client/    # React フロントエンド
└── server/    # Node.js + Express + PostgreSQL バックエンド
```

## ローカル開発

### サーバー
```bash
cd server
cp .env.example .env   # DATABASE_URL を設定
npm install
npm run dev
```

### クライアント
```bash
cd client
echo "REACT_APP_API_URL=http://localhost:3001" > .env
npm install
npm start
```

## Railway デプロイ手順

### 1. PostgreSQL を追加
Railway プロジェクトで「New Service」→「Database」→「PostgreSQL」を追加。

### 2. サーバーをデプロイ
- 「New Service」→「GitHub Repo」→ `tanto-inventory` を選択
- Root Directory: `server`
- 環境変数を設定:
  - `DATABASE_URL` = PostgreSQL の接続文字列（Railway が自動で提供）
  - `NODE_ENV` = `production`
  - `CLIENT_URL` = クライアントのデプロイURL（後で設定）

### 3. クライアントをデプロイ
- 「New Service」→「GitHub Repo」→ `tanto-inventory` を選択
- Root Directory: `client`
- 環境変数を設定:
  - `REACT_APP_API_URL` = サーバーのデプロイURL

### 4. CLIENT_URL を更新
サーバーの環境変数 `CLIENT_URL` にクライアントURLを設定して再デプロイ。

## 機能

- 📋 ベンダー別棚卸し入力（担当者スタンプ付き）
- 📊 管理者ダッシュボード（在庫 & 発注リスト）
- 📧 Gmail 連携発注メール（日本語固定）
- 📅 月別・日別履歴
- 🌐 日本語 / English / 中文 対応
- 🍺 サーバー棚卸し（アルコール・ドリンク）別カテゴリー
