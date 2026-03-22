# 🛡️ ガードプール — 警備員シェアリングシステム

警備会社間の人員余剰・不足をリアルタイムでマッチングするWebアプリケーション。

## 🌐 デモ

**https://hondaporta-ship-it.github.io/guardpool/**

### テストアカウント

| ID | パスワード | 権限 | 説明 |
|---|---|---|---|
| `ats` | `ats2024` | 管理者 | 全投稿の閲覧・管理が可能 |
| `demo` | `demo2024` | 一般 | 合計サマリー + 自社投稿のみ表示 |

## 📋 機能

### コア機能
- **人員余剰の投稿** — 「人が余ってます」を投稿
- **人員不足の投稿** — 「人が足りません」を投稿
- **サマリーダッシュボード** — 余剰・不足の合計をリアルタイム表示
- **マッチングヒント** — 余剰と不足が同時に存在する場合に通知

### 権限制御（2層構造）
- **管理者（ATS）**: 全社の投稿詳細・連絡先を閲覧可能
- **一般ユーザー**: 合計サマリーのみ + 自社の投稿管理

### フィルタリング
- 📅 日付で絞り込み
- 📍 エリアで絞り込み
- 🏷️ 種類（余剰/不足）で絞り込み

### その他
- 🗑️ 投稿の削除（自社投稿 + 管理者）
- ⏱️ 投稿からの経過時間表示
- 📱 スマホ対応（PWA対応）
- ⚡ リアルタイムデータ（Supabase）

## 🏗️ 技術スタック

- **フロントエンド**: HTML / CSS / JavaScript（フレームワークなし）
- **バックエンド**: [Supabase](https://supabase.com/)（PostgreSQL + REST API）
- **ホスティング**: GitHub Pages
- **認証**: Supabase companiesテーブルによるシンプル認証

## 📊 データベース構成

### companies（会社マスタ）
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| login_id | TEXT | ログインID（ユニーク） |
| password | TEXT | パスワード |
| company_name | TEXT | 会社名 |
| phone | TEXT | 代表電話 |
| contact_person | TEXT | 担当者名 |
| contact_phone | TEXT | 担当者電話 |
| role | TEXT | admin / member |

### posts_available / posts_needed（投稿）
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | 主キー |
| company_id | UUID | 外部キー → companies |
| company_name | TEXT | 会社名 |
| post_date | DATE | 対象日 |
| shift_type | TEXT | day / night / both |
| people_count | INTEGER | 人数 |
| area | TEXT | エリア |
| job_type | TEXT | 業務内容 |
| note | TEXT | 備考 |

## 🚀 セットアップ

1. Supabaseプロジェクトを作成
2. `sql/` 内のSQLを実行してテーブル作成
3. `config.js` にURLとキーを設定
4. GitHub Pagesにデプロイ（pushするだけ）

## 📁 ファイル構成

```
guardpool/
├── index.html          # ログインページ
├── dashboard.html      # ダッシュボード
├── app.js              # メインロジック
├── config.js           # Supabase設定
├── style.css           # スタイルシート
├── manifest.json       # PWAマニフェスト
├── sql/                # データベースSQL
│   └── add_role_column.sql
└── README.md
```

## 🏢 運営

**ATセキュリティ**
〒812-0011 福岡県福岡市博多区博多駅前3-18-6 博多テラス3F
TEL: 092-441-6900

---

© 2026 ATセキュリティ
