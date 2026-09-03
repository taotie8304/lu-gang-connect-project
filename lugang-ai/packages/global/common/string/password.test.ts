/**
 * 鲁港通 - 密码验证规则测试
 * 验证密码必须包含大写、小写、数字，8-20位
 */
import { describe, it, expect } from 'vitest';
import { checkPasswordRule } from './password';

describe('checkPasswordRule', () => {
  describe('有效密码', () => {
    it('应该接受包含大写、小写、数字的8位密码', () => {
      expect(checkPasswordRule('Abcd1234')).toBe(true);
    });

    it('应该接受包含大写、小写、数字的20位密码', () => {
      expect(checkPasswordRule('Abcd1234567890123456')).toBe(true);
    });

    it('应该接受包含大写、小写、数字和特殊字符的密码', () => {
      expect(checkPasswordRule('Abcd123!')).toBe(true);
      expect(checkPasswordRule('Test@123')).toBe(true);
      expect(checkPasswordRule('Pass#word1')).toBe(true);
    });

    it('应该接受中等长度的有效密码', () => {
      expect(checkPasswordRule('MyPassword123')).toBe(true);
      expect(checkPasswordRule('Secure1Pass')).toBe(true);
    });
  });

  describe('无效密码 - 缺少必需字符', () => {
    it('应该拒绝没有大写字母的密码', () => {
      expect(checkPasswordRule('abcd1234')).toBe(false);
      expect(checkPasswordRule('password123')).toBe(false);
    });

    it('应该拒绝没有小写字母的密码', () => {
      expect(checkPasswordRule('ABCD1234')).toBe(false);
      expect(checkPasswordRule('PASSWORD123')).toBe(false);
    });

    it('应该拒绝没有数字的密码', () => {
      expect(checkPasswordRule('Abcdefgh')).toBe(false);
      expect(checkPasswordRule('Password')).toBe(false);
    });

    it('应该拒绝只有两种字符类型的密码', () => {
      expect(checkPasswordRule('abcd1234')).toBe(false); // 只有小写和数字
      expect(checkPasswordRule('ABCD1234')).toBe(false); // 只有大写和数字
      expect(checkPasswordRule('Abcdefgh')).toBe(false); // 只有大小写
    });
  });

  describe('无效密码 - 长度不符', () => {
    it('应该拒绝少于8位的密码', () => {
      expect(checkPasswordRule('Abc123')).toBe(false);
      expect(checkPasswordRule('Ab1')).toBe(false);
      expect(checkPasswordRule('Test1')).toBe(false);
    });

    it('应该拒绝超过20位的密码', () => {
      expect(checkPasswordRule('Abcd12345678901234567')).toBe(false);
      expect(checkPasswordRule('VeryLongPassword123456')).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该接受恰好8位的有效密码', () => {
      expect(checkPasswordRule('Abcd1234')).toBe(true);
    });

    it('应该接受恰好20位的有效密码', () => {
      expect(checkPasswordRule('Abcd1234567890123456')).toBe(true);
    });

    it('应该拒绝恰好7位的密码', () => {
      expect(checkPasswordRule('Abcd123')).toBe(false);
    });

    it('应该拒绝恰好21位的密码', () => {
      expect(checkPasswordRule('Abcd12345678901234567')).toBe(false);
    });
  });

  describe('特殊字符', () => {
    it('应该接受包含特殊字符的有效密码', () => {
      expect(checkPasswordRule('Test@123')).toBe(true);
      expect(checkPasswordRule('Pass#word1')).toBe(true);
      expect(checkPasswordRule('My$ecure1')).toBe(true);
      expect(checkPasswordRule('Safe&Pass1')).toBe(true);
    });

    it('应该拒绝包含无效字符的密码', () => {
      // 空格
      expect(checkPasswordRule('Test 123A')).toBe(false);
      // 中文字符
      expect(checkPasswordRule('Test密码1A')).toBe(false);
    });
  });

  describe('空值和特殊情况', () => {
    it('应该拒绝空字符串', () => {
      expect(checkPasswordRule('')).toBe(false);
    });

    it('应该拒绝只有空格的字符串', () => {
      expect(checkPasswordRule('        ')).toBe(false);
    });
  });
});
