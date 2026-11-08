// 鲁港通 - 首页顶部导航：滚动变实、移动端抽屉菜单、语言切换入口
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import I18nLngSelector from '@/components/Select/I18nLngSelector';
import { HomeNavBrand } from './HomeBrand';
import { HOME_ANCHORS, HOME_MENU_LINKS, HOME_NAV_LINKS } from './homeData';
import type { HomeNavCopy } from './homeData';

const SmartLink = ({
  href,
  className,
  onClick,
  children
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) =>
  href.startsWith('/') ? (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );

const HomeNav = ({ copy }: { copy: HomeNavCopy }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 820) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <header className={`h5-nav${scrolled ? ' is-scrolled' : ''}${menuOpen ? ' is-menu' : ''}`}>
      <div className="h5-nav-in">
        <HomeNavBrand sub={copy.brandSub} ariaLabel={copy.brandAria} />
        <nav className="h5-links" aria-label={copy.mainAria}>
          {HOME_NAV_LINKS.map((link, index) => (
            <SmartLink key={link.href} href={link.href} className="h5-link">
              {copy.links[index]}
            </SmartLink>
          ))}
        </nav>
        <div className="h5-nav-right">
          <a className="h5-nav-dl" href={`#${HOME_ANCHORS.download}`}>
            {copy.download}
          </a>
          <a className="h5-nav-login" href={`#${HOME_ANCHORS.login}`}>
            {copy.login}
          </a>
          <a className="h5-btn h5-btn-dark" href={`#${HOME_ANCHORS.login}`}>
            {copy.start}
          </a>
        </div>
        <div className="h5-nav-lang">
          <I18nLngSelector />
        </div>
        <button
          className="h5-burger"
          type="button"
          aria-label={menuOpen ? copy.menuClose : copy.menuOpen}
          aria-expanded={menuOpen}
          aria-controls="home-nav-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </div>
      <div className="h5-menu" id="home-nav-menu" aria-hidden={!menuOpen}>
        <nav aria-label={copy.menuAria}>
          {HOME_MENU_LINKS.map((link, index) => (
            <SmartLink
              key={link.href}
              href={link.href}
              className="h5-menu-link"
              onClick={closeMenu}
            >
              {copy.links[index]}
            </SmartLink>
          ))}
        </nav>
        <div className="h5-menu-foot">
          <a className="h5-menu-dl" href={`#${HOME_ANCHORS.download}`} onClick={closeMenu}>
            {copy.download}
          </a>
          <a className="h5-btn h5-btn-dark" href={`#${HOME_ANCHORS.login}`} onClick={closeMenu}>
            {copy.menuLogin}
          </a>
        </div>
      </div>
    </header>
  );
};

export default HomeNav;
