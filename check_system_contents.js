// MongoDB 脚本：检查所有系统内容记录
db = db.getSiblingDB('fastgpt');

print("查找所有 terms_of_use 记录...\n");
const records = db.system_contents.find({ key: "terms_of_use" }).toArray();

print("找到", records.length, "条记录：\n");

records.forEach((record, index) => {
  print("记录", index + 1, ":");
  print("  _id:", record._id);
  print("  key:", record.key);
  print("  title:", record.title);
  print("  内容长度:", record.content ? record.content.length : 0, "字符");
  print("  内容开头:", record.content ? record.content.substring(0, 100) : "无");
  print("  createTime:", record.createTime);
  print("  updateTime:", record.updateTime);
  print("");
});
