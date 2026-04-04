/**
 * 鲁港通 - 系统内容常量定义
 */

export enum SystemContentKeyEnum {
  termsOfUse = 'terms_of_use',
  termsOfUseZhCN = 'terms_of_use_zh-CN',
  termsOfUseEn = 'terms_of_use_en',
  privacyPolicy = 'privacy_policy',
  privacyPolicyZhCN = 'privacy_policy_zh-CN',
  privacyPolicyEn = 'privacy_policy_en',
  dataCollection = 'data_collection',
  dataCollectionZhCN = 'data_collection_zh-CN',
  dataCollectionEn = 'data_collection_en'
}

export const systemContentKeyMap = {
  [SystemContentKeyEnum.termsOfUse]: {
    label: '使用條款',
    defaultTitle: '鲁港通 (LuGangTong) 使用條款',
    defaultContent: `# 鲁港通 (LuGangTong) 使用條款

**最後更新：2026年4月1日**

請仔細閱讀以下條款及細則（"《使用條款》" 或 "本協議"），其適用於閣下對鲁港通 (LuGangTong) 人工智能助手服務的使用。

本服務由**硕谷光核文化传播有限公司**（英文名稱：**Airscend Media Communications Limited**，簡稱 "**AMC Ltd**"，一家於香港成立的有限公司，香港為本協議適用的主要司法管轄區）對外提供及運營，**深圳市硕谷光核科技文化有限公司**為技術支援及內地數據合規主體（以下兩者統稱 "**Airscend**"、"**我們**" 或 "**我們的**"）。

---

## ⚠️ 重要提示（請特別注意）

**本協議第14條包含仲裁條款及法律選擇條款**，該等條款對閣下解決爭議的方式具有重大影響，請在使用本服務前仔細閱讀並確認理解。閣下繼續使用本服務即表示閣下已閱讀、理解並同意受該等條款的約束。

---

本協議由閣下與 Airscend 共同訂立。鲁港通 (LuGangTong) 是通過網站、流動應用程式及／或軟件應用程式提供的生成式人工智能聊天機器人及信息助手服務（"**本服務**"），旨在為用戶提供香港及山東省的民生、教育、金融、投資、營商及政策資訊。

通過下載、接達及／或使用本服務，即表示閣下確認已閱讀、理解並同意受本協議約束。如不同意，請勿使用本服務。

Airscend 有權不時對本服務及本《使用條款》作出具有約束力的更新，閣下應不時查看本條款以獲知任何更新。

**未成年人條款：** 如閣下未滿18歲，閣下必須由法定監護人作為擔保人接受本協議。擔保人同意擔保相關未成年人遵守本協議的條款。

---

## 1. 註冊

閣下可能需要提供個人資料以使用本服務，包括但不限於：

- **身份及聯絡資訊：** 使用者 ID、電話號碼、電子郵件地址；
- **輸入內容：** 指令、文本、音頻、聊天記錄、反饋及其他提交至本服務的內容；
- **通訊資訊：** 閣下與 Airscend 通訊時披露的個人資料；
- **日誌及裝置數據：** IP 地址、瀏覽器類型、操作系統、裝置識別碼等；
- **使用及位置數據：** 接達日期、時間、位置、互動數據及語言偏好；
- **其他資料：** 與提供本服務相關的必要資料。

閣下承諾：

- 提供準確、完整、合法及最新的個人資料；
- 保持登入詳情安全及保密，Airscend 對任何未經授權使用閣下帳戶的行為不承擔任何責任；
- 對通過其帳戶發生的所有活動負責，不得轉移或借出帳戶；
- 及時更新個人資料。

閣下的個人資料將根據鲁港通《私隱政策》及《個人資料收集聲明》進行處理，同時符合香港《個人資料（私隱）條例》（第486章）及中华人民共和国《個人信息保護法》的相關規定。

---

## 2. 服務使用

閣下確認 Airscend 可在其唯一酌情權下，隨時無需通知地增加、刪除、修改、暫停或終止本服務的任何部分，且 Airscend 在此情況下對閣下或任何第三方不承擔任何法律責任。

閣下同意僅為個人及非商業目的使用本服務，並對閣下提交的所有輸入內容及輸出內容承擔全部及唯一責任。

本服務及其任何部分的所有知識產權均為 Airscend 的專屬財產。

閣下明確同意不會：

- 將本服務用於軍事、非法或任何適用法律禁止的目的；
- 傳輸任何構成騷擾、誹謗、歧視、威脅、淫褻、暴力或粗俗的內容；
- 傳播任何違反香港法律（包括《煽動性刊物條例》）、內地法律（包括《網絡安全法》）或其他適用法律的信息，包括危害國家安全、社會秩序或公共利益的信息；
- 未經授權接達 Airscend 伺服器的任何部分，或試圖繞過任何安全措施；
- 干擾或擾亂本服務的正常運作；
- 傳輸任何含有病毒、木馬程式或其他惡意代碼的內容；
- 對本服務進行逆向工程、反編譯或拆解；
- 使用任何自動化系統（如"機器人"）接達本服務；
- 不誠實地或欺騙性地註冊多個帳戶；
- 未經 Airscend 事先書面許可複製、截圖或分發本服務的任何元件；
- 傳輸未獲授權的受知識產權保護的內容；
- 系統地下載及儲存本服務內容以創建任何資料庫；
- 利用本服務傳輸任何違反中华人民共和国《數據安全法》或《個人信息保護法》中跨境數據傳輸規定的信息；
- 將任何輸出內容用於直接商業銷售、再授權或作為向第三方提供的商業服務的基礎，而不事先獲得 Airscend 的書面同意。

Airscend 保留在不通知閣下的情況下監控閣下對本服務使用的權利，並保留以任何原因隨時終止閣下使用的權利。

---

## 3. 輸入及輸出內容

閣下對其向本服務提供的所有輸入內容，以及由此生成的任何輸出內容，承擔全部及唯一責任，並確保所有輸入內容及輸出內容遵守本《使用條款》及任何適用法律。

在閣下與 Airscend 之間：

- （a）閣下保留其輸入內容的所有權利；
- （b）Airscend 不主張擁有輸出內容的版權，並在此向閣下轉讓 Airscend 可能於輸出內容擁有的任何權利及權益。

然而，閣下確認輸出內容由人工智能生成，可能並非獨特，且可能與其他使用者收到的內容相同或相似，Airscend 對此不承擔任何責任。

閣下授予 Airscend 一項全球性、非專屬、免費、可轉讓及永久的權利及許可，以使用、分析及傳輸閣下的輸入內容及輸出內容，用於提供、維持、開發及改進本服務、遵守適用法律及執行本《使用條款》，Airscend 為此無需向閣下付款或承擔任何責任。

為免生疑問，閣下的可識別個人資料不會用於訓練 Airscend 的人工智能模型。

閣下確認：

- 輸出內容有時可能包含不準確、遺漏或錯誤，Airscend 對此不承擔任何法律責任；
- 輸出內容不代表 Airscend 的觀點；
- 輸出內容不構成任何形式的法律、財務、投資、稅務或醫療專業建議；
- 閣下對評估輸出內容的準確性及適用性負全部及唯一責任；
- 閣下不得僅憑輸出內容作出任何可能對個人或第三方產生法律或財務影響的重大決定。

**透明度聲明：** 閣下在發佈或分享輸出內容前，應加註："此內容由鲁港通（LuGangTong）人工智能生成，僅供參考，不構成專業建議。"

---

## 4. 知識產權

本服務中的所有材料及作品（統稱 "該內容"）歸 Airscend 所有。未經 Airscend 事先書面同意，閣下不得對該內容進行複製、下載、修改、商業利用或創作衍生作品。

閣下同意 Airscend 可以自由使用、披露、採納及修改閣下向 Airscend 提供的任何反饋，Airscend 為此無需向閣下付款或承擔任何責任。閣下特此放棄任何與 Airscend 使用上述反饋有關的索賠權利。

---

## 5. 監控

Airscend 不會主動監控使用者提交至本服務的輸入內容或輸出內容，也不保證其準確性、完整性或合法性。

**投訴程序：** 任何投訴可電郵至 service@airscend.com，或以書面方式寄往 AMC Ltd 的登記地址。

任何侵權投訴應以書面形式提交，並至少包含：

- 對聲稱受侵權作品及其擁有者的充分識別；
- 對侵權活動或材料的充分識別；
- 對侵權行為如何損害權利擁有人的描述；
- 投訴人的聯絡資訊；
- 一項聲明，確認：（i）投訴資訊屬真實準確；（ii）投訴人為版權擁有人或其授權代表；（iii）投訴人了解虛假陳述的法律後果。

Airscend 保留停用、移除或撤下任何侵權材料的權利，但對是否採取任何具體行動不承擔任何義務。

---

## 6. 鏈結及廣告

Airscend 對第三方網站沒有控制權，對其準確性或內容不承擔任何責任，包含此等鏈結並不默示 Airscend 認可第三方網站。閣下須自行承擔瀏覽任何連結網站的全部風險。

閣下不得在未經 Airscend 事先書面同意下連結至本服務的任何部分。

---

## 7. 免責聲明

閣下自行承擔使用本服務的全部風險。本服務上所有輸出內容及資料僅作資訊及參考之用，不構成任何專業建議。

本服務以**"現狀"及"現有"**方式提供，不附帶任何明示、默示或法定形式的保證或條件。

在任何適用法律允許的最大範圍內，Airscend 排除並卸棄所有與本服務有關的任何類型的聲明及保證，包括但不限於：

- 本服務將不中斷且無錯誤；
- 任何輸出內容的準確性、完整性或可靠性；
- 任何輸出內容不侵犯任何第三方知識產權；
- 本服務或相關伺服器沒有病毒或惡意軟件；
- 本服務在特定目的下的適用性。

**跨境服務聲明：** 本服務同時服務香港特別行政區及中国大陆用户。在香港境外接達本服務的用户，須自行承擔該等接達的所有風險，並負全責確保遵守其所在司法管轄區的所有法律，Airscend 對此不承擔任何責任。

---

## 8. 法律責任的限制

閣下同意不要求 Airscend 及其各自的母公司、附屬公司、關聯機構、職員、董事、僱員、代表、代理人、供應商及許可方（統稱 "**Airscend 方**"）對因本服務或任何輸入內容及輸出內容造成的任何申索、責任、損害、損失或開支（包括法律費用）負責。

在適用法律允許的最大範圍內，即使 Airscend 方已被告知可能發生該等損害，閣下同意不要求任何 Airscend 方對與使用或無法使用本服務而引起的任何直接、特別、懲罰性、間接、附帶或相應而生的損害承擔任何法律責任。

如某司法管轄區不允許完全排除法律責任，則 Airscend 方的法律責任在任何情況下均不超過**港幣500元（五百元港幣）**，或司法管轄區所允許的最大範圍（以較低者為準）。

閣下明確接受並確認上述金額為合理及充分的對價，尤其考慮到本服務系免費提供。

---

## 9. 彌償

對於直接或間接與（i）閣下的輸入內容、輸出內容或閣下對本服務的使用；及／或（ii）閣下違反或被指稱違反本協議有關連，且令任何 Airscend 方遭受任何索賠、訴訟、法律責任、損害、損失、開支及費用（包括法律費用），閣下同意按要求對所有 Airscend 方作全額彌償、捍衛他們及使其免受損害。

本彌償義務不受任何訴訟時效或 Airscend 方的任何疏忽的影響，除非該等疏忽構成重大疏忽（gross negligence）或蓄意不當行為（wilful misconduct），且該等例外情況需由閣下承擔舉證責任。

Airscend 保留自費對應由閣下彌償的事項承擔獨家抗辯及控制權，且閣下不得未經 Airscend 書面同意就任何事項作出和解。

---

## 10. 法律合規性

閣下應遵守與閣下使用本服務有關的所有適用法律及法規，包括但不限於：

- **香港：** 《個人資料（私隱）條例》（第486章）、《電子交易條例》（第553章）、《版權條例》（第528章）、《電腦罪行條例》（第200章）；
- **中国大陆：** 《網絡安全法》、《數據安全法》、《個人信息保護法》、《生成式人工智能服務管理暫行辦法》；
- **其他司法管轄區：** 任何其他與閣下使用本服務相關的法律。

遵守適用法律是閣下獨自的責任，Airscend 對閣下違反任何適用法律的行為不承擔任何責任。

---

## 11. 終止

Airscend 可在其唯一及絕對酌情權下出於任何原因隨時終止閣下對本服務的使用，立即生效，無需事先通知，包括但不限於：

- 閣下違反或 Airscend 有合理理由相信閣下違反本協議；
- Airscend 無法核實閣下提供的任何資料；
- 閣下的行為可能導致任何性質的法律責任；或
- Airscend 認為閣下的行為或使用不合適或不恰當。

終止使用後，閣下必須立即摧毀從本服務中獲得的所有材料及其任何副本。

終止不影響 Airscend 就終止前閣下的任何違規行為的任何既有權利及補救措施。

以下條款在本協議終止後繼續有效：第4條、第5條、第6條、第7條、第8條、第9條、第11條、第14條及第15條。

---

## 12. 對使用條款的修改

Airscend 保留隨時在其唯一及絕對酌情權下更新或更改本協議的權利。閣下有責任定期查看《使用條款》。

在任何更新發佈後，閣下繼續使用本服務，則表示閣下對修訂的《使用條款》作出了不可推翻的接受。如不接受任何修訂，閣下必須立即終止使用本服務。

Airscend 保留對本《使用條款》的最終解釋權及對本《使用條款》下任何爭議的決定權，該等解釋及決定對閣下具有約束力。

---

## 13. 通知

Airscend 將在本服務上發佈及提供必要的通知。一旦通知通過本服務或相關途徑發佈，閣下將被視為已收到通知。

---

## 14. 一般條款

本協議構成閣下與 Airscend 之間的完整協議，並取代所有先前的協議或溝通。

如本協議的任何條款被認定為非法或不可執行，該條款應被分割及刪除，其餘條款應繼續有效。

### ⚠️【重要：爭議解決——請特別注意】

在接達本服務的同時，閣下同意任何與本協議及本服務相關的爭議（"**爭議**"）均**受香港法律管轄**，並排除任何其他司法管轄區的法律。

閣下同意在發生任何爭議的情況下，爭議應在任何一方向另一方送達三十（30）天書面通知的請求下，提交並最終通過**仲裁在香港解決**，並由**香港國際仲裁中心（HKIAC）**根據屆時生效的仲裁規則進行管理。

仲裁地為香港，仲裁程序以英文進行，仲裁員人數為一（1）人，仲裁員的決定應為最終並對雙方具有約束力。

本條款並不阻止 Airscend 就任何威脅或實質違反本協議，向任何具有效管轄權的法院尋求禁制令或其他衡平法濟助。

本協議的英文版本與中文版本如有任何衝突，在香港特別行政區及普通法司法管轄區以英文版本為準；在中华人民共和国境內（香港除外）以中文版本為準。

---

## 15. 第三方權利

除 Airscend 方外，《合約（第三者權利）條例》（第623章）在任何情況下均不適用於本協議，且只有閣下及 Airscend 才有本協議下的任何權利。

---

## 16. 查詢

如閣下有任何有關本服務的查詢，請通過電郵 **service@airscend.com** 與我們聯繫。

---

## 在 Apple 品牌產品下載及使用本服務的使用者附錄（"附錄"）

以下條款補充本協議，適用於在 Apple Inc. 操作系統（如 iOS）設備上使用本服務的使用者。若本附錄與本協議存在不一致，以本附錄為準。

本服務由 Airscend Media Communications Limited（AMC Ltd）提供。閣下確認本協議僅在閣下與 Airscend 之間達成，而非與 Apple 達成。

Airscend（而非 Apple）對本服務及其內容負全部責任。

為本服務而授予的許可為不可轉讓的許可，在 Apple 媒體服務約定條款（"媒體條款"）所容許下使用。

閣下確認 Apple 不對任何與本服務相關的產品保證負責。Airscend 將承擔任何因未能遵守適用保證所產生的索賠的全部責任。

Apple 不負責處理由閣下或第三方就本服務提出的任何索賠，包括：(i) 產品責任索賠；(ii) 不符合法律或法規要求的索賠；及 (iii) 消費者保護法律索賠。

閣下確認 Apple 及 Apple 子公司為本協議的第三方受益人，有權以第三方受益人身份對閣下執行本協議。`
  },
  [SystemContentKeyEnum.termsOfUseEn]: {
    label: 'Terms of Use',
    defaultTitle: 'LuGangTong Terms of Use',
    defaultContent: `# LuGangTong (鲁港通) Terms of Use

**Last Updated: 01 April, 2026**

Please read the following terms and conditions carefully (the "**Terms of Use**" or "**Agreement**"), as they govern your use of the LuGangTong (鲁港通) artificial intelligence assistant service.

The LuGangTong (鲁港通) service is provided and operated by **Airscend Media Communications Limited** ("**AMC Ltd**"), a company incorporated in Hong Kong (Business Registration Number: 66594657, registered address: 6F Crason Commercial Centre, 333 Nathan Road, Tsimshatsui, Kowloon, Hong Kong), as the primary service entity, together with **Shenzhen Airscend Nucleus Technology Culture Co., Ltd.** (深圳市硕谷光核科技文化有限公司), a company duly incorporated under the laws of the People's Republic of China, acting as the technical support and Mainland data compliance entity (collectively referred to as "**Airscend**", "**we**", "**us**" or "**our**"). This Agreement is entered into between you and Airscend.

---

## ⚠️ IMPORTANT NOTICE — PLEASE READ CAREFULLY

**Clause 14 of this Agreement contains an arbitration clause and governing law clause** that materially affect how disputes between you and Airscend are resolved. Please read and confirm your understanding of these clauses before using the Service. Your continued use of the Service constitutes your acceptance of these clauses.

---

LuGangTong (鲁港通) is a generative artificial intelligence chatbot and information assistant service (the "**Service**") available via websites, mobile applications and/or software applications, designed to provide users with information on Hong Kong and Shandong Province relating to daily life, education, finance, investment, business and policy.

By downloading, accessing and/or using the Service, you confirm that you have read, understood and agree to be bound by this Agreement. If you do not agree, please do not use the Service and uninstall any related mobile or software applications.

Airscend reserves the right to update or change this Agreement from time to time in a manner binding upon you, and you should review these terms periodically for any updates.

**Minors:** If you are under the age of 18, a legal guardian (e.g. a parent) must accept this Agreement as guarantor on your behalf. The guarantor agrees to guarantee the minor's compliance with this Agreement, and Airscend may enforce this Agreement against the guarantor upon the minor's breach.

---

## 1. Registration

You may be required to provide personal data to register a user account and/or access and use the Service, including but not limited to:

- **Identity and Contact Information:** User ID assigned by Airscend; telephone number; email address;
- **Input Content:** Instructions, text, audio, chat history, feedback and other content submitted or uploaded to the Service;
- **Communications Information:** Personal data disclosed in communications with Airscend (e.g. name and address), feedback, enquiries and complaints;
- **Log Files:** IP address; browser type and version; time zone setting; operating system and platform;
- **Usage and Location Data:** Full URL clickstream, date, time and location of access and use, page response times, crash reports, performance logs, visit duration, page interaction data, language preferences;
- **Device Data:** Hardware model, operating system, unique identifiers, serial number, IP address (from which Airscend may derive your geographic location), browser type and mobile device identifier;
- **Other Data:** Other data relevant to or required for the provision of the Service.

You undertake to:

- Provide accurate, complete, lawful and up-to-date personal data and registration information as required by Airscend;
- Keep your login credentials secure and confidential. Airscend shall bear no responsibility or liability for any unauthorised use of your account by any other person;
- Be responsible for all activities conducted through your account, and not transfer, lend or otherwise make your account available to any other person;
- Promptly update any information provided to Airscend to ensure it remains current, complete, accurate and lawful.

Airscend is entitled to assume that any person using the Service with your account credentials is you. Your personal data will be processed in accordance with the LuGangTong Privacy Policy and Personal Data Collection Statement, and in compliance with the Personal Data (Privacy) Ordinance (Cap. 486) of Hong Kong and the Personal Information Protection Law of the People's Republic of China.

---

## 2. Use of the Service

You acknowledge that Airscend may, in its sole discretion and without notice to you, add, remove, modify, suspend, terminate or restrict any or all parts of the Service, and that Airscend shall bear no liability to you or any third party in such circumstances.

You agree to use the Service solely for personal and non-commercial purposes and to bear full and sole responsibility for all Input Content and Output Content you submit, input and/or transmit through the Service. All intellectual property rights in the Service and any part thereof are the exclusive property of Airscend.

You expressly agree not to:

- Use the Service for military, illegal, unauthorised or any purpose prohibited by applicable law (whether criminal or civil);
- Transmit, upload, create or promote any content that may constitute harassment, bullying, abuse, defamation, discrimination, threats, intimidation, indecency, obscenity, violence or vulgarity;
- Disseminate any information in violation of Hong Kong law (including the Sedition Ordinance), Mainland Chinese law (including the Cybersecurity Law), or other applicable laws, including information that endangers national security, social order or public interest;
- Intrude upon, access or use any unauthorised part of Airscend's servers, or attempt to circumvent any security measures;
- Interfere with or disrupt the normal operation of the Service or any connected network;
- Transmit any content containing viruses, trojan horses, worms or other malicious code;
- Attempt to reverse engineer, decompile or disassemble any part of the Service or access any source code, algorithms or underlying components;
- Use any automated system (e.g. bots or web crawlers) to access the Service;
- Dishonestly or fraudulently register multiple user accounts;
- Without Airscend's prior written consent, reproduce, screenshot, transmit or distribute any element of the Service;
- Transmit any content protected by intellectual property laws, trade secrets, privacy rights or other applicable laws without owning such rights or obtaining all necessary consents;
- Systematically download and store any content from the Service to create any database;
- Use the Service to transmit any information in violation of the cross-border data transfer provisions of the PRC Data Security Law or Personal Information Protection Law;
- Use any Output Content for direct commercial resale, sub-licensing, or as the basis of a commercial service provided to third parties, without Airscend's prior written consent.

Airscend reserves the right (but is under no obligation) to monitor your use of the Service without notice and to terminate your use at any time for any reason.

---

## 3. Input Content and Output Content

You bear full and sole responsibility for all Input Content you provide to the Service and any Output Content generated thereby, and shall ensure all such content complies with this Agreement and all applicable laws.

As between you and Airscend: (a) you retain all rights you may hold in your Input Content; and (b) Airscend does not claim ownership of Output Content and hereby assigns to you any rights, title and interest Airscend may hold in the Output Content. However, you acknowledge that Output Content is generated by artificial intelligence and may not be unique, and may be identical or similar to content received by other users. Airscend bears no responsibility therefor.

You grant Airscend a worldwide, non-exclusive, royalty-free, transferable and perpetual right and licence to use, analyse and transmit your Input Content and Output Content for the purposes of providing, maintaining, developing and improving the Service, complying with applicable laws and enforcing this Agreement, without any obligation to mention you, make payment to you or incur any liability to you.

For the avoidance of doubt, your identifiable personal data shall not be used to train Airscend's artificial intelligence models.

You acknowledge that:

- Output Content may contain factual inaccuracies, omissions, errors or may be incomplete, outdated or misleading, and Airscend bears no legal liability therefor;
- Output Content does not represent the views of Airscend;
- Output Content does not constitute legal, financial, investment, tax, medical or any other professional advice;
- You bear full and sole responsibility for evaluating the accuracy, applicability and legality of any Output Content;
- You must not rely solely on any Output Content as the basis for any decision that may have legal or material financial consequences for yourself or any third party.

**Transparency Statement:** Before publishing or sharing Output Content, you are encouraged to add the following notice: "This content was generated by LuGangTong (鲁港通) artificial intelligence and is for reference only. It does not constitute professional advice."

---

## 4. Intellectual Property

All materials and works used and provided as part of the Service (including but not limited to text, images, layout, user interface, graphics, logos, icons, branding, data compilations, source code, object code and other proprietary materials, collectively the "**Content**") are owned by Airscend or licensed to Airscend for limited use. The Content is protected by copyright, trademark, patent, design and trade secret laws.

Without Airscend's prior written consent, you shall not reproduce, download, modify, publish, transmit, display, commercially exploit or create derivative works of any Content.

You agree that Airscend may freely use, disclose, adopt and modify any ideas, concepts, know-how, proposals, suggestions, comments and other communications and information ("**Feedback**") you provide to Airscend in connection with the Service, without any obligation to mention you, make payment to you or incur any liability to you. You hereby waive all rights and claims in connection with Airscend's use, disclosure, adoption and/or modification of any or all of your Feedback.

---

## 5. Monitoring

Airscend does not actively monitor Input Content or Output Content submitted to the Service and does not guarantee the accuracy, completeness, legality or quality of such content.

**Complaints Procedure:** Any complaints may be sent by email to service@airscend.com or in writing to AMC Ltd's registered address.

Infringement complaints must be submitted in writing and include at minimum:

- Sufficient identification of the allegedly infringed work and its owner;
- Sufficient identification of the allegedly infringing activity or material and its location;
- A description of how the material or activity infringes the rights owner's rights;
- The complainant's contact details;
- A statement confirming: (i) the information in the complaint is true and accurate to the best of the complainant's knowledge and belief; (ii) the complainant is the rights owner or authorised to act on their behalf; and (iii) the complainant understands the legal consequences of making false statements.

Airscend reserves the right to disable, remove or take down any infringing material, but is under no obligation to take any specific action in this regard.

---

## 6. Links and Advertising

Airscend has no control over third-party websites linked from the Service, and bears no responsibility for their accuracy or content. The inclusion of such links does not imply Airscend's endorsement of those websites. You access any linked websites entirely at your own risk.

You may not link to any part of the Service without Airscend's prior written consent.

---

## 7. Disclaimers

You use the Service and any part thereof entirely at your own risk. All Output Content and other materials provided through the Service are for information and reference purposes only and do not constitute professional advice of any kind.

The Service is provided on an **"as is" and "as available"** basis without any warranties or conditions of any kind, whether express, implied, statutory or otherwise.

To the maximum extent permitted by applicable law, Airscend disclaims all representations and warranties in connection with the Service and Output Content, including but not limited to:

- That the Service will be uninterrupted or error-free;
- The accuracy, timeliness, applicability, completeness or reliability of any Output Content or information;
- That any Output Content does not infringe any third-party intellectual property rights;
- That the Service or related servers are free from viruses or other malicious software;
- The fitness of the Service for any particular purpose.

**Cross-Border Service Notice:** The Service serves users in both Hong Kong SAR and Mainland China. Users accessing the Service from outside Hong Kong SAR (including Mainland China) do so entirely at their own risk and are solely responsible for ensuring compliance with all laws of their respective jurisdiction. Airscend bears no liability in this regard.

---

## 8. Limitation of Liability

You agree not to hold Airscend, its respective parent companies, subsidiaries, affiliates, officers, directors, employees, representatives, agents, suppliers and/or licensors (collectively "**Airscend Parties**") liable for any claims, liabilities, damages, losses or expenses (including legal costs) arising from the Service or any Input Content and Output Content.

To the maximum extent permitted by applicable law, even where an Airscend Party has been advised of the possibility of such damages, you agree not to hold any Airscend Party liable for any direct, special, punitive, indirect, incidental or consequential damages arising from or in connection with your access to, reliance on, use of or inability to use the Service, Content, Input Content and/or Output Content.

Where any jurisdiction does not permit complete exclusion of liability, the total aggregate liability of the Airscend Parties shall not exceed **HKD 500 (Five Hundred Hong Kong Dollars)** per claim or the maximum amount permitted by the applicable jurisdiction, whichever is lower.

You expressly accept and confirm that this amount is reasonable and adequate consideration, particularly given that the Service is provided free of charge.

---

## 9. Indemnification

You agree to fully indemnify, defend and hold harmless all Airscend Parties from and against any and all claims, actions, demands, liabilities, damages, losses, expenses and costs (including all legal fees) directly or indirectly arising from or relating to: (i) your Input Content, Output Content or your use of the Service (including Content and/or any part thereof); and/or (ii) your breach or alleged breach of this Agreement.

This indemnification obligation shall not be affected by any limitation period or any negligence of any Airscend Party, except where such negligence constitutes gross negligence or wilful misconduct, and the burden of proving such exception shall rest solely with you.

Airscend reserves the right to assume exclusive defence and control of any matter subject to indemnification by you at its own expense, and you shall not settle any matter without Airscend's prior written consent. You shall cooperate fully in the defence of any claim as reasonably required.

---

## 10. Legal Compliance

You shall comply with all applicable laws, regulations, ordinances, rules and policies relating to your use of the Service, including but not limited to:

- **Hong Kong:** Personal Data (Privacy) Ordinance (Cap. 486); Electronic Transactions Ordinance (Cap. 553); Copyright Ordinance (Cap. 528); Computer Crimes Ordinance (Cap. 200); Hong Kong Generative AI Ethical Framework and Guidelines;
- **Mainland China:** Cybersecurity Law; Data Security Law; Personal Information Protection Law; Interim Measures for the Management of Generative Artificial Intelligence Services;
- **Other Jurisdictions:** Any other applicable laws relevant to your use of the Service.

Compliance with all applicable laws is your sole and exclusive responsibility, and Airscend bears no liability for your breach of any applicable law.

---

## 11. Termination

Airscend may at any time, in its sole and absolute discretion, terminate your access to and use of the Service with immediate effect and without prior notice, including but not limited to:

- If you breach or Airscend has reasonable grounds to believe you have breached this Agreement;
- If Airscend is unable to verify any information you have provided;
- If your conduct may expose Airscend to any form of liability; or
- If Airscend considers your conduct or use inappropriate or improper.

Upon termination, you must immediately destroy all materials obtained from the Service and all copies thereof. Termination shall not affect any of Airscend's accrued rights or remedies in respect of any prior breach by you.

The following clauses shall survive termination of this Agreement: Clauses 4, 5, 6, 7, 8, 9, 11, 14 and 15.

---

## 12. Amendments to Terms of Use

Airscend reserves the right to update or amend this Agreement at any time in its sole and absolute discretion. It is your responsibility to review this Agreement periodically.

Your continued use of the Service following any such update constitutes your irrevocable acceptance of the amended Terms of Use. If you do not accept any amendment, you must immediately cease using the Service.

Airscend reserves the final right of interpretation of this Agreement and the right to make final decisions on any disputes arising hereunder, which shall be binding upon you.

---

## 13. Notices

Airscend will publish and provide any necessary notices through the Service. Once a notice has been published or provided through the Service, you shall be deemed to have received such notice.

---

## 14. General Terms

This Agreement constitutes the entire agreement between you and Airscend and supersedes all prior agreements or communications.

If any provision of this Agreement is found to be illegal, invalid or unenforceable, such provision shall be severed and deleted, and the remaining provisions shall continue in full force and effect.

### ⚠️ IMPORTANT — DISPUTE RESOLUTION (PLEASE READ CAREFULLY)

By accessing the Service, you agree that any disputes, controversies or claims arising out of or relating to this Agreement and/or the Service (a "**Dispute**") shall be **governed exclusively by the laws of Hong Kong Special Administrative Region**, to the exclusion of any other jurisdiction's laws.

You agree that any Dispute shall, upon written notice by either party to the other with a request for arbitration, be submitted to and finally resolved by **binding arbitration in Hong Kong**, administered by the **Hong Kong International Arbitration Centre (HKIAC)** in accordance with the HKIAC Administered Arbitration Rules in force at the time of submission.

The seat of arbitration shall be Hong Kong. The language of arbitration shall be English. The number of arbitrators shall be one (1). The decision of the arbitrator shall be final and binding on both parties.

This clause shall not prevent Airscend from seeking injunctive relief (including interim/interlocutory injunctions), specific performance or other equitable relief from any court of competent jurisdiction in respect of any threatened or actual breach of this Agreement or any intellectual property dispute.

In the event of any conflict between the English and Chinese versions of this Agreement: the English version shall prevail in Hong Kong SAR and common law jurisdictions; the Chinese version shall prevail within Mainland China (excluding Hong Kong SAR).

---

## 15. Third Party Rights

Except as expressly provided herein with respect to Airscend Parties, the Contracts (Rights of Third Parties) Ordinance (Cap. 623) shall not apply to this Agreement. Only you and Airscend have rights under this Agreement. Any rights granted to third parties under this Agreement do not include the right of assignment, and no third party consent (other than as required from Airscend) is necessary to rescind or amend this Agreement.

---

## 16. Enquiries

For any enquiries regarding the Service, please contact us by email at **service@airscend.com** or in writing to: 6F Crason Commercial Centre, 333 Nathan Road, Tsimshatsui, Kowloon, Hong Kong.

---

## Addendum for Users Downloading and Using the Service on Apple-Branded Products ("Addendum")

The following terms supplement and form part of this Agreement and apply to users who download, access and/or use the mobile application version of the Service on smart devices running an operating system provided by Apple Inc. ("**Apple**") (e.g. iOS). In the event of any inconsistency between this Addendum and this Agreement, this Addendum shall prevail.

The Service is provided by Airscend Media Communications Limited (AMC Ltd), 6F Crason Commercial Centre, 333 Nathan Road, Tsimshatsui, Kowloon, Hong Kong. Enquiries, complaints or claims regarding the Service may be directed to service@airscend.com.

You acknowledge and agree that this Agreement is entered into solely between you and Airscend, and not with Apple. Airscend (and not Apple) is solely responsible for the Service downloaded from Apple and its content.

The licence granted to you for the Service downloaded from Apple is a non-transferable licence to use the Service on any Apple-branded products that you own or control, subject to the Usage Rules set out in the Apple Media Services Terms and Conditions ("**Media Terms**"), except that the Service downloaded from Apple may be accessed, acquired and used by other accounts associated with your account via Family Sharing, Volume Purchase or Legacy Contacts features (as defined in the Media Terms).

You acknowledge and agree that Apple has no responsibility for any product warranties (whether express or implied by law) relating to the Service. If the Service downloaded from Apple fails to conform to any applicable warranty under this Agreement, you may notify Apple and Apple will refund the purchase price (if any) of the Service. To the maximum extent permitted by applicable law, Apple will have no other warranty obligation with respect to the Service.

Apple is not responsible for addressing any claims by you or any third party relating to the Service downloaded from Apple, including but not limited to: (i) product liability claims; (ii) claims that the Service fails to conform to any applicable legal or regulatory requirement; and (iii) claims arising under consumer protection or similar laws.

You acknowledge and agree that Apple and Apple's subsidiaries are third-party beneficiaries of this Agreement, and that Apple has the right (and shall be deemed to have accepted the right) to enforce this Agreement against you as a third-party beneficiary. However, any such rights granted to Apple do not include the right of assignment, and no Apple consent is required to rescind or amend this Agreement.`
  },
  [SystemContentKeyEnum.privacyPolicy]: {
    label: '隱私政策',
    defaultTitle: '隱私政策',
    defaultContent: '# 隱私政策\n\n隱私政策內容待管理員配置。'
  },
  [SystemContentKeyEnum.privacyPolicyZhCN]: {
    label: '隐私政策',
    defaultTitle: '隐私政策',
    defaultContent: '# 隐私政策\n\n隐私政策内容待管理员配置。'
  },
  [SystemContentKeyEnum.privacyPolicyEn]: {
    label: 'Privacy Policy',
    defaultTitle: 'Privacy Policy',
    defaultContent: '# Privacy Policy\n\nEnglish content to be configured by administrator.'
  },
  [SystemContentKeyEnum.dataCollection]: {
    label: '個人資料收集聲明',
    defaultTitle: '個人資料收集聲明',
    defaultContent: '# 個人資料收集聲明\n\n個人資料收集聲明內容待管理員配置。'
  },
  [SystemContentKeyEnum.dataCollectionZhCN]: {
    label: '个人资料收集声明',
    defaultTitle: '个人资料收集声明',
    defaultContent: '# 个人资料收集声明\n\n个人资料收集声明内容待管理员配置。'
  },
  [SystemContentKeyEnum.dataCollectionEn]: {
    label: 'Personal Data Collection Statement',
    defaultTitle: 'Personal Data Collection Statement',
    defaultContent: '# Personal Data Collection Statement\n\nEnglish content to be configured by administrator.'
  }
};
