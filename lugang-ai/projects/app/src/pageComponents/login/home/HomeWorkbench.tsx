// 鲁港通 - 首屏工作台：对话示意 + 真实登录卡 + 客户端下载
import React from 'react';
import type { LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import { LoginContainer } from '../index';
import HomeDemo from './HomeDemo';
import type { HomeDemoCopy, HomeDownloadCopy, HomeLoginCopy } from './homeData';
import { HOME_ANCHORS, HOME_DOWNLOADS } from './homeData';

const HomeWorkbench = ({
  demo,
  login,
  download,
  onSuccess
}: {
  demo: HomeDemoCopy;
  login: HomeLoginCopy;
  download: HomeDownloadCopy;
  onSuccess: (res: LoginSuccessResponseType) => void | Promise<void>;
}) => (
  <section className="h5-work">
    <div className="h5-wrap">
      <div className="h5-work-stage" id="home-work-stage">
        <div className="h5-work-grid">
          <div className="h5-demo-wrap">
            <div className="h5-peek" aria-hidden="true">
              <img src="/imgs/home-mascot.webp" alt="" />
            </div>
            <HomeDemo copy={demo} />
          </div>

          <div className="h5-side">
            <div className="h5-login h5-reveal d1" id={HOME_ANCHORS.login}>
              <h2>{login.title}</h2>
              <p className="h5-login-sub">{login.sub}</p>
              <div className="h5-login-body">
                <LoginContainer onSuccess={onSuccess} />
              </div>
            </div>

            <div className="h5-dl h5-reveal d2" id={HOME_ANCHORS.download}>
              <div className="h5-dl-title">{download.title}</div>
              <a
                className="h5-dl-row"
                href={HOME_DOWNLOADS.windows}
                rel="noopener noreferrer"
              >
                <span className="h5-dl-ico win" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 5.6l7.4-1v7.1H3V5.6zm8.6-1.2L21 3v8.7h-9.4V4.4zM3 12.9h7.4v7.1L3 18.9v-6zm8.6 0H21V21l-9.4-1.3v-6.8z" />
                  </svg>
                </span>
                <span>
                  <span className="h5-dl-name">{download.winName}</span>
                  <span className="h5-dl-ver">{download.winVer}</span>
                </span>
                <span className="h5-dl-arrow">{download.arrow}</span>
              </a>
              <a
                className="h5-dl-row"
                href={HOME_DOWNLOADS.android}
                rel="noopener noreferrer"
              >
                <span className="h5-dl-ico android" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 9h12v8.2a1.8 1.8 0 0 1-1.8 1.8h-1.1v2.4a1.2 1.2 0 0 1-2.4 0V19h-1.4v2.4a1.2 1.2 0 0 1-2.4 0V19H7.8A1.8 1.8 0 0 1 6 17.2V9zm-2.4 0a1.2 1.2 0 0 0-1.2 1.2v5.4a1.2 1.2 0 0 0 2.4 0v-5.4A1.2 1.2 0 0 0 3.6 9zm16.8 0a1.2 1.2 0 0 1 1.2 1.2v5.4a1.2 1.2 0 0 1-2.4 0v-5.4A1.2 1.2 0 0 1 20.4 9zM7.6 3.6l-1-1.7a.4.4 0 0 1 .7-.4l1 1.8A6.6 6.6 0 0 1 12 2.6c1.3 0 2.6.3 3.7.7l1-1.8a.4.4 0 0 1 .7.4l-1 1.7A5.6 5.6 0 0 1 19.4 8H4.6a5.6 5.6 0 0 1 3-4.4zM9 5.6a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm6 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4z" />
                  </svg>
                </span>
                <span>
                  <span className="h5-dl-name">{download.androidName}</span>
                  <span className="h5-dl-ver">{download.androidVer}</span>
                </span>
                <span className="h5-dl-arrow">{download.arrow}</span>
              </a>
              <p className="h5-dl-note">{download.note}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default HomeWorkbench;
