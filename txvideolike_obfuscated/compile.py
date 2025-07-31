import os
import shutil
from pathlib import Path

def compile_project():
    # 编译主程序
    os.system("python -m nuitka --follow-imports --standalone --windows-disable-console --output-dir=dist txvideolike_obfuscated/cli.py")
    
    # 复制配置文件
    config_files = ["cookies.json", "video_codes.json", "block_keywords.json", 
                   "progress.json", "used_today.json"]
    dist_dir = Path("dist/txvideolike_obfuscated.cli.dist")
    
    for file in config_files:
        src_file = Path(file)
        if src_file.exists():
            shutil.copy2(src_file, dist_dir)

if __name__ == "__main__":
    compile_project() 