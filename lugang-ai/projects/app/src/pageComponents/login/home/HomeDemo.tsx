// 鲁港通 - 工作台左侧：三幕对话示意（问答 / 路线 / 材料清单），轮播由 useHomeEffects 驱动
import React from 'react';
import type { HomeDemoCopy } from './homeData';

const HomeDemo = ({ copy }: { copy: HomeDemoCopy }) => (
  <div className="h5-demo h5-reveal from-scale">
    <div className="h5-demo-bar">
      <div className="h5-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="h5-url">www.airscend.com</div>
      <span className="h5-live">
        <i />
        {copy.live}
      </span>
    </div>
    <div className="h5-stage">
      <div className="h5-scene is-on" data-scene="0">
        <div className="h5-q">{copy.q1}</div>
        <div className="h5-a">
          <strong>{copy.a1Title}</strong>
          <ul className="h5-steps">
            {copy.a1Steps.map((step, index) => (
              <li key={step}>
                <b>{index + 1}</b>
                <span>{step}</span>
              </li>
            ))}
          </ul>
          <div className="h5-src">
            <span>{copy.srcOrg}</span>
            <span>{copy.srcDate}</span>
          </div>
        </div>
      </div>

      <div className="h5-scene h5-scene-route" data-scene="1">
        <div className="h5-route-cap">
          <span>{copy.routeCap}</span>
          <span>
            {copy.routeFrom} → {copy.routeTo}
          </span>
        </div>
        <div className="h5-route-line">
          <div className="h5-route-fill" />
          <div className="h5-route-dot" />
        </div>
        <div className="h5-route-ends">
          <div>
            <b>{copy.routeFrom}</b>
            <small>{copy.routeFromSub}</small>
          </div>
          <div>
            <b>{copy.routeTo}</b>
            <small>{copy.routeToSub}</small>
          </div>
        </div>
        <div className="h5-route-meta">
          {copy.routeMeta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="h5-scene h5-scene-doc" data-scene="2">
        <div className="h5-doc-head">
          <b>{copy.docTitle}</b>
          <span>{copy.docCount}</span>
        </div>
        {copy.docRows.map(([name, meta]) => (
          <div className="h5-doc-row" key={name}>
            <span className="h5-doc-check">✓</span>
            <span className="h5-doc-name">{name}</span>
            <span className="h5-doc-meta">{meta}</span>
          </div>
        ))}
      </div>

      <div className="h5-scene-bars" aria-hidden="true">
        <i className="is-on" />
        <i />
        <i />
      </div>
      <span className="h5-stage-note">{copy.note}</span>
    </div>
  </div>
);

export default HomeDemo;
