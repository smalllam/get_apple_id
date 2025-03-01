import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

// 生成表格内容的函数
function generateTableRows(accounts) {
  return accounts.map((account, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${account.account}</td>
        <td>${account.password}</td>
      </tr>`).join('');
}

async function fetchAppleIDs() {
  // 添加无沙箱启动选项
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    // 访问目标页面
    await page.goto('https://ccbaohe.com/appleID2/', {
      waitUntil: 'networkidle2',
      timeout: 60000  // 增加超时时间到60秒
    });

    // 获取账号信息
    const accounts = await page.evaluate(() => {
      const result = [];
      // 选择所有带有 card border border-success 类的元素
      const cards = document.querySelectorAll('.card.border.border-success');

      cards.forEach((card) => {
        // 检查卡片状态，确保是"正常"状态
        const statusElement = card.querySelector('.card-title span');
        const status = statusElement ? statusElement.innerText : '';

        if (status.includes('正常')) {
          // 获取完整邮箱地址
          const emailElement = card.querySelector('.__cf_email__');
          const email = emailElement ? emailElement.getAttribute('href').replace('mailto:', '') : '';

          // 获取密码 - 从复制密码按钮的onclick属性中提取
          const passwordButton = card.querySelector('button[onclick*="copy("]');
          let password = '';

          if (passwordButton) {
            const onclickAttr = passwordButton.getAttribute('onclick');
            // 使用正则表达式从 copy('密码') 中提取密码
            const passwordMatch = onclickAttr.match(/copy\(['"](.*?)['"]\)/i);
            if (passwordMatch && passwordMatch[1]) {
              // 处理可能的Unicode转义序列
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

    console.log(`已获取 ${accounts.length} 个有效的 Apple ID 账号`);

    // 读取模板文件
    const templatePath = path.join(process.cwd(), 'template.html');
    let templateContent = await fs.readFile(templatePath, 'utf-8');

    // 替换模板中的占位符
    const timestamp = new Date().toLocaleString('zh-CN');
    const tableRows = generateTableRows(accounts);

    templateContent = templateContent
      .replace('{{TIMESTAMP}}', timestamp)
      .replace('{{TABLE_CONTENT}}', tableRows);

    // 保存到文件
    const outputPath = 'index.html';
    await fs.writeFile(outputPath, templateContent, 'utf-8');
    console.log(`账号列表已保存到: ${outputPath}`);
  } catch (error) {
    console.error('发生错误:', error);
    process.exitCode = 1;  // 设置退出码，通知GitHub Actions失败
  } finally {
    await browser.close();
  }
}

fetchAppleIDs();
