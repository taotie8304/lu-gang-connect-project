/**
 * 鲁港通 - 图片验证码生成 API
 * 用于用户注册时的图片验证码验证
 * 使用 MongoDB 存储验证码，确保多实例环境下的可靠性
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { connectToDatabase, getMongoModel } from '@/service/mongo';
import { addLog } from '@fastgpt/service/common/system/log';
import mongoose from 'mongoose';

// 验证码 Schema
const CaptchaSchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  code: { type: String, required: true },
  type: { type: String, default: 'image' }, // image 或 auth
  expireAt: { type: Date, required: true, index: { expires: 0 } } // TTL 索引自动删除
}, {
  timestamps: true
});

// 获取或创建 Model
const getCaptchaModel = () => {
  try {
    return mongoose.model('captcha');
  } catch {
    return mongoose.model('captcha', CaptchaSchema);
  }
};

// 生成随机验证码
const generateCaptchaCode = (length: number = 4): string => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 去掉容易混淆的 I O
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 生成 SVG 验证码图片
const generateCaptchaSvg = (code: string): string => {
  const width = 150;
  const height = 50;
  
  // 随机颜色
  const randomColor = () => {
    const r = Math.floor(Math.random() * 100 + 100);
    const g = Math.floor(Math.random() * 100 + 100);
    const b = Math.floor(Math.random() * 100 + 100);
    return `rgb(${r},${g},${b})`;
  };

  // 生成干扰线
  let lines = '';
  for (let i = 0; i < 5; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${randomColor()}" stroke-width="1"/>`;
  }

  // 生成干扰点
  let dots = '';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    dots += `<circle cx="${x}" cy="${y}" r="1" fill="${randomColor()}"/>`;
  }

  // 生成文字
  let text = '';
  const charWidth = width / (code.length + 1);
  for (let i = 0; i < code.length; i++) {
    const x = charWidth * (i + 0.5);
    const y = height / 2 + 8;
    const rotate = Math.random() * 30 - 15;
    const fontSize = 24 + Math.random() * 8;
    text += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="bold" fill="#3B82F6" transform="rotate(${rotate}, ${x}, ${y})">${code[i]}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f0f9ff"/>
    ${lines}
    ${dots}
    ${text}
  </svg>`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectToDatabase();
    const CaptchaModel = getCaptchaModel();
    
    const { username } = req.query as { username: string };
    
    if (!username) {
      return jsonRes(res, {
        code: 400,
        error: '缺少用户名参数'
      });
    }

    // 生成验证码
    const code = generateCaptchaCode(4);
    
    // 删除旧的验证码
    await CaptchaModel.deleteMany({ username, type: 'image' });
    
    // 存储验证码（5分钟有效）
    const expireAt = new Date(Date.now() + 5 * 60 * 1000);
    await CaptchaModel.create({
      username,
      code: code.toUpperCase(),
      type: 'image',
      expireAt
    });

    // 生成 SVG 图片
    const svg = generateCaptchaSvg(code);
    const base64 = Buffer.from(svg).toString('base64');
    const captchaImage = `data:image/svg+xml;base64,${base64}`;

    addLog.info('鲁港通验证码生成成功', { username });

    return jsonRes(res, {
      data: {
        captchaImage
      }
    });
  } catch (error) {
    addLog.error('鲁港通验证码生成失败', error);
    return jsonRes(res, {
      code: 500,
      error: '验证码生成失败'
    });
  }
}

// 导出验证码验证函数供其他 API 使用
export const verifyCaptcha = async (username: string, code: string): Promise<boolean> => {
  try {
    const CaptchaModel = getCaptchaModel();
    
    const captcha = await CaptchaModel.findOne({
      username,
      type: 'image',
      expireAt: { $gt: new Date() }
    });
    
    if (!captcha) {
      return false;
    }
    
    const isValid = captcha.code === code.toUpperCase();
    
    if (isValid) {
      // 验证成功后删除
      await CaptchaModel.deleteOne({ _id: captcha._id });
    }
    
    return isValid;
  } catch (error) {
    addLog.error('鲁港通验证码验证失败', error);
    return false;
  }
};
