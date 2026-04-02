// 检查 robertjin 用户的权限
print("=== 查找 robertjin 用户 ===");
const user = db.users.findOne({username: /robertjin/i});
if (!user) {
    print("❌ 没有找到用户！");
} else {
    printjson(user);
    
    print("\n=== 用户权限记录 ===");
    const permissions = db.user_permissions.find({userId: user._id}).toArray();
    if (permissions.length === 0) {
        print("❌ 没有找到权限记录！");
    } else {
        print("✅ 找到 " + permissions.length + " 条权限记录");
        permissions.forEach(p => {
            print("\n权限类型: " + p.type);
            print("权限值: " + p.val);
            print("创建时间: " + p.createTime);
        });
    }
}

print("\n=== 所有权限记录数量 ===");
print("总数: " + db.user_permissions.countDocuments());
