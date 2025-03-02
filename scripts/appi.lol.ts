import https from 'https';
import { AppleID } from './interface';

/**
 * 从appi.lol API直接获取Apple ID账号信息
 * 使用Node.js原生https模块
 */
async function extractAppleIDs(url: string = 'https://api.appi.lol/appid'): Promise<AppleID[]> {
  return new Promise((resolve) => {
    // 设置请求选项
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.google.com/',
        'Origin': 'https://appi.lol'
      }
    };

    // 发送HTTPS请求
    const req = https.get(url, options, (res) => {
      let data = '';

      // 接收数据
      res.on('data', (chunk) => {
        data += chunk;
      });

      // 处理接收完成的数据
      res.on('end', () => {
        try {
          // 解析JSON数据
          const jsonData = JSON.parse(data);

          // 检查是否有appidList数组
          if (!jsonData.appidList || !Array.isArray(jsonData.appidList)) {
            resolve([]);
            return;
          }

          // 提取账号信息
          const accounts: AppleID[] = [];

          jsonData.appidList.forEach((item: any) => {
            // 检查是否是有效账号
            if (!item.user || !item.pass || item.pass === '暂无可用账号') {
              return;
            }

            // 处理账号状态 (解码Unicode转义)
            const statusText = item.status.replace('账号状态：', '').replace('正常可用', '正常') || '';

            if (statusText.includes('异常')) return;

            // 提取地区信息 (如果状态中包含地区信息)
            let region = statusText === '正常' ? '' : statusText;

            // 添加到结果
            accounts.push({
              account: item.user,
              password: item.pass,
              region
            });
          });

          resolve(accounts);
        } catch (error) {
          // 解析错误，返回空数组
          resolve([]);
        }
      });
    });

    // 处理请求错误
    req.on('error', () => {
      resolve([]);
    });

    // 设置超时
    req.setTimeout(30000, () => {
      req.destroy();
      resolve([]);
    });
  });
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
