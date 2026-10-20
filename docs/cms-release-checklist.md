# 管理室の公開前チェックリスト

このファイルは作業者向けの手順書です。**現時点では管理室のログインは未公開です。**

## すでにあるもの

- ホームページ: https://wannyan929.github.io/wannyan-public/
- 既存の管理室: https://wannyan929.github.io/wannyan-public/admin.html
- 新管理室の準備ページ: https://wannyan929.github.io/wannyan-public/cms/
- Cloudflare Worker: `noisy-voice-54f9`
- GitHub: `wannyan929/wannyan-public`
- 新管理室用データ: `cms-data/events.json` と `cms-data/reports.json`
- 公開データへの変換: `.github/workflows/sync-cms.yml`

## 公開前に必須

1. `worker/oauth-draft.js` は現在、成功時にも認証を拒否する安全側の下書き。完成版として貼り付けない。
2. 認証結果の引き渡し、利用者の権限確認、CSRF・期限切れの確認を含む認証処理を完成させる。
3. `worker/oauth.test.mjs` のテストを実行し、成功結果を確認する。
4. GitHub OAuth App を本人のアカウントで作成する。コールバックURLは `https://noisy-voice-54f9.ryo-f-0924.workers.dev/callback`。
5. GitHub OAuth App の Client Secret と十分に長いランダムな STATE_SECRET は **Cloudflare Worker の Secret 変数**として登録する。チャット、GitHub、通常のテキスト変数に貼らない。
6. 完成版 Worker を Cloudflare にデプロイし、認証と失敗時の挙動を実際にテストする。
7. その後でのみ `cms/config.yml` の `backend.auth_endpoint` を有効にし、`cms/index.html` を Decap CMS 本体に切り替える。
8. テスト記事と写真を投稿し、`sync-cms.yml` が `events.json` と `activity.json` を更新すること、公開ページで写真が表示されることを確認する。
9. 既存の扉、音、トップページの演出は変更しない。

## 将来の共同編集

朱里さんなど共同編集者を追加するときは、GitHubのリポジトリ権限とWorkerの許可アカウントを**両方**更新し、本人ごとのアカウントでログインする。パスワードやトークンを共有しない。

## 操作を依頼する前に

画面を何度も行き来する負担を避けるため、GitHub OAuth App 登録・Cloudflare の Secret 登録・Worker 更新に必要な項目をまとめて案内する。必要な値は本人の画面で入力してもらい、秘密情報は見せてもらわない。
