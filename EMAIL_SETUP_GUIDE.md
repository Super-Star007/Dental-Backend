# 📧 メール送信設定ガイド（パスワードリセット機能用）

このガイドでは、Gmailを使用してパスワードリセット機能のメール送信を設定する方法を説明します。

## 🔧 Gmailアプリパスワードの取得方法

### ステップ1: Googleアカウントのセキュリティ設定を開く

1. ブラウザで [Googleアカウント](https://myaccount.google.com/) にアクセス
2. 左側のメニューから「**セキュリティ**」をクリック

### ステップ2: 2段階認証プロセスを有効化

1. 「**2段階認証プロセス**」を探してクリック
2. まだ有効化していない場合は、指示に従って有効化
   - 電話番号の確認が必要な場合があります
   - 認証アプリを使用することもできます

### ステップ3: アプリパスワードを生成

1. 「**2段階認証プロセス**」の設定画面で、「**アプリパスワード**」を探してクリック
   - または、直接 [アプリパスワードページ](https://myaccount.google.com/apppasswords) にアクセス

2. 「**アプリを選択**」ドロップダウンから「**メール**」を選択

3. 「**デバイスを選択**」ドロップダウンから「**その他（カスタム名）**」を選択

4. カスタム名に「**Nigrek Backend**」と入力

5. 「**生成**」ボタンをクリック

6. **16文字のパスワード**が表示されます（例: `abcd efgh ijkl mnop`）
   - このパスワードを**コピー**してください
   - この画面を閉じると、もう一度確認できません

## 📝 .envファイルへの設定

`backend/.env`ファイルを開いて、以下のように設定してください：

```env
# Email Configuration (for password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=abcdefghijklmnop
EMAIL_FROM=noreply@nigrek.com
```

### 設定項目の説明

- **EMAIL_HOST**: GmailのSMTPサーバー（`smtp.gmail.com`）
- **EMAIL_PORT**: GmailのSMTPポート（`587` - TLS用、または`465` - SSL用）
- **EMAIL_USER**: あなたのGmailアドレス（例: `yourname@gmail.com`）
- **EMAIL_PASS**: ステップ3で生成した16文字のアプリパスワード
  - **重要**: スペースは削除しても可（例: `abcdefghijklmnop`）
- **EMAIL_FROM**: 送信者名（任意、メールアドレス形式で）

### 設定例

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=myemail@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
EMAIL_FROM=noreply@nigrek.com
```

または、スペースを削除した場合：

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=myemail@gmail.com
EMAIL_PASS=abcdefghijklmnop
EMAIL_FROM=noreply@nigrek.com
```

## ✅ 設定後の確認

1. `.env`ファイルを保存
2. バックエンドサーバーを**再起動**（設定を反映するため）
3. パスワードリセット機能をテスト

## 🔍 トラブルシューティング

### メールが送信されない場合

1. **バックエンドのターミナルログを確認**
   - `Email server is ready to send messages` と表示されていれば設定OK
   - エラーメッセージがあれば、それを確認

2. **よくあるエラー**
   - `Invalid login`: アプリパスワードが間違っている
   - `Connection timeout`: ネットワークまたはファイアウォールの問題
   - `Authentication failed`: 2段階認証が有効化されていない

3. **確認事項**
   - 2段階認証が有効化されているか
   - アプリパスワードが正しくコピーされているか（スペースの有無）
   - `.env`ファイルが正しく保存されているか
   - バックエンドサーバーを再起動したか

### 開発環境でのテスト

メール設定がない場合でも、開発環境ではリセットトークンとURLが画面に表示されます。これを使用してパスワードリセット機能をテストできます。

## 📌 注意事項

- **アプリパスワードは機密情報です**。`.env`ファイルをGitにコミットしないでください
- `.env`ファイルは`.gitignore`に含まれていることを確認してください
- 本番環境では、専用のメール送信サービス（SendGrid、Mailgun等）の使用を推奨します

