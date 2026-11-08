// 鲁港通 - 办理流程：问清楚 / 找原文 / 备齐全 / 办到底 四步切换
import React, { useState } from 'react';
import type { HomeFlowCopy } from './homeData';
import { HOME_FLOW_COUNT, HOME_FLOW_MISSING_CHECK } from './homeData';
import { calcFlowProgress } from './homeFx';

const HomeFlow = ({ copy }: { copy: HomeFlowCopy }) => {
  const [active, setActive] = useState(0);
  const steps = copy.steps.slice(0, HOME_FLOW_COUNT);

  return (
    <section className="h5-flow-section">
      <div className="h5-wrap">
        <div className="h5-head-center">
          <span className="h5-kicker h5-reveal">{copy.kicker}</span>
          <h2 className="h5-h2 h5-reveal">
            {copy.titleA}
            <br />
            {copy.titleB}
          </h2>
          <p className="h5-sub h5-reveal d1">{copy.sub}</p>
        </div>

        <div className="h5-flow" role="tablist" aria-label={copy.kicker}>
          <div className="h5-flow-line" aria-hidden="true">
            <i style={{ width: `${calcFlowProgress(active, steps.length)}%` }} />
          </div>
          {steps.map((step, index) => (
            <button
              key={step.no}
              className={`h5-flow-btn${index === active ? ' is-on' : ''}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => setActive(index)}
            >
              <span className="h5-flow-no">{step.no}</span>
              <b>{step.label}</b>
            </button>
          ))}
        </div>

        <div className="h5-flow-detail">
          <div className="h5-flow-copy">
            {steps.map((step, index) => (
              <div
                key={step.no}
                className={`h5-flow-pane${index === active ? ' is-on' : ''}`}
                data-flow-pane={index}
              >
                <small>
                  STEP {step.no} · {step.label}
                </small>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <div className="h5-flow-tags">
                  {step.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="h5-flow-visual">
            <div className={`h5-flow-pane${active === 0 ? ' is-on' : ''}`}>
              <div className="h5-mini">
                <div className="h5-mini-q">{copy.mini.ask}</div>
                <div className="h5-mini-query">
                  {copy.mini.queries.map((query) => (
                    <span key={query}>{query}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className={`h5-flow-pane${active === 1 ? ' is-on' : ''}`}>
              <div className="h5-mini">
                <div className="h5-mini-doc">
                  <div className="h5-mini-doc-head">
                    {copy.mini.source}
                    <span className="h5-mini-stamp">{copy.mini.verified}</span>
                  </div>
                  <b>{copy.mini.docTitle}</b>
                  <p>{copy.mini.docBody}</p>
                </div>
              </div>
            </div>

            <div className={`h5-flow-pane${active === 2 ? ' is-on' : ''}`}>
              <div className="h5-mini">
                {copy.mini.checks.map((check, index) => (
                  <div
                    key={check.text}
                    className={`h5-mini-check${
                      index === HOME_FLOW_MISSING_CHECK ? ' missing' : ''
                    }`}
                  >
                    <i>{index === HOME_FLOW_MISSING_CHECK ? '!' : '✓'}</i>
                    {check.text}
                    <em>{check.state}</em>
                  </div>
                ))}
              </div>
            </div>

            <div className={`h5-flow-pane${active === 3 ? ' is-on' : ''}`}>
              <div className="h5-mini">
                <div className="h5-mini-browser">
                  <div className="h5-mini-browser-bar">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="h5-mini-browser-body">
                    <div className="h5-mini-field" />
                    <div className="h5-mini-field short" />
                    <div className="h5-mini-field" />
                    <div className="h5-mini-confirm">✓ {copy.mini.confirm}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeFlow;
