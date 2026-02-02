// ページ読み込み時の処理
document.addEventListener('DOMContentLoaded', async () => {
    // Supabaseクライアント初期化
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // ログインフォーム処理
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const loginId = document.getElementById('loginId').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('errorMessage');
            
            try {
                const { data, error } = await supabaseClient
                    .from('companies')
                    .select('*')
                    .eq('login_id', loginId)
                    .eq('password', password)
                    .single();
                
                if (error || !data) {
                    errorMessage.textContent = 'ログインIDまたはパスワードが間違っています';
                    errorMessage.classList.add('show');
                    return;
                }
                
                sessionStorage.setItem('currentUser', JSON.stringify(data));
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                console.error('ログインエラー:', error);
                errorMessage.textContent = 'ログインに失敗しました';
                errorMessage.classList.add('show');
            }
        });
    }
    
    // ダッシュボード処理
    if (window.location.pathname.includes('dashboard.html')) {
        const userStr = sessionStorage.getItem('currentUser');
        if (!userStr) {
            window.location.href = 'index.html';
            return;
        }
        
        const currentUser = JSON.parse(userStr);
        document.getElementById('companyName').textContent = currentUser.company_name;
        
        // ログアウト
        window.logout = () => {
            sessionStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        };
        
        // 投稿一覧読み込み（ダミーデータ）
const postsList = document.getElementById('postsList');

// ダミーデータ
const dummyData = {
    available: [
        {
            company_name: 'ATS（エーティーセキュリティー）',
            post_date: '2026-02-03',
            people_count: 3,
            area: '福岡市内',
            note: '交通整理経験者、2級資格保持者',
            phone: '092-XXX-XXXX',
            contact_person: '本田',
            contact_phone: '080-XXXX-XXXX'
        },
        {
            company_name: '全九州警備保障',
            post_date: '2026-02-04',
            people_count: 2,
            area: '博多区',
            note: 'イベント警備対応可',
            phone: '092-731-1310',
            contact_person: '担当者',
            contact_phone: '080-XXXX-XXXX'
        },
        {
            company_name: 'わかば総合警備株式会社',
            post_date: '2026-02-05',
            people_count: 1,
            area: '東区',
            note: '施設警備経験あり',
            phone: '092-XXX-XXXX',
            contact_person: '担当者',
            contact_phone: '080-XXXX-XXXX'
        }
    ],
    needed: [
        {
            company_name: 'Thanks警備株式会社',
            post_date: '2026-02-03',
            people_count: 2,
            area: '那珂川市',
            job_type: 'イベント警備',
            required_skills: '2級以上',
            note: '土日のみ、8:00-17:00',
            phone: '092-XXX-XXXX',
            contact_person: '担当者',
            contact_phone: '080-XXXX-XXXX'
        },
        {
            company_name: 'ALSOK九州（株）',
            post_date: '2026-02-04',
            people_count: 5,
            area: '福岡市中央区',
            job_type: '交通整理',
            required_skills: '経験者優先',
            note: '工事現場、平日対応',
            phone: '092-471-1016',
            contact_person: '担当者',
            contact_phone: '080-XXXX-XXXX'
        }
    ]
};

// HTMLを生成
let html = '<h3 style="color: #3b82f6; margin-bottom: 1rem;">🔵 人が余ってます</h3>';

dummyData.available.forEach(post => {
    const date = new Date(post.post_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
    html += `
        <div class="post-card">
            <div class="post-header">
                <div>
                    <div class="company-name">${post.company_name}</div>
                    <div class="post-date">🔵 人が余ってます - ${date}</div>
                </div>
            </div>
            <div class="post-details">
                <div class="detail-item">
                    <span class="detail-label">人数</span>
                    <span class="detail-value">${post.people_count}名</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">エリア</span>
                    <span class="detail-value">${post.area}</span>
                </div>
            </div>
            ${post.note ? `<div class="post-note">備考: ${post.note}</div>` : ''}
            <div class="contact-info">
                <div>📞 ${post.phone}</div>
                <div>👤 ${post.contact_person} (${post.contact_phone})</div>
            </div>
        </div>
    `;
});

html += '<h3 style="color: #ef4444; margin: 2rem 0 1rem 0;">🔴 人が足りません</h3>';

dummyData.needed.forEach(post => {
    const date = new Date(post.post_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
    html += `
        <div class="post-card needed">
            <div class="post-header">
                <div>
                    <div class="company-name">${post.company_name}</div>
                    <div class="post-date">🔴 人が足りません - ${date}</div>
                </div>
            </div>
            <div class="post-details">
                <div class="detail-item">
                    <span class="detail-label">必要人数</span>
                    <span class="detail-value">${post.people_count}名</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">エリア</span>
                    <span class="detail-value">${post.area}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">業務内容</span>
                    <span class="detail-value">${post.job_type}</span>
                </div>
            </div>
            ${post.note ? `<div class="post-note">備考: ${post.note}</div>` : ''}
            <div class="contact-info">
                <div>📞 ${post.phone}</div>
                <div>👤 ${post.contact_person} (${post.contact_phone})</div>
            </div>
        </div>
    `;
});

postsList.innerHTML = html;
        
        // 投稿フォーム表示（仮）
        window.showPostForm = (type) => {
            const typeText = type === 'available' ? '人が余ってます' : '人が足りません';
            alert(`${typeText}の投稿フォームは開発中です。\n電話で連絡をお願いします。`);
        };
    }
});