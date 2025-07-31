import os
import shutil
import subprocess

def build():
    # 清理旧的构建文件
    if os.path.exists('dist'):
        shutil.rmtree('dist')
    if os.path.exists('build'):
        shutil.rmtree('build')
    if os.path.exists('iqiyi_danmu_like.spec'):
        os.remove('iqiyi_danmu_like.spec')

    # 使用PyArmor加密
    subprocess.run(['pyarmor', 'obfuscate', '--recursive', 'main.py'])

    # 使用PyInstaller打包
    subprocess.run([
        'pyinstaller',
        '--noconfirm',
        '--onefile',
        '--windowed',
        '--name', 'iqiyi_danmu_like',
        '--add-data', 'cookies.json;.',
        'dist/main.py'
    ])

    # 复制必要的文件到dist目录
    if os.path.exists('cookies.json'):
        shutil.copy('cookies.json', 'dist/iqiyi_danmu_like/cookies.json')

    print("构建完成！")

if __name__ == '__main__':
    build() 