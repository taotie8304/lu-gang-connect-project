// 检查最新用户的权限
const userId = ObjectId("69c96852e76596b8a6293ae4");
print("=== 用户信息 ===");
printjson(db.users.findOne({_id: userId}, {username: 1, createTime: 1}));

print("\n=== 用户权限记录 ===");
const permissions = db.user_permissions.find({userId: userId}).toArray();
if (permissions.length === 0) {
    print("❌ 没有找到权限记录！");
} else {
    printjson(permissions);
}

print("\n=== 所有权限记录数量 ===");
print("总数: " + db.user_permissions.countDocuments());
