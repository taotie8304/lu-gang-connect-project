/**
 * 鲁港通 - 密码验证属性测试
 * Feature: user-experience-redesign, Property 3: Password Validation Rules
 * 
 * Property 3: Password Validation Rules
 * For any password string, the password is valid if and only if it contains 
 * at least one uppercase letter, at least one lowercase letter, at least one digit, 
 * and has length between 8 and 20 characters inclusive.
 * 
 * Validates: Requirements 3.3.3, 8.2
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { checkPasswordRule } from './password';

describe('Property-Based Tests: Password Validation Rules', () => {
  /**
   * Property 3: Password Validation Rules
   * 
   * 这个属性测试验证密码验证函数的正确性：
   * - 有效密码必须包含大写字母、小写字母、数字
   * - 长度必须在 8-20 位之间
   * - 只包含允许的字符
   */
  describe('Property 3: Valid passwords must meet all requirements', () => {
    it('should accept any password with uppercase, lowercase, digit, and length 8-20', () => {
      // 生成有效密码的生成器
      const validPasswordArbitrary = fc.tuple(
        // 至少一个大写字母
        fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 1, maxLength: 5 }),
        // 至少一个小写字母
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 5 }),
        // 至少一个数字
        fc.array(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 5 }),
        // 可选的其他字符（大写、小写、数字、特殊字符）
        fc.array(
          fc.constantFrom(
            ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+=.,:;?/\\|`~"\'<>{}[]-'
          ),
          { maxLength: 10 }
        )
      ).chain(([upper, lower, digit, extra]) => {
        // 组合所有部分
        const combined = [...upper, ...lower, ...digit, ...extra].join('');
        // 确保长度在 8-20 之间
        if (combined.length < 8) {
          // 如果太短，添加更多字符
          const needed = 8 - combined.length;
          return fc.constant(combined + 'a'.repeat(needed));
        } else if (combined.length > 20) {
          // 如果太长，截断到 20
          return fc.constant(combined.slice(0, 20));
        }
        // 打乱字符顺序
        return fc.shuffledSubarray(combined.split(''), { minLength: combined.length, maxLength: combined.length })
          .map(chars => chars.join(''));
      });

      fc.assert(
        fc.property(validPasswordArbitrary, (password) => {
          // 验证生成的密码确实满足所有条件
          const hasUpper = /[A-Z]/.test(password);
          const hasLower = /[a-z]/.test(password);
          const hasDigit = /\d/.test(password);
          const validLength = password.length >= 8 && password.length <= 20;
          
          // 如果生成器正确，这些应该都为 true
          expect(hasUpper).toBe(true);
          expect(hasLower).toBe(true);
          expect(hasDigit).toBe(true);
          expect(validLength).toBe(true);
          
          // 密码验证函数应该返回 true
          expect(checkPasswordRule(password)).toBe(true);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 3: Invalid passwords must be rejected', () => {
    it('should reject passwords without uppercase letters', () => {
      // 生成没有大写字母的密码
      const noUppercaseArbitrary = fc.tuple(
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 4, maxLength: 10 }),
        fc.array(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 5 }),
        fc.array(fc.constantFrom(...'!@#$%^&*()_+='), { maxLength: 5 })
      ).map(([lower, digit, special]) => {
        const combined = [...lower, ...digit, ...special].join('');
        // 确保长度在 8-20 之间
        if (combined.length < 8) {
          return combined + 'a'.repeat(8 - combined.length);
        } else if (combined.length > 20) {
          return combined.slice(0, 20);
        }
        return combined;
      });

      fc.assert(
        fc.property(noUppercaseArbitrary, (password) => {
          // 确认没有大写字母
          expect(/[A-Z]/.test(password)).toBe(false);
          // 密码验证应该失败
          expect(checkPasswordRule(password)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject passwords without lowercase letters', () => {
      // 生成没有小写字母的密码
      const noLowercaseArbitrary = fc.tuple(
        fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 4, maxLength: 10 }),
        fc.array(fc.constantFrom(...'0123456789'), { minLength: 1, maxLength: 5 }),
        fc.array(fc.constantFrom(...'!@#$%^&*()_+='), { maxLength: 5 })
      ).map(([upper, digit, special]) => {
        const combined = [...upper, ...digit, ...special].join('');
        if (combined.length < 8) {
          return combined + 'A'.repeat(8 - combined.length);
        } else if (combined.length > 20) {
          return combined.slice(0, 20);
        }
        return combined;
      });

      fc.assert(
        fc.property(noLowercaseArbitrary, (password) => {
          expect(/[a-z]/.test(password)).toBe(false);
          expect(checkPasswordRule(password)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject passwords without digits', () => {
      // 生成没有数字的密码
      const noDigitArbitrary = fc.tuple(
        fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 2, maxLength: 8 }),
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 2, maxLength: 8 }),
        fc.array(fc.constantFrom(...'!@#$%^&*()_+='), { maxLength: 4 })
      ).map(([upper, lower, special]) => {
        const combined = [...upper, ...lower, ...special].join('');
        if (combined.length < 8) {
          return combined + 'a'.repeat(8 - combined.length);
        } else if (combined.length > 20) {
          return combined.slice(0, 20);
        }
        return combined;
      });

      fc.assert(
        fc.property(noDigitArbitrary, (password) => {
          expect(/\d/.test(password)).toBe(false);
          expect(checkPasswordRule(password)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject passwords shorter than 8 characters', () => {
      // 生成短密码（包含所有必需字符类型，但长度不足）
      const shortPasswordArbitrary = fc.tuple(
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'),
        fc.constantFrom(...'0123456789'),
        fc.array(
          fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
          { maxLength: 4 }
        )
      ).map(([upper, lower, digit, extra]) => {
        const combined = [upper, lower, digit, ...extra].join('');
        // 确保长度小于 8
        return combined.slice(0, Math.min(combined.length, 7));
      });

      fc.assert(
        fc.property(shortPasswordArbitrary, (password) => {
          expect(password.length).toBeLessThan(8);
          expect(checkPasswordRule(password)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject passwords longer than 20 characters', () => {
      // 生成长密码
      const longPasswordArbitrary = fc.tuple(
        fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 5, maxLength: 10 }),
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 5, maxLength: 10 }),
        fc.array(fc.constantFrom(...'0123456789'), { minLength: 5, maxLength: 10 })
      ).map(([upper, lower, digit]) => {
        const combined = [...upper, ...lower, ...digit].join('');
        // 确保长度大于 20
        if (combined.length <= 20) {
          return combined + 'a'.repeat(21 - combined.length);
        }
        return combined;
      });

      fc.assert(
        fc.property(longPasswordArbitrary, (password) => {
          expect(password.length).toBeGreaterThan(20);
          expect(checkPasswordRule(password)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 3: Boundary cases', () => {
    it('should accept passwords with exactly 8 characters', () => {
      // 生成恰好 8 位的有效密码
      const exactly8CharsArbitrary = fc.tuple(
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'),
        fc.constantFrom(...'0123456789'),
        fc.array(
          fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
          { minLength: 5, maxLength: 5 }
        )
      ).map(([upper, lower, digit, extra]) => [upper, lower, digit, ...extra].join(''));

      fc.assert(
        fc.property(exactly8CharsArbitrary, (password) => {
          expect(password.length).toBe(8);
          expect(checkPasswordRule(password)).toBe(true);
        }),
        { numRuns: 10 }
      );
    });

    it('should accept passwords with exactly 20 characters', () => {
      // 生成恰好 20 位的有效密码
      const exactly20CharsArbitrary = fc.tuple(
        fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 5, maxLength: 5 }),
        fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 5, maxLength: 5 }),
        fc.array(fc.constantFrom(...'0123456789'), { minLength: 5, maxLength: 5 }),
        fc.array(
          fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
          { minLength: 5, maxLength: 5 }
        )
      ).map(([upper, lower, digit, extra]) => [...upper, ...lower, ...digit, ...extra].join(''));

      fc.assert(
        fc.property(exactly20CharsArbitrary, (password) => {
          expect(password.length).toBe(20);
          expect(checkPasswordRule(password)).toBe(true);
        }),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 3: Special characters handling', () => {
    it('should accept passwords with allowed special characters', () => {
      // 生成包含特殊字符的有效密码
      const withSpecialCharsArbitrary = fc.tuple(
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'),
        fc.constantFrom(...'0123456789'),
        fc.array(fc.constantFrom(...'!@#$%^&*()_+=.,:;?/\\|`~"\'<>{}[]-'), { minLength: 1, maxLength: 10 }),
        fc.array(
          fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
          { maxLength: 6 }
        )
      ).map(([upper, lower, digit, special, extra]) => {
        const combined = [upper, lower, digit, ...special, ...extra].join('');
        if (combined.length < 8) {
          return combined + 'a'.repeat(8 - combined.length);
        } else if (combined.length > 20) {
          return combined.slice(0, 20);
        }
        return combined;
      });

      fc.assert(
        fc.property(withSpecialCharsArbitrary, (password) => {
          // 验证包含特殊字符
          const hasSpecial = /[!@#$%^&*()_+=.,:;?/\\|`~"'<>{}\[\]-]/.test(password);
          expect(hasSpecial).toBe(true);
          // 应该被接受
          expect(checkPasswordRule(password)).toBe(true);
        }),
        { numRuns: 10 }
      );
    });
  });
});
