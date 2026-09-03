/**
 * 鲁港通 - 用户信息验证工具
 * 用于验证用户输入的邮箱、手机号等字段格式
 * Requirement 6.3, 6.4: 邮箱格式验证、手机号格式验证
 */

/**
 * 验证邮箱格式
 * @param email 邮箱地址
 * @returns 是否为有效邮箱
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  // RFC 5322 简化版邮箱正则，支持常见特殊字符
  // 本地部分：字母、数字、以及 . _ - + ! # $ % & ' * / = ? ^ ` { | } ~
  // 域名部分：字母、数字、连字符，至少一个点，顶级域名2-6位
  const emailRegex = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,6}$/;
  return emailRegex.test(email);
};

/**
 * 验证中国大陆手机号格式
 * @param phone 手机号
 * @returns 是否为有效手机号
 */
export const isValidChinesePhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // 中国大陆手机号：1开头，第二位为3-9，共11位数字
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

/**
 * 判断字符串是否为邮箱
 * @param str 待判断字符串
 * @returns 是否为邮箱
 */
export const isEmail = (str: string): boolean => {
  return isValidEmail(str);
};

/**
 * 判断字符串是否为手机号
 * @param str 待判断字符串
 * @returns 是否为手机号
 */
export const isPhone = (str: string): boolean => {
  return isValidChinesePhone(str);
};

/**
 * 验证用户注册信息
 * @param username 用户名（邮箱或手机号）
 * @param email 邮箱（手机号注册时必填）
 * @param phone 手机号（邮箱注册时必填）
 * @returns 验证结果
 */
export const validateUserRegistration = (
  username: string,
  email?: string,
  phone?: string
): { valid: boolean; error?: string } => {
  // 验证 username 必须是邮箱或手机号
  const isUsernameEmail = isEmail(username);
  const isUsernamePhone = isPhone(username);

  if (!isUsernameEmail && !isUsernamePhone) {
    return { valid: false, error: '用户名必须是有效的邮箱或手机号' };
  }

  // 邮箱注册时，phone 必填
  if (isUsernameEmail) {
    if (!phone) {
      return { valid: false, error: '邮箱注册时手机号为必填项' };
    }
    if (!isPhone(phone)) {
      return { valid: false, error: '手机号格式不正确' };
    }
  }

  // 手机号注册时，email 必填
  if (isUsernamePhone) {
    if (!email) {
      return { valid: false, error: '手机号注册时邮箱为必填项' };
    }
    if (!isEmail(email)) {
      return { valid: false, error: '邮箱格式不正确' };
    }
  }

  return { valid: true };
};

/**
 * 验证用户资料更新信息
 * @param data 用户资料数据
 * @returns 验证结果
 */
export const validateUserProfile = (data: {
  email?: string;
  phone?: string;
  birth_date?: Date | string;
  address?: string;
  google_account?: string;
}): { valid: boolean; error?: string } => {
  // 验证邮箱格式（如果提供）
  if (data.email !== undefined && data.email !== null && data.email !== '') {
    if (!isValidEmail(data.email)) {
      return { valid: false, error: '邮箱格式不正确' };
    }
  }

  // 验证手机号格式（如果提供）
  if (data.phone !== undefined && data.phone !== null && data.phone !== '') {
    if (!isValidChinesePhone(data.phone)) {
      return { valid: false, error: '手机号格式不正确' };
    }
  }

  // 验证生日格式（如果提供）
  if (data.birth_date !== undefined && data.birth_date !== null && data.birth_date !== '') {
    const date = new Date(data.birth_date);
    if (isNaN(date.getTime())) {
      return { valid: false, error: '生日格式不正确' };
    }
    // 生日不能是未来日期
    if (date > new Date()) {
      return { valid: false, error: '生日不能是未来日期' };
    }
  }

  // 验证地址长度（如果提供）
  if (data.address !== undefined && data.address !== null && data.address !== '') {
    if (data.address.length > 200) {
      return { valid: false, error: '地址长度不能超过200个字符' };
    }
  }

  // 验证 Google 账户格式（如果提供）
  if (data.google_account !== undefined && data.google_account !== null && data.google_account !== '') {
    if (!isValidEmail(data.google_account)) {
      return { valid: false, error: 'Google 账户必须是有效的邮箱格式' };
    }
  }

  return { valid: true };
};
