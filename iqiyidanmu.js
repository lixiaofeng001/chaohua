// ==UserScript==
// @name         爱奇艺自动发送、点赞弹幕
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  爱奇艺自动发送、点赞弹幕
// @author       路过的香菜丶
// @match        https://www.iqiyi.com/v_*.html*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let autoLikeRunning = false;
    let autoLikeTimer = null;
    let likedDanmus = [];
    let autoRepeatRunning = false;
    let autoRepeatTimer = null;
    let lastSentDanmu = '';

    // 创建控制面板
    function createPanel() {
        if (document.getElementById('danmu-like-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'danmu-like-panel';
        panel.style.position = 'fixed';
        panel.style.bottom = '40px';
        panel.style.right = '40px';
        panel.style.zIndex = 99999;
        panel.style.background = 'rgba(255,255,255,0.98)';
        panel.style.border = '1px solid #e0e0e0';
        panel.style.borderRadius = '12px';
        panel.style.padding = '18px 20px 16px 20px';
        panel.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
        panel.style.minWidth = '320px';
        panel.innerHTML = `
            <style>
            #danmu-like-count {
                position: absolute;
                top: 10px;
                right: 18px;
                background: #ff7e5f;
                color: #fff;
                font-size: 13px;
                font-weight: bold;
                border-radius: 10px;
                padding: 2px 10px;
                box-shadow: 0 1px 4px rgba(255,126,95,0.10);
                z-index: 100001;
            }
            #danmu-like-toggle {
                background: linear-gradient(90deg, #ff7e5f 0%, #feb47b 100%);
                color: #fff;
                border: none;
                border-radius: 20px;
                padding: 10px 32px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(255,126,95,0.12);
                transition: background 0.2s, box-shadow 0.2s;
                margin-bottom: 8px;
                outline: none;
            }
            #danmu-like-toggle:hover {
                background: linear-gradient(90deg, #feb47b 0%, #ff7e5f 100%);
                box-shadow: 0 4px 16px rgba(255,126,95,0.18);
            }
            #danmu-auto-repeat {
                margin-left: 10px;
                background: linear-gradient(90deg, #ffb347 0%, #ffcc33 100%);
                color: #fff;
                border: none;
                border-radius: 20px;
                padding: 10px 32px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(255,179,71,0.12);
                transition: background 0.2s, box-shadow 0.2s;
                outline: none;
            }
            #danmu-auto-repeat:hover {
                background: linear-gradient(90deg, #ffcc33 0%, #ffb347 100%);
                box-shadow: 0 4px 16px rgba(255,179,71,0.18);
            }
            #danmu-liked-table {
                width: 280px;
                table-layout: fixed;
                border-collapse: separate;
                border-spacing: 0;
                margin-top: 10px;
                font-size: 14px;
                background: #fafbfc;
                border-radius: 6px;
                overflow: hidden;
            }
            #danmu-liked-table th, #danmu-liked-table td {
                border: 1px solid #ececec;
                padding: 6px 10px;
                text-align: left;
                word-break: break-all;
                white-space: pre-wrap;
                vertical-align: top;
            }
            #danmu-liked-table th {
                background: #f7f7f7;
                font-weight: bold;
                color: #ff7e5f;
            }
            #danmu-liked-table tbody tr:nth-child(even) {
                background: #f5f5f5;
            }
            #danmu-liked-tbody {
                display: block;
                max-height: 300px;
                overflow-y: auto;
                width: 100%;
            }
            #danmu-liked-table thead, #danmu-liked-table tbody tr {
                display: table;
                width: 100%;
                table-layout: fixed;
            }
            /* 强制让播放器底部控制栏始终显示 */
            .XPlayer_bottom__xzRnb {
                transform: translateY(0px) !important;
                opacity: 1 !important;
                transition: none !important;
            }
            /* 取消鼠标移入移出时的样式变化 */
            .XPlayer_bottom__xzRnb:hover,
            .XPlayer_bottom__xzRnb:active,
            .XPlayer_bottom__xzRnb[style] {
                transform: translateY(0px) !important;
                opacity: 1 !important;
                transition: none !important;
            }
            </style>
            <button id="danmu-like-toggle">启动自动点赞</button>
            <button id="danmu-auto-repeat">自动发送弹幕</button>
        `;
        document.body.appendChild(panel);

        document.getElementById('danmu-like-toggle').onclick = function() {
            autoLikeRunning = !autoLikeRunning;
            this.innerText = autoLikeRunning ? '停止自动点赞' : '启动自动点赞';
            if (autoLikeRunning) {
                autoLikeLoop();
            } else {
                if (autoLikeTimer) clearTimeout(autoLikeTimer);
            }
        };

        // 自动发送弹幕按钮
        document.getElementById('danmu-auto-repeat').onclick = function() {
            autoRepeatRunning = !autoRepeatRunning;
            this.innerText = autoRepeatRunning ? '停止自动发送' : '自动发送弹幕';
            if (autoRepeatRunning) {
                autoRepeatLoop();
            } else {
                if (autoRepeatTimer) clearTimeout(autoRepeatTimer);
            }
        };
    }

    // 自动点赞主循环
    function autoLikeLoop() {
        if (!autoLikeRunning) return;
        likeAllVisibleDanmuWithDelay();
    }

    // 逐条延迟点赞，模拟人工操作
    function likeAllVisibleDanmuWithDelay() {
        const items = Array.from(document.querySelectorAll('.danmaku-item'));
        let idx = 0;
        function likeNext() {
            if (!autoLikeRunning || idx >= items.length) {
                // 下一轮循环，间隔更长（改为2秒）
                autoLikeTimer = setTimeout(autoLikeLoop, 2000);
                return;
            }
            const item = items[idx++];
            const contentDiv = item.querySelector('.danmaku-content');
            const likeBtn = item.querySelector('.upvote-button');
            if (!contentDiv || !likeBtn) return likeNext();
            const content = contentDiv.innerText.trim();
            const likedIcon = likeBtn.querySelector('.liked-icon');
            const upvoteNum = likeBtn.querySelector('.upvote-num');
            const isLiked = likedIcon && !likedIcon.classList.contains('dn');
            const isNumColored = upvoteNum && upvoteNum.classList.contains('upvote-num-color');
            if ((!isLiked && !isNumColored) && !likedDanmus.includes(content)) {
                item.classList.add('itemHover');
                item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                likeBtn.click();
                likedDanmus.push(content);
                console.log('已自动点赞弹幕:', content);
                setTimeout(likeNext, 180 + Math.random() * 120);
            } else {
                likeNext();
            }
        }
        likeNext();
    }

    // 更稳健地查找发送按钮（支持部分class匹配和disabled属性）
    function getSendBtn() {
        // 选择 class 含 danmuSubmitNew 的 span
        const btns = Array.from(document.querySelectorAll('span'));
        return btns.find(btn => btn.className.includes('danmuSubmitNew') && btn.innerText.includes('发送'));
    }
    // 检查发送按钮是否可用
    function isSendBtnEnabled() {
        const btn = getSendBtn();
        if (!btn) return false;
        // 检查class和disabled属性
        if (btn.className.includes('Disabled')) return false;
        if (btn.hasAttribute('disabled')) return false;
        if (btn.style.pointerEvents === 'none') return false;
        return true;
    }
    // 逐字输入模拟（修正版，确保 React/Vue 能感知 value 变化）
    async function typeInput(input, text) {
        console.log('[danmu] 开始逐字输入:', text);
        // 用原生 setter 设置 value
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        for (let i = 0; i < text.length; i++) {
            const val = input.value + text[i];
            nativeInputValueSetter.call(input, val);
            input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: text[i] }));
            input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text[i], inputType: 'insertText' }));
            input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: text[i] }));
            await new Promise(r => setTimeout(r, 30 + Math.random() * 30));
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('compositionstart', { bubbles: true }));
        input.dispatchEvent(new Event('compositionend', { bubbles: true }));
        console.log('[danmu] 逐字输入完成:', input.value);
    }

    // 发送弹幕（流程：先focus，逐字输入，输入后再判断按钮是否可用并点击）
    function sendDanmu(content) {
        const input = document.querySelector('.player-buttons_danmuInputEditBoxNew__8jijt input[type="text"]');
        let sendBtn = getSendBtn();
        console.log('[danmu] 尝试发送:', content);
        if (!input || !sendBtn) {
            console.log('[danmu] 未找到弹幕输入框或发送按钮', input, sendBtn);
            return;
        }
        input.focus();
        console.log('[danmu] 输入框已focus');
        setTimeout(async () => {
            await typeInput(input, content);
            input.blur();
            console.log('[danmu] 输入框已blur，准备点击发送');
            // 等待按钮变为可用
            setTimeout(() => {
                sendBtn = getSendBtn();
                if (sendBtn && isSendBtnEnabled()) {
                    console.log('[danmu] 发送按钮可用，点击发送');
                    sendBtn.click();
                } else {
                    console.log('[danmu] 发送按钮仍不可用，未点击');
                }
            }, 350 + Math.random() * 150);
        }, 200 + Math.random() * 100);
    }

    // 自动复读主循环，实时获取最新弹幕，且不重复发送上一条
    function autoRepeatLoop() {
        if (!autoRepeatRunning) return;
        // 实时获取所有可见弹幕内容
        const danmuNodes = Array.from(document.querySelectorAll('.danmaku-item .danmaku-content'));
        // 过滤掉上一条已发送内容
        const danmuContents = danmuNodes.map(node => node.innerText.trim()).filter(content => content && content !== lastSentDanmu);
        if (danmuContents.length === 0) {
            autoRepeatTimer = setTimeout(autoRepeatLoop, 2000);
            return;
        }
        // 随机抽取一条内容
        const randomIdx = Math.floor(Math.random() * danmuContents.length);
        const content = danmuContents[randomIdx];
        if (content) {
            lastSentDanmu = content;
            sendDanmu(content);
        } else {
            console.log('[danmu] 随机抽取弹幕内容为空，跳过');
        }
        autoRepeatTimer = setTimeout(autoRepeatLoop, 5000);
    }

    // 创建面板
    createPanel();

})();
