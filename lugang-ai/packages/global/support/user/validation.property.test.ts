/**
 * 鲁港通 - 用户信息验证属性测试
 * Property 5: User Profile Validation
 * Validates: Requirements 6.3, 6.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidEmail,
  isValidChinesePhone,
  isEmail,
  isPhone,
  validateUserRegistration,
  validateUserProfile
} from './validation';

describe('Property 5: User Profile Validation', () => {
  describe('Email Validation (Requirement 6.3)', () => {
    it('should accept valid email formats', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          (email) => {
            const result = isValidEmail(email);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid email formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('invalid'),
            fc.constant('no@domain'),
            fc.constant('@nodomain.com'),
            fc.constant('no-at-sign.com'),
            fc.string().filter(s => !s.includes('@'))
          ),
          (invalidEmail) => {
            const result = isValidEmail(invalidEmail);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases', () => {
      // 空字符串
      expect(isValidEmail('')).toBe(false);
      // null/undefined
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail(undefined as any)).toBe(false);
      // 特殊字符
      expect(isValidEmail('test@domain.com')).toBe(true);
      expect(isValidEmail('test.name@domain.com')).toBe(true);
      expect(isValidEmail('test_name@domain.com')).toBe(true);
      expect(isValidEmail('test-name@domain.com')).toBe(true);
    });
  });

  describe('Phone Validation (Requirement 6.4)', () => {
    it('should accept valid Chinese phone numbers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 9 }),
          fc.integer({ min: 0, max: 9 }),
          fc.integer({ min: 0, max: 9 }),
          fc.integer({ min: 0, max: 9 }),
          fc.integer({ min: 0, max: 9 }),
          fc.integer({ min: 0, max: 9 }),
          fc.integer({ min: 0, max: 9 }),
          fc.integer({ min: 0, max: 9 }),
          fc.integer({ min: 0, max: 9 }),
          fc.integer({ min: 0, max: 9 }),
          (d1, d2, d3, d4, d5, d6, d7, d8, d9, d10) => {
            const phone = `1${d1}${d2}${d3}${d4}${d5}${d6}${d7}${d8}${d9}${d10}`;
            const result = isValidChinesePhone(phone);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid phone numbers', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('12345678901'), // 第二位是2
            fc.constant('0123456789'), // 不是1开头
            fc.constant('1234567890'), // 只有10位
            fc.constant('123456789012'), // 12位
            fc.string().filter(s => !/^1[3-9]\d{9}$/.test(s))
          ),
          (invalidPhone) => {
            const result = isValidChinesePhone(invalidPhone);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases', () => {
      // 空字符串
      expect(isValidChinesePhone('')).toBe(false);
      // null/undefined
      expect(isValidChinesePhone(null as any)).toBe(false);
      expect(isValidChinesePhone(undefined as any)).toBe(false);
      // 有效手机号
      expect(isValidChinesePhone('13800138000')).toBe(true);
      expect(isValidChinesePhone('15912345678')).toBe(true);
      expect(isValidChinesePhone('18888888888')).toBe(true);
      // 无效手机号
      expect(isValidChinesePhone('12345678901')).toBe(false); // 第二位是2
      expect(isValidChinesePhone('11234567890')).toBe(false); // 第二位是1
    });
  });

  describe('User Registration Validation', () => {
    it('should validate email registration with phone', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.integer({ min: 3, max: 9 }).chain(d1 =>
            fc.tuple(
              fc.constant(d1),
              fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 })
            )
          ),
          (email, [d1, digits]) => {
            const phone = `1${d1}${digits.join('')}`;
            const result = validateUserRegistration(email, undefined, phone);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate phone registration with email', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 9 }).chain(d1 =>
            fc.tuple(
              fc.constant(d1),
              fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 })
            )
          ),
          fc.emailAddress(),
          ([d1, digits], email) => {
            const phone = `1${d1}${digits.join('')}`;
            const result = validateUserRegistration(phone, email, undefined);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject email registration without phone', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          (email) => {
            const result = validateUserRegistration(email, undefined, undefined);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('手机号');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject phone registration without email', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 9 }).chain(d1 =>
            fc.tuple(
              fc.constant(d1),
              fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 })
            )
          ),
          ([d1, digits]) => {
            const phone = `1${d1}${digits.join('')}`;
            const result = validateUserRegistration(phone, undefined, undefined);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('邮箱');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid username format', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !isEmail(s) && !isPhone(s)),
          (invalidUsername) => {
            const result = validateUserRegistration(invalidUsername, 'test@example.com', '13800138000');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('用户名');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('User Profile Update Validation', () => {
    it('should accept valid profile data', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.integer({ min: 3, max: 9 }).chain(d1 =>
            fc.tuple(
              fc.constant(d1),
              fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 })
            )
          ),
          fc.date({ max: new Date() }),
          fc.string({ maxLength: 200 }),
          fc.emailAddress(),
          (email, [d1, digits], birthDate, address, googleAccount) => {
            const phone = `1${d1}${digits.join('')}`;
            const result = validateUserProfile({
              email,
              phone,
              birth_date: birthDate,
              address,
              google_account: googleAccount
            });
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid email in profile', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s !== '' && !isEmail(s)),
          (invalidEmail) => {
            const result = validateUserProfile({ email: invalidEmail });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('邮箱');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid phone in profile', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s !== '' && !isPhone(s)),
          (invalidPhone) => {
            const result = validateUserProfile({ phone: invalidPhone });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('手机号');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject future birth dates', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date(Date.now() + 86400000) }), // 明天及以后
          (futureDate) => {
            const result = validateUserProfile({ birth_date: futureDate });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('生日');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject too long address', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 201 }),
          (longAddress) => {
            const result = validateUserProfile({ address: longAddress });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('地址');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid google account format', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s !== '' && !isEmail(s)),
          (invalidGoogleAccount) => {
            const result = validateUserProfile({ google_account: invalidGoogleAccount });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Google');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept empty optional fields', () => {
      // 空字符串应该被接受
      expect(validateUserProfile({ email: '' }).valid).toBe(true);
      expect(validateUserProfile({ phone: '' }).valid).toBe(true);
      expect(validateUserProfile({ birth_date: '' }).valid).toBe(true);
      expect(validateUserProfile({ address: '' }).valid).toBe(true);
      expect(validateUserProfile({ google_account: '' }).valid).toBe(true);
      
      // undefined 应该被接受
      expect(validateUserProfile({ email: undefined }).valid).toBe(true);
      expect(validateUserProfile({ phone: undefined }).valid).toBe(true);
      expect(validateUserProfile({}).valid).toBe(true);
    });
  });

  describe('isEmail and isPhone helper functions', () => {
    it('isEmail should match isValidEmail', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (str) => {
            expect(isEmail(str)).toBe(isValidEmail(str));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isPhone should match isValidChinesePhone', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (str) => {
            expect(isPhone(str)).toBe(isValidChinesePhone(str));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
