/**
 * 鲁港通 - 发送验证码 API
 * 用于用户注册、找回密码等场景的邮箱/短信验证码发送
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { connectToDatabase } from '@/service/mongo';
import { addLog } from '@fastgpt/service/common/system/log';
import { verifyCaptcha } from '../account/captcha/getImgCaptcha';
import { UserAuthTypeEnum } from '@fastgpt/global/support/user/auth/constants';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// 验证码存储（生产环境应使用 Redis）
const authCodeStore = new Map<string, { code: string; expireAt: number; type: string }>();

// 清理过期验证码
const cleanExpiredAuthCode = () => {
  const now = Date.now();
  for (const [key, value] of authCodeStore.entries()) {
    if (value.expireAt < now) {
      authCodeStore.delete(key);
    }
  }
};

// 生成6位数字验证码
const generateAuthCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 判断是否为邮箱
const isEmail = (str: string): boolean => {
  return /^[A-Za-z0-9]+([_\.][A-Za-z0-9]+)*@([A-Za-z0-9\-]+\.)+[A-Za-z]{2,6}$/.test(str);
};

// 判断是否为手机号
const isPhone = (str: string): boolean => {
  return /^1[3456789]\d{9}$/.test(str);
};

// 发送邮件
const sendEmail = async (to: string, code: string, type: string): Promise<void> => {
  // 从环境变量获取 SMTP 配置
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '465');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP 配置不完整，请联系管理员');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const typeText = type === UserAuthTypeEnum.register ? '注册' : 
                   type === UserAuthTypeEnum.findPassword ? '找回密码' : '验证';

  const mailOptions = {
    from: `"鲁港通" <${smtpFrom}>`,
    to,
    subject: `【鲁港通】${typeText}验证码`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Microsoft YaHei', Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3B82F6; margin: 0;">鲁港通</h1>
          <p style="color: #6B7280; margin: 5px 0;">跨境AI智能平台</p>
        </div>
        <div style="background: linear-gradient(135deg, #EBF4FF 0%, #DBEAFE 100%); border-radius: 12px; padding: 30px; text-align: center;">
          <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">您的${typeText}验证码是：</p>
          <div style="background: white; border-radius: 8px; padding: 20px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; color: #3B82F6; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">验证码有效期为 10 分钟，请勿泄露给他人</p>
        </div>
        <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
          <p>如果您没有请求此验证码，请忽略此邮件</p>
          <p>© ${new Date().getFullYear()} 鲁港通 All Rights Reserved</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    await connectToDatabase();
    
    const { username, type, captcha } = req.body as {
      username: string;
      type: string;
      captcha: string;
    };

    // 参数验证
    if (!username) {
      return jsonRes(res, { code: 400, error: '请输入邮箱或手机号' });
    }

    if (!captcha) {
      return jsonRes(res, { code: 400, error: '请输入图片验证码' });
    }

    // 验证图片验证码
    if (!verifyCaptcha(username, captcha)) {
      return jsonRes(res, { code: 400, error: '图片验证码错误或已过期' });
    }

    // 清理过期验证码
    cleanExpiredAuthCode();

    // 检查是否频繁发送（1分钟内只能发送一次）
    const existingCode = authCodeStore.get(`${type}:${username}`);
    if (existingCode && existingCode.expireAt > Date.now() + 9 * 60 * 1000) {
      return jsonRes(res, { code: 400, error: '验证码发送过于频繁，请稍后再试' });
    }

    // 生成验证码
    const code = generateAuthCode();
    const expireAt = Date.now() + 10 * 60 * 1000; // 10分钟有效

    // 发送验证码
    if (isEmail(username)) {
      await sendEmail(username, code, type);
    } else if (isPhone(username)) {
      // TODO: 实现短信发送
      return jsonRes(res, { code: 400, error: '暂不支持手机号注册，请使用邮箱' });
    } else {
      return jsonRes(res, { code: 400, error: '请输入正确的邮箱或手机号' });
    }

    // 存储验证码
    authCodeStore.set(`${type}:${username}`, { code, expireAt, type });

    addLog.info('鲁港通验证码发送成功', { username, type });

    return jsonRes(res, {
      data: { success: true }
    });
  } catch (error: any) {
    addLog.error('鲁港通验证码发送失败', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '验证码发送失败'
    });
  }
}

// 导出验证码验证函数供注册 API 使用
export const verifyAuthCode = (username: string, code: string, type: string): boolean => {
  const key = `${type}:${username}`;
  const stored = authCodeStore.get(key);
  
  if (!stored) {
    return false;
  }
  
  if (stored.expireAt < Date.now()) {
    authCodeStore.delete(key);
    return false;
  }
  
  const isValid = stored.code === code;
  if (isValid) {
    authCodeStore.delete(key); // 验证成功后删除
  }
  
  return isValid;
};
