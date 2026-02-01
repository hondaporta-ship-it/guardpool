// Supabaseクライアント初期化
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 現在のユーザー情報
let currentUser = null;

// ページ読み込み時の処理
document.addEventListener('DOMContentLoaded', async () => {
    // ログインページの場合
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // ダッシュボードページの場合
    if (window.location.pathname.includes('dashboard.html')) {
        await checkAuth();
        await loadPosts();
    }
});

// ログイン処理
async function handleLogin(e) {
    e.preventDefault();
    
    const loginId = document.getElementById('loginId').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    try {
        // companiesテーブルから認証
        const { data, error } = await supabase
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
        
        // ログイン成功
        sessionStorage.setItem('currentUser', JSON.stringify(data));
        window.location.href = 'dashboard.html';
        
    } catch (error) {
        console.error('ログインエラー:', error);
        errorMessage.textContent = 'ログインに失敗しました';
        errorMessage.classList.add('show');
    }
}

// 認証チェック
async function checkAuth() {
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = JSON.parse(userStr);
    
    // 会社名を表示
    const companyNameEl = document.getElementById('companyName');
    if (companyNameEl) {
        companyNameEl.textContent = currentUser.company_name;
    }
}

// ログアウト
function logout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// 投稿一覧を読み込み
async function loadPosts() {
    const postsList = document.getElementById('postsList');
    
    try {
        // 余ってます投稿
        const { data: availablePosts, error: availError } = await supabase
            .from('posts_available')
            .select(`
                *,
                companies (company_name, phone, contact_person, contact_phone)
            `)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        // 足りません投稿
        const { data: neededPosts, error: neededError } = await supabase
            .from('posts_needed')
            .select(`
                *,
                companies (company_name, phone, contact_person, contact_phone)
            `)
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (availError || neededError) {
            console.error('投稿読み込みエラー:', availError || neededError);
            postsList.innerHTML = '<p>投稿の読み込みに失敗しました</p>';
            return;
        }
        
        // 投稿を表示
        let html = '';
        
        // 余ってます投稿
        if (availablePosts && availablePosts.length > 0) {
            availablePosts.forEach(post => {
                html += createPostCard(post, 'available');
            });
        }
        
        // 足りません投稿
        if (neededPosts && neededPosts.length > 0) {
            neededPosts.forEach(post => {
                html += createPostCard(post, 'needed');
            });
        }
        
        if (html === '') {
            html = '<p>まだ投稿がありません</p>';
        }
        
        postsList.innerHTML = html;
        
    } catch (error) {
        console.error('投稿読み込みエラー:', error);
        postsList.innerHTML = '<p>投稿の読み込みに失敗しました</p>';
    }
}

// 投稿カードを作成
function createPostCard(post, type) {
    const company = post.companies;
    const date = new Date(post.post_date).toLocaleDateString('ja-JP');
    const typeLabel = type === 'available' ? '🔵 人が余ってます' : '🔴 人が足りません';
    const cardClass = type === 'available' ? '' : 'needed';
    
    return `
        <div class="post-card ${cardClass}">
            <div class="post-header">
                <div>
                    <div class="company-name">${company.company_name}</div>
                    <div class="post-date">${typeLabel} - ${date}</div>
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
                ${type === 'needed' && post.job_type ? `
                <div class="detail-item">
                    <span class="detail-label">業務内容</span>
                    <span class="detail-value">${post.job_type}</span>
                </div>
                ` : ''}
            </div>
            ${post.note ? `<div class="post-note">備考: ${post.note}</div>` : ''}
            <div class="contact-info">
                <div>📞 ${company.phone}</div>
                <div>👤 ${company.contact_person} (${company.contact_phone})</div>
            </div>
        </div>
    `;
}

// 投稿フォーム表示（仮）
function showPostForm(type) {
    const typeText = type === 'available' ? '人が余ってます' : '人が足りません';
    alert(`${typeText}の投稿フォームは開発中です。\n電話で連絡をお願いします。`);
}