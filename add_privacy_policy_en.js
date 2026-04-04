/**
 * 鲁港通 - 添加隐私政策（英文版本）
 * 
 * 使用方法：node add_privacy_policy_en.js
 */

const { MongoClient } = require('mongodb');

// 数据库配置
const MONGODB_URI = 'mongodb://root:password@localhost:27017/lugang_ai?authSource=admin';
const DATABASE_NAME = 'lugang_ai';

// 隐私政策 - 英文（完整内容）
const PRIVACY_POLICY_EN = `LuGangTong (鲁港通) Privacy Policy

Last Updated: [16 October 2025]

This Privacy Policy applies to all users of the LuGangTong (鲁港通) artificial intelligence assistant service provided and operated by Airscend Media Communications Limited ("AMC Ltd"), a company incorporated in Hong Kong (Business Registration Number: 66594657, registered address: 6F Crason Commercial Centre, 333 Nathan Road, Tsimshatsui, Kowloon, Hong Kong), together with Shenzhen Airscend Nucleus Technology Culture Co., Ltd. (深圳市硕谷光核科技文化有限公司), a company incorporated under the laws of the People's Republic of China (collectively "Airscend", "we", "us" or "our").

Your access to and use of the Service is also governed by the LuGangTong Terms of Use and Personal Data Collection Statement.

Your privacy is extremely important to us. This Privacy Policy sets out why Airscend collects your personal and non-personal data, and governs how we collect, use, transfer, store and/or process your personal data shared with us through the Service or from any third-party sources (where applicable). This Privacy Policy will also help you make an informed decision before providing your personal data and/or related consent to Airscend.

All personal data provided to us is governed and protected by:
Hong Kong: Personal Data (Privacy) Ordinance (Cap. 486) ("PDPO")
Mainland China: Personal Information Protection Law ("PIPL"), Cybersecurity Law and Data Security Law

This Privacy Policy should be read together with the Terms of Use and Personal Data Collection Statement. In the event of any inconsistency between this Privacy Policy and the Terms of Use on matters relating to personal data, this Privacy Policy shall prevail. In the event of any inconsistency between this Privacy Policy and the Personal Data Collection Statement, the Personal Data Collection Statement shall prevail.

1. Protecting Your Privacy

We are committed to complying with the PDPO and the PRC PIPL in relation to the management of personal data, and to safeguarding the privacy, confidentiality and security of the personal data we hold. We are equally committed to ensuring that all our employees and agents uphold these responsibilities.

Before using (including disclosing and transferring) your personal data for the purposes described in this Privacy Policy, we may be required by law to notify you and/or obtain your written consent for certain uses. Where written consent is required, we may only use your personal data in the specified manner after obtaining such consent.

This Privacy Policy applies to all personal data collected by Airscend through:
Any and all parts of the Service and your use and/or access thereof; and
All services provided to users by Airscend in connection with any information derived from or obtained through the Service.

We will not use your personal data for any new purpose beyond the scope of this Privacy Policy without your prior consent.

2. Who Is Responsible for My Personal Data?

AMC Ltd is the primary data user in respect of personal data collected about you through your use of the Service. Shenzhen Airscend Nucleus Technology Culture Co., Ltd. acts as the data compliance entity within Mainland China. Together, they control how your personal data is collected and determine how and why such data is used and/or processed.

3. How We Collect Personal Data and Other Information from You

3.1 Information You Provide Directly

We may collect personal data and information from you when you:
Use and/or access the Service;
Submit data through the Service, including but not limited to creating an account or providing Input Content (such as instructions, as defined in the Terms of Use); and/or
Communicate with Airscend.

3.2 Information We Collect from Other Sources

We may also collect information through:
Cookies, event tracking and/or similar technologies, to automatically collect information about your browsing activities and use of the Service; and
Trusted partners, including but not limited to security partners, to guard against fraud, abuse and other security threats.

4. Personal Data and Other Information We Collect

The types of personal data we collect may include:
Identity and Contact Information: User ID assigned by Airscend; telephone number; email address;
Input Content: Instructions, text, audio, chat history, feedback and other content submitted to the Service;
Communications Information: Personal data disclosed in communications with Airscend (e.g. name and address), feedback, enquiries and complaints;
Log Files: IP address; browser type and version; time zone settings; operating system and platform;
Usage and Location Data: Full URL clickstream, date, time and location of access and use, page response times, crash reports, performance logs, visit duration, page interaction data and language preferences;
Device Data: Hardware model, operating system, unique identifiers, serial number, IP address (from which geographic location may be derived) and mobile device identifier; and
Other Data: Other data relevant to the provision of the Service.

Where you provide personal data relating to a third party, you confirm that you have provided such third party with a copy of this Privacy Policy, that they have read and agreed to its terms, and that you have obtained their effective consent to provide their personal data to us for the purposes set out herein.

Certain personal data is mandatory for the provision of the Service and will be marked as "required" on relevant data collection forms. Failure to provide required personal data may prevent you from accessing or using part or all of the Service.

5. Purposes for Which We Collect and Use Your Personal Data

We use your personal data for the following purposes:
To verify your identity;
To provide you with access to the Service;
To provide the Service, including enabling you to create an account, input information, interact with the AI assistant and view chat history;
To communicate with you in relation to the Service and manage our relationship with you, including notifying you of changes to this Privacy Policy, the Terms of Use and the Service;
To provide and improve user experience, including responding to enquiries and complaints;
To perform analysis to generate statistical or actuarial reports;
To better understand the demographics of users of the Service;
To perform accounting, auditing and other internal functions, including legal and administrative purposes;
To maintain and manage the Service, including troubleshooting, testing, system maintenance and upgrades;
To conduct internal research or analysis to improve and optimise the Service;
To comply with legal obligations and to detect, prevent and investigate any actual or suspected unlawful activity or misuse of the Service;
To protect the rights and property of Airscend and any transferees; and
Other purposes ancillary or related to the above purposes.

For the avoidance of doubt, your personal data will not be used to train Airscend's artificial intelligence and/or large language models.

We will not use your personal data for any new purpose without your prior explicit consent.

6. To Whom May We Transfer, Disclose or Share Your Personal Data?

Your personal data may be shared or transferred to the following third parties ("Transferees") in accordance with the purposes set out in Section 5:

Technology Service Providers: Technical partners necessary for the provision of the Service, including RAG knowledge base, workflow deployment and model channel management;

Third-Party Search Service Providers: Where you use the search function of the Service, we may share relevant data with our third-party search service providers, who may process your data within or outside Hong Kong. Where reasonably practicable, we will de-identify and/or anonymise your personal data prior to such sharing;

Recipients Required by Law or Business Transfer:
We are obliged to disclose or transfer your personal data to comply with any applicable laws, regulations, rules, orders and legal obligations of any legal, regulatory, governmental, tax, law enforcement or other authority;
We will not disclose your personal data to any third party except where your personal data relates to matters involving threats to the safety of Hong Kong society, national security or other matters regulated by applicable public order or security laws and regulations. In such circumstances, we will disclose relevant data to the relevant government authorities as required by the government and judicial authorities on a case-by-case basis;
In the event of any asset or business transfer, acquisition, merger, reorganisation or liquidation, we may disclose your personal data to the relevant counterparty (including for due diligence purposes); and

Airscend's Professional Advisers: Including but not limited to lawyers, accountants and auditors.

Subject to the Terms of Use, you may share your chat conversations, Input Content or Output Content with any third party. We encourage you to review the relevant third party's terms and conditions and privacy policy before doing so.

7. Cross-Border Transfers of Personal Data

For the purposes set out in this Privacy Policy, personal data we hold about you may in limited circumstances be transferred outside Hong Kong to third-party service providers. In any cross-border transfer, we will implement appropriate contractual and technical safeguards to ensure that your personal data receives a level of protection consistent with the requirements of the PDPO and the PRC PIPL.

8. Data of Minors

If you are under the age of 18, you should not use the Service or provide any personal data to Airscend without the prior consent of your parent or legal guardian. If you are a parent or legal guardian, you may contact us at any time to withdraw your consent.

9. Where We Store and Process Your Personal Data

Data collected from you is primarily stored on servers located within Hong Kong SAR. For technical operational reasons, certain data may be stored on servers located in Mainland China, subject to applicable PRC data protection laws.

10. Security

We endeavour to implement and maintain administrative, technical and physical security measures designed to protect your personal data from accidental or unauthorised destruction, deletion, loss, alteration, access, disclosure, processing or use. However, you acknowledge that transmission of information over the internet is not completely secure, and Airscend bears no liability for any unauthorised access that could not reasonably have been prevented.

We do not authorise any third-party service processors acting on our behalf to use your personal data for any purpose beyond what is necessary to perform their services for us or as permitted under this Privacy Policy.

11. Third-Party Websites

The Service may provide links to third-party websites (including as part of Output Content). Such links are provided for general reference and convenience only. Airscend has no control over third-party websites and bears no responsibility or liability for any data they may collect about you through their websites or applications.

12. Data Retention and Destruction

The period for which we retain your data will depend on the type of personal data and the purpose for which it is used, as well as applicable legal and contractual requirements. We may anonymise your data, following which we may continue to use the anonymised data for any purpose and may transfer it to any third party.

13. Your Right of Access and Correction

You have the following rights in relation to your personal data:
To check whether Airscend holds any personal data about you;
To access the personal data we hold about you;
To request correction of any inaccurate personal data; and
To ascertain Airscend's policies and practices regarding personal data and the types of personal data held.

It is important that personal data we hold about you is accurate and up to date. If your personal data changes during your use of the Service, please notify us.

To make a request for access or correction (or any general enquiry or complaint), please submit your request in writing (marked "Confidential") by post or email to our Data Protection Officer:

Post: 6F Crason Commercial Centre, 333 Nathan Road, Tsimshatsui, Kowloon, Hong Kong
Email: service@airscend.com

Please include your name, contact number and/or email address so that we may follow up on your request. We may refuse to comply with a request if we are not provided with reasonably necessary information to locate the relevant personal data or identify any inaccuracy. In accordance with the PDPO, we reserve the right to charge a reasonable fee for processing any data access request.

14. Changes to This Privacy Policy

We reserve the right to amend the terms of this Privacy Policy in our absolute discretion. We will notify you of any amendments by publishing the revised policy and updated version date on the Service's mobile application and/or website. Your continued access to and use of the Service following the latest updated version date shall be deemed acceptance of the updated Privacy Policy. If you do not agree, please immediately cease accessing and using the Service.

In the event of any conflict between the Chinese version (Traditional or Simplified) and the English version of this Privacy Policy, the English version shall prevail in Hong Kong SAR and the Chinese version shall prevail within Mainland China (excluding Hong Kong SAR).`;

async function addPrivacyPolicyEn() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到 MongoDB');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection('system_contents');

    console.log('\n📝 处理: LuGangTong Privacy Policy (privacy_policy_en)');
    console.log(`   内容长度: ${PRIVACY_POLICY_EN.length} 字符`);
    
    const existing = await collection.findOne({ key: 'privacy_policy_en' });
    
    if (existing) {
      console.log('   ⚠️  已存在，将更新内容...');
      
      const result = await collection.updateOne(
        { key: 'privacy_policy_en' },
        {
          $set: {
            content: PRIVACY_POLICY_EN,
            title: 'LuGangTong Privacy Policy',
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`   ✅ 已更新 (匹配: ${result.matchedCount}, 修改: ${result.modifiedCount})`);
    } else {
      console.log('   📝 不存在，将创建新记录...');
      
      const result = await collection.insertOne({
        key: 'privacy_policy_en',
        title: 'LuGangTong Privacy Policy',
        content: PRIVACY_POLICY_EN,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`   ✅ 已创建 (ID: ${result.insertedId})`);
    }

    // 验证内容长度
    const doc = await collection.findOne({ key: 'privacy_policy_en' });
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

addPrivacyPolicyEn();
