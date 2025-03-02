import puppeteer from 'puppeteer';
import { AppleID } from './interface';

async function extractAppleIDs(url: string = 'https://ccbaohe.com/appleID2'): Promise<AppleID[]> {
  // 启动浏览器
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 设置浏览器头信息，避免被识别为爬虫
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.google.com/'
    });

    // 访问目标页面
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 获取账号信息
    const accounts = await page.evaluate(() => {
      const result: AppleID[] = [];

      try {
        // 查找所有包含账号信息的卡片元素
        const cards = document.querySelectorAll('.card.border.border-success');

        cards.forEach((card) => {
          // 检查账号状态是否正常
          const statusElement = card.querySelector('.card-title span');
          const status = statusElement ? statusElement.textContent?.replace('账号状态：', '').replace('正常可用', '正常') : '';
          if(status?.includes('异常')) return;
          // 尝试提取地区信息
          let region = status === '正常' ? '' : status || '';


          // 提取邮箱/账号
          const emailElement = card.querySelector('.__cf_email__');
          const email = emailElement ? emailElement.getAttribute('href')?.replace('mailto:', '') : '';

          // 提取密码
          const passwordButton = card.querySelector('button[onclick*="copy("]');
          let password = '';

          if (passwordButton) {
            const onclickAttr = passwordButton.getAttribute('onclick');
            const passwordMatch = onclickAttr?.match(/copy\(['"](.*?)['"]\)/i);
            if (passwordMatch && passwordMatch[1]) {
              password = JSON.parse(`"${passwordMatch[1].replace(/"/g, '\\"')}"`);
            }
          }

          // 只添加有效的账号和密码
          if (email && password) {
            result.push({ account: email, password, region });
          }
        });
      } catch (error) {
        // 错误处理，保持静默
      }

      return result;
    });

    return accounts;
  } catch (error) {
    // 错误处理，保持静默
    return [];
  } finally {
    // 关闭页面和浏览器
    await page.close();
    await browser.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  (async () => {
    const accounts = await extractAppleIDs();
    console.log(JSON.stringify(accounts, null, 2));
  })().catch(console.error);
}

// 导出为默认方法
export default extractAppleIDs;
