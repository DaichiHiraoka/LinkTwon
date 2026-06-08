# Contributing

Link Town の開発では、`main` を安定版、`dev` を開発統合ブランチとして扱います。

## 作業先

- システム本体の変更: `dev` または `feature/*`
- 不具合修正: `fix/*`
- ドキュメントのみ: `docs/*`
- `main` への直接変更: 原則禁止

詳しい運用は [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md) を参照してください。

## 変更前チェック

作業を始める前に、現在のブランチ/ブックマークを確認してください。

```powershell
git status --short
git branch --show-current
jj status
jj bookmark list
```

## 変更後チェック

PR または push 前に、少なくとも以下を実行します。

```powershell
npm test
```

UIを変更した場合は、ローカルで起動して主要画面を確認します。

```powershell
npm run dev
```

## Pull Request の向き

- 通常: `feature/* -> dev`
- 小さな修正: `fix/* -> dev`
- ドキュメント: `docs/* -> dev`
- リリース反映: `dev -> main`

`main` に入れる前に、`dev` で動作確認を済ませます。
