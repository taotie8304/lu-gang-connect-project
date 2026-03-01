/**
 * 鲁港通 - 活动控制器
 * 提供活动的CRUD操作和日期过滤
 */
import { MongoActivity } from './schema';
import type {
  ActivitySchema,
  ActivityCreateParams,
  ActivityUpdateParams,
  ActivityResponse,
  ActivityListQuery
} from '@fastgpt/global/support/activity/type';

/**
 * 获取当前有效的活动列表
 * @returns 有效活动列表
 */
export async function getActiveActivities(): Promise<ActivityResponse[]> {
  try {
    const now = new Date();
    
    const activities = await MongoActivity.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    })
      .sort({ createTime: -1 })
      .lean();

    return activities.map((activity) => ({
      _id: activity._id.toString(),
      title: activity.title,
      description: activity.description,
      image: activity.image,
      link: activity.link,
      startDate: activity.startDate,
      endDate: activity.endDate,
      isActive: activity.isActive,
      createTime: activity.createTime,
      updateTime: activity.updateTime
    }));
  } catch (error) {
    console.error('鲁港通：获取活动列表失败', { error });
    throw error;
  }
}

/**
 * 获取所有活动列表（管理员）
 * @param query 查询参数
 * @returns 活动列表
 */
export async function getAllActivities(
  query: ActivityListQuery = {}
): Promise<ActivityResponse[]> {
  try {
    const { includeInactive = true, startDate, endDate } = query;

    const filter: any = {};

    if (!includeInactive) {
      filter.isActive = true;
    }

    if (startDate || endDate) {
      filter.$and = [];
      if (startDate) {
        filter.$and.push({ endDate: { $gte: startDate } });
      }
      if (endDate) {
        filter.$and.push({ startDate: { $lte: endDate } });
      }
    }

    const activities = await MongoActivity.find(filter).sort({ createTime: -1 }).lean();

    return activities.map((activity) => ({
      _id: activity._id.toString(),
      title: activity.title,
      description: activity.description,
      image: activity.image,
      link: activity.link,
      startDate: activity.startDate,
      endDate: activity.endDate,
      isActive: activity.isActive,
      createTime: activity.createTime,
      updateTime: activity.updateTime
    }));
  } catch (error) {
    console.error('鲁港通：获取所有活动失败', { query, error });
    throw error;
  }
}

/**
 * 获取单个活动详情
 * @param activityId 活动ID
 * @returns 活动详情
 */
export async function getActivityById(activityId: string): Promise<ActivityResponse | null> {
  try {
    const activity = await MongoActivity.findById(activityId).lean();

    if (!activity) {
      return null;
    }

    return {
      _id: activity._id.toString(),
      title: activity.title,
      description: activity.description,
      image: activity.image,
      link: activity.link,
      startDate: activity.startDate,
      endDate: activity.endDate,
      isActive: activity.isActive,
      createTime: activity.createTime,
      updateTime: activity.updateTime
    };
  } catch (error) {
    console.error('鲁港通：获取活动详情失败', { activityId, error });
    throw error;
  }
}

/**
 * 创建活动（管理员）
 * @param params 活动参数
 * @param userId 创建者用户ID
 * @returns 创建的活动
 */
export async function createActivity(
  params: ActivityCreateParams,
  userId: string
): Promise<ActivityResponse> {
  try {
    const { title, description, image, link, startDate, endDate, isActive = true } = params;

    // 验证日期
    if (new Date(startDate) > new Date(endDate)) {
      throw new Error('开始日期不能晚于结束日期');
    }

    const activity = await MongoActivity.create({
      title,
      description,
      image,
      link,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive,
      createTime: new Date(),
      updateTime: new Date(),
      createdBy: userId
    });

    return {
      _id: activity._id.toString(),
      title: activity.title,
      description: activity.description,
      image: activity.image,
      link: activity.link,
      startDate: activity.startDate,
      endDate: activity.endDate,
      isActive: activity.isActive,
      createTime: activity.createTime,
      updateTime: activity.updateTime
    };
  } catch (error) {
    console.error('鲁港通：创建活动失败', { params, error });
    throw error;
  }
}

/**
 * 更新活动（管理员）
 * @param activityId 活动ID
 * @param params 更新参数
 * @param userId 更新者用户ID
 * @returns 更新后的活动
 */
export async function updateActivity(
  activityId: string,
  params: ActivityUpdateParams,
  userId: string
): Promise<ActivityResponse> {
  try {
    const updateData: any = {
      ...params,
      updateTime: new Date(),
      updatedBy: userId
    };

    // 如果更新了日期，验证日期
    if (params.startDate || params.endDate) {
      const activity = await MongoActivity.findById(activityId);
      if (!activity) {
        throw new Error('活动不存在');
      }

      const newStartDate = params.startDate
        ? new Date(params.startDate)
        : activity.startDate;
      const newEndDate = params.endDate ? new Date(params.endDate) : activity.endDate;

      if (newStartDate > newEndDate) {
        throw new Error('开始日期不能晚于结束日期');
      }

      if (params.startDate) {
        updateData.startDate = newStartDate;
      }
      if (params.endDate) {
        updateData.endDate = newEndDate;
      }
    }

    const updatedActivity = await MongoActivity.findByIdAndUpdate(activityId, updateData, {
      new: true
    }).lean();

    if (!updatedActivity) {
      throw new Error('更新活动失败');
    }

    return {
      _id: updatedActivity._id.toString(),
      title: updatedActivity.title,
      description: updatedActivity.description,
      image: updatedActivity.image,
      link: updatedActivity.link,
      startDate: updatedActivity.startDate,
      endDate: updatedActivity.endDate,
      isActive: updatedActivity.isActive,
      createTime: updatedActivity.createTime,
      updateTime: updatedActivity.updateTime
    };
  } catch (error) {
    console.error('鲁港通：更新活动失败', { activityId, params, error });
    throw error;
  }
}

/**
 * 删除活动（管理员）
 * @param activityId 活动ID
 * @returns 是否删除成功
 */
export async function deleteActivity(activityId: string): Promise<boolean> {
  try {
    const result = await MongoActivity.findByIdAndDelete(activityId);
    return !!result;
  } catch (error) {
    console.error('鲁港通：删除活动失败', { activityId, error });
    throw error;
  }
}
