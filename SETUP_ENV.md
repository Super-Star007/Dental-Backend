# バックエンド環境変数設定ガイド

## .env ファイルの編集方法

### 方法1: テキストエディタで直接編集

1. `backend` ディレクトリにある `.env` ファイルを開く
2. 以下の値をあなたの環境に合わせて編集
3. ファイルを保存

### 方法2: コマンドラインで編集（Windows PowerShell）

```powershell
# .envファイルをメモ帳で開く
notepad backend\.env

# またはVS Codeで開く
code backend\.env
```

## 必須設定項目

### 1. JWT_SECRET（必須 - セキュリティ上重要）

ランダムな文字列を生成して設定してください。

**Windows PowerShellで生成:**
```powershell
# ランダムな32文字の文字列を生成
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**または、オンラインツールを使用:**
- https://www.random.org/strings/ で32文字以上のランダム文字列を生成

**例:**
```env
JWT_SECRET=K8mN2pQ5rT9vW3xZ6bC1dF4gH7jL0nM8pQ2sT5vW8xZ1bC4dF7gH0jK3mN6pQ9
```

### 2. MONGODB_URI（必須）

#### ローカルMongoDBを使用する場合:
```env
MONGODB_URI=mongodb://localhost:27017/nigrek-dental
```

#### MongoDB Atlasを使用する場合:
1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)にログイン
2. クラスターを選択
3. "Connect" → "Connect your application" をクリック
4. 接続文字列をコピー
5. パスワードとデータベース名を設定

**例:**
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/nigrek-dental?retryWrites=true&w=majority
```

## 推奨設定項目

### 3. PORT（オプション）

デフォルトは `5000`。他のアプリケーションと競合する場合は変更:

```env
PORT=5001
```

### 4. NODE_ENV（オプション）

開発環境の場合は `development` のまま:

```env
NODE_ENV=development
```

## オプション設定項目（パスワードリセット機能を使用する場合のみ）

### 5. メール設定（Gmailを使用する場合）

#### ステップ1: Gmailアプリパスワードを生成

1. Googleアカウントにログイン
2. [アカウント設定](https://myaccount.google.com/) → 「セキュリティ」
3. 「2段階認証プロセス」を有効化（まだの場合）
4. 「アプリパスワード」を検索
5. 「アプリを選択」→「メール」
6. 「デバイスを選択」→「その他（カスタム名）」→「Nigrek Backend」と入力
7. 「生成」をクリック
8. 表示された16文字のパスワードをコピー

#### ステップ2: .envファイルに設定

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM=noreply@nigrek.com
```

**注意:** `EMAIL_PASS` には、生成された16文字のアプリパスワードを設定（スペースは削除しても可）

### 6. FRONTEND_URL（オプション）

フロントエンドが別のポートで起動する場合は変更:

```env
FRONTEND_URL=http://localhost:3000
```

## 完全な設定例

### 最小設定（ローカル開発用）

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nigrek-dental
JWT_SECRET=your_generated_random_string_here_minimum_32_characters
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000
```

### 完全設定（メール機能付き）

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nigrek-dental
JWT_SECRET=your_generated_random_string_here_minimum_32_characters
JWT_EXPIRE=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password_here
EMAIL_FROM=noreply@nigrek.com
FRONTEND_URL=http://localhost:3000
```

## 設定後の確認

1. `.env` ファイルを保存
2. バックエンドサーバーを起動:
   ```bash
   npm run server
   ```
3. エラーがないか確認
4. MongoDB接続が成功しているか確認（コンソールに「✅ MongoDB connected successfully」と表示される）

## トラブルシューティング

### MongoDB接続エラー

- MongoDBが起動しているか確認
- `MONGODB_URI` の値が正しいか確認
- ローカルの場合: `mongod` コマンドでMongoDBを起動

### JWT_SECRETエラー

- 32文字以上のランダム文字列を設定
- 特殊文字を含めても問題ありません

### メール送信エラー

- Gmailアプリパスワードが正しいか確認
- 2段階認証が有効になっているか確認
- `EMAIL_USER` と `EMAIL_PASS` が正しいか確認

