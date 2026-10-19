# Cloudflare Worker 接続前チェックリスト

対象 Worker: `noisy-voice-54f9`
URL: `https://noisy-voice-54f9.ryo-f-0924.workers.dev`

## 現状（2026-10-19）
- Worker の URL は確認済みだが、動作しているのは初期の Hello World の可能性がある。OAuth 仲介は未実装・未検証。
- GitHub OAuth App「Wannyan Secret Society CMS」は登録済み。
- `cms/config.yml` は編集項目の定義のみ。ログインページは未公開。
- `cms-data/` → GitHub Actions → 公開 JSON の経路は設定済み。実際の CMS 投稿からの動作テストは未実施。

## 実装前に必要なもの
1. Cloudflare Worker に GitHub OAuth の開始・コールバックを安全に実装する。
2. GitHub OAuth App の Authorization callback URL を Worker の **正確なコールバック URL** に設定する（ワイルドカードを使用しない）。
3. Worker の Secrets に GitHub OAuth Client Secret を登録する。GitHub 上の公開リポジトリやチャットに秘密値を貼らない。
4. OAuth の state 検証（CSRF 対策）、期限、許可されたサイトの origin 制限、ログインした GitHub アカウントとリポジトリ書き込み権限の確認を実装する。
5. iPhone のポップアップ・ログイン・写真アップロード・投稿を実機テストする。
6. **テスト合格後のみ** `cms/index.html` を CMS ログイン画面に切り替え、`cms/config.yml` に認証 URL を設定する。

## Cloudflare を開く際のまとめ操作（まだ実行しない）
- Cloudflare → Workers & Pages → `noisy-voice-54f9` → Settings → Runtime variables and secrets。
- 接続コードが完成してから、指定された **Secret** の名前と値を追加する。
- 画面を閉じると戻りにくいため、必要な操作を事前にすべて提示する。
- Client Secret、アクセストークン、認証番号はスクリーンショットにも含めない。

## 既存サイトの保護
- トップページ、扉の演出、効果音、クル＆ラン、公式ロゴは変更しない。
- 従来の `admin.html` はログインなしの下書き機能として維持。
- CMS の公開を先走って有効化しない。
