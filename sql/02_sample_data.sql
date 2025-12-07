-- ============================================
-- データマネジメント管理ポータル
-- サンプルデータ投入スクリプト
-- ============================================
-- 実行順序: 01_create_tables.sql の後に実行してください
-- 
-- 使用方法:
--   psql -d access_governance -f sql/02_sample_data.sql
-- ============================================

-- ============================================
-- 1. データセット
-- ============================================
INSERT INTO datasets (dataset_id, dataset_name, description, metadata) VALUES
('DS001', '月次売上データ', '月次の売上データを集計したデータセット', '{"source": "sales_db", "update_frequency": "monthly", "columns": 15, "data_type": "aggregated"}'::jsonb),
('DS002', '商品マスタ', '商品情報のマスタデータ', '{"source": "product_db", "update_frequency": "daily", "columns": 8, "data_type": "master"}'::jsonb),
('DS003', '顧客情報', '顧客の基本情報と属性データ', '{"source": "customer_db", "update_frequency": "daily", "columns": 20, "data_type": "transactional"}'::jsonb),
('DS004', '在庫データ', 'リアルタイム在庫情報', '{"source": "inventory_db", "update_frequency": "realtime", "columns": 12, "data_type": "operational"}'::jsonb),
('DS005', '財務データ', '四半期財務データ', '{"source": "finance_db", "update_frequency": "quarterly", "columns": 25, "data_type": "financial"}'::jsonb),
('DS006', 'キャンペーンデータ', 'マーケティングキャンペーンの実績データ', '{"source": "marketing_db", "update_frequency": "weekly", "columns": 10, "data_type": "analytical"}'::jsonb),
('DS007', '取引履歴', '顧客の取引履歴データ', '{"source": "transaction_db", "update_frequency": "daily", "columns": 18, "data_type": "transactional"}'::jsonb),
('DS008', '地域別売上', '地域ごとの売上集計データ', '{"source": "sales_db", "update_frequency": "monthly", "columns": 12, "data_type": "aggregated"}'::jsonb),
('DS009', '会員情報', '会員の基本情報とステータス', '{"source": "member_db", "update_frequency": "daily", "columns": 14, "data_type": "master"}'::jsonb),
('DS010', '広告効果データ', '広告配信の効果測定データ', '{"source": "advertising_db", "update_frequency": "daily", "columns": 16, "data_type": "analytical"}'::jsonb),
('DS011', '社員マスタ', '全社員の基本情報と組織情報', '{"source": "hr_db", "update_frequency": "daily", "columns": 12, "data_type": "master"}'::jsonb),
('DS012', '組織マスタ', '組織構造と部署情報', '{"source": "hr_db", "update_frequency": "weekly", "columns": 8, "data_type": "master"}'::jsonb),
('DS013', '全社売上サマリー', '全社の売上を集計したサマリーデータ', '{"source": "sales_db", "update_frequency": "monthly", "columns": 10, "data_type": "aggregated"}'::jsonb)
ON CONFLICT (dataset_id) DO NOTHING;

-- ============================================
-- 2. アプリケーション
-- ============================================
INSERT INTO applications (application_id, application_name, app_owner, business_owner, description) VALUES
('APP001', '売上分析システム', 'tanaka@example.com', 'yamada@example.com', '月次売上データの分析と可視化を行うアプリケーション'),
('APP002', '在庫管理システム', 'suzuki@example.com', 'watanabe@example.com', '在庫状況のリアルタイム監視とレポート生成'),
('APP003', '顧客管理システム', 'sato@example.com', 'ito@example.com', '顧客情報の管理と分析ダッシュボード'),
('APP004', '財務レポートシステム', 'kobayashi@example.com', 'kato@example.com', '財務データの集計とレポート作成'),
('APP005', 'マーケティング分析', 'yoshida@example.com', 'kondo@example.com', 'マーケティングキャンペーンの効果測定'),
('APP006', '会員管理システム', 'nakamura@example.com', 'kimura@example.com', '会員情報の管理と分析'),
('APP007', '広告配信システム', 'yoshida@example.com', 'kondo@example.com', '広告配信の管理と効果分析')
ON CONFLICT (application_id) DO NOTHING;

-- ============================================
-- 3. QSグループ
-- ============================================
INSERT INTO qs_groups (group_name, group_owner, dbp_manager) VALUES
('営業部', 'tanaka@example.com', 'yamada@example.com'),
('在庫管理部', 'suzuki@example.com', 'watanabe@example.com'),
('顧客分析部', 'sato@example.com', 'ito@example.com'),
('財務部', 'kobayashi@example.com', 'kato@example.com'),
('マーケティング部', 'yoshida@example.com', 'kondo@example.com')
ON CONFLICT (group_name) DO NOTHING;

-- ============================================
-- 4. グループメンバー（レガシー）
-- ============================================
INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '田中太郎', 'tanaka.taro'
FROM qs_groups g WHERE g.group_name = '営業部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '山田花子', 'yamada.hanako'
FROM qs_groups g WHERE g.group_name = '営業部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '佐藤次郎', 'sato.jiro'
FROM qs_groups g WHERE g.group_name = '営業部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '鈴木三郎', 'suzuki.saburo'
FROM qs_groups g WHERE g.group_name = '在庫管理部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '渡辺四郎', 'watanabe.shiro'
FROM qs_groups g WHERE g.group_name = '在庫管理部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '佐藤五郎', 'sato.goro'
FROM qs_groups g WHERE g.group_name = '顧客分析部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '伊藤六郎', 'ito.rokuro'
FROM qs_groups g WHERE g.group_name = '顧客分析部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '小林七郎', 'kobayashi.shichiro'
FROM qs_groups g WHERE g.group_name = '財務部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '加藤八郎', 'kato.hachiro'
FROM qs_groups g WHERE g.group_name = '財務部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '吉田九郎', 'yoshida.kuro'
FROM qs_groups g WHERE g.group_name = 'マーケティング部'
ON CONFLICT DO NOTHING;

INSERT INTO qs_group_members (group_id, member_name, qs_username)
SELECT g.id, '近藤十郎', 'kondo.juro'
FROM qs_groups g WHERE g.group_name = 'マーケティング部'
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. アプリケーション ↔ データセット関連
-- ============================================
INSERT INTO application_datasets (application_id, dataset_id) 
SELECT a.id, d.id
FROM applications a, datasets d
WHERE (a.application_id = 'APP001' AND d.dataset_id IN ('DS001', 'DS008', 'DS013'))
   OR (a.application_id = 'APP002' AND d.dataset_id IN ('DS002', 'DS004'))
   OR (a.application_id = 'APP003' AND d.dataset_id IN ('DS003', 'DS007', 'DS009'))
   OR (a.application_id = 'APP004' AND d.dataset_id IN ('DS005', 'DS013'))
   OR (a.application_id = 'APP005' AND d.dataset_id IN ('DS003', 'DS006', 'DS010'))
   OR (a.application_id = 'APP006' AND d.dataset_id = 'DS009')
   OR (a.application_id = 'APP007' AND d.dataset_id = 'DS010')
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. グループ ↔ データセット関連
-- ============================================
INSERT INTO group_dataset (group_id, dataset_id)
SELECT g.id, d.id
FROM qs_groups g
CROSS JOIN datasets d
WHERE (g.group_name = '営業部' AND d.dataset_id IN ('DS001', 'DS008', 'DS011', 'DS012', 'DS013'))
   OR (g.group_name = '在庫管理部' AND d.dataset_id IN ('DS002', 'DS004', 'DS011', 'DS012'))
   OR (g.group_name = '顧客分析部' AND d.dataset_id IN ('DS003', 'DS007', 'DS009', 'DS011', 'DS012'))
   OR (g.group_name = '財務部' AND d.dataset_id IN ('DS005', 'DS011', 'DS012', 'DS013'))
   OR (g.group_name = 'マーケティング部' AND d.dataset_id IN ('DS003', 'DS006', 'DS010', 'DS011', 'DS012'))
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. ユーザー
-- ============================================
INSERT INTO users (user_id, user_name, email, qs_username) VALUES
('U001', '田中太郎', 'tanaka.taro@example.com', 'tanaka.taro'),
('U002', '山田花子', 'yamada.hanako@example.com', 'yamada.hanako'),
('U003', '佐藤次郎', 'sato.jiro@example.com', 'sato.jiro'),
('U004', '鈴木三郎', 'suzuki.saburo@example.com', 'suzuki.saburo'),
('U005', '渡辺四郎', 'watanabe.shiro@example.com', 'watanabe.shiro'),
('U006', '佐藤五郎', 'sato.goro@example.com', 'sato.goro'),
('U007', '伊藤六郎', 'ito.rokuro@example.com', 'ito.rokuro'),
('U008', '小林七郎', 'kobayashi.shichiro@example.com', 'kobayashi.shichiro'),
('U009', '加藤八郎', 'kato.hachiro@example.com', 'kato.hachiro'),
('U010', '吉田九郎', 'yoshida.kuro@example.com', 'yoshida.kuro'),
('U011', '近藤十郎', 'kondo.juro@example.com', 'kondo.juro'),
-- グループオーナー、DBPマネージャー、アプリケーションオーナー
('U012', '田中', 'tanaka@example.com', NULL),
('U013', '山田', 'yamada@example.com', NULL),
('U014', '鈴木', 'suzuki@example.com', NULL),
('U015', '渡辺', 'watanabe@example.com', NULL),
('U016', '佐藤', 'sato@example.com', NULL),
('U017', '伊藤', 'ito@example.com', NULL),
('U018', '小林', 'kobayashi@example.com', NULL),
('U019', '加藤', 'kato@example.com', NULL),
('U020', '吉田', 'yoshida@example.com', NULL),
('U021', '近藤', 'kondo@example.com', NULL),
('U022', '中村', 'nakamura@example.com', NULL),
('U023', '木村', 'kimura@example.com', NULL),
('U024', '松本', 'matsumoto@example.com', NULL)  -- データマネージャー（固定）
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 8. ユーザー ↔ QSグループ関連
-- ============================================
INSERT INTO user_groups (user_id, group_id)
SELECT u.id, g.id
FROM users u
CROSS JOIN qs_groups g
WHERE (u.qs_username = 'tanaka.taro' AND g.group_name = '営業部')
   OR (u.qs_username = 'yamada.hanako' AND g.group_name = '営業部')
   OR (u.qs_username = 'sato.jiro' AND g.group_name = '営業部')
   OR (u.qs_username = 'suzuki.saburo' AND g.group_name = '在庫管理部')
   OR (u.qs_username = 'watanabe.shiro' AND g.group_name = '在庫管理部')
   OR (u.qs_username = 'sato.goro' AND g.group_name = '顧客分析部')
   OR (u.qs_username = 'ito.rokuro' AND g.group_name = '顧客分析部')
   OR (u.qs_username = 'kobayashi.shichiro' AND g.group_name = '財務部')
   OR (u.qs_username = 'kato.hachiro' AND g.group_name = '財務部')
   OR (u.qs_username = 'yoshida.kuro' AND g.group_name = 'マーケティング部')
   OR (u.qs_username = 'kondo.juro' AND g.group_name = 'マーケティング部')
ON CONFLICT DO NOTHING;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'サンプルデータの投入が完了しました。';
END $$;

