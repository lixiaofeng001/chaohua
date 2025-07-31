import sys
import json
import time
import random
import os
import multiprocessing
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                           QHBoxLayout, QPushButton, QLineEdit, QTextEdit, 
                           QLabel, QProgressBar, QMessageBox, QSpinBox)
from PyQt5.QtCore import Qt, QThread, pyqtSignal
import requests

class DanmuWorker:
    def __init__(self, cookies, video_url, process_id):
        self.cookies = cookies
        self.video_url = video_url
        self.process_id = process_id
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.iqiyi.com/',
        }

    def get_user_info(self):
        """获取用户信息"""
        url = 'https://passport.iqiyi.com/apis/profile/info.action'
        params = {
            'QC005': self.cookies.get('QC005', ''),
            'agenttype': '1',
            'app_version': '13.062.22175',
            'authcookie': self.cookies.get('P00001', ''),
            'device_id': self.cookies.get('QC005', ''),
            'dfp': self.cookies.get('__dfp', '').split('@')[0],
            'fields': 'public,private,icon_pendant',
            'ptid': '01010021010000000000',
            'vinfo_version': '5.0'
        }
        
        response = requests.get(url, params=params, headers=self.headers, cookies=self.cookies)
        if response.status_code == 200:
            data = response.json()
            if data.get('code') == 'A00000':
                return data.get('data', {}).get('userinfo', {})
        return None

    def send_danmu(self, content, play_time=0):
        """发送弹幕"""
        url = 'https://bar-i.iqiyi.com/myna-api/publish'
        params = {
            'dfp': self.cookies.get('__dfp', '').split('@')[0],
            'version': '1.0.0',
            'authcookie': self.cookies.get('P00001', ''),
            'qyid': self.cookies.get('QC005', ''),
            'platformId': '1079',
            'qypid': '01010011010000000000',
            'tvid': self.get_tvid(),
            'appid': '21',
            'contentType': '0',
            'color': 'FFFFFF',
            'position': '0',
            'play_time': str(play_time),
            'content': content,
            'udid': self.cookies.get('QC005', ''),
            'showTime': str(play_time),
            'is_iqiyi': 'true',
            'is_video_page': 'true',
            'categoryId': '',
            'makeVersion': '104',
            'emotionType': '1',
            'business': 'danmu',
            'isReply': 'false',
            'contentId': ''
        }
        
        response = requests.get(url, params=params, headers=self.headers, cookies=self.cookies)
        if response.status_code == 200:
            return True
        return False

    def like_danmu(self, danmu_id):
        """点赞弹幕"""
        url = 'https://bar-i.iqiyi.com/myna-api/like'
        params = {
            'dfp': self.cookies.get('__dfp', '').split('@')[0],
            'version': '1.0.0',
            'platformId': '1079',
            'qypid': '01010011010000000000',
            'contentid': danmu_id,
            'cancel': 'false'
        }
        
        response = requests.get(url, params=params, headers=self.headers, cookies=self.cookies)
        if response.status_code == 200:
            return True
        return False

    def get_tvid(self):
        """从URL中提取tvid"""
        if 'tvid=' in self.video_url:
            return self.video_url.split('tvid=')[1].split('&')[0]
        elif 'vid=' in self.video_url:
            vid = self.video_url.split('vid=')[1].split('&')[0]
            # 这里需要调用接口将vid转换为tvid
            # 暂时使用示例tvid
            return '1908051740867700'
        return None

    def process(self, danmu_list, like_interval=(1, 3), send_interval=(5, 10)):
        """处理弹幕点赞和发送"""
        user_info = self.get_user_info()
        if user_info:
            print(f"进程 {self.process_id} - 用户: {user_info.get('nickname', '未知')} 开始处理")
        else:
            print(f"进程 {self.process_id} - 获取用户信息失败")

        # 点赞弹幕
        for danmu in danmu_list:
            danmu_id = danmu.get('id')
            content = danmu.get('content', '')
            print(f"进程 {self.process_id} - 正在点赞弹幕: {content[:20]}...")
            
            if self.like_danmu(danmu_id):
                print(f"进程 {self.process_id} - 点赞成功！")
            else:
                print(f"进程 {self.process_id} - 点赞失败")

            time.sleep(random.uniform(*like_interval))

        # 发送弹幕
        danmu_contents = [
            "666666",
            "太棒了",
            "支持一下",
            "厉害了",
            "真不错",
            "学到了",
            "感谢分享",
            "继续加油",
            "期待更新",
            "太精彩了"
        ]
        
        for content in danmu_contents:
            if self.send_danmu(content):
                print(f"进程 {self.process_id} - 发送弹幕成功: {content}")
            else:
                print(f"进程 {self.process_id} - 发送弹幕失败: {content}")
            
            time.sleep(random.uniform(*send_interval))

def process_worker(cookies_str, video_url, process_id):
    """工作进程函数"""
    # 将cookie字符串转换为字典
    cookies = {}
    for item in cookies_str.split('; '):
        if '=' in item:
            key, value = item.split('=', 1)
            cookies[key] = value

    worker = DanmuWorker(cookies, video_url, process_id)
    # 这里可以添加获取弹幕列表的逻辑
    danmu_list = []  # 示例弹幕列表
    worker.process(danmu_list)

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.initUI()
        self.processes = []

    def initUI(self):
        self.setWindowTitle('爱奇艺弹幕自动化工具')
        self.setGeometry(100, 100, 800, 600)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)

        # Cookies输入
        cookies_layout = QHBoxLayout()
        cookies_label = QLabel('Cookies:')
        self.cookies_input = QTextEdit()
        self.cookies_input.setPlaceholderText('每行一个cookie字符串')
        cookies_layout.addWidget(cookies_label)
        cookies_layout.addWidget(self.cookies_input)
        layout.addLayout(cookies_layout)

        # 视频链接输入
        url_layout = QHBoxLayout()
        url_label = QLabel('视频链接:')
        self.url_input = QLineEdit()
        url_layout.addWidget(url_label)
        url_layout.addWidget(self.url_input)
        layout.addLayout(url_layout)

        # 进程数设置
        process_layout = QHBoxLayout()
        process_label = QLabel('进程数:')
        self.process_spin = QSpinBox()
        self.process_spin.setRange(1, 10)
        self.process_spin.setValue(3)
        process_layout.addWidget(process_label)
        process_layout.addWidget(self.process_spin)
        layout.addLayout(process_layout)

        # 控制按钮
        button_layout = QHBoxLayout()
        self.start_button = QPushButton('开始')
        self.stop_button = QPushButton('停止')
        self.stop_button.setEnabled(False)
        button_layout.addWidget(self.start_button)
        button_layout.addWidget(self.stop_button)
        layout.addLayout(button_layout)

        # 进度显示
        self.progress_text = QTextEdit()
        self.progress_text.setReadOnly(True)
        layout.addWidget(self.progress_text)

        # 绑定事件
        self.start_button.clicked.connect(self.start_processing)
        self.stop_button.clicked.connect(self.stop_processing)

    def start_processing(self):
        cookies_list = self.cookies_input.toPlainText().strip().split('\n')
        video_url = self.url_input.text().strip()
        process_count = self.process_spin.value()

        if not cookies_list or not video_url:
            QMessageBox.warning(self, '警告', '请输入Cookies和视频链接')
            return

        self.start_button.setEnabled(False)
        self.stop_button.setEnabled(True)
        self.progress_text.clear()

        # 创建进程池
        for i in range(min(process_count, len(cookies_list))):
            p = multiprocessing.Process(
                target=process_worker,
                args=(cookies_list[i], video_url, i+1)
            )
            self.processes.append(p)
            p.start()

    def stop_processing(self):
        for p in self.processes:
            if p.is_alive():
                p.terminate()
        self.processes.clear()
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)
        self.progress_text.append("已停止所有进程")

def main():
    multiprocessing.freeze_support()  # Windows下打包需要
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())

if __name__ == '__main__':
    main() 