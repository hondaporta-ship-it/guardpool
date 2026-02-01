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
        
        // 投稿一覧読み込み
        const postsList = document.getElementById('postsList');
        postsList.innerHTML = '<p>まだ投稿がありません</p>';
        
        // 投稿フォーム表示（仮）
        window.showPostForm = (type) => {
            const typeText = type === 'available' ? '人が余ってます' : '人が足りません';
            alert(`${typeText}の投稿フォームは開発中です。\n電話で連絡をお願いします。`);
        };
    }
});