#!/bin/bash

echo "=== 检查 MongoDB 中的使用条款 ==="
docker exec lugang-ai-mongo mongosh -u root -p LuGang2024Secure --authenticationDatabase admin fastgpt --quiet --eval '
db.system_contents.find({key: "terms_of_use"}).forEach(doc => {
  print("_id:", doc._id);
  print("title:", doc.title);
  print("contentLength:", doc.content.length);
  print("updateTime:", doc.updateTime);
  print("content preview:", doc.content.substring(0, 100));
  print("");
});
'
