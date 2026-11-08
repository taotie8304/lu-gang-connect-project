// 鲁港通 - 能力区：按处境切换（求学 / 就业 / 创业 / 安家），同一问题的不同拆法
import React, { useState } from 'react';
import type { HomePersonasCopy } from './homeData';
import { HOME_ANCHORS, HOME_PERSONA_COUNT } from './homeData';

const HomePersonas = ({ copy }: { copy: HomePersonasCopy }) => {
  const [active, setActive] = useState(0);
  const tabs = copy.tabs.slice(0, HOME_PERSONA_COUNT);
  const items = copy.items.slice(0, HOME_PERSONA_COUNT);

  return (
    <section className="h5-personas" id={HOME_ANCHORS.ability}>
      <div className="h5-wrap">
        <div className="h5-head-center">
          <span className="h5-kicker h5-reveal">{copy.kicker}</span>
          <h2 className="h5-h2 h5-reveal">
            {copy.titleA}
            <br />
            {copy.titleB}
          </h2>
          <p className="h5-sub h5-reveal d1">{copy.sub}</p>
          <div
            className="h5-persona-tabs h5-reveal d2"
            role="tablist"
            aria-label={copy.kicker}
          >
            {tabs.map((tab, index) => (
              <button
                key={tab}
                className={`h5-persona-tab${index === active ? ' is-on' : ''}`}
                type="button"
                role="tab"
                aria-selected={index === active}
                onClick={() => setActive(index)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="h5-persona-stage">
          {items.map((item, index) => (
            <div
              key={item.question}
              className={`h5-persona-panel${index === active ? ' is-on' : ''}`}
              data-persona-panel={index}
            >
              <div className="h5-persona-q">
                <small>{copy.askLabel}</small>
                <p>{item.question}</p>
                <span>{item.asker}</span>
              </div>
              <div className="h5-persona-a">
                <small>{copy.answerLabel}</small>
                <h3>{item.answer}</h3>
                <ul className="h5-persona-list">
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <div className="h5-persona-src">
                  {item.sources.map((source) => (
                    <span key={source}>{source}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomePersonas;
