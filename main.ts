import fs from 'fs';
import path from 'path';
import { AppleID } from './scripts/interface';

/**
 * 主函数：从所有源获取Apple ID账号
 */
async function main() {
  console.log('开始从各个源获取Apple ID账号...');

  try {
    // 获取所有fetcher模块
    const fetchers = await loadAllFetchers();
    console.log(`找到 ${Object.keys(fetchers).length} 个数据源`);

    if (Object.keys(fetchers).length === 0) {
      console.log('没有找到任何数据源，请确保scripts目录下有相应的模块');
      return [];
    }

    // 创建一个Promise数组，从所有来源并行获取数据
    const fetchPromises = Object.entries(fetchers).map(([name, fetcher]) =>
      fetcher()
        .then(accounts => ({ source: name, accounts }))
        .catch(error => {
          console.error(`从 ${name} 获取数据时出错:`, error);
          return { source: name, accounts: [] };
        })
    );

    // 等待所有Promise完成
    const results = await Promise.all(fetchPromises);

    // 记录每个源的结果
    results.forEach(({ source, accounts }) => {
      console.log(`${source}: 获取到 ${accounts.length} 个账号`);
    });

    // 合并所有结果
    const allAccounts: AppleID[] = results.flatMap(r => r.accounts);

    if (allAccounts.length === 0) {
      console.log('没有获取到任何账号');
      return [];
    }

    // 去重（基于账号）
    const uniqueAccounts = removeDuplicates(allAccounts);

    console.log(`成功获取 ${uniqueAccounts.length} 个有效Apple ID账号（去重后）`);

    // 保存结果到项目根目录JSON文件
    const jsonPath = path.join(__dirname, `index.json`);
    await saveToFile(uniqueAccounts, jsonPath);
    console.log(`JSON结果已保存至: ${jsonPath}`);

    // 生成HTML文件
    const htmlPath = path.join(__dirname, `index.html`);
    await generateHtmlFile(uniqueAccounts, htmlPath);
    console.log(`HTML结果已保存至: ${htmlPath}`);

    return uniqueAccounts;
  } catch (error) {
    console.error('执行过程中发生错误:', error);
    return [];
  }
}

/**
 * 动态加载所有fetcher模块
 */
async function loadAllFetchers(): Promise<Record<string, () => Promise<AppleID[]>>> {
  const fetchers: Record<string, () => Promise<AppleID[]>> = {};
  const scriptsDir = path.join(__dirname, 'scripts');

  // 确保scripts目录存在
  if (!fs.existsSync(scriptsDir)) {
    console.error('scripts目录不存在');
    return fetchers;
  }

  // 读取scripts目录中所有.ts文件
  const files = fs.readdirSync(scriptsDir)
    .filter(file => file.endsWith('.ts') && file !== 'interface.ts');

  // 动态导入每个文件
  for (const file of files) {
    const name = path.basename(file, '.ts');
    try {
      const module = await import(`./scripts/${name}`);
      if (typeof module.default === 'function') {
        fetchers[name] = module.default;
        console.log(`成功加载模块: ${name}`);
      } else {
        console.warn(`模块 ${name} 没有默认导出函数`);
      }
    } catch (error) {
      console.error(`导入模块 ${name} 时出错:`, error);
    }
  }

  return fetchers;
}

/**
 * 根据账号去重
 */
function removeDuplicates(accounts: AppleID[]): AppleID[] {
  const seen = new Set<string>();
  return accounts.filter(account => {
    if (seen.has(account.account)) {
      return false;
    }
    seen.add(account.account);
    return true;
  });
}

/**
 * 保存数据到文件
 */
async function saveToFile(data: any, filePath: string): Promise<void> {
  // 写入文件到根目录
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
      if (err) {
        console.error(`无法写入文件到 ${filePath}:`, err);
        reject(err);
      } else {
        console.log(`成功保存 ${data.length} 个账号到根目录文件`);
        resolve();
      }
    });
  });
}

/**
 * 生成HTML文件
 */
async function generateHtmlFile(accounts: AppleID[], filePath: string): Promise<void> {
  try {
    // 读取HTML模板
    const templatePath = path.join(__dirname, 'template.html');
    let templateContent = fs.readFileSync(templatePath, 'utf8');

    // 获取当前时间
    const timestamp = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // 替换时间戳
    templateContent = templateContent.replace('{{TIMESTAMP}}', timestamp);

    // 生成表格行
    const tableRows = accounts.map((account, index) => {
      return `
        <tr>
          <td>${account.region || 'Normal'}</td>
          <td>${account.account}</td>
          <td>${account.password}</td>
        </tr>
      `;
    }).join('');

    // 替换表格内容
    templateContent = templateContent.replace('{{TABLE_CONTENT}}', tableRows);

    // 写入HTML文件
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, templateContent, 'utf8', (err) => {
        if (err) {
          console.error(`无法生成HTML文件: ${filePath}`, err);
          reject(err);
        } else {
          console.log(`成功生成包含 ${accounts.length} 个账号的HTML文件`);
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('生成HTML文件时发生错误:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(error => {
    console.error('获取Apple ID时发生错误:', error);
    process.exit(1);
  });
}

export default main;
