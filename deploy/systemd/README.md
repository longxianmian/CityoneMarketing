# CityOneMarketing systemd 部署说明

当前服务器已将以下服务改为 systemd 守护运行：

- cityone-growth-backend.service
- cityone-api-server.service

作用：
- 开机自启
- 异常退出自动拉起
- 替代原先手动 nohup 启动方式

常用命令：
- systemctl status cityone-growth-backend --no-pager -l
- systemctl status cityone-api-server --no-pager -l
- systemctl restart cityone-growth-backend
- systemctl restart cityone-api-server
- systemctl stop cityone-growth-backend
- systemctl stop cityone-api-server
- systemctl start cityone-growth-backend
- systemctl start cityone-api-server

注意：
1. 不要把真实环境变量文件 /root/.cityone-growth-backend.env 提交到仓库
2. systemd 文件是部署模板，真实生效文件位于 /etc/systemd/system/
3. 服务器修改后如要同步仓库，应手动复制回 deploy/systemd/
