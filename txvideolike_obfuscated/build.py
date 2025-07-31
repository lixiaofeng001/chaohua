import os
import shutil
from pathlib import Path

def build_project():
    # 使用 PyInstaller 打包，移除 --windowed 选项以显示控制台窗口
    os.system("pyinstaller --noconfirm --onefile --name txvideolike txvideolike_obfuscated/cli.py")
    
    # 复制配置文件到 dist 目录
    config_files = ["cookies.json", "video_codes.json", "block_keywords.json", 
                   "progress.json", "used_today.json"]
    dist_dir = Path("dist")
    
    for file in config_files:
        src_file = Path(file)
        if src_file.exists():
            shutil.copy2(src_file, dist_dir)

if __name__ == "__main__":
    build_project() 