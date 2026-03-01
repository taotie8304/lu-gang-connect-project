export const checkPasswordRule = (password: string) => {
  // 鲁港通：密码规则 - 必须包含大写、小写、数字，8-20位
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const validLength = password.length >= 8 && password.length <= 20;
  const validChars = /^[\dA-Za-z!@#$%^&*()_+=.,:;?\/\\|`~"'<>{}\[\]-]+$/;

  // 必须同时满足：大写、小写、数字、长度8-20、只包含有效字符
  return hasUpperCase && hasLowerCase && hasNumber && validLength && validChars.test(password);
};
