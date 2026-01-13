/**
 * 鲁港通 - 测试邮件发送接口
 * 
 * POST /api/admin/config/test-email
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { addLog } from '@fastgpt/service/common/system/log';
import nodemailer from 'nodemailer';

export type TestEmailBody = {
  email: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
};

export type TestEmailResponse = {
  success: boolean;
  message: string;
};

async function handler(
  req: ApiRequestProps<TestEmailBody, {}>,
  _res: ApiResponseType<TestEmailResponse>
): Promise<TestEmailResponse> {
  // 验证管理员权限
  const { isRoot } = await authCert({ req, authToken: true, authRoot: true });
  
  if (!isRoot) {
    throw new Error('Permission denied: Admin access required');
  }

  const { email, smtp } = req.body;

  if (!email) {
    throw new Error('Missing email address');
  }

  if (!smtp?.host || !smtp?.user || !smtp?.pass) {
    throw new Error('Missing SMTP configuration');
  }

  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  try {
    // 创建邮件传输器
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 465,
      secure: smtp.secure !== false,
      auth: {
        user: smtp.user,
        pass: smtp.pass
      }
    });

    // 发送测试邮件
    await transporter.sendMail({
      from: smtp.from || smtp.user,
      to: email,
      subject: '【鲁港通】SMTP 配置测试',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3182ce;">鲁港通跨境AI智能平台</h2>
          <p>这是一封测试邮件，用于验证 SMTP 配置是否正确。</p>
          <p>如果您收到此邮件，说明邮件服务配置成功！</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #718096; font-size: 12px;">
            此邮件由系统自动发送，请勿回复。<br />
            发送时间：${new Date().toLocaleString('zh-CN')}
          </p>
        </div>
      `
    });

    addLog.info('Test email sent successfully', { to: email });

    return {
      success: true,
      message: 'Test email sent successfully'
    };
  } catch (error: any) {
    addLog.error('Failed to send test email', { error: error.message });
    throw new Error(`发送失败: ${error.message}`);
  }
}

export default NextAPI(handler);
