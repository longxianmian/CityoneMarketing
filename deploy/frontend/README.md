# Growth Frontend Safe Deploy

目标：

- 发布新 `index.html` 与新 hash `assets`
- 保留旧 hash `assets` 一段时间
- 避免 LINE / Safari / WebView 里已经打开的旧页面在发版后立刻 `404`

推荐做法：

1. 本地完成 `pnpm -C artifacts/cityone-growth-frontend build`
2. 打包 `artifacts/cityone-growth-frontend/dist/public`
3. 在服务器执行：

```bash
./deploy/frontend/deploy-growth-frontend-safe.sh /tmp/cityone-growth.tgz
```

脚本行为：

- 先备份当前 `/home/docker/www/growth`
- 解压新版本到临时 release 目录
- 用 `cp -a` 覆盖 live 目录中的新文件
- 不主动删除旧 `assets/*hash*.js`
- 仅清理历史备份目录，不清理 live assets

为什么这样做：

- `index.html` 会很快指向新包
- 但已经打开的旧详情页 / 旧 WebView 仍可能继续请求旧 hash 资源
- 若上线时把旧 `assets` 立刻删掉，就会出现 `chunk 404`

后续可继续演进：

- 增加 assets 生命周期清理脚本
- 基于 release manifest 做“当前版 + 上一版”精准保留
- 配合 CDN 缓存策略，把 `index.html` 设为短缓存、hash assets 设为长缓存
