db = db.getSiblingDB('fastgpt');
const doc = db.system_contents.findOne({key: "terms_of_use"});
if (doc) {
  print("内容开头 200 字符:");
  print(doc.content.substring(0, 200));
} else {
  print("未找到记录");
}
