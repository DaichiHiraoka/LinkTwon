# Link Town Frontend

Link Town の本実装フロントエンドです。`community-mile-app` は過去モック置き場のため、このアプリでは参照しません。

## 方針

- React + Vite + TypeScript
- Androidスマートフォン閲覧前提
- バックエンド未完成のためモックデータで表示
- ロゴとアイコンはReact SVGコンポーネントとして再利用

## 起動

```bash
npm install
npm run dev
```

PCでは `http://localhost:5173` を開きます。Android実機では同一LAN上のPC IPを使って `http://<PCのIP>:5173` にアクセスします。

## ビルド

```bash
npm run build
```
