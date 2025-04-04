// ==UserScript==
// @name         微博转发
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  转发工具
// @author       YourName
// @match        https://weibo.com/n/%E8%99%9E%E4%B9%A6%E6%AC%A3Esther
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @connect      weibo.com
// ==/UserScript==

(function() {
    'use strict';

    class WeiboReposter {
        // 添加 bodies 数组的定义
        static bodies = [
            "比起天赋，我更相信反复练习的力量@虞书欣Esther ​​​",
            "有我们再，你不再是一个人了@虞书欣Esther ​​​​",
            "谢谢你的出现 让我黯淡无光的世界有了一丝光亮@虞书欣Esther ​​​​",
            "烟花绽放的声音 是我无声的告白@虞书欣Esther ​​​​",
            "盛不盛开，花都是花，那片海的浪不会停，我对你的爱也是@虞书欣Esther ​​​​",
            "“你是乱花欲渐中唯一用青睐燃烧的星火燎原 𝙔𝙤𝙪 𝙖𝙧𝙚 𝙩𝙚 𝙤𝙣𝙡𝙮 𝙨𝙥𝙖𝙧𝙠 𝙩𝙖𝙩 𝙗𝙪𝙧𝙣𝙨 𝙬𝙞𝙩𝙝 𝙡𝙤𝙫𝙚 𝙞𝙣 𝙩𝙝𝙚 𝙘𝙝𝙖𝙤𝙨.”@虞书欣Esther"
        ];

        static repost(originalWeiboId, comment = '') {
            const params = new URLSearchParams({
                id: originalWeiboId,
                comment: comment,
                pic_id: '',
                is_repost: 0,
                comment_ori: 0,
                is_comment: 1,
                visible: 0,
                share_id: '',
                _t: Date.now(),
                location: 'page_100808_super_index'
            });

            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://weibo.com/ajax/statuses/normal_repost',
                headers: this.getHeaders(),
                data: params.toString(),
                onload: (res) => this.handleResponse(res, originalWeiboId, comment)
            });
        }

        static getHeaders() {
            return {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': document.cookie,
                'Referer': window.location.href,
                'Origin': 'https://weibo.com'
            };
        }

        static handleResponse(res, weiboId, comment) {
            let result;
            try {
                result = JSON.parse(res.responseText);
            } catch (e) {
                console.error('解析响应失败:', e);
                result = { ok: 0 };
            }

            const logs = GM_getValue('repost_logs', []);
            logs.push({
                time: new Date().toISOString(),
                weiboId: weiboId,
                comment: comment,
                success: result.ok === 1,
                response: result
            });
            GM_setValue('repost_logs', logs.slice(-100));

            this.updateUI(result);
        }

        static updateUI(response) {
            if (response.ok === 1) {
                const stats = GM_getValue('repost_stats', { success: 0, fail: 0 });
                stats.success++;
                GM_setValue('repost_stats', stats);
                
                // 显示成功提示
                const successTip = document.createElement('div');
                successTip.style = 'position: fixed; top: 20px; right: 20px; padding: 15px; background: #67C23A; color: white; border-radius: 5px; z-index: 9999;';
                successTip.innerText = `转发成功！新微博ID：${response.data.statuses.id}`;
                document.body.appendChild(successTip);
                
                setTimeout(() => successTip.remove(), 3000);
            } else {
                const stats = GM_getValue('repost_stats', { success: 0, fail: 0 });
                stats.fail++;
                GM_setValue('repost_stats', stats);
                
                // 显示错误提示
                const errorTip = document.createElement('div');
                errorTip.style = 'position: fixed; top: 20px; right: 20px; padding: 15px; background: #F56C6C; color: white; border-radius: 5px; z-index: 9999;';
                errorTip.innerText = `转发失败：${response.msg || '未知错误'}`;
                document.body.appendChild(errorTip);
                
                setTimeout(() => errorTip.remove(), 5000);
            }

            // 更新统计面板
            this.updateStatsPanel();
        }

        static updateStatsPanel() {
            const statsPanel = document.getElementById('repost-stats-panel');
            if (statsPanel) {
                const logs = GM_getValue('repost_logs', []);
                // 过滤掉包含特定关键词的日志条目
                const filteredLogs = logs.filter(log => !log.comment.includes('定时任务已启动') && !log.comment.includes('定时任务已停止'));
                const successCount = filteredLogs.filter(l => l.success).length;
                const statsHTML = `
                    <h3>转发统计</h3>
                    <p>总发送数: ${filteredLogs.length}</p>
                    <p>成功: ${successCount}</p>
                    <p>失败: ${filteredLogs.length - successCount}</p>
                    <p>成功率: ${filteredLogs.length ? (successCount / filteredLogs.length * 100).toFixed(2) : 0}%</p>
                `;
                statsPanel.innerHTML = statsHTML;
            }
        }

        static clearLogsAndStats() {
            GM_setValue('repost_logs', []);
            GM_setValue('repost_stats', { success: 0, fail: 0 });
            this.updateStatsPanel(); // 更新统计面板
        }

        static shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        static startAutoRepost(weiboId, interval) {
            if (this.autoRepostInterval) {
                clearInterval(this.autoRepostInterval);
            }

            // 打乱文案池
            this.shuffledBodies = [...this.bodies];
            this.shuffleArray(this.shuffledBodies);
            this.currentBodyIndex = 0;

            this.autoRepostInterval = setInterval(() => {
                if (this.currentBodyIndex >= this.shuffledBodies.length) {
                    // 如果文案用完了，重新打乱并重置索引
                    this.shuffledBodies = [...this.bodies];
                    this.shuffleArray(this.shuffledBodies);
                    this.currentBodyIndex = 0;
                }

                const randomComment = this.shuffledBodies[this.currentBodyIndex];
                this.repost(weiboId, randomComment);
                this.currentBodyIndex++;
            }, interval * 60 * 1000);
        }

        static stopAutoRepost() {
            if (this.autoRepostInterval) {
                clearInterval(this.autoRepostInterval);
                this.autoRepostInterval = null;
            }
        }

        static createControlPanel() {
            const panel = document.createElement('div');
            panel.id = 'weibo-repost-panel';
            panel.style = `
                position: fixed;
                top: 100px;
                left: 50%; /* 修改为水平居中 */
                transform: translateX(-50%); /* 使元素向左偏移自身宽度的一半 */
                background: #fff;
                padding: 20px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.1);
                z-index: 9999;
                width: 400px;
                border-radius: 4px;
                border: 1px solid #d9d9d9;
            `;

            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin-bottom: 10px;">微博转发工具</h3>
                </div>
                <div>
                    <input type="text" id="repost-weibo-id" placeholder="原微博ID" style="margin-bottom: 10px; padding: 8px; border: 1px solid #d9d9d9; border-radius: 4px;">
                    <input type="number" id="repost-interval" placeholder="定时转发间隔（分钟）" style="margin-bottom: 10px; padding: 8px; border: 1px solid #d9d9d9; border-radius: 4px;">
                    <button id="toggle-repost" style="background: #1890ff; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">开始转发</button>
                    <button id="clear-logs" style="background: #faad14; color: white; padding: 8px 16px; border: none; border-radius: 4px; margin-left: 10px; cursor: pointer;">清除日志</button>
                </div>
                <div id="repost-stats-panel" style="margin-top: 15px;"></div>
            `;

            document.body.appendChild(panel);

            // 添加拖拽相关的属性
            this.isDragging = false;
            this.startX = 0;
            this.startY = 0;

            // 绑定拖拽事件
            panel.addEventListener('mousedown', this.startDrag.bind(this));
            document.addEventListener('mousemove', this.handleDrag.bind(this));
            document.addEventListener('mouseup', this.stopDrag.bind(this));

            document.getElementById('toggle-repost').addEventListener('click', debounce(() => {
                const weiboId = document.getElementById('repost-weibo-id').value;
                const interval = document.getElementById('repost-interval').value;

                if (!weiboId) {
                    alert('请输入微博ID');
                    return;
                }

                if (!interval) {
                    alert('请输入定时转发间隔');
                    return;
                }

                const toggleButton = document.getElementById('toggle-repost');
                if (toggleButton.innerText === '开始转发') {
                    // 禁用开始转发按钮
                    toggleButton.disabled = true;

                    // 立即触发一次转发
                    WeiboReposter.repost(weiboId, WeiboReposter.bodies[Math.floor(Math.random() * WeiboReposter.bodies.length)]);

                    WeiboReposter.startAutoRepost(weiboId, interval);

                    // 更新按钮文本
                    toggleButton.innerText = '停止转发';

                    // 启用按钮
                    toggleButton.disabled = false;
                } else {
                    WeiboReposter.stopAutoRepost();

                    // 更新按钮文本
                    toggleButton.innerText = '开始转发';

                    // 修改按钮背景颜色为红色
                    toggleButton.style.background = '#ff4d4f';
                }
            }, 300));

            document.getElementById('clear-logs').addEventListener('click', debounce(() => {
                WeiboReposter.clearLogsAndStats();
            }, 300));

            // 初始化统计面板
            this.updateStatsPanel();

            // 添加这一行代码以确保 this.panel 被正确引用
            this.panel = panel;
        }

        // 拖动逻辑
        static startDrag(e) {
            this.isDragging = true;
            this.startX = e.clientX - this.panel.offsetLeft;
            this.startY = e.clientY - this.panel.offsetTop;
        }

        static handleDrag(e) {
            if (this.isDragging) {
                const x = e.clientX - this.startX;
                const y = e.clientY - this.startY;
                this.panel.style.left = `${x}px`;
                this.panel.style.top = `${y}px`;
            }
        }

        static stopDrag() {
            this.isDragging = false;
        }
    }

    // 添加防抖函数
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    // 初始化控制面板
    WeiboReposter.createControlPanel();
})();
