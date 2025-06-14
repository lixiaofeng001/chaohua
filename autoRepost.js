// ==UserScript==
// @name         微博自动转发工具
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动转发微博工具，支持自定义时间间隔和转发次数
// @author       YourName
// @match        https://m.weibo.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_log
// @connect      m.weibo.cn
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        .repost-dialog {
            position: fixed;
            width: 400px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15);
            z-index: 99999;
            left: 20px;
            top: 20px;
            user-select: none;
        }

        .dialog-header {
            padding: 12px;
            background: #ff8140;
            color: white;
            border-radius: 8px 8px 0 0;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .dialog-body {
            padding: 15px;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: #606266;
        }

        .form-group input {
            width: 100%;
            padding: 8px;
            border: 1px solid #dcdfe6;
            border-radius: 4px;
            box-sizing: border-box;
        }

        .control-buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 15px;
        }

        .btn {
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: 0.3s;
        }

        .start-btn {
            background: #67c23a;
            color: white;
        }

        .stop-btn {
            background: #f56c6c;
            color: white;
        }

        .log-panel {
            margin-top: 15px;
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #dcdfe6;
            border-radius: 4px;
            padding: 10px;
        }

        .log-item {
            padding: 5px;
            border-bottom: 1px solid #ebeef5;
            font-size: 13px;
            display: flex;
            gap: 8px;
        }

        .log-time {
            color: #909399;
            flex: 0 0 80px;
        }

        .log-type {
            flex: 0 0 60px;
        }

        .log-type[data-type="request"] {
            color: #409eff;
        }

        .log-type[data-type="response"] {
            color: #67c23a;
        }

        .log-type[data-type="error"] {
            color: #f56c6c;
        }

        .log-type[data-type="success"] {
            color: #67c23a;
        }

        .log-message {
            flex: 1;
            word-break: break-all;
        }

        .log-item.error {
            background-color: #fef0f0;
        }
    `);

    class AutoRepost {
        constructor() {
            this.isRunning = false;
            this.timer = null;
            this.currentCount = 0;
            this.pageMid = null;
            this.emojis = ['😊', '😄', '😃', '😀', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '💩', '👻', '👽', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸', '💧', '💦', '💨', '🫧', '🩹', '🩺', '💊', '💉', '🦠', '🧬', '🧫', '🧪', '🧪', '🧫', '🧬', '🦠', '💉', '💊', '🩺', '🩹', '🫧', '💨', '💦', '💧', '🩸', '💋', '👄', '👅', '👁️', '👀', '🦴', '🦷', '🫁', '🫀', '🧠', '🦻', '👂', '🦶', '🦵', '🦿', '🦾', '💪', '✍️', '🙏', '🤝', '🤲', '👐', '🙌', '👏', '🤜', '🤛', '👊', '✊', '👎', '👍', '☝️', '👇', '🖕', '👆', '👉', '👈', '🤙', '🤘', '🤟', '🤞', '✌️', '🤏', '🤌', '👌', '🖖', '✋', '🖐️', '🤚', '👋', '😾', '😿', '🙀', '😽', '😼', '😻', '😹', '😸', '😺', '🤖', '👽', '👻', '💩', '🤠', '🤑', '🤕', '🤒', '😷', '🤧', '🤮', '🤢', '🥴', '🤐', '😵', '😪', '🤤', '😴', '🥱', '😲', '😮', '😧', '😦', '😯', '🙄', '😬', '😑', '😐', '😶', '🤥', '🤫', '🤭', '🤔', '🤗', '😓', '😥', '😰', '😨', '😱', '🥶', '🥵', '😳', '🤯', '🤬', '😡', '😠', '😤', '😭', '😢', '🥺', '😩', '😫', '😖', '😣', '☹️', '🙁', '😕', '😟', '😔', '😞', '😒', '😏', '🥳', '🤩', '😎', '🤓', '🧐', '🤨', '🤪', '😜', '😝', '😛', '😋', '😚', '😙', '😗', '😘', '🥰', '😍', '😌', '😉', '🙃', '🙂', '😇', '😊', '🤣', '😂', '😅', '😆', '😁', '😀', '😃', '😄', '😊'];
            this.init();
        }

        init() {
            this.createDialog();
            this.bindEvents();
            this.setupRouteChangeListener();
        }

        setupRouteChangeListener() {
            // 监听URL变化
            let lastUrl = window.location.href;
            new MutationObserver(() => {
                if (window.location.href !== lastUrl) {
                    lastUrl = window.location.href;
                    this.clearPageMid(); // URL变化时清除缓存
                }
            }).observe(document, { subtree: true, childList: true });

            // 监听页面刷新
            window.addEventListener('beforeunload', () => {
                this.clearPageMid();
            });
        }

        clearPageMid() {
            this.pageMid = null;
            this.addLog('页面变化，清除mid缓存', false, 'info');
        }

        createDialog() {
            const dialog = document.createElement('div');
            dialog.className = 'repost-dialog';
            dialog.innerHTML = `
                <div class="dialog-header">
                    <span>微博自动转发工具</span>
                    <span class="close-btn">×</span>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label>转发间隔（秒）</label>
                        <input type="number" id="interval" min="1" value="5">
                    </div>
                    <div class="form-group">
                        <label>转发次数</label>
                        <input type="number" id="count" min="1" value="1000">
                    </div>
                    <div class="control-buttons">
                        <button class="btn start-btn">开始转发</button>
                        <button class="btn stop-btn" style="display: none;">停止转发</button>
                    </div>
                    <div class="log-panel"></div>
                </div>
            `;
            document.body.appendChild(dialog);
            this.dialog = dialog;
        }

        bindEvents() {
            const header = this.dialog.querySelector('.dialog-header');
            const closeBtn = this.dialog.querySelector('.close-btn');
            const startBtn = this.dialog.querySelector('.start-btn');
            const stopBtn = this.dialog.querySelector('.stop-btn');

            // 拖拽功能
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;

            header.addEventListener('mousedown', (e) => {
                isDragging = true;
                initialX = e.clientX - this.dialog.offsetLeft;
                initialY = e.clientY - this.dialog.offsetTop;
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                    this.dialog.style.left = currentX + 'px';
                    this.dialog.style.top = currentY + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
            });

            // 关闭按钮
            closeBtn.addEventListener('click', () => {
                this.stopRepost();
                this.dialog.remove();
            });

            // 开始按钮
            startBtn.addEventListener('click', () => {
                const interval = parseInt(this.dialog.querySelector('#interval').value);
                const count = parseInt(this.dialog.querySelector('#count').value);
                
                if (interval < 1 || count < 1) {
                    this.addLog('请输入有效的间隔时间和转发次数', true);
                    return;
                }

                this.startRepost(interval, count);
            });

            // 停止按钮
            stopBtn.addEventListener('click', () => {
                this.stopRepost();
            });
        }

        async startRepost(interval, count) {
            if (this.isRunning) return;

            this.isRunning = true;
            this.currentCount = 0;
            this.totalCount = count;
            
            this.dialog.querySelector('.start-btn').style.display = 'none';
            this.dialog.querySelector('.stop-btn').style.display = 'block';

            this.addLog('开始自动转发...');

            const repost = async () => {
                try {
                    await this.performRepost();
                    this.currentCount++;
                    
                    if (this.currentCount >= count) {
                        this.addLog(`完成所有转发任务，共转发 ${count} 次`);
                        this.stopRepost();
                        return;
                    }

                    this.addLog(`成功转发第 ${this.currentCount}/${count} 次`);
                    this.timer = setTimeout(repost, interval * 1000);
                } catch (error) {
                    this.addLog(`转发失败: ${error.message}`, true);
                    this.stopRepost();
                }
            };

            repost();
        }

        stopRepost() {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            
            this.isRunning = false;
            this.dialog.querySelector('.start-btn').style.display = 'block';
            this.dialog.querySelector('.stop-btn').style.display = 'none';
            
            if (this.currentCount > 0) {
                this.addLog(`已停止转发，共完成 ${this.currentCount}/${this.totalCount} 次`);
            }
        }

        getRandomEmoji() {
            const randomIndex = Math.floor(Math.random() * this.emojis.length);
            return this.emojis[randomIndex];
        }

        async performRepost() {
            try {
                // 获取微博ID
                const statusId = this.getStatusId();
                if (!statusId) {
                    throw new Error('未找到微博ID');
                }

                // 获取mid（使用缓存）
                const mid = await this.getMidFromStatus(statusId);
                if (!mid) {
                    throw new Error('获取mid失败');
                }

                // 获取 XSRF-TOKEN
                const xsrfToken = this.getCookie('XSRF-TOKEN');
                if (!xsrfToken) {
                    throw new Error('未找到XSRF-TOKEN，请确保已登录');
                }

                // 构建转发请求
                const url = 'https://m.weibo.cn/api/statuses/repost';
                const content = `【转发】第${this.currentCount + 1}次转发${this.getRandomEmoji()}`;
                const st = xsrfToken

                // 构造请求数据
                const postData = new URLSearchParams({
                    id: mid,
                    content: content,
                    mid: mid,
                    st: st,
                    _spr: 'screen:1280x720'
                }).toString();

                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: url,
                        data: postData,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-Xsrf-Token': xsrfToken,
                            'Cookie': document.cookie,
                            'Referer': window.location.href
                        },
                        timeout: 3000,
                        onload: function(response) {
                            try {
                                const result = JSON.parse(response.responseText);
                                if (result.ok === 1) {
                                    this.addLog('转发成功', false, 'success');
                                    resolve();
                                } else {
                                    const errorMsg = result.msg || '转发失败';
                                    this.addLog(`转发失败: ${errorMsg}`, true, 'error');
                                    reject(new Error(errorMsg));
                                }
                            } catch (error) {
                                this.addLog(`解析响应失败: ${error.message}`, true, 'error');
                                reject(new Error('解析响应失败'));
                            }
                        }.bind(this),
                        onerror: function(error) {
                            this.addLog(`网络请求失败: ${error.message}`, true, 'error');
                            reject(new Error('网络请求失败'));
                        }.bind(this),
                        ontimeout: function() {
                            this.addLog('请求超时', true, 'error');
                            reject(new Error('请求超时'));
                        }.bind(this)
                    });
                });
            } catch (error) {
                this.addLog(`转发过程出错: ${error.message}`, true, 'error');
                throw error;
            }
        }

        getStatusId() {
            // 从URL中获取微博ID
            const match = window.location.href.match(/\/status\/([^?]+)/);
            if (match) {
                // this.addLog(`获取到微博ID: ${match[1]}`, false, 'info');
                return match[1];
            }
            return null;
        }

        getMidFromUrl() {
            // 从detail路径中获取mid
            const detailMatch = window.location.href.match(/\/detail\/(\d+)/);
            if (detailMatch) {
                const mid = detailMatch[1];
                this.addLog(`从URL直接获取到mid: ${mid}`, false, 'info');
                return mid;
            }
            return null;
        }

        async getMidFromStatus(statusId) {
            // 如果缓存中有mid，直接返回
            if (this.pageMid) {
                // this.addLog(`使用缓存的mid: ${this.pageMid}`, false, 'info');
                return this.pageMid;
            }

            // 尝试从URL直接获取mid
            const directMid = this.getMidFromUrl();
            if (directMid) {
                this.pageMid = directMid;
                return directMid;
            }

            // 如果没有直接获取到mid，则请求API
            return new Promise((resolve, reject) => {
                const url = `https://m.weibo.cn/statuses/show?id=${statusId}`;
                // this.addLog(`正在获取mid，请求URL: ${url}`, false, 'info');

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Cookie': document.cookie,
                        'Referer': window.location.href
                    },
                    onload: function(response) {
                        try {
                            const result = JSON.parse(response.responseText);
                            if (result.ok === 1 && result.data) {
                                const mid = result.data.id;
                                this.pageMid = mid; // 缓存mid
                                this.addLog(`成功获取并缓存mid: ${mid}`, false, 'success');
                                resolve(mid);
                            } else {
                                this.addLog(`获取mid失败: ${result.msg || '未知错误'}`, true, 'error');
                                reject(new Error('获取mid失败'));
                            }
                        } catch (error) {
                            this.addLog(`解析mid响应失败: ${error.message}`, true, 'error');
                            reject(new Error('解析mid响应失败'));
                        }
                    }.bind(this),
                    onerror: function(error) {
                        this.addLog(`获取mid网络请求失败: ${error.message}`, true, 'error');
                        reject(new Error('获取mid网络请求失败'));
                    }.bind(this)
                });
            });
        }

        getCookie(name) {
            const value = "; " + document.cookie;
            const parts = value.split("; " + name + "=");
            if (parts.length === 2) return parts.pop().split(";").shift();
            return null;
        }

        addLog(message, isError = false, type = 'info') {
            const logPanel = this.dialog.querySelector('.log-panel');
            const logItem = document.createElement('div');
            logItem.className = `log-item ${type}${isError ? ' error' : ''}`;
            
            // 添加时间戳和类型标签
            const timestamp = new Date().toLocaleTimeString();
            const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
            
            logItem.innerHTML = `
                <span class="log-time">[${timestamp}]</span>
                <span class="log-type">[${typeLabel}]</span>
                <span class="log-message">${message}</span>
            `;
            
            logPanel.appendChild(logItem);
            logPanel.scrollTop = logPanel.scrollHeight;
        }
    }

    // 等待页面加载完成后初始化
    window.addEventListener('load', () => {
        new AutoRepost();
    });
})(); 