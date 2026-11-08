// 鲁港通 - 关于页（纸本 +《鹊华秋色图》视差介绍版）
import React from 'react';
import { serviceSideProps } from '@/web/common/i18n/utils';
import AboutPage from '@/pageComponents/about';

const About = () => {
  return <AboutPage />;
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      // 鲁港通 - 关于页使用独立 about3 命名空间（内容整体按段落取回）
      ...(await serviceSideProps(context, ['about3']))
    }
  };
}

export default About;
