'use client';
import React from 'react';
import AccountContainer from '@/pageComponents/account/AccountContainer';
import MyTickets from '@/pageComponents/account/myTickets';

const MyTicketsPage = () => {
  return (
    <AccountContainer>
      <MyTickets />
    </AccountContainer>
  );
};

export default MyTicketsPage;
