# 用户端身份与 LINE 继续链路模块说明

本目录属于“用户端身份识别 / 业务身份分层 / 外部浏览器进入 LINE 继续链路模块”。

修改本模块代码前，必须先阅读以下两份规范文档：

- [README-唯一身份与业务身份分层规范.md](/Users/lxtx/Documents/New%20project/CityoneMarketing/artifacts/cityone-growth-frontend/src/pages/user/README-唯一身份与业务身份分层规范.md)
- [README-外部浏览器进入LINE继续链路规范.md](/Users/lxtx/Documents/New%20project/CityoneMarketing/artifacts/cityone-growth-frontend/src/pages/user/README-外部浏览器进入LINE继续链路规范.md)

强约束：

- 前端禁止自行推断身份
- 前端禁止复活旧 fallback
- 前端禁止用会话缓存替代后端身份真源
- 页面禁止自行恢复业务动作
