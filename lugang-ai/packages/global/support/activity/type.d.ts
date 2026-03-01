/**
 * 鲁港通 - 活动中心类型定义
 */

export interface ActivitySchema {
  _id: string;
  title: string;
  description: string;
  image?: string;
  link?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createTime: Date;
  updateTime: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface ActivityCreateParams {
  title: string;
  description: string;
  image?: string;
  link?: string;
  startDate: Date;
  endDate: Date;
  isActive?: boolean;
}

export interface ActivityUpdateParams {
  title?: string;
  description?: string;
  image?: string;
  link?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export interface ActivityResponse {
  _id: string;
  title: string;
  description: string;
  image?: string;
  link?: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createTime: Date;
  updateTime: Date;
}

export interface ActivityListQuery {
  includeInactive?: boolean;
  startDate?: Date;
  endDate?: Date;
}
