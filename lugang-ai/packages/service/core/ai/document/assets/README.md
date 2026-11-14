# 文档能力字体资产

- 文件：`NotoSansSC-Regular.otf`（Noto Sans SC Regular，Adobe/Google Noto CJK 项目，SIL Open Font License 1.1）
- 来源：https://github.com/notofonts/noto-cjk 的 `Sans/SubsetOTF/SC/NotoSansSC-Regular.otf`
- SHA-256：`faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`
- 许可证：同目录 `OFL.txt`，随字体一并分发
- 用途：服务端生成 PDF 时嵌入中文字体（PDFKit，子集嵌入）
- 说明：设计文档写作 TTF，实际采用同字体家族的静态 OTF（CFF）。实测 pdf-lib + @pdf-lib/fontkit 对该 CID-keyed CFF 字体子集化会丢字形（如「预约填」渲染空白），故 PDF 排版与嵌入统一使用 PDFKit（fontkit 2），已验证中文渲染完整、文本可抽取、子集文件约 50KB；仓库体积比可变 TTF 小一半
