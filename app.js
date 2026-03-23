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
            const loginBtn = loginForm.querySelector('.btn-login');
            
            loginBtn.textContent = 'ログイン中...';
            loginBtn.disabled = true;
            
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
                    loginBtn.textContent = 'ログイン';
                    loginBtn.disabled = false;
                    return;
                }
                
                sessionStorage.setItem('currentUser', JSON.stringify(data));
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                console.error('ログインエラー:', error);
                errorMessage.textContent = 'ログインに失敗しました';
                errorMessage.classList.add('show');
                loginBtn.textContent = 'ログイン';
                loginBtn.disabled = false;
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
        
        // 管理者リンク表示
        if (getUserRole(currentUser) === 'admin') {
            const adminLink = document.getElementById('adminLink');
            if (adminLink) adminLink.style.display = 'inline-block';
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
        
        // フィルター初期設定
        initFilters();
        
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
// ========================================
function getUserRole(user) {
    if (user.role) return user.role;
    const adminLoginIds = ['ats', 'ats_mori', 'ats_kashiko'];
    if (adminLoginIds.includes(user.login_id)) return 'admin';
    return 'member';
}

// ========================================
// フィルター機能
// ========================================
function initFilters() {
    const filterDate = document.getElementById('filterDate');
    const filterArea = document.getElementById('filterArea');
    const filterType = document.getElementById('filterType');
    const filterClear = document.getElementById('filterClear');
    
    if (filterDate) {
        filterDate.addEventListener('change', () => loadPosts());
    }
    if (filterArea) {
        filterArea.addEventListener('change', () => loadPosts());
    }
    if (filterType) {
        filterType.addEventListener('change', () => loadPosts());
    }
    if (filterClear) {
        filterClear.addEventListener('click', () => {
            if (filterDate) filterDate.value = '';
            if (filterArea) filterArea.value = '';
            if (filterType) filterType.value = '';
            loadPosts();
        });
    }
}

function getFilters() {
    return {
        date: document.getElementById('filterDate')?.value || '',
        area: document.getElementById('filterArea')?.value || '',
        type: document.getElementById('filterType')?.value || ''
    };
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
    
    const shiftLabels = { 'day': '日勤', 'night': '夜勤', 'both': 'どちらでも' };
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = '送信中...';
    submitBtn.disabled = true;
    
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
            submitBtn.textContent = '投稿する';
            submitBtn.disabled = false;
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
        
        submitBtn.textContent = '投稿する';
        submitBtn.disabled = false;
        
        await loadPosts();
        
    } catch (error) {
        console.error('投稿エラー:', error);
        alert('投稿に失敗しました。');
        submitBtn.textContent = '投稿する';
        submitBtn.disabled = false;
    }
}

// ========================================
// 投稿削除機能
// ========================================
window.deletePost = async (postId, tableName) => {
    if (!confirm('この投稿を削除しますか？')) return;
    
    try {
        const { error } = await supabaseClient
            .from(tableName)
            .delete()
            .eq('id', postId);
        
        if (error) {
            console.error('削除エラー:', error);
            alert('削除に失敗しました。');
            return;
        }
        
        // 削除成功のフィードバック
        const card = document.querySelector(`[data-post-id="${postId}"]`);
        if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'translateX(-20px)';
            setTimeout(() => loadPosts(), 300);
        } else {
            await loadPosts();
        }
        
    } catch (error) {
        console.error('削除エラー:', error);
        alert('削除に失敗しました。');
    }
};

// ========================================
// 投稿一覧を読み込み（roleベースの表示制御 + フィルター）
// ========================================
async function loadPosts() {
    const postsList = document.getElementById('postsList');
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const role = getUserRole(currentUser);
    const filters = getFilters();
    
    // ローディング表示
    postsList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>読み込み中...</p></div>';
    
    try {
        let availableQuery = supabaseClient
            .from('posts_available')
            .select('*')
            .gte('post_date', new Date().toISOString().split('T')[0])
            .order('post_date', { ascending: true });
        
        let neededQuery = supabaseClient
            .from('posts_needed')
            .select('*')
            .gte('post_date', new Date().toISOString().split('T')[0])
            .order('post_date', { ascending: true });
        
        // フィルター適用
        if (filters.date) {
            availableQuery = availableQuery.eq('post_date', filters.date);
            neededQuery = neededQuery.eq('post_date', filters.date);
        }
        if (filters.area) {
            availableQuery = availableQuery.eq('area', filters.area);
            neededQuery = neededQuery.eq('area', filters.area);
        }
        
        const { data: availablePosts, error: availableError } = await availableQuery;
        const { data: neededPosts, error: neededError } = await neededQuery;
        
        if (availableError || neededError) {
            displayDummyData(postsList, role, currentUser);
            return;
        }
        
        let filteredAvailable = availablePosts || [];
        let filteredNeeded = neededPosts || [];
        
        // タイプフィルター
        if (filters.type === 'available') {
            filteredNeeded = [];
        } else if (filters.type === 'needed') {
            filteredAvailable = [];
        }
        
        if (filteredAvailable.length === 0 && filteredNeeded.length === 0) {
            if (filters.date || filters.area || filters.type) {
                postsList.innerHTML = '<div class="no-results"><p>🔍 条件に一致する投稿がありません</p><p class="no-results-sub">フィルターを変更してお試しください</p></div>';
            } else {
                displayDummyData(postsList, role, currentUser);
            }
            return;
        }
        
        displayPosts(postsList, filteredAvailable, filteredNeeded, role, currentUser);
        
    } catch (error) {
        displayDummyData(postsList, role, currentUser);
    }
}

// ========================================
// 投稿を表示（roleベースの分岐）
// ========================================
function displayPosts(container, availablePosts, neededPosts, role, currentUser) {
    const shiftIcons = { 'day': '☀️ 日勤', 'night': '🌙 夜勤', 'both': '🔄 どちらでも' };
    
    if (role === 'admin') {
        let html = '';
        const totalAvailable = availablePosts.reduce((sum, p) => sum + p.people_count, 0);
        const totalNeeded = neededPosts.reduce((sum, p) => sum + p.people_count, 0);
        html += createSummaryPanel(totalAvailable, totalNeeded, availablePosts.length, neededPosts.length);
        
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
        let html = '';
        const totalAvailable = availablePosts.reduce((sum, p) => sum + p.people_count, 0);
        const totalNeeded = neededPosts.reduce((sum, p) => sum + p.people_count, 0);
        html += createSummaryPanel(totalAvailable, totalNeeded, availablePosts.length, neededPosts.length);
        html += createContactATSBanner();
        
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
// サマリーパネル
// ========================================
function createSummaryPanel(totalAvailable, totalNeeded, availableCount, neededCount) {
    const matchStatus = totalAvailable > 0 && totalNeeded > 0
        ? '<div class="match-hint">💡 マッチングの可能性があります</div>'
        : '';
    
    return `
        <div class="summary-panel">
            <h3 class="summary-title">📊 サマリー</h3>
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
            ${matchStatus}
        </div>
    `;
}

// ========================================
// ATS問い合わせバナー（member向け）
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
// 投稿カード（削除ボタン付き）
// ========================================
function createPostCard(post, type, shiftIcons, role, currentUser) {
    const date = new Date(post.post_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
    const shiftLabel = shiftIcons[post.shift_type] || post.shift_type;
    const isOwnPost = currentUser && post.company_id === currentUser.id;
    const isAdmin = role === 'admin';
    
    const companyDisplay = (isAdmin || isOwnPost) ? post.company_name : '';
    
    let contactHtml = '';
    if (isAdmin) {
        contactHtml = `
            <div class="contact-info">
                <div>📞 ${post.phone || '—'}</div>
                <div>👤 ${post.contact_person || '—'} ${post.contact_phone ? '(' + post.contact_phone + ')' : ''}</div>
            </div>
        `;
    } else if (isOwnPost) {
        contactHtml = '<div class="own-post-label">✅ 自社の投稿</div>';
    }
    
    // 削除ボタン（自社投稿 or admin）
    const tableName = type === 'available' ? 'posts_available' : 'posts_needed';
    const deleteBtn = (isOwnPost || isAdmin)
        ? `<button class="btn-delete" onclick="deletePost('${post.id}', '${tableName}')" title="削除">🗑️</button>`
        : '';
    
    // 投稿からの経過時間
    const createdAt = post.created_at ? getTimeAgo(new Date(post.created_at)) : '';
    
    return `
        <div class="post-card ${type}${isOwnPost ? ' own-post' : ''}" data-post-id="${post.id}">
            <div class="post-header">
                <div>
                    ${companyDisplay ? `<div class="company-name">${companyDisplay}</div>` : ''}
                    <div class="post-date">${date}${createdAt ? ` <span class="time-ago">（${createdAt}）</span>` : ''}</div>
                </div>
                <div class="post-header-right">
                    <div class="shift-badge ${post.shift_type}">${shiftLabel}</div>
                    ${deleteBtn}
                </div>
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

// 経過時間表示
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return '';
}

// ========================================
// ダミーデータ表示
// ========================================
function displayDummyData(container, role, currentUser) {
    const dummyData = {
        available: [
            { id: 'd1', company_id: 'dummy_1', company_name: '全九州警備', post_date: getDateString(1), shift_type: 'day', people_count: 2, area: '福岡市中央区', job_type: '施設警備', note: '経験3年以上のベテラン2名', phone: '092-XXX-XXXX', contact_person: '田中', contact_phone: '090-XXXX-XXXX', created_at: new Date(Date.now() - 3600000).toISOString() },
            { id: 'd2', company_id: 'dummy_2', company_name: 'サンクス警備', post_date: getDateString(2), shift_type: 'night', people_count: 1, area: '福岡市博多区', job_type: '巡回警備', note: null, phone: '092-XXX-XXXX', contact_person: '佐藤', contact_phone: '090-XXXX-XXXX', created_at: new Date(Date.now() - 7200000).toISOString() },
            { id: 'd3', company_id: 'dummy_3', company_name: 'ATセキュリティ', post_date: getDateString(3), shift_type: 'both', people_count: 3, area: '北九州市', job_type: 'イベント警備', note: 'イベント経験豊富なスタッフ', phone: '092-441-6900', contact_person: '本田', contact_phone: '080-0000-0000', created_at: new Date(Date.now() - 10800000).toISOString() }
        ],
        needed: [
            { id: 'd4', company_id: 'dummy_4', company_name: '博多警備保障', post_date: getDateString(1), shift_type: 'day', people_count: 3, area: '福岡市博多区', job_type: '交通誘導', note: '急募！工事現場の増員', phone: '092-XXX-XXXX', contact_person: '山本', contact_phone: '090-XXXX-XXXX', created_at: new Date(Date.now() - 1800000).toISOString() },
            { id: 'd5', company_id: 'dummy_5', company_name: '九州セキュリティ', post_date: getDateString(2), shift_type: 'night', people_count: 2, area: '福岡市中央区', job_type: '施設警備', note: null, phone: '092-XXX-XXXX', contact_person: '中村', contact_phone: '090-XXXX-XXXX', created_at: new Date(Date.now() - 5400000).toISOString() }
        ]
    };
    
    const shiftIcons = { 'day': '☀️ 日勤', 'night': '🌙 夜勤', 'both': '🔄 どちらでも' };
    let html = '<div class="demo-notice">📌 デモ用サンプルデータを表示中</div>';
    
    if (role === 'admin') {
        const totalAvailable = dummyData.available.reduce((sum, p) => sum + p.people_count, 0);
        const totalNeeded = dummyData.needed.reduce((sum, p) => sum + p.people_count, 0);
        html += createSummaryPanel(totalAvailable, totalNeeded, dummyData.available.length, dummyData.needed.length);
        
        html += '<h3 class="section-title available-title">🔵 人が余ってます</h3>';
        dummyData.available.forEach(post => { html += createPostCard(post, 'available', shiftIcons, role, currentUser); });
        
        html += '<h3 class="section-title needed-title">🔴 人が足りません</h3>';
        dummyData.needed.forEach(post => { html += createPostCard(post, 'needed', shiftIcons, role, currentUser); });
    } else {
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
