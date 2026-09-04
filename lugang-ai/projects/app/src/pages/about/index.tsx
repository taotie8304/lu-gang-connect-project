// 鲁港通 - N2：关于页（公开静态页，完整复刻 api.airscend.com/about 内容）
import React from 'react';
import { serviceSideProps } from '@/web/common/i18n/utils';
import AboutPage from '@/pageComponents/about';

const About = () => {
  return <AboutPage />;
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      // 鲁港通 - 关于页文案复用 login 命名空间（about_* 前缀），无需新增 namespace/loader
      ...(await serviceSideProps(context, ['login']))
    }
  };
}

export default About;
