# Backend Setup Guide

## バックエンドの起動方法

### 1. 依存関係のインストール

```bash
cd backend
npm install
```

または、プロジェクトルートから：

```bash
npm run install-server
```

### 2. 環境変数の設定

`.env` ファイルが既に作成されています。必要に応じて以下の値を変更してください：

- **MONGODB_URI**: MongoDBの接続文字列
  - ローカル: `mongodb://localhost:27017/nigrek-dental`
  - MongoDB Atlas: `mongodb+srv://username:password@cluster.mongodb.net/nigrek-dental`
  
- **JWT_SECRET**: ランダムな文字列（本番環境では必ず変更）
  - 例: `openssl rand -base64 32` で生成

- **EMAIL_***: パスワードリセット機能を使用する場合のみ設定
  - Gmailを使用する場合、アプリパスワードを生成する必要があります

### 3. MongoDBの起動

#### ローカルMongoDBを使用する場合：

```bash
# Windows
mongod

# macOS/Linux
sudo mongod
```

または、MongoDBがサービスとして起動している場合は自動的に接続されます。

#### MongoDB Atlasを使用する場合：

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)でアカウント作成
2. クラスターを作成
3. 接続文字列を取得して `.env` の `MONGODB_URI` に設定

### 4. バックエンドサーバーの起動

#### 開発モード（推奨）:
```bash
cd backend
npm run dev
```

このコマンドは `nodemon` を使用するため、ファイル変更時に自動的に再起動します。

#### 本番モード:
```bash
cd backend
npm start
```

### 5. 動作確認

サーバーが起動すると、以下のメッセージが表示されます：

```
✅ MongoDB connected successfully
🚀 Server running on port 5000
📍 Environment: development
```

ブラウザまたはPostmanで以下にアクセスして確認：

```
http://localhost:5000/api/health
```

正常な場合、以下のJSONが返されます：

```json
{
  "status": "OK",
  "message": "Nigrek Dental Visit System API"
}
```

## トラブルシューティング

### MongoDB接続エラー

- MongoDBが起動しているか確認
- `MONGODB_URI` が正しいか確認
- ファイアウォール設定を確認（MongoDB Atlasの場合）

### ポートが既に使用されている

`.env` ファイルで `PORT` を変更してください（例: `PORT=5001`）

### モジュールが見つからないエラー

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

## API エンドポイント

- `GET /api/health` - ヘルスチェック
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/forgotpassword` - パスワードリセットメール送信
- `PUT /api/auth/resetpassword/:token` - パスワードリセット
- `GET /api/auth/me` - 現在のユーザー情報（認証必要）

