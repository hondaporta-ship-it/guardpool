// ========================================
// ガードプール 管理者パネル
// ========================================

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let allCompanies = [];

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = JSON.parse(userStr);
    const role = getUserRole(currentUser);

    if (role !== 'admin') {
        alert('管理者権限が必要です。');
        window.location.href = 'dashboard.html';
        return;
    }

    document.getElementById('companyName').textContent = currentUser.company_name;

    // 全データ読み込み
    await Promise.all([
        loadDashboardStats(),
        loadCompanies(),
    ]);
});

function getUserRole(user) {
    if (user.role) return user.role;
    const adminLoginIds = ['ats', 'ats_mori', 'ats_kashiko'];
    if (adminLoginIds.includes(user.login_id)) return 'admin';
    return 'member';
}

function logout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// ========================================
// タブ切り替え
// ========================================
function switchTab(tabId) {
    // タブボタン
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.admin-tab[data-tab="${tabId}"]`).classList.add('active');

    // タブセクション
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // 遅延ロード
    if (tabId === 'posts') loadAdminPosts();
    if (tabId === 'matching') loadMatching();
    if (tabId === 'announcements') loadAnnouncements();
}

// ========================================
// ダッシュボード統計
// ========================================
async function loadDashboardStats() {
    try {
        const [companiesRes, availableRes, neededRes] = await Promise.all([
            supabaseClient.from('companies').select('id, company_name, login_id', { count: 'exact' }),
            supabaseClient.from('posts_available').select('*'),
            supabaseClient.from('posts_needed').select('*'),
        ]);

        const companies = companiesRes.data || [];
        const available = availableRes.data || [];
        const needed = neededRes.data || [];

        document.getElementById('statCompanies').textContent = companies.length;
        document.getElementById('statAvailable').textContent = available.length;
        document.getElementById('statNeeded').textContent = needed.length;

        // アクティブ企業（直近7日で投稿したユニークなcompany_id）
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentIds = new Set();
        [...available, ...needed].forEach(p => {
            if (new Date(p.created_at) >= sevenDaysAgo) {
                recentIds.add(p.company_id);
            }
        });
        document.getElementById('statActiveUsers').textContent = recentIds.size;

        // 直近7日間チャート
        renderWeeklyChart(available, needed);

        // エリア別統計
        renderAreaStats(available, needed);

    } catch (err) {
        console.error('統計読み込みエラー:', err);
    }
}

function renderWeeklyChart(available, needed) {
    const container = document.getElementById('weeklyChart');
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    let html = '<div class="chart-rows">';
    const maxCount = Math.max(
        ...days.map(d => {
            const a = available.filter(p => p.created_at && p.created_at.startsWith(d)).length;
            const n = needed.filter(p => p.created_at && p.created_at.startsWith(d)).length;
            return a + n;
        }),
        1
    );

    days.forEach(d => {
        const date = new Date(d);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        const a = available.filter(p => p.created_at && p.created_at.startsWith(d)).length;
        const n = needed.filter(p => p.created_at && p.created_at.startsWith(d)).length;
        const aPct = (a / maxCount) * 100;
        const nPct = (n / maxCount) * 100;

        html += `
            <div class="chart-row">
                <span class="chart-label">${label}</span>
                <div class="chart-bars">
                    <div class="chart-bar bar-blue" style="width:${aPct}%">${a > 0 ? a : ''}</div>
                    <div class="chart-bar bar-red" style="width:${nPct}%">${n > 0 ? n : ''}</div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    html += '<div class="chart-legend"><span class="legend-blue">🔵 余剰</span><span class="legend-red">🔴 不足</span></div>';
    container.innerHTML = html;
}

function renderAreaStats(available, needed) {
    const container = document.getElementById('areaStats');
    const areaMap = {};

    [...available, ...needed].forEach(p => {
        if (!areaMap[p.area]) areaMap[p.area] = { available: 0, needed: 0 };
        if (available.includes(p)) areaMap[p.area].available++;
        else areaMap[p.area].needed++;
    });

    // 改めてカウント（includesの参照が壊れうるので直接カウント）
    const areaMap2 = {};
    available.forEach(p => {
        if (!areaMap2[p.area]) areaMap2[p.area] = { available: 0, needed: 0 };
        areaMap2[p.area].available++;
    });
    needed.forEach(p => {
        if (!areaMap2[p.area]) areaMap2[p.area] = { available: 0, needed: 0 };
        areaMap2[p.area].needed++;
    });

    const sorted = Object.entries(areaMap2).sort((a, b) => (b[1].available + b[1].needed) - (a[1].available + a[1].needed));

    if (sorted.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;padding:1rem">データがありません</p>';
        return;
    }

    let html = '<div class="area-list">';
    sorted.forEach(([area, counts]) => {
        html += `
            <div class="area-row">
                <span class="area-name">${area}</span>
                <span class="area-counts">
                    <span class="area-avail">🔵 ${counts.available}</span>
                    <span class="area-need">🔴 ${counts.needed}</span>
                </span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ========================================
// 企業管理
// ========================================
async function loadCompanies() {
    try {
        const { data, error } = await supabaseClient
            .from('companies')
            .select('*')
            .order('company_name');

        if (error) throw error;
        allCompanies = data || [];
        renderCompaniesTable(allCompanies);
    } catch (err) {
        console.error('企業読み込みエラー:', err);
        document.getElementById('companiesBody').innerHTML = '<tr><td colspan="6" class="table-loading">読み込みに失敗しました</td></tr>';
    }
}

function renderCompaniesTable(companies) {
    const tbody = document.getElementById('companiesBody');
    if (companies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-loading">企業が登録されていません</td></tr>';
        return;
    }

    tbody.innerHTML = companies.map(c => {
        const role = c.role || 'member';
        const roleBadge = role === 'admin'
            ? '<span class="role-badge role-admin">管理者</span>'
            : '<span class="role-badge role-member-table">一般</span>';

        return `
            <tr>
                <td class="td-bold">${c.company_name}</td>
                <td><code>${c.login_id}</code></td>
                <td>${roleBadge}</td>
                <td>${c.phone || '—'}</td>
                <td>${c.contact_person || '—'}</td>
                <td class="td-actions">
                    <button class="btn-sm btn-edit" onclick="editCompany('${c.id}')">✏️</button>
                    <button class="btn-sm btn-key" onclick="showPasswordReset('${c.id}', '${escapeHtml(c.company_name)}')">🔑</button>
                    <button class="btn-sm btn-role" onclick="toggleRole('${c.id}', '${role}')" title="${role === 'admin' ? 'memberに変更' : 'adminに変更'}">
                        ${role === 'admin' ? '👑→👤' : '👤→👑'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterCompanies() {
    const q = document.getElementById('companySearch').value.toLowerCase();
    const filtered = allCompanies.filter(c => c.company_name.toLowerCase().includes(q) || c.login_id.toLowerCase().includes(q));
    renderCompaniesTable(filtered);
}

function escapeHtml(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// 企業登録モーダル
function showAddCompanyModal() {
    document.getElementById('companyModalTitle').textContent = '新規企業登録';
    document.getElementById('companyForm').reset();
    document.getElementById('editCompanyId').value = '';
    document.getElementById('companyFormLoginId').disabled = false;
    document.getElementById('companyFormPassword').required = true;
    document.getElementById('companySubmitBtn').textContent = '登録する';
    document.getElementById('companyModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function editCompany(id) {
    const c = allCompanies.find(x => x.id === id);
    if (!c) return;

    document.getElementById('companyModalTitle').textContent = '企業情報編集';
    document.getElementById('editCompanyId').value = c.id;
    document.getElementById('companyFormName').value = c.company_name;
    document.getElementById('companyFormLoginId').value = c.login_id;
    document.getElementById('companyFormLoginId').disabled = true;
    document.getElementById('companyFormPassword').value = c.password || '';
    document.getElementById('companyFormPassword').required = false;
    document.getElementById('companyFormRole').value = c.role || 'member';
    document.getElementById('companyFormPhone').value = c.phone || '';
    document.getElementById('companyFormContact').value = c.contact_person || '';
    document.getElementById('companyFormContactPhone').value = c.contact_phone || '';
    document.getElementById('companySubmitBtn').textContent = '更新する';
    document.getElementById('companyModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeCompanyModal() {
    document.getElementById('companyModal').classList.remove('show');
    document.body.style.overflow = '';
}

async function submitCompany(e) {
    e.preventDefault();
    const editId = document.getElementById('editCompanyId').value;
    const data = {
        company_name: document.getElementById('companyFormName').value,
        login_id: document.getElementById('companyFormLoginId').value,
        role: document.getElementById('companyFormRole').value,
        phone: document.getElementById('companyFormPhone').value || null,
        contact_person: document.getElementById('companyFormContact').value || null,
        contact_phone: document.getElementById('companyFormContactPhone').value || null,
    };

    const pw = document.getElementById('companyFormPassword').value;
    if (pw) data.password = pw;

    try {
        if (editId) {
            const { error } = await supabaseClient.from('companies').update(data).eq('id', editId);
            if (error) throw error;
            alert('企業情報を更新しました。');
        } else {
            if (!pw) { alert('パスワードを入力してください。'); return; }
            data.password = pw;
            const { error } = await supabaseClient.from('companies').insert([data]);
            if (error) throw error;
            alert('企業を登録しました。');
        }
        closeCompanyModal();
        await loadCompanies();
        await loadDashboardStats();
    } catch (err) {
        console.error('企業保存エラー:', err);
        alert('保存に失敗しました: ' + (err.message || err));
    }
}

// 権限トグル
async function toggleRole(id, currentRole) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    if (!confirm(`この企業の権限を「${newRole === 'admin' ? '管理者' : '一般'}」に変更しますか？`)) return;

    try {
        const { error } = await supabaseClient.from('companies').update({ role: newRole }).eq('id', id);
        if (error) throw error;
        await loadCompanies();
    } catch (err) {
        alert('権限変更に失敗しました: ' + (err.message || err));
    }
}

// パスワードリセット
function showPasswordReset(id, name) {
    document.getElementById('resetCompanyId').value = id;
    document.getElementById('resetCompanyLabel').textContent = `企業: ${name}`;
    document.getElementById('newPassword').value = '';
    document.getElementById('passwordModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('show');
    document.body.style.overflow = '';
}

async function submitPasswordReset(e) {
    e.preventDefault();
    const id = document.getElementById('resetCompanyId').value;
    const pw = document.getElementById('newPassword').value;

    try {
        const { error } = await supabaseClient.from('companies').update({ password: pw }).eq('id', id);
        if (error) throw error;
        alert('パスワードをリセットしました。');
        closePasswordModal();
        await loadCompanies();
    } catch (err) {
        alert('パスワードリセットに失敗しました: ' + (err.message || err));
    }
}

// ========================================
// 投稿管理
// ========================================
async function loadAdminPosts() {
    const container = document.getElementById('adminPostsList');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>読み込み中...</p></div>';

    const typeFilter = document.getElementById('adminPostType').value;
    const dateFilter = document.getElementById('adminPostDate').value;

    try {
        let availPosts = [], needPosts = [];

        if (typeFilter !== 'needed') {
            let q = supabaseClient.from('posts_available').select('*').order('created_at', { ascending: false });
            if (dateFilter) q = q.eq('post_date', dateFilter);
            const { data } = await q;
            availPosts = (data || []).map(p => ({ ...p, _type: 'available' }));
        }

        if (typeFilter !== 'available') {
            let q = supabaseClient.from('posts_needed').select('*').order('created_at', { ascending: false });
            if (dateFilter) q = q.eq('post_date', dateFilter);
            const { data } = await q;
            needPosts = (data || []).map(p => ({ ...p, _type: 'needed' }));
        }

        const allPosts = [...availPosts, ...needPosts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (allPosts.length === 0) {
            container.innerHTML = '<div class="no-results"><p>投稿がありません</p></div>';
            return;
        }

        const shiftLabels = { 'day': '☀️ 日勤', 'night': '🌙 夜勤', 'both': '🔄 どちらでも' };

        container.innerHTML = allPosts.map(p => {
            const typeLabel = p._type === 'available' ? '🔵 余剰' : '🔴 不足';
            const typeClass = p._type === 'available' ? 'available' : 'needed';
            const tableName = p._type === 'available' ? 'posts_available' : 'posts_needed';
            const date = new Date(p.post_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
            const createdAt = p.created_at ? new Date(p.created_at).toLocaleString('ja-JP') : '';

            return `
                <div class="post-card ${typeClass}" data-post-id="${p.id}">
                    <div class="post-header">
                        <div>
                            <span class="type-label ${typeClass}">${typeLabel}</span>
                            <span class="company-name">${p.company_name}</span>
                            <div class="post-date">${date}</div>
                        </div>
                        <div class="post-header-right">
                            <span class="shift-badge ${p.shift_type}">${shiftLabels[p.shift_type] || p.shift_type}</span>
                            <button class="btn-delete" onclick="adminDeletePost('${p.id}', '${tableName}')" title="削除">🗑️</button>
                        </div>
                    </div>
                    <div class="post-details">
                        <div class="detail-item">
                            <span class="detail-label">人数</span>
                            <span class="detail-value">${p.people_count}名</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">エリア</span>
                            <span class="detail-value">${p.area}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">業務</span>
                            <span class="detail-value">${p.job_type}</span>
                        </div>
                    </div>
                    ${p.note ? `<div class="post-note">📝 ${p.note}</div>` : ''}
                    <div class="contact-info">
                        <div>📞 ${p.phone || '—'}</div>
                        <div>👤 ${p.contact_person || '—'} ${p.contact_phone ? '(' + p.contact_phone + ')' : ''}</div>
                        <div class="post-meta">投稿: ${createdAt}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('投稿読み込みエラー:', err);
        container.innerHTML = '<div class="no-results"><p>読み込みに失敗しました</p></div>';
    }
}

async function adminDeletePost(id, tableName) {
    if (!confirm('この投稿を削除しますか？')) return;

    try {
        const { error } = await supabaseClient.from(tableName).delete().eq('id', id);
        if (error) throw error;

        const card = document.querySelector(`[data-post-id="${id}"]`);
        if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'translateX(-20px)';
            setTimeout(() => loadAdminPosts(), 300);
        } else {
            await loadAdminPosts();
        }
    } catch (err) {
        alert('削除に失敗しました: ' + (err.message || err));
    }
}

// ========================================
// マッチング検出
// ========================================
async function loadMatching() {
    const container = document.getElementById('matchingList');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>読み込み中...</p></div>';

    try {
        const today = new Date().toISOString().split('T')[0];

        const [availRes, needRes] = await Promise.all([
            supabaseClient.from('posts_available').select('*').gte('post_date', today).order('post_date'),
            supabaseClient.from('posts_needed').select('*').gte('post_date', today).order('post_date'),
        ]);

        const avail = availRes.data || [];
        const need = needRes.data || [];

        // 日付+エリアでマッチング
        const matches = [];
        avail.forEach(a => {
            need.forEach(n => {
                if (a.post_date === n.post_date && a.area === n.area && a.company_id !== n.company_id) {
                    matches.push({ available: a, needed: n });
                }
            });
        });

        if (matches.length === 0) {
            container.innerHTML = '<div class="no-results"><p>🔍 現在マッチングはありません</p><p class="no-results-sub">同日・同エリアの余剰↔不足投稿が見つかると表示されます</p></div>';
            return;
        }

        container.innerHTML = matches.map(m => {
            const date = new Date(m.available.post_date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
            return `
                <div class="match-card">
                    <div class="match-date">📅 ${date} — ${m.available.area}</div>
                    <div class="match-pair">
                        <div class="match-side match-avail">
                            <div class="match-type">🔵 余剰</div>
                            <div class="match-company">${m.available.company_name}</div>
                            <div class="match-detail">${m.available.people_count}名 / ${m.available.job_type}</div>
                            <div class="match-contact">📞 ${m.available.phone || '—'}</div>
                        </div>
                        <div class="match-arrow">⇄</div>
                        <div class="match-side match-need">
                            <div class="match-type">🔴 不足</div>
                            <div class="match-company">${m.needed.company_name}</div>
                            <div class="match-detail">${m.needed.people_count}名 / ${m.needed.job_type}</div>
                            <div class="match-contact">📞 ${m.needed.phone || '—'}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('マッチング読み込みエラー:', err);
        container.innerHTML = '<div class="no-results"><p>読み込みに失敗しました</p></div>';
    }
}

// ========================================
// お知らせ
// ========================================
async function loadAnnouncements() {
    const container = document.getElementById('announcementsList');
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>読み込み中...</p></div>';

    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            // テーブルが存在しない場合
            if (error.code === '42P01' || error.message.includes('does not exist')) {
                container.innerHTML = `
                    <div class="no-results">
                        <p>📢 お知らせ機能を使うには、Supabaseに announcements テーブルを作成してください。</p>
                        <p class="no-results-sub">
                            CREATE TABLE announcements (<br>
                            &nbsp;&nbsp;id uuid DEFAULT gen_random_uuid() PRIMARY KEY,<br>
                            &nbsp;&nbsp;title text NOT NULL,<br>
                            &nbsp;&nbsp;body text NOT NULL,<br>
                            &nbsp;&nbsp;priority text DEFAULT 'normal',<br>
                            &nbsp;&nbsp;author_id uuid,<br>
                            &nbsp;&nbsp;author_name text,<br>
                            &nbsp;&nbsp;created_at timestamptz DEFAULT now()<br>
                            );
                        </p>
                    </div>
                `;
                return;
            }
            throw error;
        }

        const announcements = data || [];

        if (announcements.length === 0) {
            container.innerHTML = '<div class="no-results"><p>お知らせはまだありません</p></div>';
            return;
        }

        const priorityLabels = { urgent: '🚨 緊急', important: '⚠️ 重要', normal: '📢 通常' };
        const priorityClasses = { urgent: 'priority-urgent', important: 'priority-important', normal: 'priority-normal' };

        container.innerHTML = announcements.map(a => {
            const created = new Date(a.created_at).toLocaleString('ja-JP');
            const pLabel = priorityLabels[a.priority] || '📢 通常';
            const pClass = priorityClasses[a.priority] || 'priority-normal';

            return `
                <div class="announcement-card ${pClass}">
                    <div class="announcement-header">
                        <span class="announcement-priority">${pLabel}</span>
                        <span class="announcement-date">${created}</span>
                        <button class="btn-delete" onclick="deleteAnnouncement('${a.id}')" title="削除">🗑️</button>
                    </div>
                    <h4 class="announcement-title">${a.title}</h4>
                    <p class="announcement-body">${a.body.replace(/\n/g, '<br>')}</p>
                    <div class="announcement-author">投稿者: ${a.author_name || '管理者'}</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('お知らせ読み込みエラー:', err);
        container.innerHTML = '<div class="no-results"><p>読み込みに失敗しました</p></div>';
    }
}

function showAnnouncementModal() {
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.remove('show');
    document.body.style.overflow = '';
}

async function submitAnnouncement(e) {
    e.preventDefault();

    const data = {
        title: document.getElementById('announcementTitle').value,
        body: document.getElementById('announcementBody').value,
        priority: document.getElementById('announcementPriority').value,
        author_id: currentUser.id,
        author_name: currentUser.company_name,
        created_at: new Date().toISOString(),
    };

    try {
        const { error } = await supabaseClient.from('announcements').insert([data]);
        if (error) throw error;
        alert('お知らせを投稿しました。');
        closeAnnouncementModal();
        await loadAnnouncements();
    } catch (err) {
        console.error('お知らせ投稿エラー:', err);
        alert('お知らせの投稿に失敗しました: ' + (err.message || err));
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('このお知らせを削除しますか？')) return;

    try {
        const { error } = await supabaseClient.from('announcements').delete().eq('id', id);
        if (error) throw error;
        await loadAnnouncements();
    } catch (err) {
        alert('削除に失敗しました: ' + (err.message || err));
    }
}
