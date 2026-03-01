/**
 * 鲁港通 - 支付类型定义
 * Requirements: 10.2, 10.3
 */

/**
 * 支付方式枚举
 * Requirement 10.3: 支持微信支付和支付宝
 */
export enum PaymentMethod {
  WeChat = 'wechat',      // 微信支付
  Alipay = 'alipay',      // 支付宝
  UnionPay = 'unionpay'   // 银联支付（可选）
}

/**
 * 支付状态枚举
 */
export enum PaymentStatus {
  Pending = 'pending',       // 待支付
  Processing = 'processing', // 处理中
  Success = 'success',       // 支付成功
  Failed = 'failed',         // 支付失败
  Cancelled = 'cancelled',   // 已取消
  Refunded = 'refunded'      // 已退款
}

/**
 * 支付订单接口
 */
export interface PaymentOrder {
  order_id: string;              // 订单 ID
  user_id: string;               // 用户 ID
  username: string;              // 用户名
  package_id: string;            // 套餐 ID
  package_name: string;          // 套餐名称
  amount: number;                // 支付金额（单位：元）
  payment_method: PaymentMethod; // 支付方式
  status: PaymentStatus;         // 支付状态
  created_at: string;            // 创建时间
  paid_at?: string;              // 支付时间
  expired_at?: string;           // 过期时间
  transaction_id?: string;       // 第三方交易 ID
  callback_url?: string;         // 回调 URL
}

/**
 * 支付请求参数
 * Requirement 10.2: 发起支付流程
 */
export interface PaymentRequest {
  package_id: string;            // 套餐 ID
  payment_method: PaymentMethod; // 支付方式
  return_url?: string;           // 支付完成后返回 URL
  notify_url?: string;           // 支付通知 URL
}

/**
 * 支付响应
 */
export interface PaymentResponse {
  order_id: string;              // 订单 ID
  payment_url?: string;          // 支付页面 URL（用于跳转）
  qr_code?: string;              // 二维码内容（用于扫码支付）
  payment_params?: any;          // 支付参数（用于 SDK 调用）
  expires_in: number;            // 有效期（秒）
}

/**
 * 支付回调数据
 * Requirement 10.4: 处理支付回调
 */
export interface PaymentCallback {
  order_id: string;              // 订单 ID
  transaction_id: string;        // 第三方交易 ID
  payment_method: PaymentMethod; // 支付方式
  amount: number;                // 支付金额
  status: PaymentStatus;         // 支付状态
  paid_at: string;               // 支付时间
  signature: string;             // 签名（用于验证）
  raw_data?: any;                // 原始回调数据
}

/**
 * 支付验证结果
 */
export interface PaymentVerification {
  is_valid: boolean;             // 是否有效
  order: PaymentOrder | null;    // 订单信息
  error?: string;                // 错误信息
}
