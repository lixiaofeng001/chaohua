// ==UserScript==
// @name         批量修改微博可见性
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  批量修改微博可见性（公开/仅自己可见）
// @author       路过的香菜丶
// @match        https://weibo.com/u/*
// @grant        GM_xmlhttpRequest
// @connect      weibo.com
// ==/UserScript==

(function() {
    'use strict';
    const match = window.location.href.match(/weibo\.com\/u\/(\d+)/);
    var wbStoreTid;
    if (match) {
        wbStoreTid = match[1];
        console.log("UID:", wbStoreTid);
    } else {
        console.log("UID 不存在");
    }

    // 样式同weiboDelete.js
    const css = `
    .wb-panel { position: fixed; top: 100px; right: 20px; z-index: 9999; background: #fff; border-radius: 12px; box-shadow: 0 5px 25px rgba(0,0,0,0.15); padding: 20px; width: 340px; max-height: 70vh; overflow: hidden; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border: 1px solid #e9e9e9; transition: all 0.3s ease; }
    .wb-panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
    .wb-panel-title { font-size: 18px; font-weight: 600; color: #333; }
    .wb-close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; padding: 5px; }
    .wb-input-group { display: flex; gap: 10px; margin-bottom: 15px; }
    .wb-search-input { flex: 1; padding: 10px 15px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.2s; background: #fafafa; }
    .wb-search-input:focus { outline: none; border-color: #1da1f2; box-shadow: 0 0 0 2px rgba(29, 161, 242, 0.2); background: #fff; }
    .wb-btn { padding: 10px 16px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; }
    .wb-btn-primary { background: linear-gradient(135deg, #1da1f2, #0d8ddb); color: white; }
    .wb-btn-danger { background: linear-gradient(135deg, #ff4d4f, #d9363e); color: white; }
    .wb-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
    .wb-btn:active { transform: translateY(0); }
    .wb-controls { display: flex; justify-content: space-between; align-items: center; margin: 15px 0; padding: 10px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
    .wb-select-all { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #555; }
    .wb-results { flex: 1; overflow-y: auto; max-height: 300px; margin-top: 10px; padding-right: 5px; }
    .wb-result-item { padding: 12px 10px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: flex-start; transition: background 0.2s; }
    .wb-result-item:hover { background: #f9f9f9; }
    .wb-result-checkbox { margin-right: 10px; margin-top: 3px; accent-color: #1da1f2; }
    .wb-result-text { flex: 1; font-size: 14px; line-height: 1.5; color: #333; word-break: break-word; }
    .wb-status { text-align: center; padding: 10px; font-size: 14px; color: #666; }
    .wb-progress-bar { height: 4px; background: #e0e0e0; border-radius: 2px; margin-top: 10px; overflow: hidden; }
    .wb-progress { height: 100%; background: #1da1f2; border-radius: 2px; transition: width 0.3s; }
    .wb-collapse-btn { position: absolute; top: 10px; left: -40px; background: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer; border: 1px solid #eee; color: #1da1f2; font-size: 16px; }
    .wb-collapsed { transform: translateX(calc(100% + 20px)); }
    .wb-collapsed .wb-collapse-btn { left: auto; right: -40px; }
    .wb-count-badge { background: #ff4d4f; color: white; border-radius: 10px; padding: 2px 8px; font-size: 12px; margin-left: 5px; }
    .wb-results::-webkit-scrollbar { width: 6px; }
    .wb-results::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
    .wb-results::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
    .wb-results::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    class WeiboAPI {
        getHeaders() {
            return {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': document.cookie,
                'Referer': window.location.href
            };
        }
        async request(api, args, httpMethod) {
            return new Promise((resolve, reject) => {
                const requestData = {
                    method: httpMethod,
                    url: api,
                    headers: this.getHeaders(),
                    onload: (response) => {
                        const result = JSON.parse(response.responseText);
                        if (result.error) reject(result);
                        else resolve(result);
                    },
                    onerror: () => reject({})
                };
                if (httpMethod === "GET") {
                    requestData.url += '?' + new URLSearchParams(args).toString();
                    GM_xmlhttpRequest(requestData);
                } else {
                    requestData.data = new URLSearchParams(args).toString();
                    GM_xmlhttpRequest(requestData);
                }
            });
        }
        async getBatchStatuses(page) {
            const uid = wbStoreTid;
            const res = await this.request(
                "https://www.weibo.com/ajax/statuses/mymblog",
                { uid, page, feature: 0 },
                "GET"
            );
            const { list = [], total = 0 } = res.data || {};
            const hasNextPage = list.length > 0 && (page * 20) < total;
            return { statuses: list, hasNextPage };
        }
        async getAllStatuses() {
            const allStatuses = [];
            let page = 1;
            let hasNext = true;
            while (hasNext) {
                try {
                    const result = await this.getBatchStatuses(page);
                    allStatuses.push(...result.statuses);
                    hasNext = result.hasNextPage;
                    page += 1;
                } catch (err) {
                    console.error(`拉取第${page}页失败`, err);
                    break;
                }
            }
            return allStatuses;
        }
        async modifyVisible(mid, visible) {
            // 0: 公开，1: 仅自己可见
            return await this.request(
                "https://www.weibo.com/p/aj/v6/mblog/modifyvisible?__ref&ajwvr=6&domain=100505&__rnd=" + new Date().getTime(),
                { mid, visible, _t: 0 },
                "POST"
            );
        }
    }
    const api = new WeiboAPI();

    function createUI() {
        const panel = document.createElement('div');
        panel.className = 'wb-panel';
        panel.innerHTML = `
            <button class="wb-collapse-btn">✕</button>
            <div class="wb-panel-header">
                <div class="wb-panel-title">微博批量可见性修改</div>
                <button class="wb-close-btn">×</button>
            </div>
            <div class="wb-input-group">
                <input type="text" class="wb-search-input" id="wbSearch" placeholder="输入关键词搜索微博...">
                <button class="wb-btn wb-btn-primary" id="wbSearchBtn">搜索</button>
            </div>
            <button class="wb-btn wb-btn-primary" id="wbLoadBtn"><span id="wbLoadText">加载所有微博</span></button>
            <div class="wb-controls">
                <label class="wb-select-all"><input type="checkbox" id="wbSelectAll">全选</label>
                <span id="wbSelectedCount">已选择: 0条</span>
            </div>
            <div class="wb-progress-bar"><div class="wb-progress" id="wbProgress" style="width: 0%"></div></div>
            <div style="display:flex;gap:10px;margin:10px 0;">
                <button class="wb-btn wb-btn-primary" id="wbPublicBtn">转为公开</button>
                <button class="wb-btn wb-btn-danger" id="wbPrivateBtn">转为仅自己可见</button>
            </div>
            <div class="wb-results" id="wbResult"></div>
            <div class="wb-status" id="wbStatus">就绪</div>
        `;
        document.body.appendChild(panel);
        document.getElementById("wbLoadBtn").addEventListener("click", loadAllWeibos);
        document.getElementById("wbSearchBtn").addEventListener("click", filterWeibos);
        document.getElementById("wbSelectAll").addEventListener("change", toggleSelectAll);
        document.getElementById("wbPublicBtn").addEventListener("click", () => batchModifyVisible(0));
        document.getElementById("wbPrivateBtn").addEventListener("click", () => batchModifyVisible(1));
        panel.querySelector(".wb-close-btn").addEventListener("click", () => panel.remove());
        panel.querySelector(".wb-collapse-btn").addEventListener("click", togglePanel);
        panel.addEventListener("change", updateSelectionCount);
    }
    let allWeibos = [];
    let isPanelCollapsed = false;
    function togglePanel() {
        const panel = document.querySelector('.wb-panel');
        isPanelCollapsed = !isPanelCollapsed;
        panel.classList.toggle('wb-collapsed', isPanelCollapsed);
        panel.querySelector('.wb-collapse-btn').textContent = isPanelCollapsed ? '+' : '✕';
    }
    function updateSelectionCount() {
        const selected = document.querySelectorAll('.wb-item:checked').length;
        document.getElementById('wbSelectedCount').textContent = `已选择: ${selected}条`;
    }
    async function loadAllWeibos() {
        const btn = document.getElementById("wbLoadBtn");
        const statusEl = document.getElementById("wbStatus");
        btn.disabled = true;
        statusEl.textContent = "加载中，请稍候...";
        document.getElementById("wbResult").innerHTML = "";
        try {
            allWeibos = await api.getAllStatuses();
            showWeibos(allWeibos);
            statusEl.textContent = `加载完成，共 ${allWeibos.length} 条微博`;
        } catch (error) {
            console.error("加载失败:", error);
            statusEl.textContent = "加载失败，请刷新页面重试";
        } finally {
            btn.disabled = false;
        }
    }
    function filterWeibos() {
        const keyword = document.getElementById("wbSearch").value.trim().toLowerCase();
        const statusEl = document.getElementById("wbStatus");
        if (!allWeibos.length) {
            statusEl.textContent = "请先加载微博";
            return;
        }
        if (!keyword) {
            showWeibos(allWeibos);
            statusEl.textContent = "已显示所有微博";
            return;
        }
        const filtered = allWeibos.filter(wb => (wb.text_raw || "").toLowerCase().includes(keyword));
        showWeibos(filtered);
        statusEl.textContent = `找到 ${filtered.length} 条匹配的微博`;
    }
    function showWeibos(list) {
        const container = document.getElementById("wbResult");
        container.innerHTML = '';
        if (list.length === 0) {
            container.innerHTML = '<div class="wb-result-item">无匹配微博</div>';
            return;
        }
        list.forEach(wb => {
            const item = document.createElement("div");
            item.className = "wb-result-item";
            item.innerHTML = `
                <input type="checkbox" class="wb-item wb-result-checkbox" value="${wb.mid}">
                <div class="wb-result-text">${wb.text_raw?.slice(0, 100) || "[无文本]"}</div>
                <span style="font-size:12px;color:#888;margin-left:8px;">${wb.visible === 0 ? '公开' : wb.visible === 1 ? '仅自己' : '其他'}</span>
            `;
            container.appendChild(item);
        });
        updateSelectionCount();
    }
    function toggleSelectAll() {
        const checked = document.getElementById("wbSelectAll").checked;
        document.querySelectorAll(".wb-item").forEach(chk => chk.checked = checked);
        updateSelectionCount();
    }
    async function batchModifyVisible(visible) {
        const items = document.querySelectorAll(".wb-item:checked");
        const mids = Array.from(items).map(i => i.value);
        const statusEl = document.getElementById("wbStatus");
        const progressEl = document.getElementById("wbProgress");
        if (!mids.length) {
            statusEl.textContent = "请先选择要修改的微博";
            return;
        }
        if (!confirm(`确定要将 ${mids.length} 条微博批量转为${visible === 0 ? '公开' : '仅自己可见'}吗？`)) return;
        const btns = [document.getElementById("wbPublicBtn"), document.getElementById("wbPrivateBtn")];
        btns.forEach(btn => btn.disabled = true);
        statusEl.textContent = `正在修改，请勿关闭页面...`;
        let successCount = 0;
        const total = mids.length;
        for (let i = 0; i < mids.length; i++) {
            const mid = mids[i];
            progressEl.style.width = `${((i + 1) / total) * 100}%`;
            statusEl.textContent = `修改中 (${i + 1}/${total})...`;
            try {
                await api.modifyVisible(mid, visible);
                successCount++;
                // 更新UI
                const item = document.querySelector(`.wb-item[value="${mid}"]`);
                if (item) {
                    item.closest('.wb-result-item').querySelector('span').textContent = visible === 0 ? '公开' : '仅自己';
                }
            } catch (e) {
                // 忽略
            }
        }
        progressEl.style.width = "0%";
        btns.forEach(btn => btn.disabled = false);
        statusEl.textContent = `修改完成，成功修改 ${successCount}/${total} 条微博`;
        updateSelectionCount();
        // 更新全选状态
        const remaining = document.querySelectorAll('.wb-item').length;
        document.getElementById('wbSelectAll').checked = remaining > 0 && document.querySelectorAll('.wb-item:checked').length === remaining;
    }
    createUI();
})();
