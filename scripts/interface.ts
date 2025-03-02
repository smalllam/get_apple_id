/**
 * Apple ID账号接口定义
 */
export interface AppleID {
  account: string;  // 账号邮箱
  password: string; // 密码
  region?: string;  // 可选的地区信息
}