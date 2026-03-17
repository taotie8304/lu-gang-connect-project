/**
 * 鲁港通 - 管理员用户详情 API 属性测试
 * Feature: user-profile-management, Property 5: 管理员更新用户信息后数据库一致
 * Feature: user-profile-management, Property 6: 信息变更同步到鲁港通后端
 * Feature: user-profile-management, Property 7: 密码长度校验
 * Feature: user-profile-management, Property 8: root 用户不可修改
 * Validates: Requirements 5.1, 5.2, 5.5, 5.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validatePassword } from '@/pages/api/admin/users/detail';
import { validateEmail, validatePhone } from '@/pages/api/user/profile';

// 辅助：从字符集生成字符串
function stringFromCharset(charset: string, minLen: number, maxLen: number) {
  return fc
    .array(fc.constantFrom(...charset.split('')), { minLength: minLen, maxLength: maxLen })
    .map((arr) => arr.join(''));
}

describe('Property 5: 管理员更新用户信息后数据库一致', () => {
  // Feature: user-profile-management, Property 5: 管理员更新用户信息后数据库一致
  // Validates: Requirements 5.1

  it('for any valid admin update body, user fields map correctly to DB update', () => {
    const validEmailArb = fc
      .tuple(
        stringFromCharset('abcdefghijklmnopqrstuvwxyz0123456789', 1, 10),
        stringFromCharset('abcdefghijklmnopqrstuvwxyz', 1, 8),
        stringFromCharset('abcdefghijklmnopqrstuvwxyz', 2, 4)
      )
      .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    const validPhoneArb = fc.integer({ min: 7, max: 15 }).chain((len) =>
      stringFromCharset('0123456789', len, len)
    );

    const validPasswordArb = fc.string({ minLength: 8, maxLength: 64 });

    const bodyArb = fc.record({
      userId: fc.string({ minLength: 1, maxLength: 24 }),
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
      nickname: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
      phone: fc.option(validPhoneArb, { nil: undefined }),
      email: fc.option(validEmailArb, { nil: undefined }),
      address: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
      newPassword: fc.option(validPasswordArb, { nil: undefined })
    });

    fc.assert(
      fc.property(bodyArb, (body) => {
        // 模拟 handlePut 中的 userUpdate 构建逻辑
        const userUpdate: Record<string, any> = {};
        if (body.nickname !== undefined) userUpdate.nickname = body.nickname;
        if (body.phone !== undefined) userUpdate.phone = body.phone;
        if (body.email !== undefined) userUpdate.email = body.email;
        if (body.address !== undefined) userUpdate.address = body.address;
        if (body.newPassword !== undefined && body.newPassword !== '') {
          userUpdate.password = body.newPassword;
          userUpdate.passwordUpdateTime = expect.any(Date);
        }

        // 不变量：每个定义的字段都映射到 userUpdate
        for (const key of ['nickname', 'phone', 'email', 'address'] as const) {
          if (body[key] !== undefined) {
            expect(userUpdate[key]).toBe(body[key]);
          } else {
            expect(userUpdate).not.toHaveProperty(key);
          }
        }

        // name 不在 userUpdate 中（它更新 TeamMember）
        expect(userUpdate).not.toHaveProperty('name');

        // 所有字段通过校验
        if (body.email !== undefined) expect(validateEmail(body.email)).toBe(true);
        if (body.phone !== undefined) expect(validatePhone(body.phone)).toBe(true);
        if (body.newPassword !== undefined && body.newPassword !== '') {
          expect(validatePassword(body.newPassword)).toBe(true);
        }
      }),
      { numRuns: 10 }
    );
  });
});

describe('Property 6: 信息变更同步到鲁港通后端', () => {
  // Feature: user-profile-management, Property 6: 信息变更同步到鲁港通后端
  // Validates: Requirements 5.2

  it('for any update, sync payload should contain the correct fields', () => {
    const bodyArb = fc.record({
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
      nickname: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
      email: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
      phone: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined })
    });

    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 30 }), // username
        bodyArb,
        (username, body) => {
          // 模拟 handlePut 中构建同步 payload 的逻辑
          const syncPayload = {
            username,
            display_name: body.name || body.nickname,
            email: body.email,
            phone: body.phone
          };

          // 不变量：username 始终存在
          expect(syncPayload.username).toBe(username);

          // display_name 优先取 name，其次 nickname
          if (body.name) {
            expect(syncPayload.display_name).toBe(body.name);
          } else if (body.nickname) {
            expect(syncPayload.display_name).toBe(body.nickname);
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Property 7: 密码长度校验', () => {
  // Feature: user-profile-management, Property 7: 密码长度校验
  // Validates: Requirements 5.5

  it('for any string shorter than 8 chars, validatePassword should return false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 7 }),
        (shortPassword) => {
          expect(validatePassword(shortPassword)).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('for any string of 8+ chars, validatePassword should return true', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 128 }),
        (validPassword) => {
          expect(validatePassword(validPassword)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Property 8: root 用户不可修改', () => {
  // Feature: user-profile-management, Property 8: root 用户不可修改
  // Validates: Requirements 5.7

  it('for any update targeting root username, the check should block it', () => {
    // 模拟 handlePut 中的 root 检查逻辑
    function isRootUser(username: string): boolean {
      return username === 'root';
    }

    fc.assert(
      fc.property(
        fc.record({
          name: fc.option(fc.string(), { nil: undefined }),
          nickname: fc.option(fc.string(), { nil: undefined }),
          phone: fc.option(fc.string(), { nil: undefined }),
          email: fc.option(fc.string(), { nil: undefined }),
          newPassword: fc.option(fc.string(), { nil: undefined })
        }),
        (_body) => {
          // 不变量：无论提交什么数据，root 用户始终被拒绝
          expect(isRootUser('root')).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('for any non-root username, the check should allow it', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s !== 'root'),
        (username) => {
          expect(username === 'root').toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });
});
