/**
 * 鲁港通 - 桌面客户端专属登录页（0.14.2 两地长卷改版）
 * 底部通栏「山东泰山山水 → 双向光带 → 维港剪影」长卷，三栏透明叠加其上，
 * 登录卡半透明融入整页，小史莱姆坐在登录卡上沿，大史莱姆在右侧舞台。
 * 登录窗口由主进程锁定 1280×800，仅在桌面桥可用时由 pages/login 分流渲染。
 */
import React, { useEffect, useState } from 'react';
import { Flex, Image } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { LoginContainer } from '@/pageComponents/login';
import ThinkingFace from '@/components/common/ThinkingFace';
import I18nLngSelector from '@/components/Select/I18nLngSelector';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import type { HomeHeroCopy, HomeLoginCopy } from '@/pageComponents/login/home/homeData';
import { HOME_BRAND_NAME, HOME_BRAND_SUB } from '@/pageComponents/login/home/homeData';
import type { LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import styles from './DesktopLoginHero.module.scss';

// 鲁港通 - 文案按已确认稿取子集：meta 去掉平台行、浮签去掉 DSE 项
const HERO_META_INDEXES = [0, 1, 3];
const HERO_FLOAT_INDEXES = [0, 1, 2, 4];

// 鲁港通 - 双向光带曲线：山东帆船 → 香港天星小轮
const LINK_PATH = 'M372 252 C500 200 720 192 934 274';
const LINK_PATH_BACK = 'M934 274 C720 192 500 200 372 252';

type MascotFace = 'left' | 'idle' | 'squint' | 'wide';

// 鲁港通 - 大史莱姆四阶段：望登录框 → 望向你 → — w — → 跳两下
const LOGIN_PHASES: {
  face: MascotFace;
  mouth: boolean;
  duration: number;
  jump?: boolean;
}[] = [
  { face: 'left', mouth: false, duration: 1900 },
  { face: 'idle', mouth: false, duration: 1800 },
  { face: 'squint', mouth: true, duration: 1700 },
  { face: 'wide', mouth: false, duration: 1700, jump: true }
];

const LockGlyph = () => (
  <svg className={styles.lockGlyph} viewBox="0 0 24 24" aria-hidden>
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

const MascotEyes = ({ face, mini }: { face: MascotFace; mini?: boolean }) => (
  <span
    className={`${styles.eyes}${mini ? ` ${styles.miniLook}` : ''}`}
    data-face={face}
    aria-hidden
  >
    <i className={`${styles.eye} ${styles.eyeL}`} />
    <i className={`${styles.eye} ${styles.eyeR}`} />
  </span>
);

const Hearts = () => (
  <span className={styles.hearts} aria-hidden>
    <span className={`${styles.heart} ${styles.heart1}`}>♥</span>
    <span className={`${styles.heart} ${styles.heart2}`}>♥</span>
    <span className={`${styles.heart} ${styles.heart3}`}>♥</span>
  </span>
);

// 鲁港通 - 底部两地长卷：泰山山水 + 泰山日出 + 飞鸟 + 连续海面 + 帆船 + 天星小轮 + 双向光带
const Panorama = () => (
  <div className={styles.panorama} aria-hidden>
    <svg
      className={styles.panoramaSvg}
      viewBox="0 0 1280 340"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="lgPanoFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f9c8c" stopOpacity="0.16" />
          <stop offset="1" stopColor="#3f9c8c" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="lgPanoMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c6f8f" stopOpacity="0.2" />
          <stop offset="1" stopColor="#2c6f8f" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="lgPanoNear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e4d63" stopOpacity="0.24" />
          <stop offset="1" stopColor="#1e4d63" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="lgPanoWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c6f8f" stopOpacity="0.1" />
          <stop offset="1" stopColor="#2c6f8f" stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id="lgPanoArc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3f9c8c" stopOpacity="0" />
          <stop offset="0.35" stopColor="#3f9c8c" stopOpacity="0.55" />
          <stop offset="0.7" stopColor="#1e7bff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#1e7bff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lgPanoSunHalo">
          <stop offset="0" stopColor="#ffdf9e" stopOpacity="0.42" />
          <stop offset="0.55" stopColor="#f5c877" stopOpacity="0.14" />
          <stop offset="1" stopColor="#f5c877" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lgPanoSunCore">
          <stop offset="0" stopColor="#fff6e0" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#ffd98f" stopOpacity="0.5" />
          <stop offset="1" stopColor="#f2b968" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 山东 · 远山：右端逐段缓降，平滑没入海面不留断崖 */}
      <path
        d="M0 206 L64 152 L122 186 L188 128 L252 176 L318 138 L382 182 L448 146 L512 186 L574 156 L636 192 L700 164 L764 184 L822 214 L868 238 L900 252 L0 252 Z"
        fill="url(#lgPanoFar)"
      />
      {/* 泰山日出：半轮金日藏在山脊后 */}
      <circle cx="248" cy="196" r="84" fill="url(#lgPanoSunHalo)" />
      <circle cx="248" cy="196" r="27" fill="url(#lgPanoSunCore)" />
      {/* 泰山主峰 */}
      <path
        d="M0 252 L64 238 L122 244 L182 224 L240 236 L298 210 L342 188 L364 196 L402 114 L416 104 L446 160 L484 198 L532 214 L576 204 L624 234 L674 244 L720 252 Z"
        fill="url(#lgPanoMid)"
      />
      <path
        d="M298 210 L342 188 L364 196 L402 114 L416 104"
        fill="none"
        stroke="rgba(30,77,99,0.24)"
        strokeWidth="1.2"
      />
      {/* 近岸山麓：缓坡入海 */}
      <path
        d="M0 252 L0 216 C62 210 116 214 170 224 C230 236 286 244 344 248 C404 252 462 254 520 254 C566 254 604 253 640 252 Z"
        fill="url(#lgPanoNear)"
      />
      <path
        d="M0 230 C62 222 116 226 170 236 C230 248 286 254 344 256"
        fill="none"
        stroke="rgba(30,77,99,0.14)"
        strokeWidth="1"
      />
      {/* 飞鸟 */}
      <g
        className={styles.birds}
        fill="none"
        stroke="rgba(30,29,26,0.36)"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M410 148 q8 -8 16 0 M430 159 q7 -7 14 0 M452 142 q7 -7 14 0 M484 153 q6 -6 12 0 M506 144 q6 -6 12 0" />
      </g>

      {/* 海面：两地山下连成一片海 */}
      <path
        d="M0 252 C140 250 260 254 400 252 C540 250 660 254 800 252 C940 250 1100 254 1280 252 L1280 340 L0 340 Z"
        fill="url(#lgPanoWater)"
      />
      <path
        d="M0 252 C140 250 260 254 400 252 C540 250 660 254 800 252 C940 250 1100 254 1280 252"
        fill="none"
        stroke="rgba(30,123,255,0.12)"
        strokeWidth="1"
      />
      <path
        className={styles.waveLine}
        d="M36 266 Q 92 262 148 266 T 260 266 T 372 266 T 484 266 T 596 266"
        fill="none"
        stroke="rgba(30,123,255,0.20)"
        strokeWidth="1.1"
      />
      <path
        className={`${styles.waveLine} ${styles.waveLine2}`}
        d="M680 276 Q 740 272 800 276 T 920 276 T 1040 276 T 1160 276 T 1280 276"
        fill="none"
        stroke="rgba(63,156,140,0.20)"
        strokeWidth="1"
      />
      <path
        className={styles.waveLine}
        d="M420 290 Q 486 286 552 290 T 684 290 T 816 290 T 948 290 T 1080 290 T 1212 290"
        fill="none"
        stroke="rgba(30,123,255,0.13)"
        strokeWidth="1"
      />

      {/* 山东 · 传统帆船（近岸） */}
      <g transform="translate(356 300)">
        <g className={styles.boatBob}>
          <path d="M-30 0 C-24 7 -14 10 0 10 C14 10 24 7 30 0 Z" fill="rgba(35,60,72,0.84)" />
          <path d="M-27 -0.5 L27 -0.5" stroke="rgba(250,247,240,0.55)" strokeWidth="1" />
          <path d="M-4 0 L-4 -46" stroke="rgba(35,60,72,0.85)" strokeWidth="2" />
          <path
            d="M-6 -44 C4 -40 14 -26 13 -6 L-6 -6 Z"
            fill="rgba(250,247,240,0.72)"
            stroke="rgba(35,60,72,0.55)"
            strokeWidth="1"
          />
          <path
            d="M-4 -38 L10 -30 M-4 -28 L12 -22 M-4 -18 L13 -13"
            stroke="rgba(35,60,72,0.4)"
            strokeWidth="0.9"
          />
          <path d="M-4 -46 L9 -41 L-4 -36 Z" fill="rgba(169,133,63,0.65)" />
          <path d="M16 0 L16 -20 L26 -14 L16 -13 Z" fill="rgba(250,247,240,0.5)" />
        </g>
        <path
          className={styles.wake}
          d="M-46 12 q16 4 32 0 M-38 17 q14 3 28 0"
          fill="none"
          stroke="rgba(30,123,255,0.22)"
          strokeWidth="1"
        />
      </g>

      {/* 香港 · 天星小轮（横渡维港） */}
      <g transform="translate(948 300)">
        <g className={`${styles.boatBob} ${styles.boatBob2}`}>
          <path d="M-34 2 L34 2 L30 10 L-30 10 Z" fill="rgba(35,60,72,0.82)" />
          <path
            d="M-28 -8 L28 -8 L34 2 L-34 2 Z"
            fill="rgba(250,247,240,0.7)"
            stroke="rgba(35,60,72,0.6)"
            strokeWidth="1"
          />
          <path d="M-20 -14 L20 -14 L28 -8 L-28 -8 Z" fill="rgba(35,60,72,0.8)" />
          <path
            d="M-24 -3 L-10 -3 M-6 -3 L6 -3 M10 -3 L24 -3"
            stroke="rgba(250,247,240,0.85)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path d="M-2 -14 L-2 -21 M9 -14 L9 -19" stroke="rgba(35,60,72,0.8)" strokeWidth="1.2" />
          <path d="M-2 -21 L6 -18" stroke="rgba(35,60,72,0.5)" strokeWidth="0.9" />
        </g>
        <path
          className={styles.wake}
          d="M-50 12 q16 4 32 0 M44 12 q16 4 32 0"
          fill="none"
          stroke="rgba(30,123,255,0.22)"
          strokeWidth="1"
        />
      </g>

      {/* 双向联通：山东 ⇄ 香港，弯曲动态线 */}
      <g fill="none" strokeLinecap="round">
        <path
          className={styles.linkArc}
          d={LINK_PATH}
          stroke="url(#lgPanoArc)"
          strokeWidth="1.7"
        />
        <path
          className={styles.linkArc2}
          d={LINK_PATH}
          stroke="rgba(63,156,140,0.4)"
          strokeWidth="1.1"
        />
      </g>
      {/* 鲁港通 - 双向光点：去程蓝、回程青，反向路径免用 SMIL keyPoints（React 属性名不可靠） */}
      <circle className={styles.linkDot} r="2.8" fill="rgba(30,123,255,0.85)">
        <animateMotion dur="13s" repeatCount="indefinite" path={LINK_PATH} />
      </circle>
      <circle className={styles.linkDot} r="2.3" fill="rgba(63,156,140,0.85)">
        <animateMotion dur="13s" begin="6.5s" repeatCount="indefinite" path={LINK_PATH_BACK} />
      </circle>
    </svg>

    {/* 香港维港剪影：用户提供的参考图素材，基线对齐海平面 */}
    <Image
      className={styles.hkSkyline}
      src="/imgs/login-hk-skyline.png"
      alt=""
      draggable={false}
    />

    <span className={`${styles.mist} ${styles.mist1}`} />
    <span className={`${styles.mist} ${styles.mist2}`} />
    <span className={`${styles.mist} ${styles.mist3}`} />
    <span className={`${styles.spark} ${styles.spark1}`} />
    <span className={`${styles.spark} ${styles.spark2}`} />
    <span className={`${styles.spark} ${styles.spark3}`} />
    <span className={`${styles.spark} ${styles.spark4}`} />
    <span className={`${styles.spark} ${styles.spark5}`} />
    <span className={`${styles.spark} ${styles.spark6}`} />
  </div>
);

type DesktopLoginHeroProps = {
  onSuccess: (e: LoginSuccessResponseType) => any;
};

const DesktopLoginHero = ({ onSuccess }: DesktopLoginHeroProps) => {
  const { t } = useTranslation();
  const { t: tHome } = useTranslation('home');
  const { feConfigs } = useSystemStore();
  const [version, setVersion] = useState('');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const brand = feConfigs?.systemTitle || HOME_BRAND_NAME;

  // 鲁港通 - 文案按段落整体取回，与首页 v4 共用同一份 hero/login 文案
  const tHomeSection = tHome as unknown as (
    key: string,
    options: { returnObjects: true }
  ) => unknown;
  const hero = tHomeSection('hero', { returnObjects: true }) as HomeHeroCopy;
  const loginCopy = tHomeSection('login', { returnObjects: true }) as HomeLoginCopy;
  const phase = LOGIN_PHASES[phaseIndex];

  useEffect(() => {
    // 鲁港通 - 兜底关闭上一位用户遗留的内置浏览器面板，并读取真实客户端版本
    void window.lugangDesktop?.closePanel().catch(() => undefined);
    window.lugangDesktop
      ?.getVersion()
      .then((info) => setVersion(info.appVersion))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => setPhaseIndex((index) => (index + 1) % LOGIN_PHASES.length),
      phase.duration
    );
    return () => clearTimeout(timer);
  }, [phaseIndex, phase.duration]);

  return (
    <Flex className={styles.hero}>
      {/* 整页动态山水：铺满登录框架底部，三栏内容透明叠加其上 */}
      <Panorama />

      {/* 左：品牌文案 */}
      <div className={styles.left}>
        <div className={styles.brand}>
          <ThinkingFace size={36} />
          <div>
            <div className={styles.brandName}>{brand}</div>
            <div className={styles.brandSub}>{HOME_BRAND_SUB}</div>
          </div>
          <span className={styles.badge}>{t('login:desktop_badge')}</span>
        </div>

        <div className={styles.copy}>
          <div className={styles.eyebrow}>
            <i />
            {hero.eyebrow}
          </div>
          <h1 className={styles.title}>
            {hero.titleTop}
            <br />
            <span className={styles.accent}>{hero.titleAccent}</span>
          </h1>
          <p className={styles.lede}>{hero.lede}</p>
          <div className={styles.meta}>
            {HERO_META_INDEXES.map((index, position) => (
              <span key={index}>
                {position > 0 && <i />}
                {hero.meta[index]}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.floats} aria-hidden>
          {HERO_FLOAT_INDEXES.map((index, position) => (
            <span key={index} className={`${styles.float} ${styles[`float${position + 1}`]}`}>
              {hero.floats[index]}
            </span>
          ))}
        </div>

        <div className={styles.foot}>
          <div className={styles.copyright}>{t('login:desktop_copyright')}</div>
        </div>
      </div>

      {/* 中：登录卡 + 坐在卡上的小史莱姆 */}
      <div className={styles.center}>
        <div className={styles.lang}>
          <I18nLngSelector />
        </div>

        <div className={styles.stack}>
          <div className={styles.mini} aria-hidden>
            <span className={styles.miniShadow} />
            <div className={styles.miniBob}>
              <div className={styles.mascot}>
                <Image
                  className={styles.mascotImg}
                  src="/imgs/home-mascot-base.webp"
                  alt=""
                  draggable={false}
                />
                <MascotEyes face="idle" mini />
              </div>
            </div>
            <Hearts />
          </div>

          <div className={styles.loginCard}>
            <h2 className={styles.loginTitle}>{loginCopy.title}</h2>
            <p className={styles.loginSub}>{loginCopy.sub}</p>
            <div className={styles.loginBody}>
              <LoginContainer onSuccess={onSuccess} />
            </div>
          </div>

          <div className={styles.sessionNote}>
            <LockGlyph />
            <span>{t('login:desktop_session_note')}</span>
          </div>
          {version && (
            <div className={styles.version}>{t('login:desktop_version', { version })}</div>
          )}
        </div>
      </div>

      {/* 右：大史莱姆舞台 */}
      <div className={styles.right} aria-hidden>
        <span className={styles.stageGlow} />
        <div className={styles.bigStage}>
          <div className={styles.big}>
            <span className={styles.bigShadowWide} />
            <span className={styles.bigShadow} />
            <div className={`${styles.bigBob}${phase.jump ? ` ${styles.jump}` : ''}`}>
              <div className={styles.mascot}>
                <Image
                  className={styles.mascotImg}
                  src="/imgs/home-mascot-base.webp"
                  alt=""
                  draggable={false}
                />
                <MascotEyes face={phase.face} />
                <span className={`${styles.mouth}${phase.mouth ? ` ${styles.mouthOn}` : ''}`}>
                  <svg viewBox="0 0 60 22">
                    <path
                      d="M6 8 C11 16 17 16 22 8 C27 16 33 16 38 8"
                      fill="none"
                      stroke="#2c7fae"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Flex>
  );
};

export default DesktopLoginHero;
