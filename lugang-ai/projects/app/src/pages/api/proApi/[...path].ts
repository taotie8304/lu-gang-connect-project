// 鲁港通 - 商业版 API 代理
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { FastGPTProUrl } from '@fastgpt/service/common/system/constants';
import { Readable } from 'stream';

// 鲁港通 - 根据 API 路径返回合适的空数据
function getEmptyResponse(apiPath: string, method: string = 'GET'): any {
  // 通知相关
  if (apiPath.includes('inform/countUnread')) {
    return { unReadCount: 0, importantInforms: [] };
  }
  if (apiPath.includes('inform/getSystemMsgModal')) {
    return null;
  }
  if (apiPath.includes('inform/getOperationalAd')) {
    return null;
  }
  if (apiPath.includes('inform/list')) {
    return { total: 0, list: [] };
  }
  
  // 团队相关
  if (apiPath.includes('team/list')) {
    return [];
  }
  if (apiPath.includes('team/member/count')) {
    return { count: 0 };
  }
  if (apiPath.includes('team/member/list')) {
    return { total: 0, list: [] };
  }
  if (apiPath.includes('team/org/list')) {
    return [];
  }
  if (apiPath.includes('team/group/list')) {
    return [];
  }
  if (apiPath.includes('team/collaborator/list')) {
    return { members: [], groups: [] };
  }
  if (apiPath.includes('team/tag/list')) {
    return [];
  }
  if (apiPath.includes('team/invitationLink/list')) {
    return [];
  }
  
  // 应用评估
  if (apiPath.includes('app/evaluation/list')) {
    return { total: 0, list: [] };
  }
  
  // 使用记录
  if (apiPath.includes('wallet/usage')) {
    return { total: 0, list: [] };
  }
  
  // 自定义域名
  if (apiPath.includes('customDomain/list')) {
    return [];
  }
  
  // 审计日志
  if (apiPath.includes('audit/list')) {
    return { total: 0, list: [] };
  }
  
  // 默认返回空对象或空数组
  if (method === 'GET') {
    return apiPath.includes('list') ? [] : null;
  }
  
  return { success: true };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { path = [], ...query } = req.query as any;
    const requestPath = `/api/${path?.join('/')}?${new URLSearchParams(query).toString()}`;

    if (!requestPath) {
      throw new Error('url is empty');
    }
    
    // 鲁港通 - 未配置商业版时返回空数据（优雅降级）
    if (!FastGPTProUrl) {
      // 根据不同的 API 路径返回合适的空数据
      const apiPath = path?.join('/') || '';
      
      // 返回空的成功响应
      return jsonRes(res, {
        code: 200,
        data: getEmptyResponse(apiPath, req.method)
      });
    }

    const targetUrl = new URL(requestPath, FastGPTProUrl);

    // 鲁港通 - 过滤敏感请求头
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (key === 'rootkey' || key === 'host' || key === 'connection') continue;
      if (value) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    // 鲁港通 - 使用 fetch API 代理请求
    const request = new Request(targetUrl, {
      // @ts-ignore
      duplex: 'half',
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? null : (req as any)
    });

    const response = await fetch(request);

    // 鲁港通 - 复制响应头（排除编码相关）
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'content-encoding' || lowerKey === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    res.status(response.status);

    // 鲁港通 - 流式返回响应体
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
