# txvideolike_obfuscated

混淆版本的腾讯视频弹幕点赞工具。

## 安装

```bash
pip install .
```

## 使用方法

1. 确保已创建 `cookies.json` 文件并添加有效的腾讯视频 cookie
2. 运行命令：
```bash
txvideolike
```

## 配置文件

- `cookies.json`: 存储腾讯视频登录 cookie
- `video_codes.json`: 存储要处理的视频 ID
- `block_keywords.json`: 屏蔽关键词列表
- `progress.json`: 进度记录
- `used_today.json`: 每日使用配额记录 