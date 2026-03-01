/**
 * 鲁港通 - 系统内容类型定义
 */
import type { SystemContentKeyEnum } from './constant';

export interface SystemContentSchema {
  _id: string;
  key: `${SystemContentKeyEnum}`;
  title: string;
  content: string;
  contentType: 'markdown' | 'html' | 'text';
  updateTime: Date;
  updatedBy?: string;
  createTime: Date;
}

export interface SystemContentUpdateParams {
  key: `${SystemContentKeyEnum}`;
  title?: string;
  content: string;
  contentType?: 'markdown' | 'html' | 'text';
}

export interface SystemContentResponse {
  key: string;
  title: string;
  content: string;
  contentType: string;
  updateTime: Date;
}
