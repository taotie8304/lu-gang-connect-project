'use client';
import React from 'react';
import MyTicketsPanel from './MyTicketsPanel';

/** 直链 /account/myTickets 的兜底入口；日常入口是客户端设置面板里的「工单反馈」弹窗 */
const MyTickets = () => <MyTicketsPanel />;

export default MyTickets;
