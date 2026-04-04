/**
 * 鲁港通 - 添加个人资料收集声明（英文版本）
 * 
 * 使用方法：node add_data_collection_en.js
 */

const { MongoClient } = require('mongodb');

// 数据库配置
const MONGODB_URI = 'mongodb://root:password@localhost:27017/lugang_ai?authSource=admin';
const DATABASE_NAME = 'lugang_ai';

// 个人资料收集声明 - 英文（完整内容）
const DATA_COLLECTION_EN = `LuGangTong (鲁港通) Personal Data Collection Statement

This Personal Data Collection Statement ("Statement") applies to all users of the LuGangTong (鲁港通) artificial intelligence assistant service ("Service") provided and operated by Airscend Media Communications Limited ("AMC Ltd") (Business Registration Number: 66594657, registered address: 6F Crason Commercial Centre, 333 Nathan Road, Jordan, Kowloon, Hong Kong) and Shenzhen Airscend Nucleus Technology Culture Co., Ltd. (深圳市硕谷光核科技文化有限公司) (collectively "Airscend", "we", "us" or "our").

This Statement should be read together with the LuGangTong Terms of Use and Privacy Policy.

In the event of any inconsistency between this Statement and the Terms of Use or Privacy Policy on matters relating to personal data, this Statement shall prevail.

LuGangTong (鲁港通) is a generative artificial intelligence chatbot and information assistant service designed to provide users with information on Hong Kong and Shandong Province relating to daily life, education, finance, investment, business and policy. The Service is available via websites, mobile applications and/or software applications.

By creating and/or logging into an account, accessing and/or using the Service, and submitting your personal data to Airscend, you consent to the collection, holding, processing, operation and use (including disclosure and/or transfer) of your personal data in accordance with this Statement.

You acknowledge that if you do not consent to the collection, holding, processing, operation and use (including transfer and/or disclosure) of your personal data for the Permitted Purposes (as defined in Section 2 below), you should not register any account for the Service and should not access and/or use the Service. If you have already registered an account, you should immediately cease using the Service and deregister your account.

1. Collection of Personal Data

1.1 We may collect personal data and information from you from time to time when you: (i) use and/or access the Service; (ii) submit data through the Service, including but not limited to creating an account with Airscend or providing Input Content (such as instructions, as defined in the Terms of Use) to or through the Service; and/or (iii) communicate with Airscend.

1.2 We may also collect personal data and information through other means, including but not limited to: (i) cookies, event tracking and/or similar technologies to automatically collect information about your browsing activities and use of the Service and/or devices used to access the Service; and (ii) trusted partners, including but not limited to security partners, to guard against fraud, abuse and other security threats to the Service.

1.3 The types of personal data we collect about you may include, but are not limited to:
(a) Identity and Contact Information: User ID assigned by Airscend; telephone number; email address;
(b) Input Content: Instructions, text, audio, chat history, feedback and any other content you submit, transmit, input and/or upload to the Service;
(c) Communications Information: Personal data disclosed in communications with Airscend (e.g. your name and address), feedback, enquiries and/or complaints;
(d) Log Files: IP address used to connect your computer to the internet; browser type and version; time zone setting; browser plug-in types and versions; operating system and platform;
(e) Usage and Location Data: Full URL clickstream entering, through and exiting the Service; date, time and location of access and use; page response times; errors; crash reports; performance logs; visit duration; page interaction data including content types viewed or interacted with; features used and actions taken (e.g. scrolling and clicking); and language preferences;
(f) Device Data: Hardware model and operating system; version; unique identifiers; serial number; configuration settings and software and mobile configuration; IP address (from which geographic location may be derived); browser type; and mobile device identifier; and
(g) Other Data: Other data provided in connection with or for the purpose of providing the Service.

1.4 Certain personal data is mandatory for the provision of the Service and will be marked as "required" on relevant data collection forms. Failure to provide accurate/complete required personal data may prevent you from accessing or using part or all of the Service.

1.5 Personal data requested on a voluntary basis will not be marked as "required", and you may decide at your sole discretion whether to provide such information.

1.6 Unless otherwise stated, personal data you provide to Airscend through or for the Service will only be used for the Permitted Purposes (as described in Section 2 below).

2. Purposes of Data Collection

2.1 Your personal data may be used by Airscend and/or Transferees (as defined in Section 3 below) for the following purposes and their directly related purposes (collectively "Permitted Purposes"):
To verify your identity;
To provide you with access to the Service;
To provide the Service and related features, tools or capabilities, including but not limited to enabling you to create an account, input information, interact with the AI assistant, create or generate "Output Content" (as defined in the Terms of Use), and view chat history;
To communicate with you regarding the Service and manage our relationship with you, including notifying you of changes to this Statement, the Privacy Policy, the Terms of Use and the Service;
To provide and improve user experience, including responding to your enquiries and complaints, or handling any disputes arising in the course of providing the Service;
To perform analysis to generate statistical or actuarial reports (including aggregate data which may or may not relate to any identified or identifiable individual);
To better understand the demographics of users of the Service;
To perform accounting, auditing and other internal functions, including legal and administrative purposes;
To maintain and manage the Service, including troubleshooting, data analysis, testing, system maintenance and upgrades, support, reporting and data hosting, and maintaining and developing related business systems and infrastructure;
To conduct internal research or analysis to improve and optimise the Service;
To comply with legal obligations and to detect, prevent and investigate any actual or suspected unlawful activity or misuse of the Service (your personal data will only be used to the extent necessary for this purpose);
To protect the rights and property of Airscend and/or any Transferees (as defined in Section 3.1 below); and
Other purposes ancillary or related to the above purposes.

Airscend will not use your personal data for any new purpose without your prior explicit consent.

All use of personal data by Airscend and Transferees (as defined in Section 3 below) shall be subject to this Statement, the Terms of Use and the Privacy Policy, as well as any other contractual or other obligations relating to the Service.

For the avoidance of doubt, personal data collected in connection with the Service will not (whether by Airscend, Transferees and/or any third party) be used for training generative AI and/or large language models, nor for direct marketing purposes.

3. Disclosure and Transfer of Personal Data

3.1 Your personal data shall remain confidential, but may be used (including disclosed and/or transferred to) the following transferees and/or their designated personnel ("Transferees") in accordance with your user instructions on the Service, and/or for the performance of the Service, and/or for the Permitted Purposes:

(a) Technology Service Providers: Technical partners and their staff necessary for the provision of the Service, including RAG knowledge base management, workflow deployment and model channel management;

(b) Third-Party Search Service Providers: Where you use the search function of the Service, Airscend may need to share or transfer your personal data to third-party search service providers, who may process your personal data within or outside Hong Kong. Where reasonably practicable, Airscend will implement and maintain measures to appropriately de-identify and/or anonymise your personal data before sharing and/or transfer. Airscend will also endeavour to implement and maintain relevant contractual and/or other non-contractual measures to regulate and ensure that data processors comply with the Personal Data (Privacy) Ordinance (Cap. 486) ("PDPO") and the PRC Personal Information Protection Law when processing personal data;

(c) Recipients Required by Law or Business Transfer:
Airscend and/or any Transferee is obliged to disclose or transfer your personal data to comply with any applicable laws, regulations, rules, orders and legal obligations of any legal, regulatory, governmental, tax, law enforcement or other authority or self-regulatory body;
Airscend will not disclose your personal data to any third party except where your personal data relates to matters involving threats to the safety of Hong Kong society, national security, or other matters regulated by applicable public order or security laws and regulations. In such circumstances, Airscend will disclose relevant data to the relevant government authorities as required by the government and judicial authorities on a case-by-case basis;
To enforce or apply Airscend's other terms and conditions or other agreements, or to protect the rights, property or safety of Airscend, its customers/users, Transferees or others;
In connection with any asset or business transfer, acquisition, sale, merger, reorganisation, liquidation, receivership, change of control and/or service transfer (collectively "Transaction") to another entity, Airscend may disclose your personal data to the relevant counterparty (including but not limited to for due diligence purposes); and

(d) Airscend's Professional Advisers: Including but not limited to lawyers, accountants and auditors.

All personal data you provide to the Service is protected and accessible only to authorised personnel. Airscend will implement stringent technical and security measures to protect your personal data and will conduct ongoing and/or periodic reviews thereof.

Subject to the Terms of Use and Privacy Policy, you may share your chat conversations, Input Content, Output Content or other Service-related information with any third party. Information you share with such third parties will be governed by their terms and conditions and privacy policies (if applicable), which are beyond Airscend's control. Airscend encourages you to review such terms and policies before sharing your information with third parties.

4. Retention of Personal Data

4.1 All personal data will not be retained for longer than is necessary to fulfil the Permitted Purposes and/or any other directly related purposes. For clarity:
Your personal data will not be used to train Airscend's generative AI and/or large language models. However, where you provide feedback on the Service and/or any Output Content, after exclusion of any personal data, the relevant Output Content and its corresponding Input Content may be retained by Airscend for the purpose of processing such feedback and/or for Permitted Purposes.

Any other personal data collected in connection with the Service will be retained for one (1) calendar year from the date on which you withdraw your consent to use the Service in accordance with the Terms of Use, unless such personal data is required for Permitted Purposes or Airscend otherwise determines based on the nature of such personal data.

Where Airscend has reasonable grounds to believe that personal data is inaccurate (as defined in the PDPO, meaning incorrect, misleading, incomplete or outdated), Airscend will take all practicable steps to ensure that such data is not used, or is erased.

All personal data exceeding the applicable retention periods set out above will be automatically purged, deleted or removed from the Service and related servers in accordance with the applicable data retention and disposal schedule.

5. Your Rights

5.1 You have the right to: (i) check whether Airscend holds any personal data about you in connection with the Service; and (ii) request access to and correction of any errors in your personal data submitted in connection with the Service.

5.2 To submit a data access request to Airscend, please complete the Data Access Request Form published by the Office of the Privacy Commissioner for Personal Data (available at https://www.pcpd.org.hk/english/publications/files/Dformb.pdf) and submit the completed form together with a copy of your identity document by post or email to Airscend's Data Protection Officer (marked "Confidential"):

Post: 6F Crason Commercial Centre, 333 Nathan Road, Jordan, Kowloon, Hong Kong
Email: service@airscend.com

5.3 You may withdraw your consent to the use of the Service in accordance with the Terms of Use.

5.4 For any enquiries regarding this Statement and related practices, please contact Airscend's Data Protection Officer through the communication channels set out in Section 5.2.

5.5 Nothing in this Statement limits your rights under the Personal Data (Privacy) Ordinance (Cap. 486).

6. Language and Governing Law

6.1 This Statement is governed by and shall be construed in accordance with the laws of Hong Kong SAR.

6.2 In the event of any conflict between the English version and the Chinese version (Traditional or Simplified) of this Statement, the English version shall prevail in Hong Kong SAR and common law jurisdictions; the Chinese version shall prevail within Mainland China (excluding Hong Kong SAR).

7. Amendments to This Statement

7.1 Airscend reserves the right to update or amend this Statement at any time to reflect changes in Airscend's personal data protection policies and/or changes in applicable personal data and privacy laws and regulations. In the event of material changes, Airscend may notify you of such amendments through any means it deems appropriate.

7.2 Your continued use of the Service following any changes to this Statement constitutes your consent to such changes. If you do not wish to accept the amended Statement, you should cease using the Service and deregister your account. Airscend recommends that you periodically review the applicable Statement, Terms of Use and Privacy Policy.

I confirm that I have carefully read and understood the Personal Data Collection Statement, Terms of Use and Privacy Policy relating to the LuGangTong (鲁港通) artificial intelligence assistant service. I agree to and accept the scope of collection, holding, processing and use (including disclosure and transfer) of my personal data as set out in the Personal Data Collection Statement, as well as the applicable Terms of Use and Privacy Policy.`;

async function addDataCollectionEn() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到 MongoDB');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection('system_contents');

    console.log('\n📝 处理: LuGangTong Personal Data Collection Statement (data_collection_en)');
    console.log(`   内容长度: ${DATA_COLLECTION_EN.length} 字符`);
    
    const existing = await collection.findOne({ key: 'data_collection_en' });
    
    if (existing) {
      console.log('   ⚠️  已存在，将更新内容...');
      
      const result = await collection.updateOne(
        { key: 'data_collection_en' },
        {
          $set: {
            content: DATA_COLLECTION_EN,
            title: 'LuGangTong Personal Data Collection Statement',
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`   ✅ 已更新 (匹配: ${result.matchedCount}, 修改: ${result.modifiedCount})`);
    } else {
      console.log('   📝 不存在，将创建新记录...');
      
      const result = await collection.insertOne({
        key: 'data_collection_en',
        title: 'LuGangTong Personal Data Collection Statement',
        content: DATA_COLLECTION_EN,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`   ✅ 已创建 (ID: ${result.insertedId})`);
    }

    // 验证内容长度
    const doc = await collection.findOne({ key: 'data_collection_en' });
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

addDataCollectionEn();
