'use client';
import React from 'react';
import AccountContainer from '@/pageComponents/account/AccountContainer';
import Memories from '@/pageComponents/account/memories';

const MemoriesPage = () => {
  return (
    <AccountContainer>
      <Memories />
    </AccountContainer>
  );
};

export default MemoriesPage;
