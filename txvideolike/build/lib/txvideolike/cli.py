# txvideolike/cli.py
import argparse
from pathlib import Path
import txvideolike.core as core


def main():
    parser = argparse.ArgumentParser(
        prog="txvideolike",
        description="自动化为腾讯视频弹幕点赞"
    )
    parser.add_argument(
        "--cookies-file",
        default=None,
        help="自定义 cookies.json 路径（可选，默认当前工作目录或包目录）"
    )
    parser.add_argument(
        "--videos-file",
        default=None,
        help="自定义 video_codes.json 路径（可选，默认当前工作目录或包目录）"
    )
    args = parser.parse_args()

    # 动态覆盖 core 模块中的文件路径常量
    if args.cookies_file:
        core.COOKIES_FILE = Path(args.cookies_file)
    if args.videos_file:
        core.VIDEO_CODES_FILE = Path(args.videos_file)

    # 调用主逻辑入口
    core.main()


if __name__ == "__main__":
    main()
