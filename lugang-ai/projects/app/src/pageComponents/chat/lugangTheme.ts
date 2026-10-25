// 鲁港通 - 第 4 批界面主题（清雅淡蓝）
// 取值与已确认的可视化预览一致，聊天页各区块共用，避免同一批颜色在多处硬编码漂移。
export const LG = {
  mist: '#F7FAFE',
  paper: '#FBFDFF',
  pale: '#E7F1FB',
  paleSoft: '#EDF4FC',
  lake: '#6F9DD0',
  mountain: '#3A6D9C',
  sand: '#B7A888',
  ink: '#1F3142',
  inkSoft: '#273849',
  text: '#2B3C50',
  muted: '#6E8299',
  mutedSoft: '#9DAFC2',
  line: 'rgba(54,101,150,0.12)',
  lineSoft: 'rgba(54,101,150,0.1)',
  lineStrong: 'rgba(111,157,208,0.55)',
  userBubble: 'linear-gradient(135deg, #DBE9F9, #C9DDF2)',
  seal: 'linear-gradient(145deg, #A3C3E6, #6F9DD0)',
  send: 'linear-gradient(140deg, #8FB4DC, #4F80B4)',
  sidebar: 'linear-gradient(180deg, #DEEBF9 0%, #F5F9FE 58%, #E4EEFB 100%)',
  activeItem: 'linear-gradient(90deg, rgba(160,193,232,0.34), rgba(231,241,251,0.5))'
} as const;

// 鲁港通 - 侧栏网格底纹（淡蓝细线，仅作背景质感）
export const LG_GRID_STYLE = {
  bgImage:
    'linear-gradient(rgba(111,157,208,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(111,157,208,0.07) 1px, transparent 1px)',
  bgSize: '34px 34px',
  maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 78%)',
  WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 78%)'
} as const;
