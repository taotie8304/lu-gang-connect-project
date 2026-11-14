# 文档能力字体资产

- 文件：`NotoSansSC-Regular.otf`（Noto Sans SC Regular，Adobe/Google Noto CJK 项目，SIL Open Font License 1.1）
- 来源：https://github.com/notofonts/noto-cjk 的 `Sans/SubsetOTF/SC/NotoSansSC-Regular.otf`
- SHA-256：`faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`
- 许可证：同目录 `OFL.txt`，随字体一并分发
- 用途：服务端生成 PDF 时嵌入中文字体（PDFKit，子集嵌入）；编辑表单外观与文字叠加时嵌入中文字体（pdf-lib + @pdf-lib/fontkit，子集嵌入）
- 说明：设计文档写作 TTF，实际采用同字体家族的静态 OTF（CFF）。生成排版统一使用 PDFKit（fontkit 2），已验证中文渲染完整、文本可抽取、子集文件约 50KB；编辑叠加实测 pdf-lib 子集嵌入（`subset: true`）同样渲染完整、文本可抽取、产物增加约 40KB，但**不能改用全量嵌入（`subset: false`）**——该 CID-keyed CFF 字体全量嵌入会出现错字形。仓库体积比可变 TTF 小一半
