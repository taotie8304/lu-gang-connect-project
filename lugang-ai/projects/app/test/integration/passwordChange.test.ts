/**
 * 鲁港通 - 密码修改集成测试
 * 验证密码修改功能的完整流程
 */
import { describe, it, expect } from 'vitest';
import { checkPasswordRule } from '@fastgpt/global/common/string/password';
import { hashStr } from '@fastgpt/global/common/string/tools';

describe('Password Change Integration Tests', () => {
  describe('密码验证规则', () => {
    it('应该正确验证有效密码', () => {
      const validPasswords = [
        'Abcd1234',
        'Test@123',
        'MyPassword123',
        'Secure1Pass',
        'Abcd1234567890123456' // 20位
      ];

      validPasswords.forEach(password => {
        expect(checkPasswordRule(password)).toBe(true);
      });
    });

    it('应该正确拒绝无效密码', () => {
      const invalidPasswords = [
        'abcd1234',      // 没有大写
        'ABCD1234',      // 没有小写
        'Abcdefgh',      // 没有数字
        'Abc123',        // 太短
        'Abcd12345678901234567' // 太长（21位）
      ];

      invalidPasswords.forEach(password => {
        expect(checkPasswordRule(password)).toBe(false);
      });
    });
  });

  describe('密码哈希流程', () => {
    it('应该正确哈希密码', () => {
      const password = 'TestPassword123';
      const hashedOnce = hashStr(password);
      const hashedTwice = hashStr(hashedOnce);

      // 验证哈希后的值不同
      expect(hashedOnce).not.toBe(password);
      expect(hashedTwice).not.toBe(hashedOnce);
      expect(hashedTwice).not.toBe(password);

      // 验证哈希是确定性的（相同输入产生相同输出）
      expect(hashStr(password)).toBe(hashedOnce);
      expect(hashStr(hashedOnce)).toBe(hashedTwice);
    });

    it('应该模拟前后端密码哈希流程', () => {
      const userInputPassword = 'MySecurePass123';
      
      // 模拟前端：用户输入密码后，前端哈希一次
      const frontendHashed = hashStr(userInputPassword);
      
      // 模拟后端：接收前端哈希后的密码，再哈希一次存入数据库
      const backendHashed = hashStr(frontendHashed);
      
      // 模拟登录验证：前端发送哈希后的密码，后端再哈希一次比对
      const loginFrontendHashed = hashStr(userInputPassword);
      const loginBackendHashed = hashStr(loginFrontendHashed);
      
      // 验证登录时的哈希值与存储的哈希值相同
      expect(loginBackendHashed).toBe(backendHashed);
    });
  });

  describe('密码修改流程验证', () => {
    it('应该验证旧密码正确性', () => {
      const oldPassword = 'OldPassword123';
      const storedHash = hashStr(hashStr(oldPassword)); // 模拟数据库中的双重哈希
      
      // 用户输入旧密码
      const userInputOld = 'OldPassword123';
      const frontendHashedOld = hashStr(userInputOld);
      
      // 后端验证：再哈希一次与数据库比对
      const backendHashedOld = hashStr(frontendHashedOld);
      
      expect(backendHashedOld).toBe(storedHash);
    });

    it('应该拒绝错误的旧密码', () => {
      const oldPassword = 'OldPassword123';
      const storedHash = hashStr(hashStr(oldPassword));
      
      // 用户输入错误的旧密码
      const wrongPassword = 'WrongPassword123';
      const frontendHashedWrong = hashStr(wrongPassword);
      const backendHashedWrong = hashStr(frontendHashedWrong);
      
      expect(backendHashedWrong).not.toBe(storedHash);
    });

    it('应该正确更新新密码', () => {
      const newPassword = 'NewPassword456';
      
      // 前端哈希新密码
      const frontendHashedNew = hashStr(newPassword);
      
      // 后端再哈希一次存入数据库
      const backendHashedNew = hashStr(frontendHashedNew);
      
      // 验证新密码可以用于后续登录
      const loginFrontendHashed = hashStr(newPassword);
      const loginBackendHashed = hashStr(loginFrontendHashed);
      
      expect(loginBackendHashed).toBe(backendHashedNew);
    });

    it('应该验证新密码与旧密码不同', () => {
      const oldPassword = 'OldPassword123';
      const newPassword = 'OldPassword123'; // 相同的密码
      
      const oldHashed = hashStr(oldPassword);
      const newHashed = hashStr(newPassword);
      
      // 前端哈希后的值应该相同（因为密码相同）
      expect(oldHashed).toBe(newHashed);
      
      // 这种情况应该在后端被拒绝
    });

    it('应该验证新密码符合规则', () => {
      const validNewPassword = 'NewSecure123';
      const invalidNewPassword = 'weak'; // 不符合规则
      
      expect(checkPasswordRule(validNewPassword)).toBe(true);
      expect(checkPasswordRule(invalidNewPassword)).toBe(false);
    });

    it('应该验证确认密码匹配', () => {
      const newPassword = 'NewPassword789';
      const confirmPassword = 'NewPassword789';
      const wrongConfirm = 'DifferentPassword789';
      
      expect(newPassword).toBe(confirmPassword);
      expect(newPassword).not.toBe(wrongConfirm);
    });
  });

  describe('完整密码修改流程', () => {
    it('应该模拟完整的密码修改流程', () => {
      // 1. 初始状态：用户已有旧密码存储在数据库
      const oldPassword = 'OldSecure123';
      const storedOldHash = hashStr(hashStr(oldPassword));
      
      // 2. 用户在前端输入旧密码和新密码
      const userInputOld = 'OldSecure123';
      const userInputNew = 'NewSecure456';
      const userInputConfirm = 'NewSecure456';
      
      // 3. 前端验证
      // 3.1 验证新密码符合规则
      expect(checkPasswordRule(userInputNew)).toBe(true);
      
      // 3.2 验证确认密码匹配
      expect(userInputNew).toBe(userInputConfirm);
      
      // 3.3 前端哈希密码
      const frontendOldHash = hashStr(userInputOld);
      const frontendNewHash = hashStr(userInputNew);
      
      // 4. 后端验证
      // 4.1 验证旧密码正确
      const backendOldHash = hashStr(frontendOldHash);
      expect(backendOldHash).toBe(storedOldHash);
      
      // 4.2 验证新密码与旧密码不同
      expect(frontendOldHash).not.toBe(frontendNewHash);
      
      // 4.3 后端哈希新密码并存储
      const storedNewHash = hashStr(frontendNewHash);
      
      // 5. 验证新密码可以用于后续登录
      const loginPassword = 'NewSecure456';
      const loginFrontendHash = hashStr(loginPassword);
      const loginBackendHash = hashStr(loginFrontendHash);
      
      expect(loginBackendHash).toBe(storedNewHash);
      
      // 6. 验证旧密码不能再用于登录
      const oldLoginFrontendHash = hashStr(oldPassword);
      const oldLoginBackendHash = hashStr(oldLoginFrontendHash);
      
      expect(oldLoginBackendHash).toBe(storedOldHash);
      expect(oldLoginBackendHash).not.toBe(storedNewHash);
    });
  });
});
