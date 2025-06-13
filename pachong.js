// 配置参数
const API_ENDPOINT = 'http://localhost:3002/v1/crawl';
const API_KEY = 'fc-4acd482ee48c4e4bbed7691a7c67bf73'; // 替换为你的密钥
const TARGET_URL = 'https://zhuanlan.zhihu.com/p/15878761236'; // 替换为目标网站

// 执行抓取
async function crawlWebsite(url) {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('抓取过程中发生错误:', error.message);
    return null;
  }
}

// 执行示例
(async () => {
  const result = await crawlWebsite(TARGET_URL);
  if (result) {
    console.log('抓取结果:');
    console.log('页面标题:', result.data.title);
    console.log('正文长度:', result.data.markdown?.length || 0, '字符');
    console.log('状态码:', result.status);
  }
})();