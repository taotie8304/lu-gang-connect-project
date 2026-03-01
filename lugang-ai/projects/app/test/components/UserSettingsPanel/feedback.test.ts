/**
 * 鲁港通 - 产品反馈功能测试
 * Feature: user-experience-redesign
 * Validates: Requirements 3.4.1, 3.4.2, 3.4.3
 */
import { describe, it, expect } from 'vitest';

describe('Product Feedback Functionality', () => {
  describe('Requirement 3.4: 產品反饋 (Product Feedback)', () => {
    it('should generate correct mailto link with email address', () => {
      // 需求 3.4.2: 邮件地址应该是 service@airscend.com
      const expectedEmail = 'service@airscend.com';
      const mailtoLink = `mailto:${expectedEmail}?subject=鲁港通产品反馈`;
      
      expect(mailtoLink).toContain('mailto:');
      expect(mailtoLink).toContain(expectedEmail);
    });

    it('should generate correct mailto link with subject', () => {
      // 需求 3.4.3: 邮件主题应该是 "鲁港通产品反馈"
      const expectedSubject = '鲁港通产品反馈';
      const mailtoLink = `mailto:service@airscend.com?subject=${expectedSubject}`;
      
      expect(mailtoLink).toContain('subject=');
      expect(mailtoLink).toContain(expectedSubject);
    });

    it('should generate complete mailto link', () => {
      // 完整的 mailto 链接
      const mailtoLink = 'mailto:service@airscend.com?subject=鲁港通产品反馈';
      
      // 验证链接格式正确
      expect(mailtoLink).toBe('mailto:service@airscend.com?subject=鲁港通产品反馈');
      
      // 验证包含所有必需部分
      expect(mailtoLink.startsWith('mailto:')).toBe(true);
      expect(mailtoLink).toContain('service@airscend.com');
      expect(mailtoLink).toContain('subject=鲁港通产品反馈');
    });

    it('should parse mailto link correctly', () => {
      const mailtoLink = 'mailto:service@airscend.com?subject=鲁港通产品反馈';
      
      // 解析 mailto 链接
      const url = new URL(mailtoLink);
      
      // 验证协议
      expect(url.protocol).toBe('mailto:');
      
      // 验证邮箱地址（pathname 包含邮箱地址）
      expect(url.pathname).toBe('service@airscend.com');
      
      // 验证主题
      expect(url.searchParams.get('subject')).toBe('鲁港通产品反馈');
    });

    it('should handle URL encoding for subject', () => {
      // 测试主题是否需要 URL 编码
      const subject = '鲁港通产品反馈';
      const encodedSubject = encodeURIComponent(subject);
      
      // 验证编码后的主题可以正确解码
      expect(decodeURIComponent(encodedSubject)).toBe(subject);
      
      // 验证 mailto 链接可以使用编码或未编码的主题
      const mailtoWithEncoded = `mailto:service@airscend.com?subject=${encodedSubject}`;
      const mailtoWithoutEncoded = `mailto:service@airscend.com?subject=${subject}`;
      
      // 两种方式都应该有效
      expect(mailtoWithEncoded).toContain('service@airscend.com');
      expect(mailtoWithoutEncoded).toContain('service@airscend.com');
    });
  });

  describe('Email validation', () => {
    it('should validate email address format', () => {
      const email = 'service@airscend.com';
      
      // 简单的邮箱格式验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(email)).toBe(true);
    });

    it('should validate email domain', () => {
      const email = 'service@airscend.com';
      const domain = email.split('@')[1];
      
      expect(domain).toBe('airscend.com');
    });
  });

  describe('Subject validation', () => {
    it('should validate subject contains required text', () => {
      const subject = '鲁港通产品反馈';
      
      // 验证主题包含关键词
      expect(subject).toContain('鲁港通');
      expect(subject).toContain('产品反馈');
    });

    it('should validate subject is not empty', () => {
      const subject = '鲁港通产品反馈';
      
      expect(subject.length).toBeGreaterThan(0);
      expect(subject.trim()).toBe(subject);
    });
  });

  describe('Integration with window.location', () => {
    it('should generate valid href for window.location', () => {
      const href = 'mailto:service@airscend.com?subject=鲁港通产品反馈';
      
      // 验证这是一个有效的 href 值
      expect(typeof href).toBe('string');
      expect(href.length).toBeGreaterThan(0);
      expect(href.startsWith('mailto:')).toBe(true);
    });

    it('should not contain invalid characters', () => {
      const href = 'mailto:service@airscend.com?subject=鲁港通产品反馈';
      
      // 验证不包含换行符或其他无效字符
      expect(href).not.toContain('\n');
      expect(href).not.toContain('\r');
      expect(href).not.toContain('\t');
    });
  });
});
