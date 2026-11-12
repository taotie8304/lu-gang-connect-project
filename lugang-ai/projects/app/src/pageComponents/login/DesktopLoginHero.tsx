/**
 * 鲁港通 - 桌面客户端专属登录页（0.14.1 整页山水 + 史莱姆坐卡改版）
 * 整页共用一层背景与动态山水，登录卡半透明融入其中，小史莱姆坐在登录卡上沿。
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

const Landscape = () => (
  <div className={styles.landscape} aria-hidden>
    <span className={styles.sun} />
    <span className={`${styles.cloud} ${styles.cloud1}`} />
    <span className={`${styles.cloud} ${styles.cloud2}`} />
    <svg
      className={`${styles.lsLayer} ${styles.lsFar}`}
      viewBox="0 0 640 300"
      preserveAspectRatio="none"
    >
      <path
        d="M0 236 L74 176 L128 206 L196 138 L262 198 L322 150 L390 210 L452 168 L520 214 L582 182 L640 220 L640 300 L0 300 Z"
        fill="rgba(63,156,140,.13)"
      />
    </svg>
    <svg
      className={`${styles.lsLayer} ${styles.lsMid}`}
      viewBox="0 0 640 300"
      preserveAspectRatio="none"
    >
      <path
        d="M0 264 L60 224 L122 250 L188 192 L252 244 L318 206 L384 252 L450 214 L516 254 L588 226 L640 256 L640 300 L0 300 Z"
        fill="rgba(30,123,255,.12)"
      />
    </svg>
    <svg
      className={`${styles.lsLayer} ${styles.lsWater}`}
      viewBox="0 0 640 300"
      preserveAspectRatio="none"
    >
      <path
        d="M0 276 C70 268 120 284 190 276 C260 268 310 284 380 276 C450 268 500 284 570 276 C600 272 622 276 640 278 L640 300 L0 300 Z"
        fill="rgba(30,29,26,.07)"
      />
      <path
        className={styles.waterline}
        d="M20 288 Q 90 282 160 288 T 300 288 T 440 288 T 580 288"
        fill="none"
        stroke="rgba(30,123,255,.30)"
        strokeWidth="1.1"
      />
      <path
        className={`${styles.waterline} ${styles.waterline2}`}
        d="M0 294 Q 80 288 160 294 T 320 294 T 480 294 T 640 294"
        fill="none"
        stroke="rgba(63,156,140,.28)"
        strokeWidth="1"
      />
    </svg>
    <span className={`${styles.spark} ${styles.spark1}`} />
    <span className={`${styles.spark} ${styles.spark2}`} />
    <span className={`${styles.spark} ${styles.spark3}`} />
    <span className={`${styles.spark} ${styles.spark4}`} />
    <span className={`${styles.spark} ${styles.spark5}`} />
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
      <Landscape />

      {/* 左：品牌文案 */}
      <div className={styles.left}>
        <span className={styles.glow} aria-hidden />
        <span className={styles.dots} aria-hidden />

        <div className={styles.brand}>
          <ThinkingFace size={34} />
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
        <span className={styles.centerDots} aria-hidden />
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
        <div className={styles.bigStage}>
          <span className={styles.shadow} />
          <div className={styles.big}>
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
