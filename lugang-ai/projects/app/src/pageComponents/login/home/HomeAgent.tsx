// 鲁港通 - 智能体区：蓝色小圆脸 + 轨道环 + 最近动作流
import React from 'react';
import type { HomeAgentCopy } from './homeData';
import { HOME_ANCHORS, HOME_BRAND_NAME } from './homeData';

const HomeAgent = ({ copy }: { copy: HomeAgentCopy }) => (
  <section className="h5-agent" id={HOME_ANCHORS.agent}>
    <div className="h5-wrap">
      <div className="h5-agent-grid">
        <div className="h5-agent-stage">
          <div className="h5-agent-ring r1" aria-hidden="true" />
          <div className="h5-agent-ring r2" aria-hidden="true" />
          <div className="h5-agent-ring r3" aria-hidden="true" />
          <div className="h5-agent-mascot" id="home-agent-mascot" data-drift="-0.07">
            <img src="/imgs/home-mascot.webp" alt={HOME_BRAND_NAME} />
          </div>
          {copy.orbits.slice(0, 4).map((label, index) => (
            <span key={label} className={`h5-orbit o${index + 1}`}>
              {label}
            </span>
          ))}
        </div>

        <div className="h5-agent-feed h5-reveal from-right">
          <div className="h5-head-center">
            <span className="h5-kicker">{copy.kicker}</span>
            <h2 className="h5-h2">
              {copy.titleA}
              <br />
              {copy.titleB}
            </h2>
            <p className="h5-sub">{copy.sub}</p>
          </div>
          <div className="h5-agent-feed-head">
            <i />
            {copy.feedHead}
          </div>
          <ul className="h5-feed">
            {copy.feed.map((item) => (
              <li key={`${item.time}-${item.text}`}>
                <time>{item.time}</time>
                <p>{item.text}</p>
                <em>{item.state}</em>
              </li>
            ))}
          </ul>
          <p className="h5-agent-note">{copy.note}</p>
        </div>
      </div>
    </div>
  </section>
);

export default HomeAgent;
