import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { AppleID } from './interface';

async function extractAppleIDs(url: string = 'https://free.mayun.us/'): Promise<AppleID[]> {
  // 启动浏览器
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const tempHtmlPath = path.join(process.cwd(), 'free.mayun.us.html');

  try {
    // 设置浏览器头信息
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

    // 获取页面内容并保存为临时HTML文件
    const content = await page.content();
    await fs.writeFile(tempHtmlPath, content, 'utf-8');

    // 关闭原始页面
    await page.close();

    // 打开本地HTML文件进行分析
    const localPage = await browser.newPage();
    await localPage.goto(`file://${tempHtmlPath}`, { waitUntil: 'load' });

    // 从页面提取账号信息
    const accounts = await localPage.evaluate(() => {
      const result: AppleID[] = [];

      try {
        // 查找所有card-body元素
        const cardBodies = document.querySelectorAll('.biank.border-success');

        // 遍历卡片提取信息
        cardBodies.forEach((cardBody) => {
            // 提取地区
            const region = '';
            // 获取账号和密码按钮
            const buttons = cardBody.querySelectorAll('button[data-clipboard-text]');

            // 通常第一个是账号按钮，第二个是密码按钮
            if (buttons.length >= 2) {
              const account = buttons[0].getAttribute('data-clipboard-text');
              const password = buttons[1].getAttribute('data-clipboard-text');

              if (account && password) {
                result.push({ account, password, region });
              }
            }
        });
      } catch (error) {
        // 错误处理
      }

      return result;
    });

    // 关闭本地页面
    await localPage.close();
    return accounts;
  } catch (error) {
    return [];
  } finally {
    // 关闭浏览器
    await browser.close();

    // 删除临时文件
    try {
      await fs.unlink(tempHtmlPath);
    } catch (e) {
      // 忽略删除临时文件的错误
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  (async () => {
    const accounts = await extractAppleIDs();
    console.log(JSON.stringify(accounts, null, 2));
  })().catch(console.error);
}

// 将函数作为默认导出
export default extractAppleIDs;
