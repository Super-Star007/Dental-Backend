# MongoDB Atlas セットアップガイド

## MongoDB Atlas への接続方法

### ステップ1: MongoDB Atlas アカウントの作成

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) にアクセス
2. 「Try Free」をクリックしてアカウントを作成
3. 無料プラン（M0）を選択

### ステップ2: クラスターの作成

1. 「Build a Database」をクリック
2. 「FREE」プランを選択
3. クラウドプロバイダーとリージョンを選択（推奨: AWS, 東京リージョン）
4. クラスター名を入力（例: `Cluster0`）
5. 「Create」をクリック

### ステップ3: データベースユーザーの作成

1. 「Database Access」をクリック
2. 「Add New Database User」をクリック
3. 認証方法を選択:
   - **Password**: ユーザー名とパスワードを設定
   - または **Certificate**: 証明書を使用
4. ユーザー権限: 「Atlas admin」または「Read and write to any database」
5. 「Add User」をクリック
6. **重要**: ユーザー名とパスワードをメモしておく

### ステップ4: ネットワークアクセスの設定

1. 「Network Access」をクリック
2. 「Add IP Address」をクリック
3. オプション:
   - **開発用**: 「Add Current IP Address」をクリック
   - **本番用**: 「Allow Access from Anywhere」を選択（`0.0.0.0/0`）
4. 「Confirm」をクリック

**注意**: セキュリティのため、本番環境では特定のIPアドレスのみを許可することを推奨します。

### ステップ5: 接続文字列の取得

1. 「Database」タブに戻る
2. 「Connect」ボタンをクリック
3. 「Connect your application」を選択
4. Driver: **Node.js**、Version: **5.5 or later** を選択
5. 接続文字列をコピー

接続文字列の例:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### ステップ6: .env ファイルに設定

`backend/.env` ファイルを開き、`MONGODB_URI` を更新:

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/nigrek-dental?retryWrites=true&w=majority
```

**重要**: 
- `<username>` と `<password>` を実際の値に置き換える
- パスワードに特殊文字（`@`, `#`, `%` など）が含まれる場合は、URLエンコードが必要
- データベース名（`nigrek-dental`）を接続文字列に追加

### ステップ7: 接続のテスト

接続をテストするには:

```bash
cd backend
node test-connection.js
```

または、サーバーを起動:

```bash
npm run dev
```

正常に接続できると、以下のメッセージが表示されます:

```
✅ MongoDB connected successfully
```

## トラブルシューティング

### エラー: "authentication failed"

- ユーザー名とパスワードが正しいか確認
- パスワードに特殊文字が含まれる場合は、URLエンコードが必要
  - `@` → `%40`
  - `#` → `%23`
  - `%` → `%25`
  - `:` → `%3A`

### エラー: "IP address not whitelisted"

- MongoDB Atlas の「Network Access」でIPアドレスを追加
- 「Allow Access from Anywhere」を選択（開発環境のみ）

### エラー: "ENOTFOUND" または "getaddrinfo"

- クラスターのホスト名が正しいか確認
- インターネット接続を確認

### エラー: "timeout"

- ファイアウォール設定を確認
- ネットワーク接続を確認
- MongoDB Atlas のクラスターが起動しているか確認

## 接続文字列の形式

### 基本形式

```
mongodb+srv://username:password@cluster.mongodb.net/database-name?options
```

### オプション

- `retryWrites=true`: 書き込み操作の再試行を有効化
- `w=majority`: 書き込み確認を有効化
- `ssl=true`: SSL接続を有効化（デフォルトで有効）

### 完全な例

```env
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/nigrek-dental?retryWrites=true&w=majority
```

## セキュリティのベストプラクティス

1. **強力なパスワード**: データベースユーザーには強力なパスワードを使用
2. **IP制限**: 本番環境では特定のIPアドレスのみを許可
3. **環境変数**: `.env` ファイルをGitにコミットしない（`.gitignore`に含まれています）
4. **定期的なローテーション**: パスワードを定期的に変更

## 接続テストスクリプト

`backend/test-connection.js` を使用して接続をテストできます:

```bash
cd backend
node test-connection.js
```

このスクリプトは:
- 接続文字列を検証
- MongoDBへの接続をテスト
- データベース情報を表示
- エラーの詳細を表示

