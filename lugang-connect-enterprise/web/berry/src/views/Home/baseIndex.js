import { Box, Typography, Container, Stack, Chip } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';

const BaseIndex = () => (
  <Box
    sx={{
      minHeight: 'calc(100vh - 136px)',
      backgroundImage: 'url(https://airscend.com/quehuaqiusetu.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      color: 'white',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 1
      }
    }}
  >
    <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, py: 6 }}>
      <Grid container columns={12} alignItems="center" sx={{ minHeight: 'calc(100vh - 280px)' }}>
        <Grid xs={12}>
          <Stack spacing={4} alignItems="center" textAlign="center">
            {/* 主标题 */}
            <Typography 
              variant="h1" 
              sx={{ 
                fontSize: { xs: '2.5rem', md: '4rem' }, 
                fontWeight: 700,
                color: '#fff', 
                lineHeight: 1.3,
                textShadow: '2px 2px 8px rgba(0,0,0,0.5)'
              }}
            >
              鲁港通跨境 AI 智能服务平台
            </Typography>
            
            {/* 副标题 */}
            <Typography 
              variant="h4" 
              sx={{ 
                fontSize: { xs: '1.2rem', md: '1.8rem' }, 
                color: '#fff', 
                lineHeight: 1.6,
                fontWeight: 500,
                textShadow: '1px 1px 4px rgba(0,0,0,0.5)',
                maxWidth: '900px'
              }}
            >
              " 智联香江资源 · 赋能齐鲁腾飞 "
              <br />
              —— 打造山东高水平对外开放的数字新引擎
            </Typography>

            {/* 描述文字 */}
            <Typography 
              variant="body1" 
              sx={{ 
                fontSize: { xs: '1rem', md: '1.2rem' }, 
                color: 'rgba(255,255,255,0.95)', 
                lineHeight: 2,
                maxWidth: '1000px',
                textShadow: '1px 1px 3px rgba(0,0,0,0.4)'
              }}
            >
              立足香港，服务山东。我们以行业领先的 <strong>AI 大模型技术</strong> 为核心，构筑连接黄海之滨与维港之畔的数字化枢纽。
              <br /><br />
              南下助企合规出海，北上引资引智入鲁。既是企业搏击全球市场的智能导航，更是推动鲁港产业链、资金链、人才链深度融合的战略平台。
            </Typography>

            {/* 标签 */}
            <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center" sx={{ mt: 2 }}>
              <Chip 
                label="政策精准直达" 
                sx={{ 
                  backgroundColor: 'rgba(255,255,255,0.2)', 
                  color: '#fff', 
                  fontSize: '1rem',
                  fontWeight: 500,
                  px: 2,
                  py: 2.5,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)'
                }} 
              />
              <Chip 
                label="跨境全域服务" 
                sx={{ 
                  backgroundColor: 'rgba(255,255,255,0.2)', 
                  color: '#fff', 
                  fontSize: '1rem',
                  fontWeight: 500,
                  px: 2,
                  py: 2.5,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)'
                }} 
              />
              <Chip 
                label="人才双向奔赴" 
                sx={{ 
                  backgroundColor: 'rgba(255,255,255,0.2)', 
                  color: '#fff', 
                  fontSize: '1rem',
                  fontWeight: 500,
                  px: 2,
                  py: 2.5,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)'
                }} 
              />
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  </Box>
);

export default BaseIndex;
