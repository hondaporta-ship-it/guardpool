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

// 投稿一覧を読み込み
async function loadPosts() {
    const postsList = document.getElementById('postsList');
    
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
            displayDummyData(postsList);
            return;
        }
        
        if ((!availablePosts || availablePosts.length === 0) && (!neededPosts || neededPosts.length === 0)) {
            displayDummyData(postsList);
            return;
        }
        
        displayPosts(postsList, availablePosts || [], neededPosts || []);
        
    } catch (error) {
        displayDummyData(postsList);
    }
}

// 投稿を表示
function displayPosts(container, availablePosts, neededPosts) {
    let html = '';
    const shiftIcons = { 'day': '☀️ 日勤', 'night': '🌙 夜勤', 'both': '🔄 どちらでも' };
    
    if (availablePosts.length > 0) {
        html += '<h3 class="section-title available-title">🔵 人が余ってます</h3>';
        availablePosts.forEach(post => { html += createPostCard(post, 'available', shiftIcons); });
    }
    
    if (neededPosts.length > 0) {
        html += '<h3 class="section-title needed-title">🔴 人が足りません</h3>';
        neededPosts.forEach(post => { html += createPostCard(post, 'needed', shiftIcons); });
    }
    
    container.innerHTML = html;
}

// 投稿カードを作成
function createPostCard(post, type, shiftIcons) {
    const date = new Date(post.post_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
    const shiftLabel = shiftIcons[post.shift_type] || post.shift_type;
    
    return `
        <div class="post-card ${type}">
            <div class="post-header">
                <div>
                    <div class="company-name">${post.company_name}</div>
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
            <div class="contact-info">
                <div>📞 ${post.phone}</div>
                <div>👤 ${post.contact_person} (${post.contact_phone})</div>
            </div>
        </div>
    `;
}

// ダミーデータを表示
function displayDummyData(container) {
    const dummyData = {
        available: [
            { company_name: '全九州警備', post_date: getDateString(1), shift_type: 'day', people_count: 2, area: '福岡市中央区', job_type: '施設警備', note: '経験3年以上のベテラン2名', phone: '092-XXX-XXXX', contact_person: '田中', contact_phone: '090-XXXX-XXXX' },
            { company_name: 'サンクス警備', post_date: getDateString(2), shift_type: 'night', people_count: 1, area: '福岡市博多区', job_type: '巡回警備', note: null, phone: '092-XXX-XXXX', contact_person: '佐藤', contact_phone: '090-XXXX-XXXX' },
            { company_name: 'ATセキュリティ', post_date: getDateString(3), shift_type: 'both', people_count: 3, area: '北九州市', job_type: 'イベント警備', note: 'イベント経験豊富なスタッフ', phone: '092-XXX-XXXX', contact_person: '本田', contact_phone: '090-XXXX-XXXX' }
        ],
        needed: [
            { company_name: '博多警備保障', post_date: getDateString(1), shift_type: 'day', people_count: 3, area: '福岡市博多区', job_type: '交通誘導', note: '急募！工事現場の増員', phone: '092-XXX-XXXX', contact_person: '山本', contact_phone: '090-XXXX-XXXX' },
            { company_name: '九州セキュリティ', post_date: getDateString(2), shift_type: 'night', people_count: 2, area: '福岡市中央区', job_type: '施設警備', note: null, phone: '092-XXX-XXXX', contact_person: '中村', contact_phone: '090-XXXX-XXXX' }
        ]
    };
    
    const shiftIcons = { 'day': '☀️ 日勤', 'night': '🌙 夜勤', 'both': '🔄 どちらでも' };
    let html = '<div class="demo-notice">📌 デモ用サンプルデータを表示中</div>';
    
    html += '<h3 class="section-title available-title">🔵 人が余ってます</h3>';
    dummyData.available.forEach(post => { html += createPostCard(post, 'available', shiftIcons); });
    
    html += '<h3 class="section-title needed-title">🔴 人が足りません</h3>';
    dummyData.needed.forEach(post => { html += createPostCard(post, 'needed', shiftIcons); });
    
    container.innerHTML = html;
}

function getDateString(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
}