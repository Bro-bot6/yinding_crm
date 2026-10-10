# 银鼎客资信息网站

基于 Django 的公司客资与项目跟进系统。

## 在新电脑上首次运行

1. 安装 Git 和 Python 3.12 或更高版本。
2. 从 [GitHub 仓库](https://github.com/Bro-bot6/yinding_crm) 克隆本项目。
3. 如需沿用原电脑的数据，将单独备份的数据库复制到项目的 `data` 目录并命名为 `crm.sqlite3`；使用 `DJANGO_DATA_DIR` 时应复制到该指定目录。替换前停止服务并保留原数据库副本。
4. 双击 `setup.bat`。脚本会自动创建虚拟环境、安装依赖、迁移数据库并打开网站。
5. 以后直接双击 `run.bat` 即可。

## 同步代码

开始工作前拉取最新代码，结束工作后提交并推送修改。不要在两台电脑上同时修改同一个文件后再同步，以免产生冲突。

当前功能与存档安排见 [2026-10-10 项目进度](docs/project-progress-20261010.md)。

## 数据安全

- `data/crm.sqlite3` 包含客资、账号和密码哈希，不会进入 Git 仓库；历史 `db.sqlite3` 同样被忽略。
- 安装局域网服务任务后，每天 17:30 生成本地 ZIP 存档，当前电脑路径为 `E:\yinding_crm\backups\daily`。
- 双击 `backup-data.bat` 可以在 `private-backup` 中生成带时间戳的数据库副本。
- `private-backup`、`.env`、日志、虚拟环境和本地测试截图均被 Git 忽略。
- 数据库备份应通过可信的私人网盘或 U 盘转移，不要上传到公开仓库。
- 正式部署前必须设置新的 `DJANGO_SECRET_KEY`，并关闭 `DJANGO_DEBUG`。

## 常用文件

- `setup.bat`：新电脑首次安装与启动。
- `run.bat`：日常启动网站。
- `backup-data.bat`：备份当前数据库。
- `archive-crm.pyw`：生成数据库与 Excel 的本地 ZIP 存档。
- `install-lan-service.ps1`：安装后台服务、每日 17:30 存档和健康检查任务。
- `push-to-gitee.bat`：将已经提交的代码上传到配置好的 Gitee 仓库。
- `.env.example`：正式部署所需环境变量示例。
