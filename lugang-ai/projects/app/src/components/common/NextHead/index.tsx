import Head from 'next/head';
import React, { useMemo } from 'react';

const NextHead = ({ title, icon, desc }: { title?: string; icon?: string; desc?: string }) => {
  const formatIcon = useMemo(() => {
    if (!icon) return '/favicon.ico';
    if (icon.startsWith('http') || icon.startsWith('/')) {
      return icon;
    }
    return '/favicon.ico';
  }, [icon]);

  return (
    <Head>
      <title>{title}</title>
      <meta
        name="viewport"
        content="width=device-width,initial-scale=1.0,maximum-scale=1.0,minimum-scale=1.0,user-scalable=no, viewport-fit=cover"
      />
      <meta httpEquiv="Content-Security-Policy" content="img-src * data: blob:;" />
      {desc && <meta name="description" content={desc} />}
      {/* 鲁港通 - 恒定渲染单个图标链接：条件渲染会让浏览器回退抓 /favicon.ico，重渲染时形成请求风暴 */}
      <link rel="icon" href={formatIcon} />
    </Head>
  );
};

export default NextHead;
