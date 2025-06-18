import time
import random
import sys
import requests

# ——【一】配置区——
VIDEO_CODES = [
    "l4100htiszw",  # 第1集
]
CID = "mzc002007sqbpce"
VAPPID = "70930403"
VSECRET = "e496b057758aeb04b3a2d623c952a1c47e04ffb0a01e19cf"
VIDEO_APPID = "1000005"
SEGMENT_MS = 30_000
LIKE_URL = (
    "https://pbaccess.video.qq.com/com.tencent.qqlive.protocol.pb.PraiseService/"  
    "doPraiseAction"
)

# 多用户 Cookie 列表
USER_COOKIES = [
    "qq_domain_video_guid_verify=2f0c1ed55ffd5010; _qimei_uuid42=1931c122a111004f4e816f85e5d4bc374b74947f24; _qimei_q36=; _qimei_h38=59a993f84e816f85e5d4bc370200000701931c; pgv_pvid=5884138296; video_platform=2; video_guid=2f0c1ed55ffd5010; check_16=7c02308a93a84917f355bbd92db9d4a8; _qimei_fingerprint=3cd16105e80abe18d7019a90db9f1e95; pgv_info=ssid=s5475778626; main_login=wx; access_token=93_vznREFCdQLGCgbIhAhvT8d-oSBTUPUICe5IvxT43iwiLH1SdjJRuEnTZeKvExlmwTYGrkY4j6bKtp0ZIwK5WyBSYhAL56Vo6YqXAnKpD9os; appid=wx5ed58254bc0d6b7f; openid=ox8XOvqRcPL21bXZeoew2xVEyEuY; vuserid=32522070; refresh_token=93_8NKocyGYD9oEEsJPNXvSu0J_yMBEp6wRd0x3XsK28pQQG5kcovEgDqXcPr1gb7q565wGDTZEYDG43IIT4Um44TGkLleGc2O3evUeIas2bm0; _video_qq_version=1.1; _video_qq_access_token=93_vznREFCdQLGCgbIhAhvT8d-oSBTUPUICe5IvxT43iwiLH1SdjJRuEnTZeKvExlmwTYGrkY4j6bKtp0ZIwK5WyBSYhAL56Vo6YqXAnKpD9os; _video_qq_appid=wx5ed58254bc0d6b7f; _video_qq_openid=ox8XOvqRcPL21bXZeoew2xVEyEuY; _video_qq_vuserid=32522070; _video_qq_refresh_token=93_8NKocyGYD9oEEsJPNXvSu0J_yMBEp6wRd0x3XsK28pQQG5kcovEgDqXcPr1gb7q565wGDTZEYDG43IIT4Um44TGkLleGc2O3evUeIas2bm0; _video_qq_main_login=wx; wx_nick=%E8%B7%AF%E8%BF%87%E7%9A%84%E9%A6%99%E8%8F%9C%E4%B8%B6; wx_head=https%3A%2F%2Fimage.video.qpic.cn%2F1234_0cdef6-1_1991729072_1658589742940520; vversion_name=8.2.95; video_omgid=2f0c1ed55ffd5010; vusession=AstwpHn_0i2bFohZ8KuivQA6l7AwmA28Rm9Y6kpifIankNAIzll9sTCH9KCjUuI-g3OmkI-bgA4lLQCN9xDaoRFH3FTvO9NzbL4qTOF3Si5GZO-IcoF7MUJ60zpFlxvRRw.M; _video_qq_vusession=AstwpHn_0i2bFohZ8KuivQA6l7AwmA28Rm9Y6kpifIankNAIzll9sTCH9KCjUuI-g3OmkI-bgA4lLQCN9xDaoRFH3FTvO9NzbL4qTOF3Si5GZO-IcoF7MUJ60zpFlxvRRw.M; login_time_init=1750171482; next_refresh_time=6209; _video_qq_login_time_init=1750171482; _video_qq_next_refresh_time=6209; login_time_last=2025-6-17 22:44:42",
]

# ——【二】辅助函数——
def make_session(cookie_str: str) -> requests.Session:
    headers = {
        "Content-Type": "application/json",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/114.0.0.0 Safari/537.36"
        ),
        "Cookie": cookie_str,
    }
    sess = requests.Session()
    sess.headers.update(headers)
    return sess


def fetch_all_barrages(sess: requests.Session, vid: str) -> list:
    t = 0
    all_items = []
    while True:
        url = f"https://dm.video.qq.com/barrage/segment/{vid}/t/v1/{t}/{t+SEGMENT_MS}"
        resp = sess.get(url)
        resp.raise_for_status()
        items = resp.json().get("barrage_list", [])
        if not items:
            break
        all_items.extend(items)
        print(f"[{vid}] 拉取 {len(items)} 条弹幕 @ {t}-{t+SEGMENT_MS} ms")
        t += SEGMENT_MS
        time.sleep(random.uniform(0.1, 0.3))
    print(f"[{vid}] 共抓取 {len(all_items)} 条弹幕")
    return all_items


def like_barrage(sess: requests.Session, vid: str, danmaku_id: str, user_idx: int):
    payload = {
        "praise_action_type": 1,
        "praise_data": {
            "praise_data_key": f"id={danmaku_id}&vid={vid}&cid={CID}",
            "praise_type": "praise_type_barrage",
            "praise_match_key": danmaku_id,
        }
    }
    params = {"vappid": VAPPID, "vsecret": VSECRET, "video_appid": VIDEO_APPID}
    resp = sess.post(LIKE_URL, params=params, json=payload)
    
    # 解析返回并判断结果
    try:
        j = resp.json()
    except ValueError:
        print(f"[用户{user_idx}][{vid}] 弹幕 {danmaku_id} 点赞失败：非 JSON 返回 → {resp.text}")
        return True  # 继续下一个

    # 最外层错误
    if j.get("ret") != 0:
        print(f"[用户{user_idx}][{vid}] 弹幕 {danmaku_id} 点赞失败：ret={j.get('ret')} msg={j.get('msg')}")
        return True

    data = j.get("data", {})
    err_code = data.get("err_code")
    err_msg = data.get("err_msg")
    # 如果操作过于频繁，立即停止整个脚本
    if err_code == -2021009:
        print(f"[用户{user_idx}][{vid}] 触发频率限制，停止任务：{err_msg}")
        sys.exit(1)

    if err_code != 0:
        print(f"[用户{user_idx}][{vid}] 弹幕 {danmaku_id} 点赞失败：err_code={err_code} err_msg={err_msg}")
        return True

    # 判断点赞状态
    praise_info = data.get("praise_info") or {}
    status = praise_info.get("praise_status")
    if status == 1:
        print(f"[用户{user_idx}][{vid}] 弹幕 {danmaku_id} 点赞成功 ✔")
    else:
        print(f"[用户{user_idx}][{vid}] 弹幕 {danmaku_id} 点赞未生效 (status={status})")
    return True


# ——【三】主流程——
if __name__ == "__main__":
    for user_idx, cookie in enumerate(USER_COOKIES, start=1):
        print(f"\n=== 用户 {user_idx} 开始任务 ===")
        session = make_session(cookie)

        for vid in VIDEO_CODES:
            print(f"[用户{user_idx}][{vid}] 开始拉弹幕")
            barrages = fetch_all_barrages(session, vid)

            print(f"[用户{user_idx}][{vid}] 开始点赞 {len(barrages)} 条弹幕")
            for i, dm in enumerate(barrages, 1):
                like_barrage(session, vid, dm["id"], user_idx)
                time.sleep(random.uniform(0.5, 0.1))

        print(f"=== 用户 {user_idx} 任务完成 ===")

    print("\n所有用户的弹幕点赞任务已全部完成！")
