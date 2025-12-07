const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア設定
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// PostgreSQL接続プール
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',        // インストール時に設定したユーザー
    password: 'pchan5261', // そのパスワード
    database: 'access_governance'
});

// ルートハンドラー
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/pages/login.html'));
});

// APIエンドポイント: データセット一覧
app.get('/api/datasets', async (req, res) => {
    try {
        const query = `
            SELECT 
                d.id,
                d.dataset_id,
                d.dataset_name,
                d.description,
                d.metadata
            FROM datasets d
            ORDER BY d.dataset_name ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching datasets:', error);
        res.status(500).json({ error: 'データセットの取得に失敗しました' });
    }
});

// APIエンドポイント: データセット詳細
app.get('/api/datasets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                d.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'application_id', a.application_id,
                            'application_name', a.application_name
                        )
                    ) FILTER (WHERE a.id IS NOT NULL),
                    '[]'::json
                ) as applications
            FROM datasets d
            LEFT JOIN application_datasets ad ON d.id = ad.dataset_id
            LEFT JOIN applications a ON ad.application_id = a.id
            WHERE d.id = $1
            GROUP BY d.id
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'データセットが見つかりません' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching dataset:', error);
        res.status(500).json({ error: 'データセットの取得に失敗しました' });
    }
});

// APIエンドポイント: QSグループ一覧
app.get('/api/groups', async (req, res) => {
    try {
        const query = `
            SELECT 
                g.id,
                g.group_name,
                g.group_owner,
                g.dbp_manager,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'member_name', m.member_name,
                            'qs_username', m.qs_username
                        )
                    ) FILTER (WHERE m.id IS NOT NULL),
                    '[]'::json
                ) as members
            FROM qs_groups g
            LEFT JOIN qs_group_members m ON g.id = m.group_id
            GROUP BY g.id, g.group_name, g.group_owner, g.dbp_manager
            ORDER BY g.group_name ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'QSグループの取得に失敗しました' });
    }
});

// APIエンドポイント: QSグループ詳細
app.get('/api/groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // グループ基本情報
        const groupQuery = `
            SELECT 
                g.*
            FROM qs_groups g
            WHERE g.id = $1
        `;
        const groupResult = await pool.query(groupQuery, [id]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'QSグループが見つかりません' });
        }
        const group = groupResult.rows[0];

        // メンバー情報
        const membersQuery = `
            SELECT 
                m.member_name,
                m.qs_username
            FROM qs_group_members m
            WHERE m.group_id = $1
            ORDER BY m.member_name ASC
        `;
        const membersResult = await pool.query(membersQuery, [id]);
        group.members = membersResult.rows;

        // 紐づくデータセット
        const datasetsQuery = `
            SELECT 
                d.dataset_id,
                d.dataset_name
            FROM datasets d
            JOIN group_dataset gd ON d.id = gd.dataset_id
            WHERE gd.group_id = $1
            ORDER BY d.dataset_name ASC
        `;
        const datasetsResult = await pool.query(datasetsQuery, [id]);
        group.datasets = datasetsResult.rows;

        // 申請履歴
        const historyQuery = `
            SELECT 
                rh.id,
                rh.request_date,
                rh.status,
                rh.requester,
                COALESCE(
                    string_agg(d.dataset_name, ', ' ORDER BY d.dataset_name),
                    ''
                ) as datasets
            FROM request_history rh
            LEFT JOIN request_datasets rd ON rh.id = rd.request_id
            LEFT JOIN datasets d ON rd.dataset_id = d.id
            WHERE rh.group_id = $1
            GROUP BY rh.id, rh.request_date, rh.status, rh.requester
            ORDER BY rh.request_date DESC
        `;
        const historyResult = await pool.query(historyQuery, [id]);
        group.request_history = historyResult.rows;

        // 所属ユーザー
        const usersQuery = `
            SELECT 
                u.id,
                u.user_id,
                u.user_name,
                u.email,
                u.qs_username
            FROM users u
            JOIN user_groups ug ON u.id = ug.user_id
            WHERE ug.group_id = $1
            ORDER BY u.user_name ASC
        `;
        const usersResult = await pool.query(usersQuery, [id]);
        group.users = usersResult.rows;

        res.json(group);
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ error: 'QSグループの取得に失敗しました' });
    }
});

// APIエンドポイント: アプリケーション一覧
app.get('/api/applications', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.id,
                a.application_id,
                a.application_name,
                a.app_owner,
                a.business_owner,
                a.description
            FROM applications a
            ORDER BY a.application_name ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ error: 'アプリケーションの取得に失敗しました' });
    }
});

// APIエンドポイント: アプリケーション詳細
app.get('/api/applications/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                a.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'dataset_id', d.dataset_id,
                            'dataset_name', d.dataset_name
                        )
                    ) FILTER (WHERE d.id IS NOT NULL),
                    '[]'::json
                ) as datasets
            FROM applications a
            LEFT JOIN application_datasets ad ON a.id = ad.application_id
            LEFT JOIN datasets d ON ad.dataset_id = d.id
            WHERE a.id = $1
            GROUP BY a.id
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'アプリケーションが見つかりません' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching application:', error);
        res.status(500).json({ error: 'アプリケーションの取得に失敗しました' });
    }
});

// APIエンドポイント: グループに対して申請可能なデータセット一覧
app.get('/api/groups/:groupId/datasets-for-request', async (req, res) => {
    try {
        const { groupId } = req.params;
        
        // グループが既にアクセス権限を持っているデータセットを取得
        const query = `
            SELECT 
                d.id,
                d.dataset_id,
                d.dataset_name,
                d.description,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 
                        FROM request_datasets rd
                        JOIN request_history rh ON rd.request_id = rh.id
                        WHERE rd.dataset_id = d.id 
                        AND rh.group_id = $1
                        AND rh.status = 'approved'
                        AND (rh.request_type IN ('dataset_access', 'remove_dataset_access') OR rh.request_type IS NULL)
                    ) THEN true
                    ELSE false
                END as already_requested
            FROM datasets d
            ORDER BY d.dataset_name ASC
        `;
        const result = await pool.query(query, [groupId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching datasets for request:', error);
        res.status(500).json({ error: 'データセットの取得に失敗しました' });
    }
});

// APIエンドポイント: グループがアクセス権限を持っているデータセット一覧（削除申請用）
app.get('/api/groups/:groupId/datasets-with-access', async (req, res) => {
    try {
        const { groupId } = req.params;
        
        // グループが既にアクセス権限を持っているデータセットを取得
        const query = `
            SELECT 
                d.id,
                d.dataset_id,
                d.dataset_name,
                d.description,
                true as has_access
            FROM datasets d
            WHERE EXISTS (
                SELECT 1 
                FROM request_datasets rd
                JOIN request_history rh ON rd.request_id = rh.id
                WHERE rd.dataset_id = d.id 
                AND rh.group_id = $1
                AND rh.status = 'approved'
                AND (rh.request_type IN ('dataset_access', 'remove_dataset_access') OR rh.request_type IS NULL)
            )
            ORDER BY d.dataset_name ASC
        `;
        const result = await pool.query(query, [groupId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching datasets with access:', error);
        res.status(500).json({ error: 'データセットの取得に失敗しました' });
    }
});

// APIエンドポイント: JIRA用テキストのプレビュー生成
app.post('/api/requests/preview', async (req, res) => {
    try {
        const { userId, groupId, datasetIds, requestType } = req.body;
        const finalRequestType = requestType || 'dataset_access';
        
        if (!groupId || !datasetIds || datasetIds.length === 0) {
            return res.status(400).json({ error: 'グループIDとデータセットIDが必要です' });
        }

        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '' };
        if (userId) {
            const userQuery = `SELECT user_name, email FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
            }
        }

        // グループ情報を取得
        const groupQuery = `SELECT group_name, group_owner, dbp_manager FROM qs_groups WHERE id = $1`;
        const groupResult = await pool.query(groupQuery, [groupId]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'グループが見つかりません' });
        }
        const group = groupResult.rows[0];

        // グループオーナーの名前を取得
        let groupOwnerName = '';
        if (group.group_owner) {
            const ownerQuery = `SELECT user_name FROM users WHERE email = $1`;
            const ownerResult = await pool.query(ownerQuery, [group.group_owner]);
            if (ownerResult.rows.length > 0) {
                groupOwnerName = ownerResult.rows[0].user_name;
            }
        }

        // DBPマネージャーの名前を取得
        let dbpManagerName = '';
        if (group.dbp_manager) {
            const dbpQuery = `SELECT user_name FROM users WHERE email = $1`;
            const dbpResult = await pool.query(dbpQuery, [group.dbp_manager]);
            if (dbpResult.rows.length > 0) {
                dbpManagerName = dbpResult.rows[0].user_name;
            }
        }

        // データセット情報を取得
        const datasetQuery = `
            SELECT dataset_id, dataset_name 
            FROM datasets 
            WHERE id = ANY($1::int[])
            ORDER BY dataset_name ASC
        `;
        const datasetResult = await pool.query(datasetQuery, [datasetIds]);
        const datasets = datasetResult.rows;

        // データセットに関連するアプリケーション情報を取得
        const appQuery = `
            SELECT DISTINCT
                a.application_id,
                a.application_name,
                a.app_owner
            FROM applications a
            JOIN application_datasets ad ON a.id = ad.application_id
            WHERE ad.dataset_id = ANY($1::int[])
            ORDER BY a.application_name ASC
        `;
        const appResult = await pool.query(appQuery, [datasetIds]);
        const applications = appResult.rows;

        // JIRA用テキストを生成
        const jiraText = await generateJiraText(userInfo, group, datasets, applications, '', finalRequestType);

        res.json({ jiraText });
    } catch (error) {
        console.error('Error generating preview:', error);
        res.status(500).json({ error: 'プレビューの生成に失敗しました' });
    }
});

// 共通関数: JIRAテキスト生成
async function generateJiraText(userInfo, group, datasets, applications, requestReason, requestType = 'dataset_access') {
    let jiraText = '';
    jiraText += `申請者: ${userInfo.user_name || '(未入力)'}${userInfo.email ? ` (${userInfo.email})` : ''}\n\n`;
    jiraText += `申請タイプ: ${requestType === 'remove_dataset_access' ? 'データセットアクセス削除' : 'データセットアクセス'}\n\n`;
    jiraText += `対象グループ: ${group.group_name}\n\n`;
    jiraText += `${requestType === 'remove_dataset_access' ? '削除対象データセット(ID):' : '対象データセット(ID):'}\n`;
    datasets.forEach((ds, index) => {
        jiraText += `${index + 1}. ${ds.dataset_name} (${ds.dataset_id})\n`;
    });
    jiraText += `\n`;
    
    if (applications.length > 0) {
        jiraText += `該当アプリケーション(ID):\n`;
        applications.forEach((app, index) => {
            jiraText += `${index + 1}. ${app.application_name} (${app.application_id})\n`;
        });
        jiraText += `\n`;
    }
    
    jiraText += `DBPマネージャー：\n`;
    if (group.dbp_manager) {
        let dbpManagerName = '';
        if (group.dbp_manager) {
            const dbpQuery = `SELECT user_name FROM users WHERE email = $1`;
            const dbpResult = await pool.query(dbpQuery, [group.dbp_manager]);
            if (dbpResult.rows.length > 0) {
                dbpManagerName = dbpResult.rows[0].user_name;
            }
        }
        jiraText += `${dbpManagerName ? `${dbpManagerName} ` : ''}(${group.dbp_manager})\n`;
    } else {
        jiraText += `(未登録)\n`;
    }
    jiraText += `\n`;
    
    jiraText += `データマネージャー：\n`;
    jiraText += `松本 (matsumoto@example.com)\n\n`;
    
    jiraText += `グループオーナー：\n`;
    if (group.group_owner) {
        let groupOwnerName = '';
        if (group.group_owner) {
            const ownerQuery = `SELECT user_name FROM users WHERE email = $1`;
            const ownerResult = await pool.query(ownerQuery, [group.group_owner]);
            if (ownerResult.rows.length > 0) {
                groupOwnerName = ownerResult.rows[0].user_name;
            }
        }
        jiraText += `${groupOwnerName ? `${groupOwnerName} ` : ''}(${group.group_owner})\n`;
    } else {
        jiraText += `(未登録)\n`;
    }
    jiraText += `\n`;
    
    if (applications.length > 0) {
        const uniqueAppOwners = [...new Set(applications.map(app => app.app_owner).filter(owner => owner))];
        if (uniqueAppOwners.length > 0) {
            const appOwnerEmails = uniqueAppOwners;
            const appOwnerQuery = `
                SELECT email, user_name 
                FROM users 
                WHERE email = ANY($1::text[])
            `;
            const appOwnerResult = await pool.query(appOwnerQuery, [appOwnerEmails]);
            const appOwnerMap = {};
            appOwnerResult.rows.forEach(row => {
                appOwnerMap[row.email] = row.user_name;
            });
            
            const ownerAppMap = {};
            applications.forEach(app => {
                if (app.app_owner) {
                    if (!ownerAppMap[app.app_owner]) {
                        ownerAppMap[app.app_owner] = [];
                    }
                    ownerAppMap[app.app_owner].push(app);
                }
            });
            
            jiraText += `アプリケーションオーナー：\n`;
            uniqueAppOwners.forEach(owner => {
                const ownerName = appOwnerMap[owner] || '';
                const ownerApps = ownerAppMap[owner] || [];
                const appNames = ownerApps.map(app => app.application_name).join('、');
                jiraText += `${ownerName ? `${ownerName} ` : ''}(${owner}) - ${appNames}\n`;
            });
        }
    }
    
    if (requestReason) {
        jiraText += `\n申請理由：\n${requestReason}\n`;
    }
    
    return jiraText;
}

// APIエンドポイント: ドラフト保存
app.post('/api/requests/draft', async (req, res) => {
    try {
        const { userId, groupId, datasetIds, requestReason, requestId, requestType } = req.body;
        const finalRequestType = requestType || 'dataset_access';
        
        if (!groupId || !datasetIds || datasetIds.length === 0) {
            return res.status(400).json({ error: 'グループIDとデータセットIDが必要です' });
        }
        
        if (!requestReason || requestReason.trim() === '') {
            return res.status(400).json({ error: '申請理由は必須です' });
        }

        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '', qs_username: '' };
        let requester = '';
        if (userId) {
            const userQuery = `SELECT user_name, email, qs_username FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
                requester = userInfo.qs_username || userInfo.user_name || '';
            }
        }

        // グループ情報を取得
        const groupQuery = `SELECT group_name, group_owner, dbp_manager FROM qs_groups WHERE id = $1`;
        const groupResult = await pool.query(groupQuery, [groupId]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'グループが見つかりません' });
        }
        const group = groupResult.rows[0];

        // データセット情報を取得
        const datasetQuery = `
            SELECT dataset_id, dataset_name 
            FROM datasets 
            WHERE id = ANY($1::int[])
            ORDER BY dataset_name ASC
        `;
        const datasetResult = await pool.query(datasetQuery, [datasetIds]);
        const datasets = datasetResult.rows;

        // データセットに関連するアプリケーション情報を取得
        const appQuery = `
            SELECT DISTINCT
                a.application_id,
                a.application_name,
                a.app_owner
            FROM applications a
            JOIN application_datasets ad ON a.id = ad.application_id
            WHERE ad.dataset_id = ANY($1::int[])
            ORDER BY a.application_name ASC
        `;
        const appResult = await pool.query(appQuery, [datasetIds]);
        const applications = appResult.rows;

        // JIRA用テキストを生成
        const jiraText = await generateJiraText(userInfo, group, datasets, applications, requestReason, finalRequestType);

        let savedRequestId;
        if (requestId) {
            // 既存のドラフトを更新
            const updateRequestQuery = `
                UPDATE request_history 
                SET group_id = $1, requester = $2, jira_text = $3, request_reason = $4, request_type = $5, request_date = NOW()
                WHERE id = $6 AND status = 'draft'
                RETURNING id
            `;
            const updateResult = await pool.query(updateRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType, requestId]);
            if (updateResult.rows.length === 0) {
                return res.status(404).json({ error: 'ドラフトが見つかりません' });
            }
            savedRequestId = updateResult.rows[0].id;
            
            // 既存のデータセット関連を削除
            await pool.query('DELETE FROM request_datasets WHERE request_id = $1', [requestId]);
        } else {
            // 新しいドラフトを作成
            const insertRequestQuery = `
                INSERT INTO request_history (group_id, requester, status, jira_text, request_reason, request_type)
                VALUES ($1, $2, 'draft', $3, $4, $5)
                RETURNING id
            `;
            const requestResult = await pool.query(insertRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType]);
            savedRequestId = requestResult.rows[0].id;
        }

        // 申請とデータセットの関連を保存
        const insertRequestDatasetsQuery = `
            INSERT INTO request_datasets (request_id, dataset_id)
            SELECT $1, unnest($2::int[])
        `;
        await pool.query(insertRequestDatasetsQuery, [savedRequestId, datasetIds]);

        res.json({ success: true, requestId: savedRequestId, jiraText, message: 'ドラフトを保存しました' });
    } catch (error) {
        console.error('Error saving draft:', error);
        res.status(500).json({ error: 'ドラフトの保存に失敗しました' });
    }
});

// APIエンドポイント: メンバー追加/削除申請のドラフト保存
app.post('/api/requests/draft-members', async (req, res) => {
    try {
        const { userId, groupId, memberUserIds, requestReason, requestId, requestType } = req.body;
        const finalRequestType = requestType || 'add_members';
        
        if (!userId || !groupId || !memberUserIds || memberUserIds.length === 0) {
            return res.status(400).json({ error: '必須項目が不足しています' });
        }
        
        if (!requestReason || requestReason.trim() === '') {
            return res.status(400).json({ error: '申請理由は必須です' });
        }

        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '', qs_username: '' };
        let requester = '';
        if (userId) {
            const userQuery = `SELECT user_name, email, qs_username FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
                requester = userInfo.qs_username || userInfo.user_name || '';
            }
        }

        // グループ情報を取得
        const groupQuery = `SELECT group_name, group_owner, dbp_manager FROM qs_groups WHERE id = $1`;
        const groupResult = await pool.query(groupQuery, [groupId]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'グループが見つかりません' });
        }
        const group = groupResult.rows[0];

        // 追加するメンバーの情報を取得
        const membersQuery = `
            SELECT user_name, email, qs_username
            FROM users
            WHERE id = ANY($1::int[])
        `;
        const membersResult = await pool.query(membersQuery, [memberUserIds]);
        const members = membersResult.rows;

        // JIRA用テキストを生成
        const requestTypeLabel = finalRequestType === 'remove_members' ? 'メンバー削除' : 'メンバー追加';
        const memberActionLabel = finalRequestType === 'remove_members' ? '削除するメンバー' : '追加するメンバー';
        
        let jiraText = '';
        jiraText += `申請者: ${userInfo.user_name || '(未入力)'}${userInfo.email ? ` (${userInfo.email})` : ''}\n\n`;
        jiraText += `申請タイプ: ${requestTypeLabel}\n\n`;
        jiraText += `対象グループ: ${group.group_name}\n\n`;
        jiraText += `${memberActionLabel}:\n`;
        members.forEach((member, index) => {
            jiraText += `${index + 1}. ${member.user_name || ''} (${member.email || member.qs_username || ''})\n`;
        });
        jiraText += `\n`;
        jiraText += `DBPマネージャー：\n`;
        if (group.dbp_manager) {
            jiraText += `${group.dbp_manager}\n\n`;
        } else {
            jiraText += `(未登録)\n\n`;
        }
        jiraText += `データマネージャー：\n`;
        jiraText += `松本 (matsumoto@example.com)\n\n`;
        jiraText += `グループオーナー：\n`;
        if (group.group_owner) {
            jiraText += `${group.group_owner}\n\n`;
        } else {
            jiraText += `(未登録)\n\n`;
        }
        jiraText += `申請理由: ${requestReason}\n\n`;

        let savedRequestId;
        if (requestId) {
            // 既存のドラフトを更新
            const updateRequestQuery = `
                UPDATE request_history 
                SET group_id = $1, requester = $2, jira_text = $3, request_reason = $4, request_type = $5, request_date = NOW()
                WHERE id = $6 AND status = 'draft'
                RETURNING id
            `;
            const updateResult = await pool.query(updateRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType, requestId]);
            if (updateResult.rows.length === 0) {
                return res.status(404).json({ error: 'ドラフトが見つかりません' });
            }
            savedRequestId = updateResult.rows[0].id;
            
            // 既存のメンバー関連を削除
            await pool.query('DELETE FROM request_members WHERE request_id = $1', [requestId]);
        } else {
            // 新しいドラフトを作成
            const insertRequestQuery = `
                INSERT INTO request_history (group_id, requester, status, jira_text, request_reason, request_type)
                VALUES ($1, $2, 'draft', $3, $4, $5)
                RETURNING id
            `;
            const requestResult = await pool.query(insertRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType]);
            savedRequestId = requestResult.rows[0].id;
        }

        // 申請とメンバーの関連を保存
        const insertRequestMembersQuery = `
            INSERT INTO request_members (request_id, user_id)
            SELECT $1, unnest($2::int[])
        `;
        await pool.query(insertRequestMembersQuery, [savedRequestId, memberUserIds]);

        res.json({ success: true, requestId: savedRequestId, jiraText, message: 'ドラフトを保存しました' });
    } catch (error) {
        console.error('Error saving draft:', error);
        res.status(500).json({ error: 'ドラフトの保存に失敗しました' });
    }
});

// APIエンドポイント: グループ作成/削除申請のドラフト保存
app.post('/api/requests/draft-group', async (req, res) => {
    try {
        const { userId, groupName, groupOwner, dbpManager, groupId, requestReason, requestId, requestType } = req.body;
        const finalRequestType = requestType || 'create_group';
        
        if (!userId) {
            return res.status(400).json({ error: '申請者IDが必要です' });
        }
        
        if (!requestReason || requestReason.trim() === '') {
            return res.status(400).json({ error: '申請理由は必須です' });
        }

        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '', qs_username: '' };
        let requester = '';
        if (userId) {
            const userQuery = `SELECT user_name, email, qs_username FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
                requester = userInfo.qs_username || userInfo.user_name || '';
            }
        }

        let jiraText = '';
        let savedRequestId;
        
        if (finalRequestType === 'create_group') {
            // グループ作成
            if (!groupName || !groupOwner || !dbpManager) {
                return res.status(400).json({ error: 'グループ名、グループオーナー、DBPマネージャーが必要です' });
            }
            
            jiraText += `申請者: ${userInfo.user_name || '(未入力)'}${userInfo.email ? ` (${userInfo.email})` : ''}\n\n`;
            jiraText += `申請タイプ: 新規グループ作成\n\n`;
            jiraText += `グループ名: ${groupName}\n\n`;
            jiraText += `グループオーナー: ${groupOwner}\n\n`;
            jiraText += `DBPマネージャー: ${dbpManager}\n\n`;
            jiraText += `データマネージャー：\n`;
            jiraText += `松本 (matsumoto@example.com)\n\n`;
            jiraText += `申請理由: ${requestReason}\n\n`;

            if (requestId) {
                // 既存のドラフトを更新
                const updateRequestQuery = `
                    UPDATE request_history 
                    SET requester = $1, jira_text = $2, request_reason = $3, request_type = $4, new_group_name = $5, new_group_owner = $6, new_dbp_manager = $7, request_date = NOW()
                    WHERE id = $8 AND status = 'draft'
                    RETURNING id
                `;
                const updateResult = await pool.query(updateRequestQuery, [requester, jiraText, requestReason, finalRequestType, groupName, groupOwner, dbpManager, requestId]);
                if (updateResult.rows.length === 0) {
                    return res.status(404).json({ error: 'ドラフトが見つかりません' });
                }
                savedRequestId = updateResult.rows[0].id;
            } else {
                // 新しいドラフトを作成
                const insertRequestQuery = `
                    INSERT INTO request_history (group_id, requester, status, jira_text, request_reason, request_type, new_group_name, new_group_owner, new_dbp_manager)
                    VALUES (NULL, $1, 'draft', $2, $3, $4, $5, $6, $7)
                    RETURNING id
                `;
                const requestResult = await pool.query(insertRequestQuery, [requester, jiraText, requestReason, finalRequestType, groupName, groupOwner, dbpManager]);
                savedRequestId = requestResult.rows[0].id;
            }
        } else {
            // グループ削除
            if (!groupId) {
                return res.status(400).json({ error: 'グループIDが必要です' });
            }
            
            // グループ情報を取得
            const groupQuery = `SELECT group_name, group_owner, dbp_manager FROM qs_groups WHERE id = $1`;
            const groupResult = await pool.query(groupQuery, [groupId]);
            if (groupResult.rows.length === 0) {
                return res.status(404).json({ error: 'グループが見つかりません' });
            }
            const group = groupResult.rows[0];
            
            jiraText += `申請者: ${userInfo.user_name || '(未入力)'}${userInfo.email ? ` (${userInfo.email})` : ''}\n\n`;
            jiraText += `申請タイプ: グループ削除\n\n`;
            jiraText += `削除対象グループ: ${group.group_name}\n\n`;
            jiraText += `グループオーナー: ${group.group_owner || '(未登録)'}\n\n`;
            jiraText += `DBPマネージャー: ${group.dbp_manager || '(未登録)'}\n\n`;
            jiraText += `データマネージャー：\n`;
            jiraText += `松本 (matsumoto@example.com)\n\n`;
            jiraText += `申請理由: ${requestReason}\n\n`;

            if (requestId) {
                // 既存のドラフトを更新
                const updateRequestQuery = `
                    UPDATE request_history 
                    SET group_id = $1, requester = $2, jira_text = $3, request_reason = $4, request_type = $5, request_date = NOW()
                    WHERE id = $6 AND status = 'draft'
                    RETURNING id
                `;
                const updateResult = await pool.query(updateRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType, requestId]);
                if (updateResult.rows.length === 0) {
                    return res.status(404).json({ error: 'ドラフトが見つかりません' });
                }
                savedRequestId = updateResult.rows[0].id;
            } else {
                // 新しいドラフトを作成
                const insertRequestQuery = `
                    INSERT INTO request_history (group_id, requester, status, jira_text, request_reason, request_type)
                    VALUES ($1, $2, 'draft', $3, $4, $5)
                    RETURNING id
                `;
                const requestResult = await pool.query(insertRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType]);
                savedRequestId = requestResult.rows[0].id;
            }
        }

        res.json({ success: true, requestId: savedRequestId, jiraText, message: 'ドラフトを保存しました' });
    } catch (error) {
        console.error('Error saving draft:', error);
        res.status(500).json({ error: 'ドラフトの保存に失敗しました' });
    }
});

// APIエンドポイント: 申請送信
app.post('/api/requests/submit', async (req, res) => {
    try {
        const { userId, groupId, datasetIds, requestReason, requestId, requestType } = req.body;
        const finalRequestType = requestType || 'dataset_access';
        
        if (!groupId || !datasetIds || datasetIds.length === 0) {
            return res.status(400).json({ error: 'グループIDとデータセットIDが必要です' });
        }
        
        if (!requestReason || requestReason.trim() === '') {
            return res.status(400).json({ error: '申請理由は必須です' });
        }

        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '', qs_username: '' };
        let requester = '';
        if (userId) {
            const userQuery = `SELECT user_name, email, qs_username FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
                requester = userInfo.qs_username || userInfo.user_name || '';
            }
        }

        // グループ情報を取得
        const groupQuery = `SELECT group_name, group_owner, dbp_manager FROM qs_groups WHERE id = $1`;
        const groupResult = await pool.query(groupQuery, [groupId]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'グループが見つかりません' });
        }
        const group = groupResult.rows[0];

        // データセット情報を取得
        const datasetQuery = `
            SELECT dataset_id, dataset_name 
            FROM datasets 
            WHERE id = ANY($1::int[])
            ORDER BY dataset_name ASC
        `;
        const datasetResult = await pool.query(datasetQuery, [datasetIds]);
        const datasets = datasetResult.rows;

        // データセットに関連するアプリケーション情報を取得
        const appQuery = `
            SELECT DISTINCT
                a.application_id,
                a.application_name,
                a.app_owner
            FROM applications a
            JOIN application_datasets ad ON a.id = ad.application_id
            WHERE ad.dataset_id = ANY($1::int[])
            ORDER BY a.application_name ASC
        `;
        const appResult = await pool.query(appQuery, [datasetIds]);
        const applications = appResult.rows;

        // JIRA用テキストを生成
        const jiraText = await generateJiraText(userInfo, group, datasets, applications, requestReason);

        let savedRequestId;
        if (requestId) {
            // 既存のドラフトを申請に変更
            const updateRequestQuery = `
                UPDATE request_history 
                SET group_id = $1, requester = $2, status = 'requested', jira_text = $3, request_reason = $4, request_type = $5, request_date = NOW()
                WHERE id = $6 AND status = 'draft'
                RETURNING id
            `;
            const updateResult = await pool.query(updateRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType, requestId]);
            if (updateResult.rows.length === 0) {
                return res.status(404).json({ error: 'ドラフトが見つかりません' });
            }
            savedRequestId = updateResult.rows[0].id;
            
            // 既存のデータセット関連を削除
            await pool.query('DELETE FROM request_datasets WHERE request_id = $1', [requestId]);
        } else {
            // 新しい申請を作成
            const insertRequestQuery = `
                INSERT INTO request_history (group_id, requester, status, jira_text, request_reason, request_type)
                VALUES ($1, $2, 'requested', $3, $4, $5)
                RETURNING id
            `;
            const requestResult = await pool.query(insertRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType]);
            savedRequestId = requestResult.rows[0].id;
        }

        // 申請とデータセットの関連を保存
        const insertRequestDatasetsQuery = `
            INSERT INTO request_datasets (request_id, dataset_id)
            SELECT $1, unnest($2::int[])
        `;
        await pool.query(insertRequestDatasetsQuery, [savedRequestId, datasetIds]);

        // 承認レコードを自動作成
        // データセットアクセス申請（追加・削除）: グループオーナー → データマネージャー → アプリケーションオーナー
        // DBPマネージャーとビジネスオーナーは承認フローには含めない（通知のみ）
        const approvalRecords = [];
        
        // データセットアクセス申請（追加・削除）の場合のみ承認レコードを作成
        if (finalRequestType === 'dataset_access' || finalRequestType === 'remove_dataset_access') {
            // グループオーナー（最初）
            if (group.group_owner) {
                approvalRecords.push({
                    request_id: savedRequestId,
                    approver_type: 'group_owner',
                    approver_email: group.group_owner,
                    status: 'pending'
                });
            }
            
            // データマネージャー（固定、2番目）
            approvalRecords.push({
                request_id: savedRequestId,
                approver_type: 'data_manager',
                approver_email: 'matsumoto@example.com',
                status: 'pending'
            });
            
            // アプリケーションオーナー（3番目）
            if (applications.length > 0) {
                const uniqueAppOwners = [...new Set(applications.map(app => app.app_owner).filter(owner => owner))];
                uniqueAppOwners.forEach(owner => {
                    approvalRecords.push({
                        request_id: savedRequestId,
                        approver_type: 'app_owner',
                        approver_email: owner,
                        status: 'pending'
                    });
                });
            }
        }
        
        if (approvalRecords.length > 0) {
            const insertApprovalsQuery = `
                INSERT INTO request_approvals (request_id, approver_type, approver_email, status)
                VALUES ${approvalRecords.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
            `;
            const approvalValues = approvalRecords.flatMap(r => [r.request_id, r.approver_type, r.approver_email, r.status]);
            await pool.query(insertApprovalsQuery, approvalValues);
        }

        res.json({ success: true, requestId: savedRequestId, jiraText, message: '申請を送信しました' });
    } catch (error) {
        console.error('Error submitting request:', error);
        res.status(500).json({ error: '申請の送信に失敗しました' });
    }
});

// APIエンドポイント: 申請履歴の保存（後方互換性のため残す）
app.post('/api/requests', async (req, res) => {
    try {
        const { userId, groupId, datasetIds, requestReason } = req.body;

        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '', qs_username: '' };
        let requester = '';
        if (userId) {
            const userQuery = `SELECT user_name, email, qs_username FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
                requester = userInfo.qs_username || userInfo.user_name || '';
            }
        }

        // グループ情報を取得
        const groupQuery = `SELECT group_name, group_owner, dbp_manager FROM qs_groups WHERE id = $1`;
        const groupResult = await pool.query(groupQuery, [groupId]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'グループが見つかりません' });
        }
        const group = groupResult.rows[0];

        // グループオーナーの名前を取得
        let groupOwnerName = '';
        if (group.group_owner) {
            const ownerQuery = `SELECT user_name FROM users WHERE email = $1`;
            const ownerResult = await pool.query(ownerQuery, [group.group_owner]);
            if (ownerResult.rows.length > 0) {
                groupOwnerName = ownerResult.rows[0].user_name;
            }
        }

        // DBPマネージャーの名前を取得
        let dbpManagerName = '';
        if (group.dbp_manager) {
            const dbpQuery = `SELECT user_name FROM users WHERE email = $1`;
            const dbpResult = await pool.query(dbpQuery, [group.dbp_manager]);
            if (dbpResult.rows.length > 0) {
                dbpManagerName = dbpResult.rows[0].user_name;
            }
        }

        // データセット情報を取得
        const datasetQuery = `
            SELECT dataset_id, dataset_name 
            FROM datasets 
            WHERE id = ANY($1::int[])
            ORDER BY dataset_name ASC
        `;
        const datasetResult = await pool.query(datasetQuery, [datasetIds]);
        const datasets = datasetResult.rows;

        // データセットに関連するアプリケーション情報を取得
        const appQuery = `
            SELECT DISTINCT
                a.application_id,
                a.application_name,
                a.app_owner
            FROM applications a
            JOIN application_datasets ad ON a.id = ad.application_id
            WHERE ad.dataset_id = ANY($1::int[])
            ORDER BY a.application_name ASC
        `;
        const appResult = await pool.query(appQuery, [datasetIds]);
        const applications = appResult.rows;

        // JIRA用テキストを生成
        let jiraText = '';
        jiraText += `申請者: ${userInfo.user_name || '(未入力)'}${userInfo.email ? ` (${userInfo.email})` : ''}\n\n`;
        jiraText += `対象グループ: ${group.group_name}\n\n`;
        jiraText += `対象データセット(ID):\n`;
        datasets.forEach((ds, index) => {
            jiraText += `${index + 1}. ${ds.dataset_name} (${ds.dataset_id})\n`;
        });
        jiraText += `\n`;
        
        if (applications.length > 0) {
            jiraText += `該当アプリケーション(ID):\n`;
            applications.forEach((app, index) => {
                jiraText += `${index + 1}. ${app.application_name} (${app.application_id})\n`;
            });
            jiraText += `\n`;
        }
        
        jiraText += `DBPマネージャー：\n`;
        if (group.dbp_manager) {
            jiraText += `${dbpManagerName ? `${dbpManagerName} ` : ''}(${group.dbp_manager})\n`;
        } else {
            jiraText += `(未登録)\n`;
        }
        jiraText += `\n`;
        
        jiraText += `データマネージャー：\n`;
        jiraText += `松本 (matsumoto@example.com)\n\n`;
        
        jiraText += `グループオーナー：\n`;
        if (group.group_owner) {
            jiraText += `${groupOwnerName ? `${groupOwnerName} ` : ''}(${group.group_owner})\n`;
        } else {
            jiraText += `(未登録)\n`;
        }
        jiraText += `\n`;
        
        if (applications.length > 0) {
            // アプリケーションオーナーを取得（重複除去）
            const uniqueAppOwners = [...new Set(applications.map(app => app.app_owner).filter(owner => owner))];
            if (uniqueAppOwners.length > 0) {
                // アプリケーションオーナーの名前を取得
                const appOwnerEmails = uniqueAppOwners;
                const appOwnerQuery = `
                    SELECT email, user_name 
                    FROM users 
                    WHERE email = ANY($1::text[])
                `;
                const appOwnerResult = await pool.query(appOwnerQuery, [appOwnerEmails]);
                const appOwnerMap = {};
                appOwnerResult.rows.forEach(row => {
                    appOwnerMap[row.email] = row.user_name;
                });
                
                // オーナーごとにアプリケーションをグループ化
                const ownerAppMap = {};
                applications.forEach(app => {
                    if (app.app_owner) {
                        if (!ownerAppMap[app.app_owner]) {
                            ownerAppMap[app.app_owner] = [];
                        }
                        ownerAppMap[app.app_owner].push(app);
                    }
                });
                
                jiraText += `アプリケーションオーナー：\n`;
                uniqueAppOwners.forEach(owner => {
                    const ownerName = appOwnerMap[owner] || '';
                    const ownerApps = ownerAppMap[owner] || [];
                    const appNames = ownerApps.map(app => app.application_name).join('、');
                    jiraText += `${ownerName ? `${ownerName} ` : ''}(${owner}) - ${appNames}\n`;
                });
            }
        }

        // 申請履歴を保存
            const insertRequestQuery = `
                INSERT INTO request_history (group_id, requester, status, jira_text, request_reason)
                VALUES ($1, $2, 'requested', $3, $4)
                RETURNING id
            `;
            const requestResult = await pool.query(insertRequestQuery, [groupId, requester, jiraText, requestReason]);
        const requestId = requestResult.rows[0].id;

        // 申請とデータセットの関連を保存
        const insertRequestDatasetsQuery = `
            INSERT INTO request_datasets (request_id, dataset_id)
            SELECT $1, unnest($2::int[])
        `;
        await pool.query(insertRequestDatasetsQuery, [requestId, datasetIds]);

        // 承認レコードを自動作成（データセットアクセス申請：グループオーナー → データマネージャー → アプリケーションオーナー）
        // DBPマネージャーとビジネスオーナーは承認フローには含めない（通知のみ）
        const approvalRecords = [];
        
        // グループオーナー（最初）
        if (group.group_owner) {
            approvalRecords.push({
                request_id: requestId,
                approver_type: 'group_owner',
                approver_email: group.group_owner,
                status: 'pending'
            });
        }
        
        // データマネージャー（固定、2番目）
        approvalRecords.push({
            request_id: requestId,
            approver_type: 'data_manager',
            approver_email: 'matsumoto@example.com',
            status: 'pending'
        });
        
        // アプリケーションオーナー（3番目、重複除去）
        const uniqueAppOwners = [...new Set(applications.map(app => app.app_owner).filter(owner => owner))];
        uniqueAppOwners.forEach(owner => {
            approvalRecords.push({
                request_id: requestId,
                approver_type: 'app_owner',
                approver_email: owner,
                status: 'pending'
            });
        });
        
        // 承認レコードを一括挿入
        if (approvalRecords.length > 0) {
            const insertApprovalsQuery = `
                INSERT INTO request_approvals (request_id, approver_type, approver_email, status)
                VALUES ${approvalRecords.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
            `;
            const approvalValues = approvalRecords.flatMap(r => [r.request_id, r.approver_type, r.approver_email, r.status]);
            await pool.query(insertApprovalsQuery, approvalValues);
        }

        res.json({ jiraText, requestId });
    } catch (error) {
        console.error('Error saving request:', error);
        res.status(500).json({ error: '申請の保存に失敗しました' });
    }
});

// APIエンドポイント: ユーザー一覧
app.get('/api/users', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id,
                u.user_id,
                u.user_name,
                u.email,
                u.qs_username
            FROM users u
            ORDER BY u.user_name ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'ユーザーの取得に失敗しました' });
    }
});

// APIエンドポイント: ユーザー詳細
app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // ユーザー基本情報
        const userQuery = `
            SELECT 
                u.*
            FROM users u
            WHERE u.id = $1
        `;
        const userResult = await pool.query(userQuery, [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }
        const user = userResult.rows[0];

        // 所属グループ（オーナーとDBPマネージャーのユーザー名も取得）
        const groupsQuery = `
            SELECT 
                g.id,
                g.group_name,
                g.group_owner,
                g.dbp_manager,
                owner_user.user_name as group_owner_name,
                dbp_user.user_name as dbp_manager_name
            FROM qs_groups g
            JOIN user_groups ug ON g.id = ug.group_id
            LEFT JOIN users owner_user ON g.group_owner = owner_user.email
            LEFT JOIN users dbp_user ON g.dbp_manager = dbp_user.email
            WHERE ug.user_id = $1
            ORDER BY g.group_name ASC
        `;
        const groupsResult = await pool.query(groupsQuery, [id]);
        user.groups = groupsResult.rows;

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'ユーザーの取得に失敗しました' });
    }
});

// サーバー起動
// APIエンドポイント: ドラフト一覧
app.get('/api/requests/drafts', async (req, res) => {
    try {
        const { requesterEmail } = req.query;
        
        // 申請者のメールアドレスからqs_usernameを取得
        let requesterFilter = '';
        let queryParams = [];
        
        if (requesterEmail) {
            const userQuery = `SELECT qs_username, user_id FROM users WHERE email = $1`;
            const userResult = await pool.query(userQuery, [requesterEmail]);
            
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                // qs_usernameがあればそれを使用、なければuser_idを使用
                const requesterValue = user.qs_username || user.user_id;
                if (requesterValue) {
                    requesterFilter = 'WHERE rh.requester = $1 AND rh.status = $2';
                    queryParams = [requesterValue, 'draft'];
                }
            }
        } else {
            requesterFilter = 'WHERE rh.status = $1';
            queryParams = ['draft'];
        }
        
        const query = `
            SELECT 
                rh.id,
                rh.request_date,
                rh.status,
                rh.requester,
                rh.request_type,
                rh.request_reason,
                COALESCE(g.group_name, rh.new_group_name) as group_name,
                COALESCE(
                    string_agg(DISTINCT d.dataset_name, ', ' ORDER BY d.dataset_name),
                    ''
                ) as datasets
            FROM request_history rh
            LEFT JOIN qs_groups g ON rh.group_id = g.id
            LEFT JOIN request_datasets rd ON rh.id = rd.request_id
            LEFT JOIN datasets d ON rd.dataset_id = d.id
            ${requesterFilter}
            GROUP BY rh.id, rh.request_date, rh.status, rh.requester, rh.request_type, rh.request_reason, g.group_name, rh.new_group_name
            ORDER BY rh.request_date DESC
        `;
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching drafts:', error);
        res.status(500).json({ error: 'ドラフト一覧の取得に失敗しました' });
    }
});

// APIエンドポイント: 申請一覧
app.get('/api/requests', async (req, res) => {
    try {
        const { requesterEmail } = req.query;
        
        // 申請者のメールアドレスからqs_usernameを取得
        let requesterFilter = '';
        let queryParams = [];
        
        if (requesterEmail) {
            const userQuery = `SELECT qs_username, user_id FROM users WHERE email = $1`;
            const userResult = await pool.query(userQuery, [requesterEmail]);
            
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                // qs_usernameがあればそれを使用、なければuser_idを使用
                const requesterValue = user.qs_username || user.user_id;
                if (requesterValue) {
                    requesterFilter = 'WHERE rh.requester = $1 AND rh.status != $2';
                    queryParams = [requesterValue, 'draft'];
                }
            }
        } else {
            requesterFilter = 'WHERE rh.status != $1';
            queryParams = ['draft'];
        }
        
        const query = `
            SELECT 
                rh.id,
                rh.request_date,
                rh.status,
                rh.requester,
                rh.request_type,
                COALESCE(g.group_name, rh.new_group_name) as group_name,
                COALESCE(
                    string_agg(DISTINCT d.dataset_name, ', ' ORDER BY d.dataset_name),
                    ''
                ) as datasets,
                COALESCE(
                    string_agg(DISTINCT d.dataset_id, ', ' ORDER BY d.dataset_id),
                    ''
                ) as dataset_ids,
                (
                    SELECT json_agg(
                        json_build_object(
                            'approver_type', ra.approver_type,
                            'approver_email', ra.approver_email,
                            'status', ra.status,
                            'approved_at', ra.approved_at,
                            'comment', ra.comment
                        )
                    )
                    FROM request_approvals ra
                    WHERE ra.request_id = rh.id
                ) as approvals
            FROM request_history rh
            LEFT JOIN qs_groups g ON rh.group_id = g.id
            LEFT JOIN request_datasets rd ON rh.id = rd.request_id
            LEFT JOIN datasets d ON rd.dataset_id = d.id
            ${requesterFilter}
            GROUP BY rh.id, rh.request_date, rh.status, rh.requester, rh.request_type, g.group_name, rh.new_group_name
            ORDER BY rh.request_date DESC
        `;
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: '申請一覧の取得に失敗しました' });
    }
});

// APIエンドポイント: 申請詳細
app.get('/api/requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 申請基本情報
        const requestQuery = `
            SELECT 
                rh.*,
                g.group_name,
                g.group_owner,
                g.dbp_manager
            FROM request_history rh
            LEFT JOIN qs_groups g ON rh.group_id = g.id
            WHERE rh.id = $1
        `;
        const requestResult = await pool.query(requestQuery, [id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: '申請が見つかりません' });
        }
        const request = requestResult.rows[0];
        
        // 新規グループ作成申請の場合、group_nameを設定
        if (request.request_type === 'create_group' && request.new_group_name) {
            request.group_name = request.new_group_name;
        }

        // 申請者情報を取得
        let requesterInfo = null;
        if (request.requester) {
            const requesterQuery = `SELECT user_name, email FROM users WHERE qs_username = $1`;
            const requesterResult = await pool.query(requesterQuery, [request.requester]);
            if (requesterResult.rows.length > 0) {
                requesterInfo = requesterResult.rows[0];
            }
        }

        // データセット情報（データセットアクセス申請の場合）
        if (request.request_type === 'dataset_access' || request.request_type === 'remove_dataset_access' || !request.request_type) {
            const datasetsQuery = `
                SELECT 
                    d.id,
                    d.dataset_id,
                    d.dataset_name,
                    d.description
                FROM datasets d
                JOIN request_datasets rd ON d.id = rd.dataset_id
                WHERE rd.request_id = $1
                ORDER BY d.dataset_name ASC
            `;
            const datasetsResult = await pool.query(datasetsQuery, [id]);
            request.datasets = datasetsResult.rows;
        } else {
            request.datasets = [];
        }
        
        // メンバー情報（メンバー追加/削除申請の場合）
        if (request.request_type === 'add_members' || request.request_type === 'remove_members') {
            const membersQuery = `
                SELECT 
                    u.id as user_id,
                    u.user_name,
                    u.email,
                    u.qs_username
                FROM users u
                JOIN request_members rm ON u.id = rm.user_id
                WHERE rm.request_id = $1
                ORDER BY u.user_name ASC
            `;
            const membersResult = await pool.query(membersQuery, [id]);
            request.members = membersResult.rows;
        } else {
            request.members = [];
        }

        // アプリケーション情報（データセットアクセス申請（追加・削除）の場合のみ）
        if (request.request_type === 'dataset_access' || request.request_type === 'remove_dataset_access' || !request.request_type) {
            const applicationsQuery = `
                SELECT DISTINCT
                    a.id,
                    a.application_id,
                    a.application_name,
                    a.app_owner,
                    a.business_owner
                FROM applications a
                JOIN application_datasets ad ON a.id = ad.application_id
                JOIN request_datasets rd ON ad.dataset_id = rd.dataset_id
                WHERE rd.request_id = $1
                ORDER BY a.application_name ASC
            `;
            const applicationsResult = await pool.query(applicationsQuery, [id]);
            request.applications = applicationsResult.rows;
        } else {
            request.applications = [];
        }

        // 申請者情報を追加
        request.requester_info = requesterInfo;
        
        // 申請理由を追加
        request.request_reason = request.request_reason || null;

        // 承認ステータスを取得（申請タイプに応じた順序で）
        const orderByClause = request.request_type === 'add_members' || request.request_type === 'create_group' || request.request_type === 'remove_group' || request.request_type === 'remove_members'
            ? `CASE approver_type
                WHEN 'group_owner' THEN 1
                WHEN 'data_manager' THEN 2
                ELSE 3
              END`
            : (request.request_type === 'dataset_access' || request.request_type === 'remove_dataset_access' || !request.request_type)
            ? `CASE approver_type
                WHEN 'group_owner' THEN 1
                WHEN 'data_manager' THEN 2
                WHEN 'app_owner' THEN 3
                ELSE 4
              END`
            : `CASE approver_type
                WHEN 'group_owner' THEN 1
                WHEN 'data_manager' THEN 2
                WHEN 'app_owner' THEN 3
                ELSE 4
              END`;
        
        const approvalsQuery = `
            SELECT 
                approver_type,
                approver_email,
                status,
                approved_at,
                comment
            FROM request_approvals
            WHERE request_id = $1
            ORDER BY 
                ${orderByClause},
                approver_email
        `;
        const approvalsResult = await pool.query(approvalsQuery, [id]);
        request.approvals = approvalsResult.rows;

        // 通知済み（DBPマネージャーとビジネスオーナー）を取得（データセットアクセス申請の場合のみ）
        request.notifications = [];
        if (request.request_type === 'dataset_access' || !request.request_type) {
            // DBPマネージャーを取得
            if (request.group_id) {
                const groupQuery = `SELECT dbp_manager FROM qs_groups WHERE id = $1`;
                const groupResult = await pool.query(groupQuery, [request.group_id]);
                if (groupResult.rows.length > 0 && groupResult.rows[0].dbp_manager) {
                    // DBPマネージャーの名前を取得
                    const dbpManagerEmail = groupResult.rows[0].dbp_manager;
                    const dbpManagerQuery = `SELECT user_name FROM users WHERE email = $1`;
                    const dbpManagerResult = await pool.query(dbpManagerQuery, [dbpManagerEmail]);
                    const dbpManagerName = dbpManagerResult.rows.length > 0 ? dbpManagerResult.rows[0].user_name : null;
                    
                    request.notifications.push({
                        type: 'dbp_manager',
                        email: dbpManagerEmail,
                        name: dbpManagerName,
                        status: 'notified'
                    });
                }
            }
            
            // ビジネスオーナーを取得（重複除去）
            if (request.applications && request.applications.length > 0) {
                const uniqueBusinessOwners = [...new Set(
                    request.applications
                        .map(app => app.business_owner)
                        .filter(owner => owner)
                )];
                
                for (const businessOwnerEmail of uniqueBusinessOwners) {
                    // ビジネスオーナーの名前を取得
                    const businessOwnerQuery = `SELECT user_name FROM users WHERE email = $1`;
                    const businessOwnerResult = await pool.query(businessOwnerQuery, [businessOwnerEmail]);
                    const businessOwnerName = businessOwnerResult.rows.length > 0 ? businessOwnerResult.rows[0].user_name : null;
                    
                    request.notifications.push({
                        type: 'business_owner',
                        email: businessOwnerEmail,
                        name: businessOwnerName,
                        status: 'notified'
                    });
                }
            }
        }

        res.json(request);
    } catch (error) {
        console.error('Error fetching request details:', error);
        res.status(500).json({ error: '申請詳細の取得に失敗しました' });
    }
});

// APIエンドポイント: 承認待ち申請一覧（承認者別）
app.get('/api/approvals/pending', async (req, res) => {
    try {
        const { approverEmail, status, canApprove } = req.query;
        
        if (!approverEmail) {
            return res.status(400).json({ error: '承認者のメールアドレスが必要です' });
        }

        // ステータスフィルター（pending, approved, rejected）
        let statusFilter = '';
        if (status === 'pending') {
            statusFilter = "AND ra.status = 'pending' AND rh.status = 'requested'";
        } else if (status === 'approved') {
            statusFilter = "AND ra.status = 'approved'";
        } else if (status === 'rejected') {
            statusFilter = "AND ra.status = 'rejected'";
        } else {
            // デフォルトは承認待ち
            statusFilter = "AND ra.status = 'pending' AND rh.status = 'requested'";
        }

        const query = `
            SELECT DISTINCT
                rh.id,
                rh.request_date,
                rh.status,
                rh.requester,
                rh.request_type,
                g.group_name,
                ra.approver_type,
                ra.status as approval_status,
                ra.approved_at,
                ra.comment,
                COALESCE(
                    string_agg(DISTINCT d.dataset_name, ', ' ORDER BY d.dataset_name),
                    ''
                ) as datasets,
                -- 承認可能かどうかを判定（申請タイプに応じて、pendingの場合のみ）
                CASE 
                    WHEN ra.status != 'pending' THEN false
                    -- メンバー追加・削除申請またはグループ作成・削除申請の場合
                    WHEN rh.request_type IN ('add_members', 'create_group', 'remove_members', 'remove_group') THEN
                        CASE 
                            WHEN ra.approver_type = 'group_owner' THEN true
                            WHEN ra.approver_type = 'data_manager' THEN (
                                SELECT COUNT(*) = 0
                                FROM request_approvals
                                WHERE request_id = rh.id
                                AND approver_type = 'group_owner'
                                AND status != 'approved'
                            )
                            ELSE false
                        END
                    -- データセットアクセス申請（追加・削除）の場合（グループオーナー → データマネージャー → アプリケーションオーナー）
                    ELSE
                        CASE 
                            WHEN ra.approver_type = 'group_owner' THEN true
                            WHEN ra.approver_type = 'data_manager' THEN (
                                SELECT COUNT(*) = 0
                                FROM request_approvals
                                WHERE request_id = rh.id
                                AND approver_type = 'group_owner'
                                AND status != 'approved'
                            )
                            WHEN ra.approver_type = 'app_owner' THEN (
                                SELECT COUNT(*) = 0
                                FROM request_approvals
                                WHERE request_id = rh.id
                                AND approver_type IN ('group_owner', 'data_manager')
                                AND status != 'approved'
                            )
                            ELSE false
                        END
                END as can_approve
            FROM request_history rh
            LEFT JOIN qs_groups g ON rh.group_id = g.id
            JOIN request_approvals ra ON rh.id = ra.request_id
            LEFT JOIN request_datasets rd ON rh.id = rd.request_id
            LEFT JOIN datasets d ON rd.dataset_id = d.id
            WHERE ra.approver_email = $1
            ${statusFilter}
            GROUP BY rh.id, rh.request_date, rh.status, rh.requester, rh.request_type, g.group_name, ra.approver_type, ra.status, ra.approved_at, ra.comment
            ORDER BY rh.request_date DESC
        `;
        let result = await pool.query(query, [approverEmail]);
        
        // 承認待ちの場合、canApproveでフィルタリング
        if (status === 'pending' && canApprove !== null && canApprove !== undefined) {
            result.rows = result.rows.filter(row => {
                const canApproveValue = row.can_approve === true;
                if (canApprove === 'true') {
                    return canApproveValue;
                } else if (canApprove === 'false') {
                    return !canApproveValue;
                }
                return true;
            });
        }
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching approvals:', error);
        res.status(500).json({ error: '申請の取得に失敗しました' });
    }
});

// APIエンドポイント: DBPマネージャーが関連する申請一覧を取得（通知のみ）
app.get('/api/requests/by-dbp-manager', async (req, res) => {
    try {
        const { dbpManagerEmail } = req.query;
        
        if (!dbpManagerEmail) {
            return res.status(400).json({ error: 'DBPマネージャーのメールアドレスが必要です' });
        }

        const query = `
            SELECT DISTINCT
                rh.id,
                rh.request_date,
                rh.status,
                rh.requester,
                rh.request_type,
                g.group_name,
                COALESCE(
                    string_agg(DISTINCT d.dataset_name, ', ' ORDER BY d.dataset_name),
                    ''
                ) as datasets
            FROM request_history rh
            JOIN qs_groups g ON rh.group_id = g.id
            LEFT JOIN request_datasets rd ON rh.id = rd.request_id
            LEFT JOIN datasets d ON rd.dataset_id = d.id
            WHERE g.dbp_manager = $1
            AND (rh.request_type IN ('dataset_access', 'remove_dataset_access') OR rh.request_type IS NULL)
            AND rh.status != 'draft'
            GROUP BY rh.id, rh.request_date, rh.status, rh.requester, rh.request_type, g.group_name
            ORDER BY rh.request_date DESC
        `;
        const result = await pool.query(query, [dbpManagerEmail]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching requests by DBP manager:', error);
        res.status(500).json({ error: '申請の取得に失敗しました' });
    }
});

// APIエンドポイント: ビジネスオーナーが関連する申請一覧を取得（通知のみ）
app.get('/api/requests/by-business-owner', async (req, res) => {
    try {
        const { businessOwnerEmail } = req.query;
        
        if (!businessOwnerEmail) {
            return res.status(400).json({ error: 'ビジネスオーナーのメールアドレスが必要です' });
        }

        const query = `
            SELECT DISTINCT
                rh.id,
                rh.request_date,
                rh.status,
                rh.requester,
                rh.request_type,
                g.group_name,
                COALESCE(
                    string_agg(DISTINCT d.dataset_name, ', ' ORDER BY d.dataset_name),
                    ''
                ) as datasets
            FROM request_history rh
            JOIN qs_groups g ON rh.group_id = g.id
            JOIN request_datasets rd ON rh.id = rd.request_id
            JOIN application_datasets ad ON rd.dataset_id = ad.dataset_id
            JOIN applications a ON ad.application_id = a.id
            LEFT JOIN datasets d ON rd.dataset_id = d.id
            WHERE a.business_owner = $1
            AND (rh.request_type IN ('dataset_access', 'remove_dataset_access') OR rh.request_type IS NULL)
            AND rh.status != 'draft'
            GROUP BY rh.id, rh.request_date, rh.status, rh.requester, rh.request_type, g.group_name
            ORDER BY rh.request_date DESC
        `;
        const result = await pool.query(query, [businessOwnerEmail]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching requests by business owner:', error);
        res.status(500).json({ error: '申請の取得に失敗しました' });
    }
});

// APIエンドポイント: 承認実行
app.post('/api/approvals/:requestId/approve', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { approverEmail, approverType, comment } = req.body;
        
        if (!approverEmail || !approverType) {
            return res.status(400).json({ error: '承認者のメールアドレスとタイプが必要です' });
        }

        // 申請タイプを取得
        const requestTypeQuery = `SELECT request_type FROM request_history WHERE id = $1`;
        const requestTypeResult = await pool.query(requestTypeQuery, [requestId]);
        if (requestTypeResult.rows.length === 0) {
            return res.status(404).json({ error: '申請が見つかりませんでした' });
        }
        const requestType = requestTypeResult.rows[0].request_type || 'dataset_access';

        // 申請タイプに応じた承認順序を設定
        let approvalOrder;
        if (requestType === 'add_members') {
            // メンバー追加申請: グループオーナー → データマネージャー
            approvalOrder = {
                'group_owner': 1,
                'data_manager': 2
            };
        } else if (requestType === 'create_group' || requestType === 'remove_group') {
            // グループ作成・削除申請: グループオーナー → データマネージャー
            approvalOrder = {
                'group_owner': 1,
                'data_manager': 2
            };
        } else if (requestType === 'remove_dataset_access') {
            // データセットアクセス削除申請: グループオーナー → データマネージャー → アプリケーションオーナー
            // DBPマネージャーとビジネスオーナーは承認フローには含めない（通知のみ）
            approvalOrder = {
                'group_owner': 1,
                'data_manager': 2,
                'app_owner': 3
            };
        } else {
            // データセットアクセス申請: グループオーナー → データマネージャー → アプリケーションオーナー
            // DBPマネージャーとビジネスオーナーは承認フローには含めない（通知のみ）
            approvalOrder = {
                'group_owner': 1,
                'data_manager': 2,
                'app_owner': 3
            };
        }
        
        const currentOrder = approvalOrder[approverType];
        if (!currentOrder) {
            return res.status(400).json({ error: '無効な承認者タイプです' });
        }

        // アプリケーションオーナー以外の場合、前の承認者が承認済みかチェック
        if (approverType !== 'app_owner') {
            const previousOrders = Object.entries(approvalOrder)
                .filter(([type, order]) => order < currentOrder)
                .map(([type]) => type);
            
            if (previousOrders.length > 0) {
                const checkPreviousQuery = `
                    SELECT COUNT(*) as pending_count
                    FROM request_approvals
                    WHERE request_id = $1
                    AND approver_type = ANY($2::text[])
                    AND status != 'approved'
                `;
                const checkResult = await pool.query(checkPreviousQuery, [requestId, previousOrders]);
                
                if (parseInt(checkResult.rows[0].pending_count) > 0) {
                    return res.status(400).json({ 
                        error: '前の承認者がまだ承認していません。順番に承認してください。' 
                    });
                }
            }
        } else {
            // アプリケーションオーナーの場合、グループオーナーとデータマネージャーがすべて承認済みかチェック
            const requiredTypes = ['group_owner', 'data_manager'];
            const checkRequiredQuery = `
                SELECT COUNT(*) as pending_count
                FROM request_approvals
                WHERE request_id = $1
                AND approver_type = ANY($2::text[])
                AND status != 'approved'
            `;
            const checkResult = await pool.query(checkRequiredQuery, [requestId, requiredTypes]);
            
            if (parseInt(checkResult.rows[0].pending_count) > 0) {
                return res.status(400).json({ 
                    error: 'グループオーナーとデータマネージャーの承認が必要です。' 
                });
            }
        }

        // 承認レコードを更新
        const updateQuery = `
            UPDATE request_approvals
            SET status = 'approved',
                approved_at = now(),
                comment = $1
            WHERE request_id = $2
            AND approver_email = $3
            AND approver_type = $4
            AND status = 'pending'
            RETURNING id
        `;
        const updateResult = await pool.query(updateQuery, [comment || null, requestId, approverEmail, approverType]);
        
        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: '承認対象の申請が見つかりませんでした' });
        }

        // すべての承認が完了したかチェック
        const checkAllApprovedQuery = `
            SELECT COUNT(*) as pending_count
            FROM request_approvals
            WHERE request_id = $1
            AND status = 'pending'
        `;
        const checkResult = await pool.query(checkAllApprovedQuery, [requestId]);
        
        // すべて承認済みの場合、申請ステータスを更新
        if (checkResult.rows[0].pending_count === '0') {
            const updateRequestQuery = `
                UPDATE request_history
                SET status = 'approved'
                WHERE id = $1
            `;
            await pool.query(updateRequestQuery, [requestId]);
        }

        res.json({ success: true, message: '承認しました' });
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ error: '承認処理に失敗しました' });
    }
});

// APIエンドポイント: 却下実行
app.post('/api/approvals/:requestId/reject', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { approverEmail, approverType, comment } = req.body;
        
        if (!approverEmail || !approverType) {
            return res.status(400).json({ error: '承認者のメールアドレスとタイプが必要です' });
        }

        // 申請タイプを取得
        const requestTypeQuery = `SELECT request_type FROM request_history WHERE id = $1`;
        const requestTypeResult = await pool.query(requestTypeQuery, [requestId]);
        if (requestTypeResult.rows.length === 0) {
            return res.status(404).json({ error: '申請が見つかりませんでした' });
        }
        const requestType = requestTypeResult.rows[0].request_type || 'dataset_access';

        // 申請タイプに応じた承認順序を設定（却下も同じ順序制約を適用）
        let approvalOrder;
        if (requestType === 'add_members') {
            // メンバー追加申請: グループオーナー → データマネージャー
            approvalOrder = {
                'group_owner': 1,
                'data_manager': 2
            };
        } else if (requestType === 'create_group' || requestType === 'remove_group') {
            // グループ作成・削除申請: グループオーナー → データマネージャー
            approvalOrder = {
                'group_owner': 1,
                'data_manager': 2
            };
        } else if (requestType === 'remove_dataset_access') {
            // データセットアクセス削除申請: グループオーナー → データマネージャー → アプリケーションオーナー
            // DBPマネージャーとビジネスオーナーは承認フローには含めない（通知のみ）
            approvalOrder = {
                'group_owner': 1,
                'data_manager': 2,
                'app_owner': 3
            };
        } else {
            // データセットアクセス申請: グループオーナー → データマネージャー → アプリケーションオーナー
            // DBPマネージャーとビジネスオーナーは承認フローには含めない（通知のみ）
            approvalOrder = {
                'group_owner': 1,
                'data_manager': 2,
                'app_owner': 3
            };
        }
        
        const currentOrder = approvalOrder[approverType];
        if (!currentOrder) {
            return res.status(400).json({ error: '無効な承認者タイプです' });
        }

        // アプリケーションオーナー以外の場合、前の承認者が承認済みかチェック
        if (approverType !== 'app_owner') {
            const previousOrders = Object.entries(approvalOrder)
                .filter(([type, order]) => order < currentOrder)
                .map(([type]) => type);
            
            if (previousOrders.length > 0) {
                const checkPreviousQuery = `
                    SELECT COUNT(*) as pending_count
                    FROM request_approvals
                    WHERE request_id = $1
                    AND approver_type = ANY($2::text[])
                    AND status != 'approved'
                `;
                const checkResult = await pool.query(checkPreviousQuery, [requestId, previousOrders]);
                
                if (parseInt(checkResult.rows[0].pending_count) > 0) {
                    return res.status(400).json({ 
                        error: '前の承認者がまだ承認していません。順番に承認してください。' 
                    });
                }
            }
        } else {
            // アプリケーションオーナーの場合、グループオーナーとデータマネージャーがすべて承認済みかチェック
            const requiredTypes = ['group_owner', 'data_manager'];
            const checkRequiredQuery = `
                SELECT COUNT(*) as pending_count
                FROM request_approvals
                WHERE request_id = $1
                AND approver_type = ANY($2::text[])
                AND status != 'approved'
            `;
            const checkResult = await pool.query(checkRequiredQuery, [requestId, requiredTypes]);
            
            if (parseInt(checkResult.rows[0].pending_count) > 0) {
                return res.status(400).json({ 
                    error: 'グループオーナーとデータマネージャーの承認が必要です。' 
                });
            }
        }

        // 却下レコードを更新
        const updateQuery = `
            UPDATE request_approvals
            SET status = 'rejected',
                approved_at = now(),
                comment = $1
            WHERE request_id = $2
            AND approver_email = $3
            AND approver_type = $4
            AND status = 'pending'
            RETURNING id
        `;
        const updateResult = await pool.query(updateQuery, [comment || null, requestId, approverEmail, approverType]);
        
        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: '却下対象の申請が見つかりませんでした' });
        }

        // 申請ステータスを却下に更新
        const updateRequestQuery = `
            UPDATE request_history
            SET status = 'rejected'
            WHERE id = $1
        `;
        await pool.query(updateRequestQuery, [requestId]);

        res.json({ success: true, message: '却下しました' });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ error: '却下処理に失敗しました' });
    }
});

// APIエンドポイント: 申請内容の更新
app.put('/api/requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { requestReason, datasetIds } = req.body;
        
        if (!datasetIds || datasetIds.length === 0) {
            return res.status(400).json({ error: 'データセットIDが必要です' });
        }

        // 申請が存在するか確認
        const checkQuery = `SELECT id, status FROM request_history WHERE id = $1`;
        const checkResult = await pool.query(checkQuery, [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: '申請が見つかりません' });
        }
        
        const request = checkResult.rows[0];
        
        // 承認済みまたは却下済みの場合は更新不可
        if (request.status === 'approved' || request.status === 'rejected') {
            return res.status(400).json({ error: '承認済みまたは却下済みの申請は更新できません' });
        }

        // 申請理由を更新
        if (requestReason !== undefined) {
            if (!requestReason || requestReason.trim() === '') {
                return res.status(400).json({ error: '申請理由は必須です' });
            }
            const updateReasonQuery = `
                UPDATE request_history
                SET request_reason = $1
                WHERE id = $2
            `;
            await pool.query(updateReasonQuery, [requestReason, id]);
        }

        // データセットの関連を更新
        // 既存の関連を削除
        const deleteDatasetsQuery = `DELETE FROM request_datasets WHERE request_id = $1`;
        await pool.query(deleteDatasetsQuery, [id]);
        
        // 新しい関連を追加
        const insertDatasetsQuery = `
            INSERT INTO request_datasets (request_id, dataset_id)
            SELECT $1, unnest($2::int[])
        `;
        await pool.query(insertDatasetsQuery, [id, datasetIds]);

        // 承認レコードを再作成（既存の承認レコードを削除して再作成）
        const deleteApprovalsQuery = `DELETE FROM request_approvals WHERE request_id = $1`;
        await pool.query(deleteApprovalsQuery, [id]);
        
        // グループ情報を取得
        const groupQuery = `SELECT group_owner, dbp_manager FROM qs_groups WHERE id = (SELECT group_id FROM request_history WHERE id = $1)`;
        const groupResult = await pool.query(groupQuery, [id]);
        const group = groupResult.rows[0];
        
        // アプリケーション情報を取得
        const appQuery = `
            SELECT DISTINCT a.app_owner
            FROM applications a
            JOIN application_datasets ad ON a.id = ad.application_id
            WHERE ad.dataset_id = ANY($1::int[])
            AND a.app_owner IS NOT NULL
        `;
        const appResult = await pool.query(appQuery, [datasetIds]);
        
        // 承認レコードを再作成
        const approvalRecords = [];
        
        if (group && group.dbp_manager) {
            approvalRecords.push({
                request_id: id,
                approver_type: 'dbp_manager',
                approver_email: group.dbp_manager,
                status: 'pending'
            });
        }
        
        approvalRecords.push({
            request_id: id,
            approver_type: 'data_manager',
            approver_email: 'matsumoto@example.com',
            status: 'pending'
        });
        
        if (group && group.group_owner) {
            approvalRecords.push({
                request_id: id,
                approver_type: 'group_owner',
                approver_email: group.group_owner,
                status: 'pending'
            });
        }
        
        const uniqueAppOwners = [...new Set(appResult.rows.map(row => row.app_owner).filter(owner => owner))];
        uniqueAppOwners.forEach(owner => {
            approvalRecords.push({
                request_id: id,
                approver_type: 'app_owner',
                approver_email: owner,
                status: 'pending'
            });
        });
        
        if (approvalRecords.length > 0) {
            const insertApprovalsQuery = `
                INSERT INTO request_approvals (request_id, approver_type, approver_email, status)
                VALUES ${approvalRecords.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
            `;
            const approvalValues = approvalRecords.flatMap(r => [r.request_id, r.approver_type, r.approver_email, r.status]);
            await pool.query(insertApprovalsQuery, approvalValues);
        }

        res.json({ success: true, message: '申請内容を更新しました' });
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({ error: '申請内容の更新に失敗しました' });
    }
});

// APIエンドポイント: 新規グループ作成申請
app.post('/api/requests/create-group', async (req, res) => {
    try {
        const { userId, groupName, groupOwner, dbpManager, requestReason, requestId } = req.body;
        
        if (!userId || !groupName || !groupOwner || !dbpManager) {
            return res.status(400).json({ error: '必須項目が不足しています' });
        }
        
        if (!requestReason || requestReason.trim() === '') {
            return res.status(400).json({ error: '申請理由は必須です' });
        }

        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '', qs_username: '' };
        let requester = '';
        if (userId) {
            const userQuery = `SELECT user_name, email, qs_username FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
                requester = userInfo.qs_username || userInfo.user_name || '';
            }
        }

        // JIRA用テキストを生成
        let jiraText = '';
        jiraText += `申請者: ${userInfo.user_name || '(未入力)'}${userInfo.email ? ` (${userInfo.email})` : ''}\n\n`;
        jiraText += `申請タイプ: 新規グループ作成\n\n`;
        jiraText += `グループ名: ${groupName}\n\n`;
        jiraText += `グループオーナー: ${groupOwner}\n\n`;
        jiraText += `DBPマネージャー: ${dbpManager}\n\n`;
        jiraText += `データマネージャー：\n`;
        jiraText += `松本 (matsumoto@example.com)\n\n`;
        jiraText += `申請理由: ${requestReason}\n\n`;

        // 申請履歴を保存（group_idはNULL）
        let savedRequestId;
        if (requestId) {
            // 既存のドラフトを申請に変更
            const updateRequestQuery = `
                UPDATE request_history 
                SET requester = $1, status = 'requested', jira_text = $2, request_reason = $3, request_type = $4, new_group_name = $5, new_group_owner = $6, new_dbp_manager = $7, request_date = NOW()
                WHERE id = $8 AND status = 'draft'
                RETURNING id
            `;
            const updateResult = await pool.query(updateRequestQuery, [requester, jiraText, requestReason, 'create_group', groupName, groupOwner, dbpManager, requestId]);
            if (updateResult.rows.length === 0) {
                return res.status(404).json({ error: 'ドラフトが見つかりません' });
            }
            savedRequestId = updateResult.rows[0].id;
            
            // 既存の承認レコードを削除
            await pool.query('DELETE FROM request_approvals WHERE request_id = $1', [savedRequestId]);
        } else {
            // 新しい申請を作成
            const insertRequestQuery = `
                INSERT INTO request_history (group_id, requester, status, jira_text, request_reason, request_type, new_group_name, new_group_owner, new_dbp_manager)
                VALUES (NULL, $1, 'requested', $2, $3, 'create_group', $4, $5, $6)
                RETURNING id
            `;
            const requestResult = await pool.query(insertRequestQuery, [requester, jiraText, requestReason, groupName, groupOwner, dbpManager]);
            savedRequestId = requestResult.rows[0].id;
        }
        
        const approvalRecords = [];
        
        // グループオーナー（最初）
        if (groupOwner) {
            approvalRecords.push({
                request_id: savedRequestId,
                approver_type: 'group_owner',
                approver_email: groupOwner,
                status: 'pending'
            });
        }
        
        // データマネージャー（固定、2番目）
        approvalRecords.push({
            request_id: savedRequestId,
            approver_type: 'data_manager',
            approver_email: 'matsumoto@example.com',
            status: 'pending'
        });
        
        // 承認レコードを一括挿入
        if (approvalRecords.length > 0) {
            const insertApprovalsQuery = `
                INSERT INTO request_approvals (request_id, approver_type, approver_email, status)
                VALUES ${approvalRecords.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
            `;
            const approvalValues = approvalRecords.flatMap(r => [r.request_id, r.approver_type, r.approver_email, r.status]);
            await pool.query(insertApprovalsQuery, approvalValues);
        }

        res.json({ success: true, requestId: savedRequestId });
    } catch (error) {
        console.error('Error saving create group request:', error);
        res.status(500).json({ error: '申請の保存に失敗しました' });
    }
});

// APIエンドポイント: グループ削除申請
app.post('/api/requests/remove-group', async (req, res) => {
    try {
        const { userId, groupId, requestReason, requestId } = req.body;
        
        if (!userId || !groupId) {
            return res.status(400).json({ error: '必須項目が不足しています' });
        }
        
        if (!requestReason || requestReason.trim() === '') {
            return res.status(400).json({ error: '申請理由は必須です' });
        }

        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '', qs_username: '' };
        let requester = '';
        if (userId) {
            const userQuery = `SELECT user_name, email, qs_username FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
                requester = userInfo.qs_username || userInfo.user_name || '';
            }
        }

        // グループ情報を取得
        const groupQuery = `SELECT group_name, group_owner, dbp_manager FROM qs_groups WHERE id = $1`;
        const groupResult = await pool.query(groupQuery, [groupId]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'グループが見つかりません' });
        }
        const group = groupResult.rows[0];

        // JIRA用テキストを生成
        let jiraText = '';
        jiraText += `申請者: ${userInfo.user_name || '(未入力)'}${userInfo.email ? ` (${userInfo.email})` : ''}\n\n`;
        jiraText += `申請タイプ: グループ削除\n\n`;
        jiraText += `削除対象グループ: ${group.group_name}\n\n`;
        jiraText += `グループオーナー: ${group.group_owner || '(未登録)'}\n\n`;
        jiraText += `DBPマネージャー: ${group.dbp_manager || '(未登録)'}\n\n`;
        jiraText += `データマネージャー：\n`;
        jiraText += `松本 (matsumoto@example.com)\n\n`;
        jiraText += `申請理由: ${requestReason}\n\n`;

        // 申請履歴を保存
        let savedRequestId;
        if (requestId) {
            // 既存のドラフトを申請に変更
            const updateRequestQuery = `
                UPDATE request_history 
                SET group_id = $1, requester = $2, status = 'requested', jira_text = $3, request_reason = $4, request_type = $5, request_date = NOW()
                WHERE id = $6 AND status = 'draft'
                RETURNING id
            `;
            const updateResult = await pool.query(updateRequestQuery, [groupId, requester, jiraText, requestReason, 'remove_group', requestId]);
            if (updateResult.rows.length === 0) {
                return res.status(404).json({ error: 'ドラフトが見つかりません' });
            }
            savedRequestId = updateResult.rows[0].id;
        } else {
            // 新しい申請を作成
            const insertRequestQuery = `
                INSERT INTO request_history (group_id, requester, status, jira_text, request_reason, request_type)
                VALUES ($1, $2, 'requested', $3, $4, 'remove_group')
                RETURNING id
            `;
            const requestResult = await pool.query(insertRequestQuery, [groupId, requester, jiraText, requestReason]);
            savedRequestId = requestResult.rows[0].id;
        }

        // 承認レコードを自動作成（グループ削除申請：グループオーナー → データマネージャーの順）
        // ドラフトから申請に変更する場合は、既存の承認レコードがあるかもしれないので削除
        if (requestId) {
            await pool.query('DELETE FROM request_approvals WHERE request_id = $1', [savedRequestId]);
        }
        
        const approvalRecords = [];
        
        // グループオーナー（最初）
        if (group.group_owner) {
            approvalRecords.push({
                request_id: savedRequestId,
                approver_type: 'group_owner',
                approver_email: group.group_owner,
                status: 'pending'
            });
        }
        
        // データマネージャー（固定、2番目）
        approvalRecords.push({
            request_id: savedRequestId,
            approver_type: 'data_manager',
            approver_email: 'matsumoto@example.com',
            status: 'pending'
        });
        
        // 承認レコードを一括挿入
        if (approvalRecords.length > 0) {
            const insertApprovalsQuery = `
                INSERT INTO request_approvals (request_id, approver_type, approver_email, status)
                VALUES ${approvalRecords.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
            `;
            const approvalValues = approvalRecords.flatMap(r => [r.request_id, r.approver_type, r.approver_email, r.status]);
            await pool.query(insertApprovalsQuery, approvalValues);
        }

        res.json({ success: true, requestId: savedRequestId });
    } catch (error) {
        console.error('Error saving remove group request:', error);
        res.status(500).json({ error: '申請の保存に失敗しました' });
    }
});

// APIエンドポイント: メンバー追加/削除申請
app.post('/api/requests/add-members', async (req, res) => {
    try {
        const { userId, groupId, memberUserIds, requestReason, requestType, requestId } = req.body;
        const finalRequestType = requestType || 'add_members';
        
        if (!userId || !groupId || !memberUserIds || memberUserIds.length === 0) {
            return res.status(400).json({ error: '必須項目が不足しています' });
        }
        
        if (!requestReason || requestReason.trim() === '') {
            return res.status(400).json({ error: '申請理由は必須です' });
        }

        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '', qs_username: '' };
        let requester = '';
        if (userId) {
            const userQuery = `SELECT user_name, email, qs_username FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [userId]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
                requester = userInfo.qs_username || userInfo.user_name || '';
            }
        }

        // グループ情報を取得
        const groupQuery = `SELECT group_name, group_owner, dbp_manager FROM qs_groups WHERE id = $1`;
        const groupResult = await pool.query(groupQuery, [groupId]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'グループが見つかりません' });
        }
        const group = groupResult.rows[0];

        // 追加するメンバーの情報を取得
        const membersQuery = `
            SELECT user_name, email, qs_username
            FROM users
            WHERE id = ANY($1::int[])
        `;
        const membersResult = await pool.query(membersQuery, [memberUserIds]);
        const members = membersResult.rows;

        // JIRA用テキストを生成
        const requestTypeLabel = finalRequestType === 'remove_members' ? 'メンバー削除' : 'メンバー追加';
        const memberActionLabel = finalRequestType === 'remove_members' ? '削除するメンバー' : '追加するメンバー';
        
        let jiraText = '';
        jiraText += `申請者: ${userInfo.user_name || '(未入力)'}${userInfo.email ? ` (${userInfo.email})` : ''}\n\n`;
        jiraText += `申請タイプ: ${requestTypeLabel}\n\n`;
        jiraText += `対象グループ: ${group.group_name}\n\n`;
        jiraText += `${memberActionLabel}:\n`;
        members.forEach((member, index) => {
            jiraText += `${index + 1}. ${member.user_name || ''} (${member.email || member.qs_username || ''})\n`;
        });
        jiraText += `\n`;
        jiraText += `DBPマネージャー：\n`;
        if (group.dbp_manager) {
            jiraText += `${group.dbp_manager}\n\n`;
        } else {
            jiraText += `(未登録)\n\n`;
        }
        jiraText += `データマネージャー：\n`;
        jiraText += `松本 (matsumoto@example.com)\n\n`;
        jiraText += `グループオーナー：\n`;
        if (group.group_owner) {
            jiraText += `${group.group_owner}\n\n`;
        } else {
            jiraText += `(未登録)\n\n`;
        }
        jiraText += `申請理由: ${requestReason}\n\n`;

        // 申請履歴を保存
        let savedRequestId;
        if (requestId) {
            // 既存のドラフトを申請に変更
            const updateRequestQuery = `
                UPDATE request_history 
                SET group_id = $1, requester = $2, status = 'requested', jira_text = $3, request_reason = $4, request_type = $5, request_date = NOW()
                WHERE id = $6 AND status = 'draft'
                RETURNING id
            `;
            const updateResult = await pool.query(updateRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType, requestId]);
            if (updateResult.rows.length === 0) {
                return res.status(404).json({ error: 'ドラフトが見つかりません' });
            }
            savedRequestId = updateResult.rows[0].id;
            
            // 既存のメンバー関連を削除
            await pool.query('DELETE FROM request_members WHERE request_id = $1', [savedRequestId]);
            
            // 既存の承認レコードを削除
            await pool.query('DELETE FROM request_approvals WHERE request_id = $1', [savedRequestId]);
        } else {
            // 新しい申請を作成
            const insertRequestQuery = `
                INSERT INTO request_history (group_id, requester, status, jira_text, request_reason, request_type)
                VALUES ($1, $2, 'requested', $3, $4, $5)
                RETURNING id
            `;
            const requestResult = await pool.query(insertRequestQuery, [groupId, requester, jiraText, requestReason, finalRequestType]);
            savedRequestId = requestResult.rows[0].id;
        }

        // 申請とメンバーの関連を保存
        const insertRequestMembersQuery = `
            INSERT INTO request_members (request_id, user_id)
            SELECT $1, unnest($2::int[])
        `;
        await pool.query(insertRequestMembersQuery, [savedRequestId, memberUserIds]);

        // 承認レコードを自動作成（メンバー追加・削除申請：グループオーナー → データマネージャー）
        const approvalRecords = [];
        
        // グループオーナー（最初）
        if (group.group_owner) {
            approvalRecords.push({
                request_id: requestId,
                approver_type: 'group_owner',
                approver_email: group.group_owner,
                status: 'pending'
            });
        }
        
        // データマネージャー（固定、2番目）
        approvalRecords.push({
            request_id: requestId,
            approver_type: 'data_manager',
            approver_email: 'matsumoto@example.com',
            status: 'pending'
        });
        
        // 承認レコードを一括挿入
        if (approvalRecords.length > 0) {
            const insertApprovalsQuery = `
                INSERT INTO request_approvals (request_id, approver_type, approver_email, status)
                VALUES ${approvalRecords.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
            `;
            const approvalValues = approvalRecords.flatMap(r => [r.request_id, r.approver_type, r.approver_email, r.status]);
            await pool.query(insertApprovalsQuery, approvalValues);
        }

        res.json({ success: true, requestId });
    } catch (error) {
        console.error('Error saving add members request:', error);
        res.status(500).json({ error: '申請の保存に失敗しました' });
    }
});

// APIエンドポイント: 申請取り下げ
app.post('/api/requests/:id/withdraw', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 申請が存在するか確認
        const checkQuery = `SELECT id, status, requester FROM request_history WHERE id = $1`;
        const checkResult = await pool.query(checkQuery, [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: '申請が見つかりません' });
        }
        
        const request = checkResult.rows[0];
        
        // 承認済み、却下済み、取り下げ済みの場合は取り下げ不可
        if (request.status === 'approved' || request.status === 'rejected' || request.status === 'withdrawn') {
            return res.status(400).json({ error: 'この申請は取り下げできません' });
        }
        
        // 申請ステータスを取り下げに更新
        const updateQuery = `
            UPDATE request_history
            SET status = 'withdrawn'
            WHERE id = $1
        `;
        await pool.query(updateQuery, [id]);
        
        // 承認レコードのステータスも更新（pendingのものを取り下げ済みに）
        const updateApprovalsQuery = `
            UPDATE request_approvals
            SET status = 'withdrawn'
            WHERE request_id = $1
            AND status = 'pending'
        `;
        await pool.query(updateApprovalsQuery, [id]);

        res.json({ success: true, message: '申請を取り下げました' });
    } catch (error) {
        console.error('Error withdrawing request:', error);
        res.status(500).json({ error: '申請の取り下げに失敗しました' });
    }
});

// APIエンドポイント: ドラフトを申請として送信
app.post('/api/requests/:id/submit', async (req, res) => {
    try {
        const { id } = req.params;
        
        // ドラフトを取得
        const draftQuery = `
            SELECT rh.*, g.group_name, g.group_owner, g.dbp_manager
            FROM request_history rh
            LEFT JOIN qs_groups g ON rh.group_id = g.id
            WHERE rh.id = $1 AND rh.status = 'draft'
        `;
        const draftResult = await pool.query(draftQuery, [id]);
        if (draftResult.rows.length === 0) {
            return res.status(404).json({ error: 'ドラフトが見つかりません' });
        }
        const draft = draftResult.rows[0];
        
        // データセット情報を取得
        const datasetQuery = `
            SELECT d.id, d.dataset_id, d.dataset_name
            FROM datasets d
            JOIN request_datasets rd ON d.id = rd.dataset_id
            WHERE rd.request_id = $1
            ORDER BY d.dataset_name ASC
        `;
        const datasetResult = await pool.query(datasetQuery, [id]);
        const datasets = datasetResult.rows;
        
        // データセットに関連するアプリケーション情報を取得
        const datasetIds = datasets.map(d => d.id);
        const appQuery = `
            SELECT DISTINCT
                a.application_id,
                a.application_name,
                a.app_owner
            FROM applications a
            JOIN application_datasets ad ON a.id = ad.application_id
            WHERE ad.dataset_id = ANY($1::int[])
            ORDER BY a.application_name ASC
        `;
        const appResult = await pool.query(appQuery, [datasetIds]);
        const applications = appResult.rows;
        
        // ユーザー情報を取得
        let userInfo = { user_name: '', email: '', qs_username: '' };
        if (draft.requester) {
            const userQuery = `SELECT user_name, email, qs_username FROM users WHERE qs_username = $1 OR user_id = $1`;
            const userResult = await pool.query(userQuery, [draft.requester]);
            if (userResult.rows.length > 0) {
                userInfo = userResult.rows[0];
            }
        }
        
        // JIRAテキストを再生成
        const group = {
            group_name: draft.group_name,
            group_owner: draft.group_owner,
            dbp_manager: draft.dbp_manager
        };
        const jiraText = await generateJiraText(userInfo, group, datasets, applications, draft.request_reason);
        
        // ドラフトを申請に変更
        const updateQuery = `
            UPDATE request_history
            SET status = 'requested', jira_text = $1, request_date = NOW()
            WHERE id = $2
            RETURNING id
        `;
        await pool.query(updateQuery, [jiraText, id]);
        
        // 承認レコードを自動作成
        const approvalRecords = [];
        
        // DBPマネージャー
        if (group.dbp_manager) {
            approvalRecords.push({
                request_id: id,
                approver_type: 'dbp_manager',
                approver_email: group.dbp_manager,
                status: 'pending'
            });
        }
        
        // データマネージャー（固定）
        approvalRecords.push({
            request_id: id,
            approver_type: 'data_manager',
            approver_email: 'matsumoto@example.com',
            status: 'pending'
        });
        
        // グループオーナー
        if (group.group_owner) {
            approvalRecords.push({
                request_id: id,
                approver_type: 'group_owner',
                approver_email: group.group_owner,
                status: 'pending'
            });
        }
        
        // アプリケーションオーナー
        if (applications.length > 0) {
            const uniqueAppOwners = [...new Set(applications.map(app => app.app_owner).filter(owner => owner))];
            uniqueAppOwners.forEach(owner => {
                approvalRecords.push({
                    request_id: id,
                    approver_type: 'app_owner',
                    approver_email: owner,
                    status: 'pending'
                });
            });
        }
        
        if (approvalRecords.length > 0) {
            const insertApprovalsQuery = `
                INSERT INTO request_approvals (request_id, approver_type, approver_email, status)
                VALUES ${approvalRecords.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ')}
                ON CONFLICT (request_id, approver_type, approver_email) DO NOTHING
            `;
            const approvalValues = approvalRecords.flatMap(r => [r.request_id, r.approver_type, r.approver_email, r.status]);
            await pool.query(insertApprovalsQuery, approvalValues);
        }
        
        res.json({ success: true, message: '申請を送信しました' });
    } catch (error) {
        console.error('Error submitting draft:', error);
        res.status(500).json({ error: '申請の送信に失敗しました' });
    }
});

// APIエンドポイント: 申請削除（ドラフトのみ）
app.delete('/api/requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // ドラフトかどうかを確認
        const checkQuery = `SELECT id, status FROM request_history WHERE id = $1`;
        const checkResult = await pool.query(checkQuery, [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: '申請が見つかりません' });
        }
        
        const request = checkResult.rows[0];
        if (request.status !== 'draft') {
            return res.status(400).json({ error: 'ドラフトのみ削除できます' });
        }
        
        // 関連データを削除（CASCADEで自動削除されるが、明示的に削除）
        await pool.query('DELETE FROM request_datasets WHERE request_id = $1', [id]);
        await pool.query('DELETE FROM request_approvals WHERE request_id = $1', [id]);
        await pool.query('DELETE FROM request_history WHERE id = $1', [id]);
        
        res.json({ success: true, message: 'ドラフトを削除しました' });
    } catch (error) {
        console.error('Error deleting draft:', error);
        res.status(500).json({ error: 'ドラフトの削除に失敗しました' });
    }
});

// APIエンドポイント: ログイン
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'メールアドレスが必要です' });
        }

        // ユーザーをメールアドレスで検索
        const userQuery = `SELECT id, user_id, user_name, email, qs_username FROM users WHERE email = $1`;
        const userResult = await pool.query(userQuery, [email]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'メールアドレスが見つかりません' });
        }

        const user = userResult.rows[0];
        
        // 承認者かどうかをチェック（DBPマネージャー、データマネージャー、グループオーナー、アプリケーションオーナーのいずれか）
        const approverCheckQuery = `
            SELECT 
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM qs_groups WHERE dbp_manager = $1
                    ) THEN true
                    WHEN EXISTS (
                        SELECT 1 FROM qs_groups WHERE group_owner = $1
                    ) THEN true
                    WHEN EXISTS (
                        SELECT 1 FROM applications WHERE app_owner = $1
                    ) THEN true
                    WHEN $1 = 'matsumoto@example.com' THEN true
                    ELSE false
                END as is_approver
        `;
        const approverResult = await pool.query(approverCheckQuery, [email]);
        const isApprover = approverResult.rows[0].is_approver;

        res.json({ 
            success: true, 
            user: {
                id: user.id,
                user_id: user.user_id,
                user_name: user.user_name,
                email: user.email,
                qs_username: user.qs_username
            },
            isApprover: isApprover
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'ログイン処理に失敗しました' });
    }
});

// APIエンドポイント: ログアウト
app.post('/api/auth/logout', async (req, res) => {
    res.json({ success: true, message: 'ログアウトしました' });
});

app.listen(PORT, () => {
    console.log(`サーバーが起動しました:`);
    console.log(`http://localhost:${PORT}`);
    console.log(`http://127.0.0.1:${PORT}`);
});
  