# 文档能力字体资产

- 文件：`NotoSansSC-Regular.otf`（Noto Sans SC Regular，Adobe/Google Noto CJK 项目，SIL Open Font License 1.1）
- 来源：https://github.com/notofonts/noto-cjk 的 `Sans/SubsetOTF/SC/NotoSansSC-Regular.otf`
- SHA-256：`faa6c9df652116dde789d351359f3d7e5d2285a2b2a1f04a2d7244df706d5ea9`
- 许可证：同目录 `OFL.txt`，随字体一并分发
- 用途：服务端生成 PDF 与填写/叠加 PDF 文本时嵌入中文字体（pdf-lib + @pdf-lib/fontkit，subset 嵌入）
- 说明：设计文档写作 TTF，实际采用同字体家族的静态 OTF（CFF），已验证 pdf-lib 嵌入、子集化与中文文本抽取正常；仓库体积比可变 TTF 小一半
