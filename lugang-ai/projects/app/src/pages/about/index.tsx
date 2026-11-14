// 鲁港通 - 关于页（纸本 +《鹊华秋色图》视差介绍版）
import React from 'react';
import { serviceSideProps } from '@/web/common/i18n/utils';
import AboutPage from '@/pageComponents/about';

const About = ({ defaultAppId }: { defaultAppId: string }) => {
  return <AboutPage defaultAppId={defaultAppId} />;
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      // 鲁港通 - 关于页内嵌登录卡，需要与登录页一致的文案命名空间与默认助手
      defaultAppId: process.env.DEFAULT_APP_ID || '',
      ...(await serviceSideProps(context, ['about3', 'login', 'app', 'user']))
    }
  };
}

export default About;
