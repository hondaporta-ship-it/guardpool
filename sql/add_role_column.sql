-- ========================================
-- companiesテーブルにroleカラムを追加
-- role: 'admin' (ATS管理者) or 'member' (一般参加会社)
-- ========================================

-- roleカラムを追加（デフォルトは'member'）
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' 
CHECK (role IN ('admin', 'member'));

-- ATセキュリティのアカウントをadminに設定
-- ※ login_idは実際の値に合わせて調整してください
UPDATE companies SET role = 'admin' WHERE login_id = 'ats';
UPDATE companies SET role = 'admin' WHERE login_id = 'ats_mori';
UPDATE companies SET role = 'admin' WHERE login_id = 'ats_kashiko';

-- 確認
SELECT login_id, company_name, role FROM companies ORDER BY role, company_name;
