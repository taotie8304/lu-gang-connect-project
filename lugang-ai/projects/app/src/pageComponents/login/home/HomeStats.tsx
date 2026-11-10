// 鲁港通 - 数据带：四项统计滚动计数 + 政策词跑马灯
import React from 'react';
import type { HomeStatsCopy } from './homeData';
import { HOME_STAT_COUNTS, HOME_STAT_PREFIXES } from './homeData';
import { formatCount } from './homeFx';
import { hasStatsAnimated } from './homeRuntime';

const REVEAL_DELAYS = ['', ' d1', ' d2', ' d3'];

const HomeStats = ({ copy, marquee }: { copy: HomeStatsCopy; marquee: string[] }) => (
  <section className="h5-stats">
    <div className="h5-wrap">
      <div className="h5-stats-grid">
        {copy.items.map((item, index) => (
          <div key={item.label} className={`h5-stat h5-reveal${REVEAL_DELAYS[index]}`}>
            <b>
              {HOME_STAT_PREFIXES[index]}
              <span data-count={HOME_STAT_COUNTS[index]}>{hasStatsAnimated() ? formatCount(HOME_STAT_COUNTS[index]) : '0'}</span>
              <small>{item.suffix}</small>
            </b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="h5-marquee" aria-hidden="true">
      <div className="h5-marquee-track">
        {[...marquee, ...marquee].map((word, index) => (
          <span key={`${word}-${index}`}>{word}</span>
        ))}
      </div>
    </div>
  </section>
);

export default HomeStats;
