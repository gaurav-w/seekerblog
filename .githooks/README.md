# Repository hooks

`pre-commit` rebuilds and stages `assets/search-index.json` whenever a public
search source is committed. Enable the tracked hooks after cloning with:

```powershell
git config core.hooksPath .githooks
```

The current checkout is configured automatically by the search feature setup.
