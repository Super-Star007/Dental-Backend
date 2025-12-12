# MongoDB Atlas クイックセットアップ

## 現在の接続エラー

接続テストで以下のエラーが発生しています:
```
querySrv ENOTFOUND _mongodb._tcp.cluster.mongodb.net
```

これは、MongoDB Atlas の接続文字列が正しく設定されていないことを示しています。

## 解決方法

### ステップ1: MongoDB Atlas で接続文字列を取得

1. [MongoDB Atlas](https://cloud.mongodb.com/) にログイン
2. クラスターを選択
3. 「Connect」ボタンをクリック
4. 「Connect your application」を選択
5. Driver: **Node.js**、Version: **5.5 or later** を選択
6. **接続文字列をコピー**

例:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### ステップ2: データベース名を追加

接続文字列にデータベース名を追加します:

```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/nigrek-dental?retryWrites=true&w=majority
```

**重要**: 
- `cluster0.xxxxx.mongodb.net` の部分は、あなたのクラスターの実際のホスト名に置き換えてください
- `username` と `password` を実際の値に置き換えてください

### ステップ3: パスワードのURLエンコード

パスワードに特殊文字が含まれる場合、URLエンコードが必要です:

- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- `:` → `%3A`
- `/` → `%2F`
- `?` → `%3F`
- `=` → `%3D`
- `&` → `%26`

### ステップ4: .env ファイルを更新

`backend/.env` ファイルを開き、`MONGODB_URI` を更新:

```env
MONGODB_URI=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/nigrek-dental?retryWrites=true&w=majority
```

### ステップ5: ネットワークアクセスの確認

MongoDB Atlas で:

1. 「Network Access」をクリック
2. 「Add IP Address」をクリック
3. 「Add Current IP Address」をクリック（開発用）
   - または「Allow Access from Anywhere」を選択（`0.0.0.0/0`）

### ステップ6: 接続をテスト

```bash
cd backend
npm run test-connection
```

または:

```bash
node test-connection.js
```

成功すると以下のメッセージが表示されます:

```
✅ MongoDB connected successfully!
📊 Database: nigrek-dental
🌐 Host: cluster0.xxxxx.mongodb.net
```

## よくあるエラーと解決方法

### エラー: "authentication failed"

- ユーザー名とパスワードが正しいか確認
- パスワードをURLエンコードする

### エラー: "IP address not whitelisted"

- MongoDB Atlas の「Network Access」でIPアドレスを追加

### エラー: "ENOTFOUND" または "querySrv ENOTFOUND"

- クラスターのホスト名が正しいか確認
- 接続文字列の形式が正しいか確認
- データベース名が接続文字列に含まれているか確認

## 接続文字列の例

### 正しい形式

```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/nigrek-dental?retryWrites=true&w=majority
```

### 間違った形式（データベース名がない）

```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
```

## 次のステップ

接続が成功したら、サーバーを起動:

```bash
npm run dev
```

