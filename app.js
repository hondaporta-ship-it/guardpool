// Supabaseクライアント初期化
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========================================
// 権限制御: role = 'admin' (ATS) or 'member' (他社)
// admin: 全情報閲覧可能（会社名・連絡先・個別投稿）
// member: 合計サマリー + 自社投稿のみ表示
// ========================================

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
        
        // 権限バッジを表示（admin/member）
        const roleBadge = document.getElementById('roleBadge');
        if (roleBadge) {
            const isAdmin = getUserRole(currentUser) === 'admin';
            roleBadge.textContent = isAdmin ? '管理者' : '一般';
            roleBadge.className = 'role-badge ' + (isAdmin ? 'role-admin' : 'role-member');
        }
        
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

// ========================================
// ユーザーのroleを判定する関数
// companiesテーブルのroleカラムを使用
// roleカラムが未設定の場合はlogin_idで判定（フォールバック）
// ========================================
function getUserRole(user) {
    // roleカラムがある場合はそれを使用
    if (user.role) {
        return user.role;
    }
    // フォールバック: ATSのlogin_idなら管理者
    // （companiesテーブルにroleカラムが追加されるまでの暫定対応）
    const adminLoginIds = ['ats', 'ats_mori', 'ats_kashiko'];
    if (adminLoginIds.includes(user.login_id)) {
        return 'admin';
    }
    return 'member';
}

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
        
        closeModal();
        
        const typeText = postType === 'available' ? '🔵 人が余ってます' : '🔴 人が足りません';
        const dateFormatted = new Date(postDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
        
        document.getElementById('successDetail').innerHTML = `
            <strong>${typeText}</strong><br>
            ${dateFormatted} / ${shiftLabels[shiftType]} / ${peopleCount}名 / ${area}
        `;
        document.getElementById('successMessage').classList.add('show');
        
        await loadPosts();
        
    } catch (error) {
        console.error('投稿エラー:', error);
        alert('投稿に失敗しました。');
    }
}

// ========================================
// 投稿一覧を読み込み（roleベースの表示制御）
// ========================================
async function loadPosts() {
    const postsList = document.getElementById('postsList');
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const role = getUserRole(currentUser);
    
    try {
        const { data: availablePosts, error: availableError } = await supabaseClient
            .from('posts_available')
            .select('*')
            .gte('post_date', new Date().toISOString().split('T')[0])
            .order('post_date', { ascending: true });
        
        const { data: neededPosts, error: neededError } = await supabaseClient
            .from('posts_needed')
            .select('*')
            .gte('post_date', new Date().toISOString().split('T')[0])
            .order('post_date', { ascending: true });
        
        if (availableError || neededError) {
            displayDummyData(postsList, role, currentUser);
            return;
        }
        
        if ((!availablePosts || availablePosts.length === 0) && (!neededPosts || neededPosts.length === 0)) {
            displayDummyData(postsList, role, currentUser);
            return;
        }
        
        displayPosts(postsList, availablePosts || [], neededPosts || [], role, currentUser);
        
    } catch (error) {
        displayDummyData(postsList, role, currentUser);
    }
}

// ========================================
// 投稿を表示（roleベースの分岐）
// admin: 全投稿の個別カード表示（会社名・連絡先含む）
// member: 合計サマリー + 自社投稿の個別表示
// ========================================
function displayPosts(container, availablePosts, neededPosts, role, currentUser) {
    const shiftIcons = { 'day': '☀️ 日勤', 'night': '🌙 夜勤', 'both': '🔄 どちらでも' };
    
    if (role === 'admin') {
        // ======== 管理者表示: サマリー + 全投稿の詳細 ========
        let html = '';
        
        // サマリーパネル（管理者にも合計を表示）
        const totalAvailable = availablePosts.reduce((sum, p) => sum + p.people_count, 0);
        const totalNeeded = neededPosts.reduce((sum, p) => sum + p.people_count, 0);
        html += createSummaryPanel(totalAvailable, totalNeeded, availablePosts.length, neededPosts.length);
        
        // 個別投稿カード（全情報表示）
        if (availablePosts.length > 0) {
            html += '<h3 class="section-title available-title">🔵 人が余ってます</h3>';
            availablePosts.forEach(post => { html += createPostCard(post, 'available', shiftIcons, role, currentUser); });
        }
        
        if (neededPosts.length > 0) {
            html += '<h3 class="section-title needed-title">🔴 人が足りません</h3>';
            neededPosts.forEach(post => { html += createPostCard(post, 'needed', shiftIcons, role, currentUser); });
        }
        
        container.innerHTML = html;
    } else {
        // ======== 一般ユーザー表示: サマリー + 自社投稿のみ ========
        let html = '';
        
        // 合計サマリー（どの会社かは見えない）
        const totalAvailable = availablePosts.reduce((sum, p) => sum + p.people_count, 0);
        const totalNeeded = neededPosts.reduce((sum, p) => sum + p.people_count, 0);
        html += createSummaryPanel(totalAvailable, totalNeeded, availablePosts.length, neededPosts.length);
        
        // ATS問い合わせ案内
        html += createContactATSBanner();
        
        // 自社の投稿のみ個別表示
        const myAvailable = availablePosts.filter(p => p.company_id === currentUser.id);
        const myNeeded = neededPosts.filter(p => p.company_id === currentUser.id);
        
        if (myAvailable.length > 0 || myNeeded.length > 0) {
            html += '<h3 class="section-title own-posts-title">📌 自社の投稿</h3>';
            myAvailable.forEach(post => { html += createPostCard(post, 'available', shiftIcons, role, currentUser); });
            myNeeded.forEach(post => { html += createPostCard(post, 'needed', shiftIcons, role, currentUser); });
        }
        
        container.innerHTML = html;
    }
}

// ========================================
// サマリーパネルを生成
// 余剰・不足の合計人数を表示
// ========================================
function createSummaryPanel(totalAvailable, totalNeeded, availableCount, neededCount) {
    return `
        <div class="summary-panel">
            <h3 class="summary-title">📊 本日のサマリー</h3>
            <div class="summary-cards">
                <div class="summary-card summary-available">
                    <div class="summary-icon">🔵</div>
                    <div class="summary-info">
                        <div class="summary-label">余剰人員</div>
                        <div class="summary-value">${totalAvailable}<span class="summary-unit">名</span></div>
                        <div class="summary-sub">${availableCount}社から投稿</div>
                    </div>
                </div>
                <div class="summary-card summary-needed">
                    <div class="summary-icon">🔴</div>
                    <div class="summary-info">
                        <div class="summary-label">不足人員</div>
                        <div class="summary-value">${totalNeeded}<span class="summary-unit">名</span></div>
                        <div class="summary-sub">${neededCount}社から投稿</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// ATS問い合わせバナー（member向け）
// 直接やり取りさせず、すべてATS経由
// ========================================
function createContactATSBanner() {
    return `
        <div class="ats-contact-banner">
            <div class="ats-contact-icon">📞</div>
            <div class="ats-contact-text">
                <strong>人員の調整はATSが仲介いたします</strong>
                <p>余剰・不足の詳細やマッチングについては、ATセキュリティまでお問い合わせください。</p>
                <p class="ats-contact-info">📞 ATセキュリティ ☎ 092-409-3735</p>
            </div>
        </div>
    `;
}

// ========================================
// 投稿カードを作成（roleに応じて表示内容を変更）
// admin: 会社名・連絡先を含む全情報
// member: 自社投稿のみ表示（連絡先は自社のもののみ）
// ========================================
function createPostCard(post, type, shiftIcons, role, currentUser) {
    const date = new Date(post.post_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
    const shiftLabel = shiftIcons[post.shift_type] || post.shift_type;
    const isOwnPost = currentUser && post.company_id === currentUser.id;
    
    // 会社名: adminは全表示、memberは自社のみ表示
    const companyDisplay = (role === 'admin' || isOwnPost) ? post.company_name : '';
    
    // 連絡先: adminは全表示、memberには非表示（自社投稿でも連絡先は自分のなので不要）
    let contactHtml = '';
    if (role === 'admin') {
        // 管理者: 全連絡先表示
        contactHtml = `
            <div class="contact-info">
                <div>📞 ${post.phone}</div>
                <div>👤 ${post.contact_person} (${post.contact_phone})</div>
            </div>
        `;
    } else if (isOwnPost) {
        // 一般ユーザーの自社投稿: 連絡先は省略（自分の情報なので）
        contactHtml = '<div class="own-post-label">✅ 自社の投稿</div>';
    }
    
    return `
        <div class="post-card ${type}${isOwnPost ? ' own-post' : ''}">
            <div class="post-header">
                <div>
                    ${companyDisplay ? `<div class="company-name">${companyDisplay}</div>` : ''}
                    <div class="post-date">${date}</div>
                </div>
                <div class="shift-badge ${post.shift_type}">${shiftLabel}</div>
            </div>
            <div class="post-details">
                <div class="detail-item">
                    <span class="detail-label">${type === 'available' ? '余剰人数' : '必要人数'}</span>
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
            ${post.note ? `<div class="post-note">📝 ${post.note}</div>` : ''}
            ${contactHtml}
        </div>
    `;
}

// ========================================
// ダミーデータを表示（テーブル未作成時のフォールバック）
// roleベースの表示制御にも対応
// ========================================
function displayDummyData(container, role, currentUser) {
    const dummyData = {
        available: [
            { company_id: 'dummy_1', company_name: '全九州警備', post_date: getDateString(1), shift_type: 'day', people_count: 2, area: '福岡市中央区', job_type: '施設警備', note: '経験3年以上のベテラン2名', phone: '092-XXX-XXXX', contact_person: '田中', contact_phone: '090-XXXX-XXXX' },
            { company_id: 'dummy_2', company_name: 'サンクス警備', post_date: getDateString(2), shift_type: 'night', people_count: 1, area: '福岡市博多区', job_type: '巡回警備', note: null, phone: '092-XXX-XXXX', contact_person: '佐藤', contact_phone: '090-XXXX-XXXX' },
            { company_id: 'dummy_3', company_name: 'ATセキュリティ', post_date: getDateString(3), shift_type: 'both', people_count: 3, area: '北九州市', job_type: 'イベント警備', note: 'イベント経験豊富なスタッフ', phone: '092-XXX-XXXX', contact_person: '本田', contact_phone: '090-XXXX-XXXX' }
        ],
        needed: [
            { company_id: 'dummy_4', company_name: '博多警備保障', post_date: getDateString(1), shift_type: 'day', people_count: 3, area: '福岡市博多区', job_type: '交通誘導', note: '急募！工事現場の増員', phone: '092-XXX-XXXX', contact_person: '山本', contact_phone: '090-XXXX-XXXX' },
            { company_id: 'dummy_5', company_name: '九州セキュリティ', post_date: getDateString(2), shift_type: 'night', people_count: 2, area: '福岡市中央区', job_type: '施設警備', note: null, phone: '092-XXX-XXXX', contact_person: '中村', contact_phone: '090-XXXX-XXXX' }
        ]
    };
    
    const shiftIcons = { 'day': '☀️ 日勤', 'night': '🌙 夜勤', 'both': '🔄 どちらでも' };
    let html = '<div class="demo-notice">📌 デモ用サンプルデータを表示中</div>';
    
    if (role === 'admin') {
        // 管理者: サマリー + 全投稿の個別表示
        const totalAvailable = dummyData.available.reduce((sum, p) => sum + p.people_count, 0);
        const totalNeeded = dummyData.needed.reduce((sum, p) => sum + p.people_count, 0);
        html += createSummaryPanel(totalAvailable, totalNeeded, dummyData.available.length, dummyData.needed.length);
        
        html += '<h3 class="section-title available-title">🔵 人が余ってます</h3>';
        dummyData.available.forEach(post => { html += createPostCard(post, 'available', shiftIcons, role, currentUser); });
        
        html += '<h3 class="section-title needed-title">🔴 人が足りません</h3>';
        dummyData.needed.forEach(post => { html += createPostCard(post, 'needed', shiftIcons, role, currentUser); });
    } else {
        // 一般ユーザー: サマリーのみ（ダミーデータなので自社投稿なし）
        const totalAvailable = dummyData.available.reduce((sum, p) => sum + p.people_count, 0);
        const totalNeeded = dummyData.needed.reduce((sum, p) => sum + p.people_count, 0);
        html += createSummaryPanel(totalAvailable, totalNeeded, dummyData.available.length, dummyData.needed.length);
        html += createContactATSBanner();
        html += '<p class="no-own-posts">自社の投稿はまだありません。上のボタンから投稿できます。</p>';
    }
    
    container.innerHTML = html;
}

function getDateString(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
}
