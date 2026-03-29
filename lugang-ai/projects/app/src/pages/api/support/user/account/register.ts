/**
 * 鲁港通 - 用户注册 API
 * 用户注册后自动在鲁港通后端创建对应账户
 * 新用户自动加入 root 管理员的团队，而不是创建独立团队
 * 支持邮箱注册和手机号注册（手机号注册需要绑定邮箱接收验证码）
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { addLog } from '@fastgpt/service/common/system/log';
import { verifyAuthCode } from '../inform/sendAuthCode';
import { UserAuthTypeEnum } from '@fastgpt/global/support/user/auth/constants';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberRoleEnum, TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { hashStr } from '@fastgpt/global/common/string/tools';
import { checkPasswordRule } from '@fastgpt/global/common/string/password';
import { createUserSession } from '@fastgpt/service/support/user/session';
import { setCookie } from '@fastgpt/service/support/permission/auth/common';
import { getUserDetail } from '@fastgpt/service/support/user/controller';
import requestIp from 'request-ip';
import { createUserInBackend } from '@fastgpt/service/support/user/integration/userSync';
import { isEmail, isPhone, validateUserRegistration } from '@fastgpt/global/support/user/validation';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { PerResourceTypeEnum, ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { TeamDefaultRoleVal } from '@fastgpt/global/support/permission/user/constant';
import { sumPer } from '@fastgpt/global/support/permission/utils';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }
    
    const { username, password, code, inviterId, email, phone } = req.body as {
      username: string;
      password: string;
      code: string;
      inviterId?: string;
      email?: string; // 手机号注册时需要提供邮箱
      phone?: string; // 邮箱注册时需要提供手机号
    };

    // 参数验证
    if (!username || !password || !code) {
      return jsonRes(res, { code: 400, error: '参数不完整' });
    }

    // 验证密码规则
    if (!checkPasswordRule(password)) {
      return jsonRes(res, { 
        code: 400, 
        error: '密码必须包含大小写字母和数字，长度8-20位' 
      });
    }

    // Requirement 6.2, 6.3, 6.4: 验证用户注册信息（email 和 phone 必填）
    const validation = validateUserRegistration(username, email, phone);
    if (!validation.valid) {
      return jsonRes(res, { code: 400, error: validation.error });
    }

    // 确定验证码对应的邮箱和显示名称
    let verifyEmail = username;
    let displayName = '';
    let userEmail = email;
    let userPhone = phone;
    
    if (isPhone(username)) {
      // 手机号注册：使用提供的邮箱验证
      verifyEmail = email!;
      userPhone = username;
      displayName = username.slice(-4) + '用户'; // 使用手机号后4位
    } else if (isEmail(username)) {
      // 邮箱注册：使用邮箱验证
      verifyEmail = username;
      userEmail = username;
      displayName = username.split('@')[0];
    }

    // 验证邮箱验证码（现在是异步函数）
    const codeValid = await verifyAuthCode(verifyEmail, code, UserAuthTypeEnum.register);
    if (!codeValid) {
      return jsonRes(res, { code: 400, error: '验证码错误或已过期' });
    }

    // 检查用户是否已存在
    const existingUser = await MongoUser.findOne({ username });
    if (existingUser) {
      const accountType = isPhone(username) ? '手机号' : '邮箱';
      return jsonRes(res, { code: 400, error: `该${accountType}已被注册` });
    }

    // 检查邮箱是否已被使用（无论是作为 username 还是 email 字段）
    if (userEmail) {
      const existingEmail = await MongoUser.findOne({
        $or: [
          { username: userEmail },
          { email: userEmail }
        ]
      });
      if (existingEmail && existingEmail.username !== username) {
        return jsonRes(res, { code: 400, error: '该邮箱已被其他账号使用' });
      }
    }

    // 鲁港通：手机号暂时允许重复使用，后续开启短信验证码后再启用唯一性校验
    // if (userPhone) {
    //   const existingPhone = await MongoUser.findOne({
    //     $or: [
    //       { username: userPhone },
    //       { phone: userPhone }
    //     ]
    //   });
    //   if (existingPhone && existingPhone.username !== username) {
    //     return jsonRes(res, { code: 400, error: '该手机号已被其他账号使用' });
    //   }
    // }

    // 创建用户
    const userData = await mongoSessionRun(async (session) => {
      // Requirement 6.1, 6.2: 创建用户时保存 email 和 phone 字段
      const [user] = await MongoUser.create(
        [{
          username,
          password: hashStr(password),
          avatar: '/icon/logo.png',
          timezone: 'Asia/Shanghai',
          status: 'active',
          createTime: new Date(),
          email: userEmail,
          phone: userPhone,
          ...(inviterId ? { inviterId } : {})
        }],
        { session }
      );

      // 鲁港通：查找 root 管理员的团队
      const rootUser = await MongoUser.findOne({ username: 'root' }).lean();
      if (!rootUser) {
        throw new Error('系统未初始化，请联系管理员');
      }

      // 查找 root 用户所属的团队
      const rootTeamMember = await MongoTeamMember.findOne({ 
        userId: rootUser._id,
        role: TeamMemberRoleEnum.owner 
      }).lean();
      
      if (!rootTeamMember) {
        throw new Error('管理员团队不存在，请联系管理员');
      }

      // 将新用户加入 root 管理员的团队
      // role 使用 'member'（非 owner），确保 isOwner=false，普通用户无管理权限
      // 实际资源权限通过 MongoResourcePermission 表控制
      const [tmb] = await MongoTeamMember.create(
        [{
          teamId: rootTeamMember.teamId,
          userId: user._id,
          name: displayName || username.split('@')[0],
          role: 'member',
          status: TeamMemberStatusEnum.active,
          createTime: new Date()
        }],
        { session }
      );

      addLog.info('鲁港通用户加入管理员团队', { 
        userId: user._id.toString(), 
        teamId: rootTeamMember.teamId.toString() 
      });

      // 为新用户添加团队读取权限（让用户能正常访问团队）
      await MongoResourcePermission.create(
        [{
          resourceType: PerResourceTypeEnum.team,
          teamId: rootTeamMember.teamId,
          resourceId: null,
          tmbId: tmb._id,
          permission: TeamDefaultRoleVal
        }],
        { session }
      );

      // 鲁港通：为新用户添加默认应用的读取权限（包含聊天日志读取权限）
      // ReadPermissionVal (0b100) + AppReadChatLogPerVal (0b1000) = 0b1100 = 12
      const defaultAppId = process.env.DEFAULT_APP_ID;
      if (defaultAppId) {
        const { AppReadChatLogPerVal } = await import('@fastgpt/global/support/permission/app/constant');
        const appPermission = sumPer(ReadPermissionVal, AppReadChatLogPerVal);
        
        await MongoResourcePermission.create(
          [{
            resourceType: PerResourceTypeEnum.app,
            teamId: rootTeamMember.teamId,
            resourceId: new Types.ObjectId(defaultAppId),
            tmbId: tmb._id,
            permission: appPermission
          }],
          { session }
        );
        addLog.info('鲁港通用户应用权限已分配', { 
          tmbId: tmb._id.toString(), 
          appId: defaultAppId,
          permission: appPermission
        });
      }

      return {
        userId: user._id.toString(),
        tmbId: tmb._id.toString()
      };
    });

    if (!userData?.tmbId) {
      return jsonRes(res, { code: 500, error: '用户创建失败' });
    }

    // 在鲁港通后端创建对应用户（异步，不阻塞注册流程）
    // Requirement 5.1, 5.2, 5.4: 注册成功后同步到后端，同步失败不阻塞注册
    createUserInBackend({
      username,
      password,
      display_name: displayName,
      email: userEmail,
      phone: userPhone
    }).catch((err) => {
      addLog.error('鲁港通后端用户创建异步失败', err);
    });

    // 获取用户详情
    const userDetail = await getUserDetail({
      tmbId: userData.tmbId,
      userId: userData.userId
    });

    // 生成 session token（与登录 API 保持一致）
    const token = await createUserSession({
      userId: userData.userId,
      teamId: userDetail.team.teamId,
      tmbId: userData.tmbId,
      isRoot: false,
      ip: requestIp.getClientIp(req)
    });
    setCookie(res, token);

    addLog.info('鲁港通用户注册成功', { username, isPhone: isPhone(username) });

    return jsonRes(res, {
      data: {
        user: userDetail,
        token
      }
    });
  } catch (error: any) {
    addLog.error('鲁港通用户注册失败', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '注册失败，请稍后再试'
    });
  }
}
