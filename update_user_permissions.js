// 更新所有旧用户的应用权限从 4 改为 12
// 在服务器上运行：docker exec -i lugang-ai-mongo mongosh -u root -p LuGang2024Secure --authenticationDatabase admin lugang_ai < update_user_permissions.js

db.resource_permissions.updateMany(
  {
    resourceType: 'app',
    resourceId: ObjectId('6966689f9f3c04a509b3465a'),
    permission: 4
  },
  {
    $set: { permission: 12 }
  }
);

print('权限更新完成');
print('更新的记录数：' + db.resource_permissions.countDocuments({
  resourceType: 'app',
  resourceId: ObjectId('6966689f9f3c04a509b3465a'),
  permission: 12
}));
