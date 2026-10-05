// 鲁港通 - XML 分块提取器测试（TDD）：三文件 fixtures 覆盖 CRLF/实体/尾随空格/缺失字段
import { describe, it, expect } from 'vitest';
import { fixtureText } from './fixture';
import { extractBlocks, getField, scanBlocks } from '../src/xml';

const basicXml = fixtureText('SchoolBasicInfo.sample.xml');
const premisesXml = fixtureText('SchoolPremises.sample.xml');
const accXml = fixtureText('SchoolAccommodation.sample.xml');

describe('extractBlocks（按记录标签切块）', () => {
  it('三文件块数：Basic 9 / Premises 8 / Accommodation 10', () => {
    expect(extractBlocks(basicXml, 'SchoolBasicInfo')).toHaveLength(9);
    expect(extractBlocks(premisesXml, 'SchoolPremises')).toHaveLength(8);
    expect(extractBlocks(accXml, 'SchoolAccommodation')).toHaveLength(10);
  });

  it('块不含首尾标签', () => {
    const b = extractBlocks(basicXml, 'SchoolBasicInfo')[0];
    expect(b.trimStart().startsWith('<SchoolNameEng>')).toBe(true);
    expect(b.includes('</SchoolBasicInfo>')).toBe(false);
  });

  it('标签不存在 → 空数组', () => {
    expect(extractBlocks(basicXml, 'NoSuchTag')).toEqual([]);
  });

  it('scanBlocks 流式回调计数与末块内容一致', () => {
    let n = 0;
    let lastName = '';
    const count = scanBlocks(basicXml, 'SchoolBasicInfo', (b) => {
      n += 1;
      lastName = getField(b, 'SchoolNameChi') ?? '';
    });
    expect(count).toBe(9);
    expect(n).toBe(9);
    expect(lastName).toBe('港專成人教育中心（皇仁書院）');
  });
});

describe('getField（字段提取与清洗）', () => {
  const basic = extractBlocks(basicXml, 'SchoolBasicInfo');
  const shatin = basic[0]; // 112526 沙田公立（小學）
  const lasalle = basic[2]; // 512583 喇沙書院
  const centre611 = basic[5]; // 584487 ６１１教育中心（下午）

  it('普通字段提取', () => {
    expect(getField(shatin, 'SchoolNameChi')).toBe('沙田公立學校');
    expect(getField(shatin, 'SchoolNumber')).toBe('112526');
    expect(getField(shatin, 'SchoolRegistrationNumber')).toBe('11252');
  });

  it('英文名尾随大量空格被清理', () => {
    expect(getField(shatin, 'SchoolNameEng')).toBe('SHATIN PUBLIC SCHOOL');
  });

  it('实体解码：&amp; 全量还原（喇沙地址）', () => {
    expect(getField(lasalle, 'SchoolAddressEng')).toBe(
      '1/F & 2/F BASEMENTS & G/F-4/F 18 LA SALLE ROAD  KOWLOON'
    );
  });

  it('&#x20; 空格实体 → 解码后为空 → undefined', () => {
    expect(getField(centre611, 'FaxNumber')).toBeUndefined();
  });

  it('缺失字段 → undefined；存在字段正常返回', () => {
    expect(getField(shatin, 'ProvisionalRegistrationDate')).toBeUndefined();
    expect(getField(shatin, 'SchoolWebSite')).toBe('http://www.shatinpublicschool.edu.hk');
    expect(getField(centre611, 'ProvisionalRegistrationDate')).toBe('2011-01-04');
    expect(getField(centre611, 'SchoolWebSite')).toBeUndefined();
  });

  it('空标签（值仅换行）→ undefined', () => {
    expect(getField(centre611, 'LocationMapUrl')).toBeUndefined();
  });

  it('值内换行归一为空格（实体解码后可含换行，防御）', () => {
    expect(getField('<F>A\r\nB</F>', 'F')).toBe('A B');
  });
});

describe('getField（Premises / Accommodation 字段）', () => {
  it('Premises：喇沙校舍（0001）与多条校舍（圣保罗 0001/0003）', () => {
    const prem = extractBlocks(premisesXml, 'SchoolPremises');
    expect(getField(prem[0], 'SchoolNumber')).toBe('112526');
    expect(getField(prem[1], 'PremisesCode')).toBe('0001');
    expect(getField(prem[1], 'PremisesDescChi')).toBe('九龍喇沙利道１８號地庫１至２樓及地下至４樓');
    expect(getField(prem[2], 'PremisesCode')).toBe('0001');
    expect(getField(prem[3], 'PremisesCode')).toBe('0003');
  });

  it('Accommodation：房间号 trim 与字母房号（114 / A / B）', () => {
    const rooms = extractBlocks(accXml, 'SchoolAccommodation');
    expect(getField(rooms[0], 'RoomNo')).toBe('114');
    expect(getField(rooms[0], 'PermittedAccommodation')).toBe('26');
    expect(getField(rooms[8], 'RoomNo')).toBe('A');
    expect(getField(rooms[8], 'PermittedAccommodation')).toBe('25');
    expect(getField(rooms[9], 'RoomNo')).toBe('B');
    expect(getField(rooms[9], 'PermittedAccommodation')).toBe('42');
  });

  it('Accommodation：全空格 RemarksChi → undefined', () => {
    const rooms = extractBlocks(accXml, 'SchoolAccommodation');
    expect(getField(rooms[8], 'RemarksChi')).toBeUndefined();
  });
});
