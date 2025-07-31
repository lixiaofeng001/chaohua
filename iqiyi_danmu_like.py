import requests
import json
import time
import random
import os
import re

class IQiyiDanmuLiker:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.iqiyi.com/',
        }
        self.progress_file = 'danmu_progress.json'
        self.load_progress()

    def load_progress(self):
        """加载进度文件"""
        if os.path.exists(self.progress_file):
            with open(self.progress_file, 'r', encoding='utf-8') as f:
                self.progress = json.load(f)
        else:
            self.progress = {'liked_danmu': []}

    def save_progress(self):
        """保存进度"""
        with open(self.progress_file, 'w', encoding='utf-8') as f:
            json.dump(self.progress, f, ensure_ascii=False, indent=2)

    def extract_video_info(self, url):
        """从URL中提取视频信息"""
        vid_match = re.search(r'vid=([^&]+)', url)
        if vid_match:
            return vid_match.group(1)
        return None

    def get_danmu_list(self, vid):
        """获取弹幕列表"""
        url = 'https://cmts.iqiyi.com/bullet/'
        params = {
            'vid': vid,
            'page': 1,
            'pageSize': 100
        }
        try:
            response = requests.get(url, params=params, headers=self.headers)
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            print(f"获取弹幕列表失败: {str(e)}")
            return None

    def like_danmu(self, danmu_id):
        """点赞弹幕"""
        url = 'https://cmts.iqiyi.com/bullet/like'
        data = {
            'bulletId': danmu_id,
            'vid': self.current_vid,
            'type': 'like'
        }
        try:
            response = requests.post(url, json=data, headers=self.headers)
            if response.status_code == 200:
                return True
            return False
        except Exception as e:
            print(f"点赞弹幕失败: {str(e)}")
            return False

    def process_danmu(self, video_url):
        """处理弹幕点赞"""
        vid = self.extract_video_info(video_url)
        if not vid:
            print("无法从URL中提取视频ID")
            return

        self.current_vid = vid
        print(f"正在获取视频 {vid} 的弹幕...")
        danmu_list = self.get_danmu_list(vid)
        
        if not danmu_list:
            print("获取弹幕失败")
            return

        danmus = danmu_list.get('data', {}).get('comments', [])
        if not danmus:
            print("没有找到弹幕")
            return

        print(f"找到 {len(danmus)} 条弹幕")
        for danmu in danmus:
            danmu_id = danmu.get('id')
            if not danmu_id or danmu_id in self.progress['liked_danmu']:
                continue

            content = danmu.get('content', '')
            print(f"正在点赞弹幕: {content[:20]}...")
            if self.like_danmu(danmu_id):
                self.progress['liked_danmu'].append(danmu_id)
                self.save_progress()
                print("点赞成功！")
            else:
                print("点赞失败")

            # 随机延迟，避免请求过快
            time.sleep(random.uniform(1, 2))

def main():
    liker = IQiyiDanmuLiker()
    video_url = input("请输入爱奇艺视频链接: ")
    
    print(f"开始处理视频弹幕点赞...")
    liker.process_danmu(video_url)
    print("处理完成！")

if __name__ == "__main__":
    main() 