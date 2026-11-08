// 鲁港通 - 页脚：品牌、三列链接与底部声明
import React from 'react';
import Link from 'next/link';
import { HomeFootBrand } from './HomeBrand';
import type { HomeFooterCopy } from './homeData';
import { HOME_FOOTER_LINKS } from './homeData';

const FootLink = ({ href, children }: { href: string; children: React.ReactNode }) =>
  href.startsWith('/') ? (
    <Link href={href}>{children}</Link>
  ) : (
    <a href={href}>{children}</a>
  );

const HomeFooter = ({ copy }: { copy: HomeFooterCopy }) => (
  <footer className="h5-foot">
    <div className="h5-wrap">
      <div className="h5-foot-grid">
        <div className="h5-foot-intro">
          <HomeFootBrand />
          <p className="h5-foot-tag">{copy.tagline}</p>
        </div>
        {copy.columns.map((column, columnIndex) => (
          <div className="h5-foot-col" key={column.title}>
            <h4>{column.title}</h4>
            {column.links.map((label, linkIndex) => {
              const href = HOME_FOOTER_LINKS[columnIndex]?.[linkIndex]?.href ?? '#';
              return (
                <FootLink key={`${column.title}-${label}`} href={href}>
                  {label}
                </FootLink>
              );
            })}
          </div>
        ))}
      </div>
      <div className="h5-foot-bottom">
        {copy.bottom.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  </footer>
);

export default HomeFooter;
