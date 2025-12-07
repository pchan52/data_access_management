# Quicksight アクセス管理ポータル

## ディレクトリ構造

```
qs-access-portal/
├── public/              # フロントエンドファイル
│   ├── pages/          # HTMLページ
│   └── css/            # CSSファイル
├── server/             # バックエンドファイル
│   └── server.js       # Expressサーバー
├── sql/                # SQLスクリプト
│   ├── 01_create_tables.sql  # テーブル作成（最初に実行）
│   └── 02_sample_data.sql    # サンプルデータ投入（オプション）
├── node_modules/       # Node.js依存パッケージ
├── package.json
└── package-lock.json
```

## セットアップ

### 1. 依存パッケージのインストール
```bash
npm install
```

### 2. PostgreSQLデータベースのセットアップ

#### 2.1 データベース作成
```bash
createdb access_governance
```

#### 2.2 テーブル作成（必須）
```bash
psql -d access_governance -f sql/01_create_tables.sql
```

このスクリプトで以下のテーブルが作成されます：
- 基本テーブル（datasets, applications, qs_groups等）
- ユーザー管理テーブル（users, user_groups）
- 申請管理テーブル（request_history, request_datasets, request_members）
- 承認管理テーブル（request_approvals）
- インデックス

#### 2.3 サンプルデータ投入（オプション、開発・テスト環境のみ）
```bash
psql -d access_governance -f sql/02_sample_data.sql
```

このスクリプトで以下のサンプルデータが投入されます：
- データセット（13件）
- アプリケーション（7件）
- QSグループ（5件）
- ユーザー（24件）
- 各種関連データ

**注意**: サンプルデータは開発・テスト環境でのみ使用してください。本番環境では実行しないでください。

#### サンプルデータのログイン情報

サンプルデータには以下のユーザーが含まれています：

**一般ユーザー（申請者）**
- `tanaka.taro@example.com` - 田中太郎（営業部メンバー）
- `yamada.hanako@example.com` - 山田花子（営業部メンバー）
- `sato.jiro@example.com` - 佐藤次郎（営業部メンバー）
- `suzuki.saburo@example.com` - 鈴木三郎（在庫管理部メンバー）
- `watanabe.shiro@example.com` - 渡辺四郎（在庫管理部メンバー）
- `sato.goro@example.com` - 佐藤五郎（顧客分析部メンバー）
- `ito.rokuro@example.com` - 伊藤六郎（顧客分析部メンバー）
- `kobayashi.shichiro@example.com` - 小林七郎（財務部メンバー）
- `kato.hachiro@example.com` - 加藤八郎（財務部メンバー）
- `yoshida.kuro@example.com` - 吉田九郎（マーケティング部メンバー）
- `kondo.juro@example.com` - 近藤十郎（マーケティング部メンバー）

**承認者（グループオーナー）**
- `tanaka@example.com` - 田中（営業部グループオーナー、売上分析システムアプリケーションオーナー）
- `suzuki@example.com` - 鈴木（在庫管理部グループオーナー、在庫管理システムアプリケーションオーナー）
- `sato@example.com` - 佐藤（顧客分析部グループオーナー、顧客管理システムアプリケーションオーナー）
- `kobayashi@example.com` - 小林（財務部グループオーナー、財務レポートシステムアプリケーションオーナー）
- `yoshida@example.com` - 吉田（マーケティング部グループオーナー、マーケティング分析・広告配信システムアプリケーションオーナー）

**承認者（DBPマネージャー）**
- `yamada@example.com` - 山田（営業部DBPマネージャー）
- `watanabe@example.com` - 渡辺（在庫管理部DBPマネージャー）
- `ito@example.com` - 伊藤（顧客分析部DBPマネージャー）
- `kato@example.com` - 加藤（財務部DBPマネージャー）
- `kondo@example.com` - 近藤（マーケティング部DBPマネージャー）

**承認者（データマネージャー）**
- `matsumoto@example.com` - 松本（データマネージャー、固定）

**承認者（アプリケーションオーナー）**
- `tanaka@example.com` - 田中（売上分析システム）
- `suzuki@example.com` - 鈴木（在庫管理システム）
- `sato@example.com` - 佐藤（顧客管理システム）
- `kobayashi@example.com` - 小林（財務レポートシステム）
- `yoshida@example.com` - 吉田（マーケティング分析、広告配信システム）
- `nakamura@example.com` - 中村（会員管理システム）

**通知のみ（ビジネスオーナー）**
- `yamada@example.com` - 山田（売上分析システム）
- `watanabe@example.com` - 渡辺（在庫管理システム）
- `ito@example.com` - 伊藤（顧客管理システム）
- `kato@example.com` - 加藤（財務レポートシステム）
- `kondo@example.com` - 近藤（マーケティング分析、広告配信システム）
- `kimura@example.com` - 木村（会員管理システム）

**注意**: 
- グループオーナー、DBPマネージャー、アプリケーションオーナー、データマネージャーは承認画面にアクセスできます
- DBPマネージャーとビジネスオーナーは承認フローには含まれませんが、関連する申請を閲覧できます
- パスワード認証は実装されていないため、メールアドレスを入力するだけでログインできます

### 3. サーバーの起動
```bash
npm start
# または
node server/server.js
```

### 4. ブラウザでアクセス
```
http://localhost:3000
```

## SQLスクリプト実行ガイド

### 実行順序

以下の順序でSQLスクリプトを実行してください。

1. **データベース作成**
   ```bash
   createdb access_governance
   ```

2. **テーブル作成（必須）**
   ```bash
   psql -d access_governance -f sql/01_create_tables.sql
   ```

3. **サンプルデータ投入（オプション）**
   ```bash
   psql -d access_governance -f sql/02_sample_data.sql
   ```

### ファイル説明

- **01_create_tables.sql**: すべてのテーブルとインデックスを作成します。**最初に実行する必要があります。**
- **02_sample_data.sql**: 開発・テスト用のサンプルデータを投入します。本番環境では実行しないでください。

### 注意事項

- 既存のデータベースに実行する場合は、バックアップを取ってから実行してください
- `ON CONFLICT DO NOTHING`を使用しているため、重複実行してもエラーになりません
- サンプルデータは開発・テスト環境でのみ使用してください

### トラブルシューティング

#### エラー: "relation already exists"
テーブルが既に存在する場合、`DROP TABLE`で削除してから再実行するか、`CREATE TABLE IF NOT EXISTS`を使用してください。

#### エラー: "foreign key constraint"
参照先のテーブルが存在しない場合、実行順序を確認してください。

## 主な機能

- データセットアクセス申請（追加・削除）
- グループ管理申請（作成・削除）
- メンバー管理申請（追加・削除）
- 承認ワークフロー
- ドラフト保存機能
- 申請一覧・詳細表示

## 承認フロー

### データセットアクセス申請
1. グループオーナー
2. データマネージャー
3. アプリケーションオーナー（順序なし）
DBPマネージャーとビジネスオーナーは通知のみ（承認フローには含まれません）

### メンバー管理申請・グループ管理申請
1. グループオーナー
2. データマネージャー



