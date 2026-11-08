// 鲁港通 - 首页首屏：大标题居中 + 指针视差吉祥物 + 漂浮政策词
import React from 'react';
import type { HomeHeroCopy } from './homeData';
import { HOME_ANCHORS } from './homeData';

const FLOAT_SPEEDS = ['-0.08', '-0.14', '-0.05', '-0.12', '-0.07'];

const HomeHero = ({ copy }: { copy: HomeHeroCopy }) => (
  <section className="h5-hero">
    <div className="h5-hero-bg" aria-hidden="true">
      <div className="h5-hero-glow" />
      <div className="h5-hero-grid" />
      <div className="h5-orb a" data-parallax="-0.10" />
      <div className="h5-orb b" data-parallax="-0.16" />
      <div className="h5-orb c" data-parallax="-0.06" />
      {copy.floats.map((word, index) => (
        <span
          key={word}
          className={`h5-float f${index + 1}`}
          data-parallax={FLOAT_SPEEDS[index]}
        >
          {word}
        </span>
      ))}
    </div>

    <div className="h5-hero-mascot" id="home-hero-mascot" aria-hidden="true">
      <div className="h5-mascot-say">{copy.mascotSay}</div>
      <div className="h5-mascot-bob">
        <img className="h5-mascot-img" src="/imgs/home-mascot.webp" alt="" />
      </div>
    </div>

    <div className="h5-wrap">
      <span className="h5-eyebrow">{copy.eyebrow}</span>
      <h1>
        {copy.titleTop}
        <br />
        <em>{copy.titleAccent}</em>
      </h1>
      <p className="h5-lede">{copy.lede}</p>
      <div className="h5-cta">
        <a className="h5-btn h5-btn-dark" href={`#${HOME_ANCHORS.login}`}>
          {copy.ctaPrimary}
        </a>
        <a className="h5-btn h5-btn-line" href={`#${HOME_ANCHORS.download}`}>
          {copy.ctaSecondary}
        </a>
      </div>
      <div className="h5-meta">
        {copy.meta.map((item, index) => (
          <span key={item}>
            {index > 0 && <i aria-hidden="true" />}
            {item}
          </span>
        ))}
      </div>
      <div className="h5-scroll-cue" aria-hidden="true">
        <i />
        {copy.scroll}
      </div>
    </div>
  </section>
);

export default HomeHero;
