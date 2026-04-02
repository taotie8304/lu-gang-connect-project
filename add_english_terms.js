/**
 * 鲁港通 - 添加英文版使用条款到数据库
 * 
 * 使用方法：node add_english_terms.js
 */

const { MongoClient } = require('mongodb');

// ========================================
// 📝 英文版使用条款内容
// ========================================
const ENGLISH_TERMS_CONTENT = `# LuGangTong (鲁港通) Terms of Use

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

You acknowledge and agree that Apple and Apple's subsidiaries are third-party beneficiaries of this Agreement, and that Apple has the right (and shall be deemed to have accepted the right) to enforce this Agreement against you as a third-party beneficiary. However, any such rights granted to Apple do not include the right of assignment, and no Apple consent is required to rescind or amend this Agreement.
`;

// ========================================
// 数据库配置
// ========================================
const MONGODB_URI = 'mongodb://root:huijin8304@172.17.0.1:27017';
const DATABASE_NAME = 'lugang_ai';

async function addEnglishTerms() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到 MongoDB');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection('system_contents');

    // 检查英文版是否已存在
    const existing = await collection.findOne({ key: 'terms_of_use_en' });
    
    if (existing) {
      console.log('⚠️  英文版使用条款已存在，将更新内容...');
      
      const result = await collection.updateOne(
        { key: 'terms_of_use_en' },
        {
          $set: {
            content: ENGLISH_TERMS_CONTENT,
            title: 'LuGangTong Terms of Use',
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`✅ 已更新英文版使用条款 (匹配: ${result.matchedCount}, 修改: ${result.modifiedCount})`);
    } else {
      console.log('📝 英文版使用条款不存在，将创建新记录...');
      
      const result = await collection.insertOne({
        key: 'terms_of_use_en',
        title: 'LuGangTong Terms of Use',
        content: ENGLISH_TERMS_CONTENT,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ 已创建英文版使用条款 (ID: ${result.insertedId})`);
    }

    // 验证内容长度
    const doc = await collection.findOne({ key: 'terms_of_use_en' });
    console.log(`\n📊 内容统计：`);
    console.log(`   - 字符数：${doc.content.length}`);
    console.log(`   - 标题：${doc.title}`);
    console.log(`   - 更新时间：${doc.updatedAt}`);

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ 数据库连接已关闭');
  }
}

addEnglishTerms();
