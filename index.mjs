import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import https from 'https';

// 修改生成表格内容的函数，移除来源列
function generateTableRows(accounts) {
  return accounts.map((account, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${account.account}</td>
        <td>${account.password}</td>
      </tr>`).join('');
}

// 从第一个平台获取账号
async function fetchAppleIDsFromFirst(browser) {
  console.log("开始从第一个平台获取账号...");
  const page = await browser.newPage();

  try {
    await page.goto('https://ccbaohe.com/appleID2/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 获取账号信息
    const accounts = await page.evaluate(() => {
      const result = [];
      const cards = document.querySelectorAll('.card.border.border-success');

      cards.forEach((card) => {
        const statusElement = card.querySelector('.card-title span');
        const status = statusElement ? statusElement.innerText : '';

        if (status.includes('正常')) {
          const emailElement = card.querySelector('.__cf_email__');
          const email = emailElement ? emailElement.getAttribute('href').replace('mailto:', '') : '';

          const passwordButton = card.querySelector('button[onclick*="copy("]');
          let password = '';

          if (passwordButton) {
            const onclickAttr = passwordButton.getAttribute('onclick');
            const passwordMatch = onclickAttr.match(/copy\(['"](.*?)['"]\)/i);
            if (passwordMatch && passwordMatch[1]) {
              password = JSON.parse(`"${passwordMatch[1].replace(/"/g, '\\"')}"`);
            }
          }

          if (email && password) {
            result.push({ account: email, password });
          }
        }
      });

      return result;
    });

    console.log(`第一个平台获取到 ${accounts.length} 个账号`);
    return accounts;
  } catch (error) {
    console.error("从第一个平台获取账号时出错:", error);
    return [];
  } finally {
    await page.close();
  }
}

// 使用临时HTML文件的第二平台抓取函数
async function fetchAppleIDsFromSecond(browser) {
  console.log("开始从第二个平台获取账号...");
  const page = await browser.newPage();
  const tempHtmlPath = path.join(process.cwd(), 'temp_page.html');

  try {
    // 第一步：获取原始页面内容
    console.log("正在获取页面内容...");

    // 使用普通浏览器头信息访问页面
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.google.com/'
    });

    // 访问目标页面获取内容
    await page.goto('https://aauto.233.tw/share/whvAdkbDeO', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 获取页面内容
    const content = await page.content();
    console.log(`获取到页面内容，长度: ${content.length} 字符`);

    // 第二步：将内容保存为临时HTML文件
    await fs.writeFile(tempHtmlPath, content, 'utf-8');
    console.log(`页面内容已保存到临时文件: temp_page.html`);

    // 关闭原始页面
    await page.close();

    // 第三步：打开本地HTML文件进行分析
    console.log("正在打开本地HTML文件进行分析...");
    const localPage = await browser.newPage();
    await localPage.goto(`file://${tempHtmlPath}`, { waitUntil: 'load' });

    // 分析HTML提取数据
    const accounts = await localPage.evaluate(() => {
      console.log("开始从本地HTML提取账号信息");
      const result = [];

      try {
        // 查找所有card-body元素
        const cardBodies = document.querySelectorAll('.card-body');
        console.log(`找到 ${cardBodies.length} 个card-body元素`);

        // 遍历卡片提取信息
        cardBodies.forEach((cardBody, index) => {
          try {
            // 查找所有带有"正常"文本的标签
            const statusElements = cardBody.querySelectorAll('.badge');
            let isNormal = false;

            // 检查是否有状态为"正常"的标签
            statusElements.forEach(element => {
              if (element.textContent && element.textContent.includes('正常')) {
                isNormal = true;
              }
            });

            if (isNormal) {
              // 获取账号和密码按钮
              const buttons = cardBody.querySelectorAll('button[data-clipboard-text]');

              // 通常第一个是账号按钮，第二个是密码按钮
              if (buttons.length >= 2) {
                const account = buttons[0].getAttribute('data-clipboard-text');
                const password = buttons[1].getAttribute('data-clipboard-text');

                if (account && password) {
                  console.log(`从卡片 ${index+1} 成功提取账号`);
                  result.push({ account, password });
                }
              }
            }
          } catch (err) {
            console.log(`处理卡片 ${index+1} 时出错: ${err.message}`);
          }
        });
      } catch (error) {
        console.error("提取过程中出错:", error);
      }

      return result;
    });

    // 关闭本地页面
    await localPage.close();

    console.log(`第二个平台获取到 ${accounts.length} 个账号`);
    return accounts;
  } catch (error) {
    console.error("从第二个平台获取账号时出错:", error);
    return [];
  } finally {
    // 无论成功失败，最后清理临时文件
    try {
      await fs.unlink(tempHtmlPath);
      console.log("临时HTML文件已删除");
    } catch (e) {
      console.log("删除临时文件失败:", e.message);
    }
  }
}

// 在fetchAllAppleIDs函数中重新启用两个平台抓取
async function fetchAllAppleIDs() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 并行获取两个平台的账号
    const [accountsFromFirst, accountsFromSecond] = await Promise.all([
      fetchAppleIDsFromFirst(browser),
      fetchAppleIDsFromSecond(browser)
    ]);

    // 合并账号列表
    const allAccounts = [...accountsFromFirst, ...accountsFromSecond];

    console.log(`总共获取到 ${allAccounts.length} 个有效的 Apple ID 账号`);

    if (allAccounts.length === 0) {
      console.log("未获取到任何有效账号，不更新HTML文件");
      return false;
    }

    // 读取模板文件
    const templatePath = path.join(process.cwd(), 'template.html');
    let templateContent = await fs.readFile(templatePath, 'utf-8');

    // 替换模板中的占位符
    const timestamp = new Date().toLocaleString('zh-CN');
    const tableRows = generateTableRows(allAccounts);

    templateContent = templateContent
      .replace('{{TIMESTAMP}}', timestamp)
      .replace('{{TABLE_CONTENT}}', tableRows);

    // 保存到文件
    const outputPath = 'index.html';
    await fs.writeFile(outputPath, templateContent, 'utf-8');
    console.log(`账号列表已保存到: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('发生错误:', error);
    process.exitCode = 1;
    return false;
  } finally {
    await browser.close();
  }
}

fetchAllAppleIDs();
