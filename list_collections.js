// MongoDB 脚本：列出所有集合
db = db.getSiblingDB('fastgpt');

print("数据库中的所有集合：\n");
db.getCollectionNames().forEach(name => {
  if (name.includes('system') || name.includes('content')) {
    const count = db[name].countDocuments();
    print(`  ${name}: ${count} 条记录`);
  }
});
