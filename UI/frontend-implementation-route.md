# Link Town フロントエンド実装ルート

対象デザイン: `LinkTwon/UI/Link Town.png`

本実装は `LinkTwon/` 配下で完結させる。`community-mile-app/` は過去モック置き場として扱い、本実装では参照・改修しない。

## 方針

- Androidスマートフォンでの閲覧を前提にする。
- PCブラウザではスマートフォン幅の画面を中央表示する。
- バックエンド未完成のため、当面はモックデータで画面を表示する。
- API接続時の変更範囲を狭くするため、データは `src/data/mockData.ts` に集約する。
- ロゴと主要アイコンはReact SVGコンポーネントとして使い回す。

## 実装画面

- ログイン
- ホーム
- イベント
- QR読み取り完了
- ウォレット
- ポイント購入
- アカウント

## 実装先

```text
LinkTwon/frontend/
  package.json
  index.html
  src/
    main.tsx
    App.tsx
    components/
      Logo.tsx
      Icons.tsx
    data/
      mockData.ts
    styles.css
```

## 起動

```bash
cd prototype/LinkTwon/frontend
npm install
npm run dev
```

## 確認

```bash
npm run build
```
