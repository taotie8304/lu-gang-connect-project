/**
 * 鲁港通 - 更新使用条款到数据库
 * 通过 API 安全地更新系统内容
 */

const https = require('https');

// 使用条款完整内容
const termsContent = `# 鲁港通 (LuGangTong) 使用條款

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

閣下確認 Apple 及 Apple 子公司為本協議的第三方受益人，有權以第三方受益人身份對閣下執行本協議。`;

// API 配置
const API_BASE = 'www.airscend.com';
const USERNAME = 'root';
const PASSWORDS = ['Huijin8304*']; // 管理员密码

// HTTP 请求函数
function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// 登录获取 token
async function login(password) {
  console.log(`\n尝试使用密码登录: ${password}`);
  
  const postData = JSON.stringify({
    username: USERNAME,
    password: password
  });

  const options = {
    hostname: API_BASE,
    port: 443,
    path: '/api/support/user/account/loginByPassword',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const result = await makeRequest(options, postData);
  
  if (result.statusCode === 200 && result.data.data && result.data.data.token) {
    console.log('✓ 登录成功');
    return result.data.data.token;
  } else {
    console.log(`✗ 登录失败: ${JSON.stringify(result.data)}`);
    return null;
  }
}

// 更新使用条款
async function updateTerms(token) {
  console.log('\n开始更新使用条款...');
  
  const postData = JSON.stringify({
    key: 'terms_of_use',
    title: '鲁港通 (LuGangTong) 使用條款',
    content: termsContent,
    contentType: 'markdown'
  });

  const options = {
    hostname: API_BASE,
    port: 443,
    path: '/api/system/content/update',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${token}`
    }
  };

  const result = await makeRequest(options, postData);
  
  if (result.statusCode === 200) {
    console.log('✓ 使用条款更新成功！');
    console.log('更新时间:', result.data.data?.updateTime);
    return true;
  } else {
    console.log(`✗ 更新失败: ${JSON.stringify(result.data)}`);
    return false;
  }
}

// 验证更新结果
async function verifyUpdate() {
  console.log('\n验证更新结果...');
  
  const options = {
    hostname: API_BASE,
    port: 443,
    path: '/api/system/content/terms_of_use',
    method: 'GET'
  };

  const result = await makeRequest(options);
  
  if (result.statusCode === 200 && result.data.data) {
    const content = result.data.data.content;
    if (content.includes('最後更新：2026年4月1日')) {
      console.log('✓ 验证成功：使用条款已正确更新');
      console.log('内容长度:', content.length, '字符');
      return true;
    } else {
      console.log('✗ 验证失败：内容未正确更新');
      return false;
    }
  } else {
    console.log(`✗ 验证失败: ${JSON.stringify(result.data)}`);
    return false;
  }
}

// 主函数
async function main() {
  console.log('='.repeat(60));
  console.log('鲁港通 - 更新使用条款到数据库');
  console.log('='.repeat(60));

  let token = null;
  
  // 尝试所有密码
  for (const password of PASSWORDS) {
    token = await login(password);
    if (token) break;
  }

  if (!token) {
    console.error('\n✗ 所有密码都登录失败，无法继续');
    process.exit(1);
  }

  // 更新使用条款
  const updateSuccess = await updateTerms(token);
  if (!updateSuccess) {
    console.error('\n✗ 更新失败');
    process.exit(1);
  }

  // 验证更新
  const verifySuccess = await verifyUpdate();
  if (!verifySuccess) {
    console.error('\n✗ 验证失败');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✓ 所有操作完成！使用条款已成功更新到数据库');
  console.log('='.repeat(60));
}

// 运行
main().catch(err => {
  console.error('\n✗ 发生错误:', err.message);
  process.exit(1);
});
