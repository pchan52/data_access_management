-- ============================================
-- データマネジメント管理ポータル
-- データベース初期化スクリプト
-- ============================================
-- 実行順序: このファイルを最初に実行してください
-- 
-- 使用方法:
--   psql -d access_governance -f sql/01_create_tables.sql
-- ============================================

-- ============================================
-- 1. 基本テーブル
-- ============================================

-- データセット
CREATE TABLE IF NOT EXISTS datasets (
  id serial PRIMARY KEY,
  dataset_id text NOT NULL UNIQUE,
  dataset_name text NOT NULL,
  description text,
  metadata jsonb
);

-- アプリケーション
CREATE TABLE IF NOT EXISTS applications (
  id serial PRIMARY KEY,
  application_id text NOT NULL UNIQUE,
  application_name text NOT NULL,
  app_owner text,
  business_owner text,
  description text
);

-- QuickSight グループ
CREATE TABLE IF NOT EXISTS qs_groups (
  id serial PRIMARY KEY,
  group_name text NOT NULL UNIQUE,
  group_owner text,
  dbp_manager text
);

-- グループメンバー（レガシー、現在はuser_groupsテーブルを使用）
CREATE TABLE IF NOT EXISTS qs_group_members (
  id serial PRIMARY KEY,
  group_id int NOT NULL REFERENCES qs_groups(id) ON DELETE CASCADE,
  member_name text,
  qs_username text
);

-- ============================================
-- 2. 関連テーブル
-- ============================================

-- アプリケーション ↔ データセット
CREATE TABLE IF NOT EXISTS application_datasets (
  application_id int NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  dataset_id int NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  PRIMARY KEY (application_id, dataset_id)
);

-- グループ ↔ データセット
CREATE TABLE IF NOT EXISTS group_dataset (
  group_id int NOT NULL REFERENCES qs_groups(id) ON DELETE CASCADE,
  dataset_id int NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, dataset_id)
);

-- グループ ↔ アプリケーション
CREATE TABLE IF NOT EXISTS group_applications (
  group_id int NOT NULL REFERENCES qs_groups(id) ON DELETE CASCADE,
  application_id int NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, application_id)
);

-- ============================================
-- 3. ユーザー管理テーブル
-- ============================================

-- ユーザー
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  user_name text NOT NULL,
  email text,
  qs_username text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ユーザー ↔ QSグループ
CREATE TABLE IF NOT EXISTS user_groups (
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id int NOT NULL REFERENCES qs_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- ============================================
-- 4. 申請管理テーブル
-- ============================================

-- 申請履歴（ヘッダ）
CREATE TABLE IF NOT EXISTS request_history (
  id serial PRIMARY KEY,
  group_id int REFERENCES qs_groups(id) ON DELETE SET NULL,  -- グループ作成申請の場合はNULL
  requester text NOT NULL,
  request_date timestamp NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'requested',  -- 'requested', 'approved', 'rejected', 'withdrawn', 'draft'
  jira_text text,
  request_reason text,  -- 申請理由
  request_type text,  -- 'dataset_access', 'remove_dataset_access', 'create_group', 'remove_group', 'add_members', 'remove_members'
  new_group_name text,  -- グループ作成申請用
  new_group_owner text,  -- グループ作成申請用
  new_dbp_manager text  -- グループ作成申請用
);

-- 申請 ↔ データセット
CREATE TABLE IF NOT EXISTS request_datasets (
  request_id int NOT NULL REFERENCES request_history(id) ON DELETE CASCADE,
  dataset_id int NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, dataset_id)
);

-- 申請 ↔ メンバー（メンバー追加・削除申請用）
CREATE TABLE IF NOT EXISTS request_members (
  request_id int NOT NULL REFERENCES request_history(id) ON DELETE CASCADE,
  user_id int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, user_id)
);

-- ============================================
-- 5. 承認管理テーブル
-- ============================================

-- 承認ステータス管理
CREATE TABLE IF NOT EXISTS request_approvals (
  id serial PRIMARY KEY,
  request_id int NOT NULL REFERENCES request_history(id) ON DELETE CASCADE,
  approver_type text NOT NULL,  -- 'dbp_manager', 'data_manager', 'group_owner', 'app_owner'
  approver_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  approved_at timestamp,
  comment text,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(request_id, approver_type, approver_email)
);

-- ============================================
-- 6. インデックス作成
-- ============================================

-- 承認テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_request_approvals_request_id ON request_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_request_approvals_approver_email ON request_approvals(approver_email);
CREATE INDEX IF NOT EXISTS idx_request_approvals_status ON request_approvals(status);

-- 申請履歴のインデックス
CREATE INDEX IF NOT EXISTS idx_request_history_requester ON request_history(requester);
CREATE INDEX IF NOT EXISTS idx_request_history_status ON request_history(status);
CREATE INDEX IF NOT EXISTS idx_request_history_request_type ON request_history(request_type);
CREATE INDEX IF NOT EXISTS idx_request_history_group_id ON request_history(group_id);

-- ユーザーのインデックス
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_qs_username ON users(qs_username);

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'テーブル作成が完了しました。';
    RAISE NOTICE '次のステップ: sql/02_sample_data.sql を実行してサンプルデータを投入してください。';
END $$;

