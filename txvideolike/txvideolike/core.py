# core.py
import time
import random
import sys
import json
import requests
import re
from pathlib import Path
import threading
from queue import Queue
from concurrent.futures import ThreadPoolExecutor
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# 配置及持久化文件路径
WORKDIR = Path.cwd()
PKGDIR = Path(__file__).parent
COOKIES_FILE     = WORKDIR / "cookies.json"       # 存储列表：cookie 字符串
VIDEO_CODES_FILE = WORKDIR / "video_codes.json"
BLOCK_FILE       = WORKDIR / "block_keywords.json"
PROGRESS_FILE    = WORKDIR / "progress.json"
QUOTA_FILE       = WORKDIR / "used_today.json"

# 回退到包内
if not COOKIES_FILE.exists():     COOKIES_FILE = PKGDIR / "cookies.json"
if not VIDEO_CODES_FILE.exists(): VIDEO_CODES_FILE = PKGDIR / "video_codes.json"

# 读取屏蔽关键词
if BLOCK_FILE.exists():
    BLOCK_KEYWORDS = json.loads(BLOCK_FILE.read_text(encoding="utf-8"))
    if not isinstance(BLOCK_KEYWORDS, list):
        print("block_keywords.json 必须为字符串数组格式"); sys.exit(1)
else:
    BLOCK_KEYWORDS = []

# 接口与常量
CID          = "mzc002007sqbpce"
VAPPID       = "70930403"
VSECRET      = "e496b057758aeb04b3a2d623c952a1c47e04ffb0a01e19cf"
VIDEO_APPID  = "1000005"
SEGMENT_MS   = 30000
LIKE_URL     = "https://pbaccess.video.qq.com/com.tencent.qqlive.protocol.pb.PraiseService/doPraiseAction"
REFRESH_URL  = "https://pbaccess.video.qq.com/trpc.video_account_login.web_login_trpc.WebLoginTrpc/NewRefresh"
MAX_RETRIES  = 5
INITIAL_WAIT = 60
MAX_WAIT     = 15 * 60
DAILY_QUOTA  = 20000
MAX_WORKERS  = 4  # 并发请求数
REQUEST_TIMEOUT = 10  # 请求超时时间

# 线程锁
progress_lock = threading.Lock()
quota_lock    = threading.Lock()

# 加载/保存 JSON

def load_progress(path):
    """
    支持两种格式：
    1. 旧格式：整个文件是一个 JSON 数组
    2. 新格式：每行一个 JSON 对象（JSON Lines）
    """
    if not path.exists():
        return []
    try:
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            return []
        if text.startswith("["):
            # 旧格式
            return json.loads(text)
        # 新格式
        lines = [json.loads(line) for line in text.splitlines() if line.strip()]
        return lines
    except Exception:
        return []

def append_progress(path, rec):
    """
    追加一条记录到 progress.json，每行一个 JSON 对象。
    """
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

def load_json(path, default=None):
    if not path.exists():
        return default
    try:
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            return default
        return json.loads(text)
    except Exception:
        return default
    return json.loads(path.read_text(encoding="utf-8"))

def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

# 加载配置：简单列表
all_cookies = load_json(COOKIES_FILE, []) or []
if not isinstance(all_cookies, list):
    print("cookies.json 必须为字符串数组格式"); sys.exit(1)

videos     = load_json(VIDEO_CODES_FILE, []) or []
used_today = load_json(QUOTA_FILE, {}) or {}
progress   = load_progress(PROGRESS_FILE)

# 检测 cookie 有效期

def parse_cookie_expiry(cookie):
    m1 = re.search(r'login_time_init=(\d+)', cookie)
    m2 = re.search(r'next_refresh_time=(\d+)', cookie)
    return int(m1.group(1)) + int(m2.group(1)) if m1 and m2 else None


def is_cookie_valid(cookie):
    exp = parse_cookie_expiry(cookie)
    return True if exp is None else time.time() < exp

# 刷新 token

def refresh_token(cookie):
    h38  = re.search(r'_qimei_h38=([^;]+)', cookie).group(1)
    init = re.search(r'login_time_init=(\d+)', cookie).group(1)
    curr = re.search(r'refresh_token=([^;]+)', cookie).group(1)
    guid = re.search(r'video_guid=([^;]+)', cookie).group(1)
    si   = {
        "q36": "",
        "h38": h38,
        "o_data": f"g={guid}&t={init}000&r={curr}",
        "s": ""
    }
    r = requests.post(REFRESH_URL, json={"type": "wx", "si": si})
    r.raise_for_status()
    j = r.json()
    if j.get('ret') != 0 or j['data'].get('errcode') != 0:
        raise RuntimeError(f"刷新失败: {j}")
    d = j['data']
    new = cookie
    new = re.sub(r'refresh_token=[^;]+', f"refresh_token={d['refresh_token']}", new)
    new = re.sub(r'_video_qq_access_token=[^;]+', f"_video_qq_access_token={d['access_token']}", new)
    new = re.sub(r'next_refresh_time=[^;]+', f"next_refresh_time={d['next_refresh_time']}", new)
    return new

# 构造 session

def make_session(cookie):
    s = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504]
    )
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=MAX_WORKERS,
        pool_maxsize=MAX_WORKERS
    )
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    s.headers.update({
        "Content-Type": "application/json",
        "User-Agent":    "Mozilla/5.0",
        "Cookie":        cookie
    })
    return s

# 分段拉取弹幕

def fetch_barrages_segment(sess, vid, start_ms):
    url = f"https://dm.video.qq.com/barrage/segment/{vid}/t/v1/{start_ms}/{start_ms+SEGMENT_MS}"
    try:
        r = sess.get(url, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
        return r.json().get('barrage_list', [])
    except Exception as e:
        print(f"获取弹幕失败: {e}")
        return []

# 并发获取所有分段的弹幕

def fetch_all_barrages(sess, vid, duration_ms):
    segments = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = []
        for start_ms in range(0, duration_ms, SEGMENT_MS):
            futures.append(executor.submit(fetch_barrages_segment, sess, vid, start_ms))
        
        for i, future in enumerate(futures):
            try:
                items = future.result()
                if items:
                    segments.extend(items)
                    print(f"[{vid}] 分段{i+1}, 获取{len(items)}条弹幕")
            except Exception as e:
                print(f"[{vid}] 分段{i+1}获取失败: {e}")
    
    return segments

# 点赞逻辑

def like_barrage_with_backoff(sess, vid, mid):
    wait = INITIAL_WAIT
    for _ in range(MAX_RETRIES):
        r = sess.post(
            LIKE_URL,
            params={"vappid": VAPPID, "vsecret": VSECRET, "video_appid": VIDEO_APPID},
            json={
                "praise_action_type": 1,
                "praise_data": {
                    "praise_data_key": f"id={mid}&vid={vid}&cid={CID}",
                    "praise_type": "praise_type_barrage",
                    "praise_match_key": mid
                }
            }
        )
        if r.status_code == 401:
            raise RuntimeError("LOGIN_EXPIRED")
        j = r.json()
        if j.get('ret') == 15006:
            raise RuntimeError("LOGIN_EXPIRED")
        if j.get('ret') != 0:
            return False
        err = j['data'].get('err_code')
        if err == -2021009:
            time.sleep(wait); wait = min(wait*2, MAX_WAIT); continue
        if err != 0:
            return False
        return (j['data'].get('praise_info') or {}).get('praise_status') == 1
    return False

# 单账号任务

def worker(idx, cookie):
    print(f"\n[账号{idx+1}] 启动，配额={DAILY_QUOTA}，共{len(videos)}集")
    try:
        if not is_cookie_valid(cookie):
            print(f"[账号{idx+1}] Cookie 过期，刷新中...")
            cookie = refresh_token(cookie)
            all_cookies[idx] = cookie
            save_json(COOKIES_FILE, all_cookies)
    except Exception as e:
        print(f"[账号{idx+1}] 刷新失败，跳过: {e}")
        return f"账号{idx+1} 跳过"
    
    sess = make_session(cookie)
    liked = 0; attempts = 0
    done = {(r['user_idx'],r['vid'],r['id']) for r in progress}
    
    for vid in videos:
        print(f"[账号{idx+1}][{vid}] 开始获取弹幕...")
        items = fetch_all_barrages(sess, vid, 7200000)  # 假设视频最长2小时
        print(f"[账号{idx+1}][{vid}] 共获取{len(items)}条弹幕")
        
        for dm in items:
            attempts += 1
            if int(dm.get('up_count',0)) >= 50: continue
            if any(kw in dm.get('content','') for kw in BLOCK_KEYWORDS): continue
            key=(idx+1,vid,dm['id'])
            if key in done: continue
            
            with quota_lock:
                used=used_today.get(str(idx+1),0)
                if used>=DAILY_QUOTA:
                    print(f"[账号{idx+1}] 今日配额用尽")
                    save_json(QUOTA_FILE, used_today)
                    return f"账号{idx+1} 完成"
                used_today[str(idx+1)] = used+1
                save_json(QUOTA_FILE, used_today)
            
            try:
                ok = like_barrage_with_backoff(sess, vid, dm['id'])
                if ok:
                    liked += 1
                    rec={'user_idx':idx+1,'vid':vid,'id':dm['id'],'content':dm.get('content'),'time':int(time.time())}
                    with progress_lock:
                        progress.append(rec)
                        append_progress(PROGRESS_FILE, rec)
                if attempts % 50 == 0:
                    print(f"[账号{idx+1}] 尝试{attempts}次, 点赞{liked}次")
                time.sleep(random.uniform(0.2,0.5))
            except Exception as e:
                print(f"[账号{idx+1}] 点赞失败: {e}")
                continue
    
    print(f"[账号{idx+1}] 完成: 尝试{attempts}次, 点赞{liked}次")
    return f"账号{idx+1} 完成"

# 主入口

def main():
    print(f"启动{len(all_cookies)}账号并行任务")
    threads = []
    results = Queue()
    
    def thread_worker(idx, cookie):
        try:
            result = worker(idx, cookie)
            results.put(result)
        except Exception as e:
            results.put(f"账号{idx+1} 错误: {str(e)}")
    
    # 创建并启动线程
    for i, cookie in enumerate(all_cookies):
        t = threading.Thread(target=thread_worker, args=(i, cookie))
        threads.append(t)
        t.start()
    
    # 等待所有线程完成
    for t in threads:
        t.join()
    
    # 打印结果
    while not results.empty():
        print(results.get())
    
    print("所有账号任务完成！")

if __name__=='__main__': main()
