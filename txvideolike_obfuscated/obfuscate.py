import os
import shutil
from pathlib import Path

def copy_and_obfuscate():
    # 源目录和目标目录
    src_dir = Path("../txvideolike/txvideolike")
    dst_dir = Path("txvideolike_obfuscated")
    
    # 确保目标目录存在
    dst_dir.mkdir(exist_ok=True)
    
    # 复制所有Python文件
    for src_file in src_dir.glob("*.py"):
        dst_file = dst_dir / src_file.name
        shutil.copy2(src_file, dst_file)
    
    # 复制配置文件
    config_files = ["cookies.json", "video_codes.json", "block_keywords.json", 
                   "progress.json", "used_today.json"]
    for file in config_files:
        src_file = Path("../txvideolike") / file
        if src_file.exists():
            shutil.copy2(src_file, dst_dir)

if __name__ == "__main__":
    copy_and_obfuscate() 