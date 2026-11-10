// 鲁港通 - 价格区：四档套餐按功能差异分档，月付/年付切换，功能对比表
import React, { useState } from 'react';
import type { HomePricingCopy } from './homeData';
import {
  HOME_ANCHORS,
  HOME_SERVICE_MAIL,
  HOME_FEATURED_PLAN,
  HOME_PLAN_PRICES
} from './homeData';
import type { BillingMode } from './homeFx';
import { resolveBillingAmount } from './homeFx';

const renderTableCell = (cell: string) => {
  if (cell === '✓') return <span className="yes">{cell}</span>;
  if (cell === '—') return <span className="no">{cell}</span>;
  return <span className="part">{cell}</span>;
};

const HomePricing = ({ copy }: { copy: HomePricingCopy }) => {
  const [billing, setBilling] = useState<BillingMode>('month');

  return (
    <section className="h5-pricing" id={HOME_ANCHORS.price}>
      <div className="h5-wrap">
        <div className="h5-head-center">
          <span className="h5-kicker h5-reveal">{copy.kicker}</span>
          <h2 className="h5-h2 h5-reveal">
            {copy.titleA}
            <br />
            {copy.titleB}
          </h2>
          <p className="h5-sub h5-reveal d1">{copy.sub}</p>
          <div className="h5-billing h5-reveal d2" role="group" aria-label={copy.kicker}>
            <button
              type="button"
              className={billing === 'month' ? 'is-on' : ''}
              aria-pressed={billing === 'month'}
              onClick={() => setBilling('month')}
            >
              {copy.month}
            </button>
            <button
              type="button"
              className={billing === 'year' ? 'is-on' : ''}
              aria-pressed={billing === 'year'}
              onClick={() => setBilling('year')}
            >
              {copy.year}
              <small>{copy.yearSave}</small>
            </button>
          </div>
        </div>

        <div className="h5-price-grid">
          {copy.plans.map((plan, index) => {
            const price = HOME_PLAN_PRICES[index];
            const isFree = price.month === 0;
            const unit = isFree
              ? copy.priceUnit.permanent
              : copy.priceUnit[billing];
            return (
              <article
                key={plan.name}
                className={`h5-plan h5-reveal${index === HOME_FEATURED_PLAN ? ' is-featured' : ''}${
                  index > 0 ? ` d${Math.min(index, 3)}` : ''
                }`}
              >
                {plan.badge && <span className="h5-plan-badge">{plan.badge}</span>}
                <div className="h5-plan-name">{plan.name}</div>
                <div className="h5-plan-desc">{plan.desc}</div>
                <div className="h5-plan-price">
                  <span className="cur">¥</span>
                  <span className="num">
                    {resolveBillingAmount(price.month, price.year, billing).toLocaleString(
                      'en-US'
                    )}
                  </span>
                  <span className="unit">/ {unit}</span>
                </div>
                <a className="h5-plan-cta" href={`#${HOME_ANCHORS.login}`}>
                  {plan.cta}
                </a>
                <ul className="h5-plan-feats">
                  <li>{plan.credits}</li>
                  {plan.feats.map((feat) => (
                    <li key={feat.text} className={feat.off ? 'off' : undefined}>
                      {feat.text}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="h5-service-note h5-reveal">
          {copy.serviceNote.map((note) => (
            <span key={note}>
              <i aria-hidden="true" />
              {note}
            </span>
          ))}
        </div>

        <p className="h5-table-hint">{copy.tableHint}</p>
        <div className="h5-table-wrap h5-reveal">
          <table className="h5-table">
            <thead>
              <tr>
                {copy.tableHead.map((head) => (
                  <th key={head} scope="col">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {copy.tableRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.label}-${index}`}>{renderTableCell(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="h5-enterprise h5-reveal">
          <div>
            <h3>{copy.enterprise.title}</h3>
            <p>{copy.enterprise.body}</p>
          </div>
          <a className="h5-btn h5-btn-line" href={`mailto:${HOME_SERVICE_MAIL}`}>
            {copy.enterprise.cta}
          </a>
        </div>

        <div className="h5-price-notes">
          {copy.notes.map((note) => (
            <span key={note}>· {note}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomePricing;
