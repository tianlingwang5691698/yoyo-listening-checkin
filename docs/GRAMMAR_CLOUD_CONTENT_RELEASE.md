# 语法云课程发布

## 结构

- 每次发布生成不可变 `releaseId`，由 25 个专题的内容哈希决定。
- 每个专题一个 JSON，同时包含 `zh-CN` 和 `en` bundle。
- 云存储路径：`_content/grammar-classroom/releases/{releaseId}/`。
- 发布记录只向 `grammarClassroomReleases` 新增，不更新、不删除旧版本。

## 生成与检查

```bash
node scripts/build_grammar_cloud_release.js
node scripts/publish_grammar_cloud_release.js --release-id=<releaseId>
```

生成时自动检查：25 个专题、484 节课、中英课程数与顺序、中英共用 narration、重复 ID、单专题小于 1MB，以及内容、文件和 manifest 哈希。默认发布命令只做本地 dry-run。

## 正式增量发布

1. 在 CloudBase 控制台创建 `grammarClassroomReleases` 空集合；建议增加 `active + status + releasedAt` 组合索引。
2. 确认 `SecretKey.csv` 和正式环境配置。
3. 执行：

```bash
node scripts/publish_grammar_cloud_release.js --release-id=<releaseId> --apply --confirm-additive-release
```

正式发布前会对全部 26 个云路径做哈希预检；同路径、同哈希的已上传文件会验证后复用，便于中断后续传；同路径但哈希不同会立即终止，绝不覆盖。专题和 manifest 全部校验后，才新增 `status: released, active: true` 的发布记录。

## 回退到已发布版本

默认只做本地 dry-run：

```bash
node scripts/activate_grammar_cloud_release.js --release-id=<旧 releaseId>
```

正式全局切换：

```bash
node scripts/activate_grammar_cloud_release.js --release-id=<旧 releaseId> --apply --confirm-activate-existing-release --confirm-global-switch
```

回退脚本不上传、不覆盖任何文件。它会校验本地发布包、云端 manifest 原始文件哈希和 `manifestHash`，确认数据库已有该 `releaseId` 的发布记录后，再追加一条最新 `released/active` 记录。读取端按最新记录选择全局版本。
