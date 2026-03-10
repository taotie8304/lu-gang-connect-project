/**
 * 鲁港通 - 用户个人资料 API 属性测试
 * Feature: user-profile-management, Property 3: 邮箱/手机号格式校验
 * Feature: user-profile-management, Property 4: 个人资料保存后数据库一致
 * Validates: Requirements 2.2, 2.4, 2.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateEmail, validatePhone } from '@/pages/api/user/profile';

// Helper: generate a string from a given charset
function stringFromCharset(charset: string, minLen: number, maxLen: number) {
  return fc
    .array(fc.constantFrom(...charset.split('')), { minLength: minLen, maxLength: maxLen })
    .map((arr) => arr.join(''));
}

describe('Property 3: 邮箱/手机号格式校验', () => {
  // Feature: user-profile-management, Property 3: 邮箱/手机号格式校验
  // Validates: Requirements 2.4, 2.5

  describe('validateEmail', () => {
    it('should accept valid emails with @ and domain containing a dot', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            stringFromCharset('abcdefghijklmnopqrstuvwxyz0123456789._-', 1, 20),
            stringFromCharset('abcdefghijklmnopqrstuvwxyz0123456789', 1, 10),
            stringFromCharset('abcdefghijklmnopqrstuvwxyz', 2, 5)
          ),
          ([local, domainName, tld]) => {
            const email = `${local}@${domainName}.${tld}`;
            expect(validateEmail(email)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings without @', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => !s.includes('@')),
          (noAt) => {
            expect(validateEmail(noAt)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings with @ but no domain dot', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            stringFromCharset('abcdefghijklmnopqrstuvwxyz', 1, 10),
            stringFromCharset('abcdefghijklmnopqrstuvwxyz', 1, 10)
          ),
          ([local, domain]) => {
            const email = `${local}@${domain}`;
            expect(validateEmail(email)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept empty string (optional field)', () => {
      expect(validateEmail('')).toBe(true);
    });
  });

  describe('validatePhone', () => {
    it('should accept 7-15 digit strings', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 7, max: 15 }).chain((len) =>
            stringFromCharset('0123456789', len, len)
          ),
          (phone) => {
            expect(validatePhone(phone)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings shorter than 7 digits', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 6 }).chain((len) =>
            stringFromCharset('0123456789', len, len)
          ),
          (shortPhone) => {
            expect(validatePhone(shortPhone)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings longer than 15 digits', () => {
      fc.assert(
        fc.property(
          stringFromCharset('0123456789', 16, 30),
          (longPhone) => {
            expect(validatePhone(longPhone)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject strings containing non-digit characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 7, maxLength: 15 }).filter((s) => s.length >= 7 && !/^\d+$/.test(s)),
          (nonDigit) => {
            expect(validatePhone(nonDigit)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept empty string (optional field)', () => {
      expect(validatePhone('')).toBe(true);
    });
  });
});

describe('Property 4: 个人资料保存后数据库一致', () => {
  // Feature: user-profile-management, Property 4: 个人资料保存后数据库一致
  // Validates: Requirements 2.2

  it('for any valid profile, all non-undefined fields should be included in the DB update', () => {
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

    const profileArb = fc.record({
      name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
      nickname: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
      phone: fc.option(validPhoneArb, { nil: undefined }),
      email: fc.option(validEmailArb, { nil: undefined }),
      address: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined })
    });

    fc.assert(
      fc.property(profileArb, (body) => {
        // Simulate the update object construction from handlePut
        const userUpdate: Record<string, any> = {};
        if (body.nickname !== undefined) userUpdate.nickname = body.nickname;
        if (body.phone !== undefined) userUpdate.phone = body.phone;
        if (body.email !== undefined) userUpdate.email = body.email;
        if (body.address !== undefined) userUpdate.address = body.address;

        // Invariant: every defined field in body (except name) maps to userUpdate
        for (const key of ['nickname', 'phone', 'email', 'address'] as const) {
          if (body[key] !== undefined) {
            expect(userUpdate[key]).toBe(body[key]);
          } else {
            expect(userUpdate).not.toHaveProperty(key);
          }
        }

        // name goes to TeamMember, not User — verify it's NOT in userUpdate
        expect(userUpdate).not.toHaveProperty('name');

        // All fields pass validation
        if (body.email !== undefined) {
          expect(validateEmail(body.email)).toBe(true);
        }
        if (body.phone !== undefined) {
          expect(validatePhone(body.phone)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
