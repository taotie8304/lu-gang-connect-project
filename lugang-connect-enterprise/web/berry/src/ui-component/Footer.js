// material-ui
import { Link, Container, Box } from '@mui/material';
import React from 'react';
import { useSelector } from 'react-redux';

// ==============================|| FOOTER - AUTHENTICATION 2 & 3 ||============================== //

const Footer = () => {
  const siteInfo = useSelector((state) => state.siteInfo);

  return (
    <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64px' }}>
      <Box sx={{ textAlign: 'center' }}>
        {siteInfo.footer_html ? (
          <div className="custom-footer" dangerouslySetInnerHTML={{ __html: siteInfo.footer_html }}></div>
        ) : (
          <>
            {siteInfo.system_name} {process.env.REACT_APP_VERSION}{' '}
            由 Airscend Media Communications Limited 构建
            <br />
            版权归属 香港硕谷光核文化传播有限公司 / 深圳市硕谷光核科技文化有限公司
          </>
        )}
      </Box>
    </Container>
  );
};

export default Footer;
