// 鲁港通 - Excel 公式安全：只放行常规计算函数，阻止外部数据与命令类公式
export const DANGEROUS_FORMULA_PATTERN =
  /(WEBSERVICE|HYPERLINK|DDE|CMD|EXEC|CALL|REGISTER|IMPORTDATA|IMPORTXML|IMPORTRANGE|RTD|FILTERXML)\s*\(/i;

export const isSafeFormula = (formula: string): boolean => !DANGEROUS_FORMULA_PATTERN.test(formula);