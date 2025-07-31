// ==UserScript==
// @name         微博自动评论工具
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动评论微博，评论内容随机选自评论区
// @author       路过的香菜丶
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

    GM_addStyle(`
        .comment-dialog {
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
            background: #409eff;
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

    class AutoComment {
        constructor() {
            this.isRunning = false;
            this.timer = null;
            this.currentCount = 0;
            this.totalCount = 0;
            this.init();
        }

        init() {
            this.createDialog();
            this.bindEvents();
        }

        createDialog() {
            const dialog = document.createElement('div');
            dialog.className = 'comment-dialog';
            dialog.innerHTML = `
                <div class="dialog-header">
                    <span>微博自动评论工具</span>
                    <span class="close-btn">×</span>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label>评论间隔（秒）</label>
                        <input type="number" id="interval" min="1" value="5">
                    </div>
                    <div class="control-buttons">
                        <button class="btn start-btn">开始评论</button>
                        <button class="btn stop-btn" style="display: none;">停止评论</button>
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

            closeBtn.addEventListener('click', () => {
                this.stopComment();
                this.dialog.remove();
            });

            startBtn.addEventListener('click', () => {
                const interval = parseInt(this.dialog.querySelector('#interval').value);
                if (interval < 1) {
                    this.addLog('请输入有效的间隔时间', true);
                    return;
                }
                this.startComment(interval);
            });

            stopBtn.addEventListener('click', () => {
                this.stopComment();
            });
        }

        async startComment(interval) {
            if (this.isRunning) return;
            this.isRunning = true;
            this.currentCount = 0;
            this.dialog.querySelector('.start-btn').style.display = 'none';
            this.dialog.querySelector('.stop-btn').style.display = 'block';
            this.addLog('开始自动评论...');
            const comment = async () => {
                try {
                    await this.performComment();
                    this.currentCount++;
                    this.addLog(`成功评论第 ${this.currentCount} 次`);
                    this.timer = setTimeout(comment, interval * 1000);
                } catch (error) {
                    this.addLog(`评论失败: ${error.message}`, true);
                    this.stopComment();
                }
            };
            comment();
        }

        stopComment() {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            this.isRunning = false;
            this.dialog.querySelector('.start-btn').style.display = 'block';
            this.dialog.querySelector('.stop-btn').style.display = 'none';
            if (this.currentCount > 0) {
                this.addLog(`已停止评论，共完成 ${this.currentCount} 次`);
            }
        }

        getStatusId() {
            // 兼容 /status/xxx 和 /detail/数字 两种URL
            let match = window.location.href.match(/\/status\/([^?&#]+)/);
            if (match) {
                return match[1];
            }
            match = window.location.href.match(/\/detail\/(\d+)/);
            if (match) {
                return match[1];
            }
            return null;
        }

        getCookie(name) {
            const value = "; " + document.cookie;
            const parts = value.split("; " + name + "=");
            if (parts.length === 2) return parts.pop().split(";").shift();
            return null;
        }

        async getMidFromStatusId(statusId) {
            // 通过微博详情接口获取mid
            return new Promise((resolve, reject) => {
                const url = `https://m.weibo.cn/statuses/show?id=${statusId}`;
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
                            if (result.ok === 1 && result.data && result.data.mid) {
                                resolve(result.data.mid);
                            } else {
                                reject(new Error('获取mid失败'));
                            }
                        } catch (error) {
                            reject(new Error('解析mid响应失败'));
                        }
                    },
                    onerror: function() {
                        reject(new Error('获取mid网络请求失败'));
                    }
                });
            });
        }

        async getRandomCommentContent(mid) {
            // 获取评论区内容，参数用mid，只返回大于等于15字的评论
            return new Promise((resolve, reject) => {
                const url = `https://m.weibo.cn/comments/hotflow?id=${mid}&mid=${mid}&max_id_type=0`;
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
                            if (result.ok === 1 && result.data && result.data.data && result.data.data.length > 0) {
                                // 只保留大于等于15个字的评论
                                const comments = result.data.data
                                    .map(item => item.text.replace(/<[^>]+>/g, ''))
                                    .filter(text => text.length >= 15);
                                if (comments.length === 0) {
                                    reject(new Error('评论区无可用评论（>=15字）'));
                                } else {
                                    const randomIndex = Math.floor(Math.random() * comments.length);
                                    resolve(comments[randomIndex]);
                                }
                            } else {
                                reject(new Error('评论区无可用评论'));
                            }
                        } catch (error) {
                            reject(new Error('解析评论区失败'));
                        }
                    },
                    onerror: function() {
                        reject(new Error('获取评论区失败'));
                    }
                });
            });
        }

        getRandomEmoji() {
            // 常用表情，可自行扩展
            const emojis = [
                '😊','😄','😃','😀','😁','😆','😅','😂','🤣','😍','🥰','😘','😋','😎','🤩','🥳','😏','😒','😞','😔','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','💩','👻','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','👋','👍','🙏','👏','💪','🫶','🧡','💙','💚','💛','💜','🖤','🤎','❤️','🩷','🩵','🩶','💖','💗','💓','💞','💕','💟','❣️','💔','💘','💝','💌','💤','💢','💥','💦','💨','🕳️','💣','💬','👀','👁️','👄','👅','🦷','🦴','🦾','🦿','🦵','🦶','🦻','👂','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','💋','🩸','💧','💦','💨','🫧','🩹','🩺','💊','💉','🦠','🧬','🧫','🧪','🧪','🧫','🧬','🦠','💉','💊','🩺','🩹','🫧','💨','💦','💧','🩸','💋','👄','👅','👁️','👀','🦴','🦷','🫁','🫀','🧠','🦻','👂','🦶','🦵','🦿','🦾','💪','✍️','🙏','🤝','🤲','👐','🙌','👏','🤜','🤛','👊','✊','👎','👍','☝️','👇','🖕','👆','👉','👈','🤙','🤘','🤟','🤞','✌️','🤏','🤌','👌','🖖','✋','🖐️','🤚','👋','😾','😿','🙀','😽','😼','😻','😹','😸','😺','🤖','👽','👻','💩','🤠','🤑','🤕','🤒','😷','🤧','🤮','🤢','🥴','🤐','😵','😪','🤤','😴','🥱','😲','😮','😧','😦','😯','🙄','😬','😑','😐','😶','🤥','🤫','🤭','🤔','🤗','😓','😥','😰','😨','😱','🥶','🥵','😳','🤯','🤬','😡','😠','😤','😭','😢','🥺','😩','😫','😖','😣','☹️','🙁','😕','😟','😔','😞','😒','😏','🥳','🤩','😎','🤓','🧐','🤨','🤪','😜','😝','😛','😋','😚','😙','😗','😘','🥰','😍','😌','😉','🙃','🙂','😇','😊','🤣','😂','😅','😆','😁','😀','😃','😄','😊'
            ];
            const randomIndex = Math.floor(Math.random() * emojis.length);
            return emojis[randomIndex];
        }

        async performComment() {
            try {
                const statusId = this.getStatusId();
                if (!statusId) throw new Error('未找到微博ID');
                const mid = await this.getMidFromStatusId(statusId);
                const xsrfToken = this.getCookie('XSRF-TOKEN');
                if (!xsrfToken) throw new Error('未找到XSRF-TOKEN，请确保已登录');
                let content = await this.getRandomCommentContent(mid);
                if (!content) throw new Error('未获取到评论内容');
                content = content + this.getRandomEmoji();
                // 构造参数，全部和示例一致
                const params = {
                    content: content,
                    id: mid,
                    mid: mid,
                    st: xsrfToken,
                    _spr: 'screen:451x800'
                };
                const url = 'https://m.weibo.cn/api/comments/create';
                const postData = new URLSearchParams(params).toString();
                this.addLog(`评论内容: ${params.content}`);
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
                                    this.addLog('评论成功', false, 'success');
                                    resolve();
                                } else {
                                    const errorMsg = result.msg || '评论失败';
                                    this.addLog(`评论失败: ${errorMsg}`, true, 'error');
                                    this.addLog(`接口响应状态: ${response.status}, 响应内容: ${response.responseText}`, true, 'error');
                                    reject(new Error(errorMsg));
                                }
                            } catch (error) {
                                this.addLog(`解析响应失败: ${error.message}`, true, 'error');
                                this.addLog(`接口原始响应: ${response.responseText}`, true, 'error');
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
                this.addLog(`评论过程出错: ${error.message}`, true, 'error');
                throw error;
            }
        }

        addLog(message, isError = false, type = 'info') {
            const logPanel = this.dialog.querySelector('.log-panel');
            const logItem = document.createElement('div');
            logItem.className = `log-item ${type}${isError ? ' error' : ''}`;
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

    window.addEventListener('load', () => {
        new AutoComment();
    });
})();
