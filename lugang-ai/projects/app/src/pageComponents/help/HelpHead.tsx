// 鲁港通 - 帮助中心 SEO 头信息（标题 / 描述 / canonical）
import React from 'react';
import Head from 'next/head';

type HelpHeadProps = {
  title: string;
  description: string;
  path: string;
};

const HelpHead = ({ title, description, path }: HelpHeadProps) => (
  <Head>
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={`https://www.airscend.com${path}`} />
  </Head>
);

export default HelpHead;
