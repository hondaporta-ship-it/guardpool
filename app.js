// Supabaseクライアント初期化
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ページ読み込み時の処理
document.addEventListener('DOMContentLoaded', async () => {
    
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
        
        // 今日の日付をデフォルト設定
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        document.getElementById('postDate').value = todayStr;
        document.getElementById('postDate').min = todayStr;
        
        // 投稿一覧を読み込み
        await loadPosts();
        
        // 投稿フォーム送信処理
        const postForm = document.getElementById('postForm');
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitPost(currentUser);
        });
    }
});

// 投稿フォームを表示
window.showPostForm = (type) => {
    const modal = document.getElementById('postModal');
    const modalTitle = document.getElementById('modalTitle');
    const submitBtn = document.getElementById('submitBtn');
    const postTypeInput = document.getElementById('postType');
    
    postTypeInput.value = type;
    
    if (type === 'available') {
        modalTitle.textContent = '🔵 人が余ってます';
        modalTitle.style.color = '#3b82f6';
        submitBtn.textContent = '余剰を投稿する';
        submitBtn.className = 'btn-submit btn-submit-available';
    } else {
        modalTitle.textContent = '🔴 人が足りません';
        modalTitle.style.color = '#ef4444';
        submitBtn.textContent = '不足を投稿する';
        submitBtn.className = 'btn-submit btn-submit-needed';
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
};

// モーダルを閉じる
window.closeModal = () => {
    const modal = document.getElementById('postModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    document.getElementById('postForm').reset();
    
    // 今日の日付を再設定
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('postDate').value = today;
};

// 成功メッセージを閉じる
window.closeSuccessMessage = () => {
    document.getElementById('successMessage').classList.remove('show');
};

// 投稿を送信
async function submitPost(currentUser) {
    const postType = document.getElementById('postType').value;
    const postDate = document.getElementById('postDate').value;
    const shiftType = document.querySelector('input[name="shiftType"]:checked').value;
    const peopleCount = document.getElementById('peopleCount').value;
    const area = document.getElementById('area').value;
    const jobType = document.getElementById('jobType').value;
    const note = document.getElementById('note').value;
    
    // 勤務時間帯のラベル
    const shiftLabels = {
        'day': '日勤',
        'night': '夜勤',
        'both': 'どちらでも'
    };
    
    const postData = {
        company_id: currentUser.id,
        company_name: currentUser.company_name,
        post_date: postDate,
        shift_type: shiftType,
        people_count: parseInt(peopleCount),
        area: area,
        job_type: jobType,
        note: note || null,
        phone: currentUser.phone,
        contact_person: currentUser.contact_person,
        contact_phone: currentUser.contact_phone,
        created_at: new Date().toISOString()
    };
    
    // テーブル名を決定
    const tableName = postType === 'available' ? 'posts_available' : 'posts_needed';
    
    try {
        const { data, error } = await supabaseClient
            .from(tableName)
            .insert([postData]);
        
        if (error) {
            console.error('投稿エラー:', error);
            alert('投稿に失敗しました。もう一度お試しください。');
            return;
        }
        
        // 成功メッセージ
        closeModal();
        
        const typeText = postType === 'available' ? '🔵 人が余ってます' : '🔴 人が足りません';
        const dateFormatted = new Date(postDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
        
        document.getElementById('successDetail').innerHTML = `
            <strong>${typeText}</strong><br>
            ${dateFormatted} / ${shiftLabels[shiftType]} / ${peopleCount}名 / ${area}
        `;
        document.getElementById('successMessage').classList.add('show');
        
        // 投稿一覧を更新
        await loadPosts();
        
    } catch (error) {
        console.error('投稿エラー:', error);
        alert('投稿に失敗しました。');
    }
}

// 投稿一覧を読み込み
async function loadPosts() {
    const postsList = document.getElementById('postsList');
    
    try {
        // 「人が余ってます」を取得
        const { data: availablePosts, error: availableError } = await supabaseClient
            .from('posts_available')