// 鲁港通 - 常见问题：原生 details 折叠，保持轻量与可访问
import React from 'react';
import Link from 'next/link';
import type { HomeFaqCopy } from './homeData';
import { HOME_ANCHORS } from './homeData';

const HomeFaq = ({ copy }: { copy: HomeFaqCopy }) => (
  <section className="h5-faq" id={HOME_ANCHORS.faq}>
    <div className="h5-wrap">
      <div className="h5-head-center">
        <span className="h5-kicker h5-reveal">{copy.kicker}</span>
        <h2 className="h5-h2 h5-reveal">{copy.title}</h2>
      </div>
      <div className="h5-faq-list h5-reveal d1">
        {copy.items.map((item, index) => (
          <details className="h5-faq-item" key={index}>
            <summary>{item.q}</summary>
            <p className="h5-faq-a">{item.a}</p>
          </details>
        ))}
      </div>
      <div className="h5-faq-more h5-reveal d2">
        <Link href="/help">{copy.more} →</Link>
      </div>
    </div>
  </section>
);

export default HomeFaq;
