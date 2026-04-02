// MongoDB 脚本：更新 root 用户密码
db = db.getSiblingDB('fastgpt');

// 更新密码
const result = db.users.updateOne(
  {username: "root"},
  {$set: {password: "39a37706427e8e1968b346f365ed982144afae01ac300edaadeb5b2b1c93c870"}}
);

// 输出结果
print("更新结果:");
printjson(result);

if (result.modifiedCount === 1) {
  print("\n✓ 密码重置成功！");
  print("新密码: Huijin8304*");
} else if (result.matchedCount === 0) {
  print("\n✗ 错误：未找到 root 用户");
} else {
  print("\n✗ 错误：密码未更新");
}
