import React from 'react';
import { Box, Container, Typography, Stack, Paper, Grid, Divider, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import PersonIcon from '@mui/icons-material/Person';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import StarIcon from '@mui/icons-material/Star';
import GroupsIcon from '@mui/icons-material/Groups';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SouthIcon from '@mui/icons-material/South';
import NorthIcon from '@mui/icons-material/North';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import BiotechIcon from '@mui/icons-material/Biotech';
import SchoolIcon from '@mui/icons-material/School';
import FavoriteIcon from '@mui/icons-material/Favorite';

// 可配置的背景图片 - 可以通过环境变量或配置文件修改
const HERO_BACKGROUND_IMAGE = process.env.REACT_APP_HERO_BG_IMAGE || 'https://www.shuohk.com/quehuaqiusetu.jpg';

const About = () => {
  return (
    <Box sx={{ backgroundColor: '#0a1628' }}>
      {/* Hero 区域 - 带背景图 */}
      <Box
        sx={{
          minHeight: '100vh',
          backgroundImage: `url(${HERO_BACKGROUND_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(10, 22, 40, 0.85) 0%, rgba(26, 35, 126, 0.75) 100%)',
            zIndex: 1
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, py: 8 }}>
          <Stack spacing={4} alignItems="center" textAlign="center">
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.5rem', md: '4rem' },
                fontWeight: 800,
                color: '#fff',
                textShadow: '3px 3px 15px rgba(0,0,0,0.5)',
                letterSpacing: '0.05em'
              }}
            >
              鲁港通跨境 AI 智能服务平台
            </Typography>
            
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: '1.2rem', md: '1.6rem' },
                color: 'rgba(255,255,255,0.95)',
                fontWeight: 500,
                textShadow: '2px 2px 8px rgba(0,0,0,0.4)'
              }}
            >
              —— 链接鲁港双向资源 · 赋能高水平对外开放 ——
            </Typography>

            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.2rem' },
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 2.2,
                maxWidth: '1000px',
                textShadow: '1px 1px 4px rgba(0,0,0,0.3)'
              }}
            >
              由<strong>香港硕谷光核文化传播有限公司</strong>自主研发，依托行业领先大模型技术，构建连接齐鲁大地与世界的数字桥梁。
            </Typography>

            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.15rem' },
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 2.2,
                maxWidth: '1000px',
                textShadow: '1px 1px 4px rgba(0,0,0,0.3)'
              }}
            >
              我们深入贯彻国家<strong>"高水平对外开放"</strong>战略，积极响应山东省委省政府<strong>"打造对外开放新高地"</strong>及<strong>"双招双引"</strong>号召。
            </Typography>

            <Box sx={{ 
              mt: 4, 
              p: 4, 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              borderRadius: 4,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <Typography
                variant="h5"
                sx={{
                  color: '#ffd54f',
                  fontWeight: 600,
                  lineHeight: 2,
                  textShadow: '1px 1px 4px rgba(0,0,0,0.3)'
                }}
              >
                鲁港通致力于成为：
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 2 }} justifyContent="center">
                <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, flex: 1 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 500 }}>🏛️ 政府信赖的政策落地助推器</Typography>
                </Paper>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, flex: 1 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 500 }}>🧭 企业出海的智能导航仪</Typography>
                </Paper>
                <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, flex: 1 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 500 }}>⚙️ 鲁港融合发展的核心引擎</Typography>
                </Paper>
              </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* 南下板块 */}
      <Box sx={{ py: 8, backgroundColor: '#0d2137' }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
            <SouthIcon sx={{ fontSize: 48, color: '#ff7043' }} />
            <Typography variant="h2" sx={{ fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 700, color: '#fff' }}>
              南下：助鲁企出海，融全球格局
            </Typography>
          </Stack>
          <Typography variant="h6" sx={{ textAlign: 'center', color: '#ffd54f', mb: 5 }}>
            【核心使命】帮助山东企业"走出去"，响应中央惠港政策，壮大爱国爱港力量
          </Typography>

          <Grid container spacing={4}>
            {/* 智领出海 */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ 
                p: 4, 
                height: '100%', 
                background: 'linear-gradient(145deg, #1a3a5c 0%, #0d2137 100%)',
                borderRadius: 4,
                border: '1px solid rgba(255,112,67,0.3)',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'translateY(-8px)' }
              }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <SecurityIcon sx={{ fontSize: 40, color: '#ff7043' }} />
                  <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>智领出海，合规护航</Typography>
                </Stack>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 2 }}>
                  针对山东企业跨境痛点，利用 AI 深度解析国际贸易法规与税务政策。提供从资质申请到经营合规的全流程智能指引，确保企业出海<strong style={{color: '#ffd54f'}}>"走得稳、走得远"</strong>，将山东优质产品推向港澳台及全球市场。
                </Typography>
              </Paper>
            </Grid>

            {/* 身份规划 */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ 
                p: 4, 
                height: '100%', 
                background: 'linear-gradient(145deg, #1a3a5c 0%, #0d2137 100%)',
                borderRadius: 4,
                border: '1px solid rgba(255,112,67,0.3)',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'translateY(-8px)' }
              }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <FamilyRestroomIcon sx={{ fontSize: 40, color: '#ff7043' }} />
                  <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>身份规划，家国同心</Typography>
                </Stack>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 2 }}>
                  积极配合香港投资推广署政策，为内地企业家提供从香港身份申请、子女教育（幼儿园至大学）到家庭生活融入的一站式管家服务。助力企业家融入香港主流社会，培育爱国爱港情怀。
                </Typography>
              </Paper>
            </Grid>

            {/* 反哺桑梓 */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ 
                p: 4, 
                height: '100%', 
                background: 'linear-gradient(145deg, #1a3a5c 0%, #0d2137 100%)',
                borderRadius: 4,
                border: '1px solid rgba(255,112,67,0.3)',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'translateY(-8px)' }
              }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: '#ff7043' }} />
                  <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>反哺桑梓，资本回流</Typography>
                </Stack>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 2 }}>
                  引导在港发展的山东籍企业家利用香港资本优势，反向投资家乡，形成<strong style={{color: '#ffd54f'}}>"立足香港、贡献国家、回报山东"</strong>的良性商业闭环。
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* 北上板块 */}
      <Box sx={{ py: 8, backgroundColor: '#0a1628' }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
            <NorthIcon sx={{ fontSize: 48, color: '#42a5f5' }} />
            <Typography variant="h2" sx={{ fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 700, color: '#fff' }}>
              北上：引港资入鲁，聚创新动能
            </Typography>
          </Stack>
          <Typography variant="h6" sx={{ textAlign: 'center', color: '#ffd54f', mb: 5 }}>
            【核心使命】吸引香港资金、智力、青年"引进来"，赋能山东新旧动能转换
          </Typography>

          <Grid container spacing={4}>
            {/* 双招双引 */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ 
                p: 4, 
                height: '100%', 
                background: 'linear-gradient(145deg, #1a3a5c 0%, #0a1628 100%)',
                borderRadius: 4,
                border: '1px solid rgba(66,165,245,0.3)',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'translateY(-8px)' }
              }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <PrecisionManufacturingIcon sx={{ fontSize: 40, color: '#42a5f5' }} />
                  <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>双招双引，精准链接</Typography>
                </Stack>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 2 }}>
                  依托 AI 大数据，将山东省最新的招商政策、产业规划精准推送至香港商界。消除信息差，吸引香港企业家投资山东实体经济，助力山东强链补链，实现鲁港产业深度融合。
                </Typography>
              </Paper>
            </Grid>

            {/* 科创落地 */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ 
                p: 4, 
                height: '100%', 
                background: 'linear-gradient(145deg, #1a3a5c 0%, #0a1628 100%)',
                borderRadius: 4,
                border: '1px solid rgba(66,165,245,0.3)',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'translateY(-8px)' }
              }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <BiotechIcon sx={{ fontSize: 40, color: '#42a5f5' }} />
                  <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>科创落地，智汇齐鲁</Typography>
                </Stack>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 2 }}>
                  搭建高端科研转化通道，协助香港高校教授、专家将高质量科研成果（如生物医药、AI、新材料）落地山东。不仅引资，更引智，以新质生产力助推山东产业升级。
                </Typography>
              </Paper>
            </Grid>

            {/* 文化寻根 */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ 
                p: 4, 
                height: '100%', 
                background: 'linear-gradient(145deg, #1a3a5c 0%, #0a1628 100%)',
                borderRadius: 4,
                border: '1px solid rgba(66,165,245,0.3)',
                transition: 'transform 0.3s',
                '&:hover': { transform: 'translateY(-8px)' }
              }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                  <SchoolIcon sx={{ fontSize: 40, color: '#42a5f5' }} />
                  <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>文化寻根，筑梦未来</Typography>
                </Stack>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 2 }}>
                  整合齐鲁文化资源，吸引香港青少年开展<strong style={{color: '#ffd54f'}}>"寻根研学"</strong>，增强民族认同感；打造港澳青年双创服务站，提供政策咨询与落地扶持，吸引香港青年来鲁创业，让青春在建设现代化强省中绽放。
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* 愿景宣言 */}
      <Box sx={{ 
        py: 8, 
        background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #1565c0 100%)',
        position: 'relative'
      }}>
        <Container maxWidth="md">
          <Stack spacing={4} alignItems="center" textAlign="center">
            <FavoriteIcon sx={{ fontSize: 60, color: '#ff5252' }} />
            <Typography variant="h3" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.5 }}>
              共乘鲁港合作东风
              <br />
              共绘开放繁荣新篇章
            </Typography>
            <Divider sx={{ width: '100px', borderColor: 'rgba(255,255,255,0.5)', borderWidth: 2 }} />
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '1.2rem', lineHeight: 2.2 }}>
              鲁港通不仅是一个服务平台，更是一项<strong>政治任务</strong>、一份<strong>社会责任</strong>。
            </Typography>
            <Typography variant="h5" sx={{ color: '#ffd54f', fontWeight: 600 }}>
              我们承诺：
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', lineHeight: 2 }}>
              以数字化手段提升政府经贸影响力，以专业服务解决用户核心痛点。
            </Typography>
            <Paper sx={{ 
              mt: 4, 
              p: 4, 
              backgroundColor: 'rgba(255,255,255,0.15)', 
              borderRadius: 4,
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,213,79,0.5)'
            }}>
              <Typography variant="h5" sx={{ color: '#ffd54f', fontWeight: 600 }}>
                🎉 诚邀各大企业、专家学者及有志青年注册使用
              </Typography>
            </Paper>
          </Stack>
        </Container>
      </Box>

      {/* 发展历程 */}
      <Box sx={{ py: 8, backgroundColor: '#0d2137' }}>
        <Container maxWidth="lg">
          <Paper elevation={0} sx={{ backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 4, p: { xs: 3, md: 5 } }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <TimelineIcon sx={{ fontSize: 42, color: '#1976d2' }} />
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#1a237e' }}>发展历程</Typography>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 600, color: '#333', mb: 3 }}>
              2025年：顺势而生，智联未来
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 2.4, color: '#444', fontSize: '1.1rem', mb: 3 }}>
              在国家"十四五"规划深度实施与鲁港合作全面深化的历史机遇期，<strong>鲁港通跨境AI智能服务平台</strong>于香港正式创立。
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 2.4, color: '#444', fontSize: '1.1rem', mb: 3 }}>
              平台紧密依托中央惠港政策、山东省"双招双引"战略及香港特区政府跨境便利化措施，立足香港这一国际科创与金融中心，旨在以 <strong>AI 大模型技术</strong>打破地域壁垒，构建鲁港两地经贸、人才、数据互联互通的数字新基建。
            </Typography>
            <Box sx={{ p: 3, backgroundColor: 'rgba(26, 35, 126, 0.08)', borderRadius: 2, borderLeft: '5px solid #1a237e' }}>
              <Typography variant="body1" sx={{ lineHeight: 2.2, color: '#1a237e', fontSize: '1.15rem', fontStyle: 'italic', fontWeight: 500 }}>
                我们不仅是政策红利的"转化器"，更是新时代鲁港融合发展的"数字先行者"。
              </Typography>
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* 创始人领航 */}
      <Box sx={{ py: 8, backgroundColor: '#0a1628' }}>
        <Container maxWidth="lg">
          <Paper elevation={0} sx={{ backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 4, p: { xs: 3, md: 5 } }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <PersonIcon sx={{ fontSize: 42, color: '#ed6c02' }} />
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#1a237e' }}>创始人领航</Typography>
            </Stack>
            
            <Box sx={{ mb: 4, p: 4, background: 'linear-gradient(135deg, #1a237e 0%, #303f9f 100%)', borderRadius: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
                金晖 先生 | Mr. Jin Hui
              </Typography>
              <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                项目发起人 / 首席战略官
              </Typography>
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 600, color: '#333', mb: 3 }}>社会职务与影响力：</Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {[
                '中国侨联青年委员',
                '山东省济南市政协委员',
                '山东省海联会理事',
                '香港山东社团总会副会长',
                '香港山东侨界联合会会长',
                '大湾区科教智投联合会主席'
              ].map((item, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Paper sx={{ p: 2.5, backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: 2, borderLeft: '4px solid #ffc107' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StarIcon sx={{ color: '#ffc107', fontSize: 24 }} />
                      <Typography variant="h6" sx={{ fontWeight: 500, color: '#333' }}>{item}</Typography>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Typography variant="h4" sx={{ fontWeight: 600, color: '#333', mb: 3 }}>领航优势：</Typography>
            <Typography variant="body1" sx={{ lineHeight: 2.4, color: '#444', fontSize: '1.1rem', mb: 3 }}>
              作为横跨鲁港两地的杰出侨领与商业领袖，金晖先生在教育产业数字化转型与跨境资本运作领域拥有逾十年的深厚积淀。他不仅具备敏锐的国际化视野，更掌握着从政府顶层设计到民间商业落地的全链路资源。
            </Typography>
            <Typography variant="body1" sx={{ lineHeight: 2.4, color: '#444', fontSize: '1.1rem' }}>
              金晖先生以"AI+跨境"为战略支点，亲自挂帅鲁港通项目，将其丰富的鲁港政商网络转化为平台核心竞争力，为企业出海合规、跨境融资及人才引进提供极具前瞻性的战略指引与强有力的资源背书。
            </Typography>
          </Paper>
        </Container>
      </Box>

      {/* 战略合作伙伴 */}
      <Box sx={{ py: 8, backgroundColor: '#0d2137' }}>
        <Container maxWidth="lg">
          <Paper elevation={0} sx={{ backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 4, p: { xs: 3, md: 5 } }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
              <HandshakeIcon sx={{ fontSize: 42, color: '#2e7d32' }} />
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#1a237e' }}>战略合作伙伴</Typography>
            </Stack>
            
            <Typography variant="h5" sx={{ textAlign: 'center', color: '#666', mb: 4, fontStyle: 'italic' }}>
              —— 构筑"政产学研金"全域生态 ——
            </Typography>
            
            <Typography variant="body1" sx={{ lineHeight: 2.4, color: '#444', fontSize: '1.1rem', mb: 4 }}>
              我们不仅是一个平台，更是一个通过 AI 链接的高端资源联合体。通过与权威机构的深度协同，确保每一项服务的合规性、权威性与落地效率。
            </Typography>

            <Divider sx={{ my: 4 }} />

            {/* 核心社团支持 */}
            <Box sx={{ mb: 5 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                <GroupsIcon sx={{ color: '#9c27b0', fontSize: 32 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, color: '#333' }}>核心社团支持：</Typography>
              </Stack>
              <Grid container spacing={2}>
                {['香港山东社团总会', '香港侨界社团联会', '香港山东侨界联合会', '大湾区科教智投联合会'].map((item, index) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'rgba(156, 39, 176, 0.08)', borderRadius: 3, height: '100%' }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>{item}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="body1" sx={{ mt: 2, color: '#666', fontStyle: 'italic', textAlign: 'center', fontSize: '1.05rem' }}>
                （作用：提供庞大的企业家网络与两地互信基础）
              </Typography>
            </Box>

            {/* 政府及官方机构协同 */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                <AccountBalanceIcon sx={{ color: '#1976d2', fontSize: 32 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, color: '#333' }}>政府及官方机构协同：</Typography>
              </Stack>
              <Grid container spacing={3}>
                {/* 香港投资推广署 */}
                <Grid item xs={12} md={6} lg={3}>
                  <Paper sx={{ p: 4, height: '100%', backgroundColor: '#f8f9fa', borderRadius: 3, borderTop: '5px solid #1976d2' }}>
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                      <img 
                        src="https://www.yinghelawyer.com/uploads/upfiles/image/20220228/1646015503924161.png" 
                        alt="香港投资推广署" 
                        style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#1976d2', mb: 2, textAlign: 'center' }}>
                      香港投资推广署
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#666', textAlign: 'center', mb: 2 }}>
                      (InvestHK)
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#444', lineHeight: 2, fontSize: '1.05rem' }}>
                      政策绿色通道，助力企业极速落地。
                    </Typography>
                  </Paper>
                </Grid>
                {/* 香港教育局 */}
                <Grid item xs={12} md={6} lg={3}>
                  <Paper sx={{ p: 4, height: '100%', backgroundColor: '#f8f9fa', borderRadius: 3, borderTop: '5px solid #2e7d32' }}>
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                      <img 
                        src="https://clologin.edb.gov.hk/adfs/portal/logo/logo.png" 
                        alt="香港教育局" 
                        style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#2e7d32', mb: 2, textAlign: 'center' }}>
                      香港教育局
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#444', lineHeight: 2, fontSize: '1.05rem' }}>
                      赋能教育规划、青年研学与人才引进。
                    </Typography>
                  </Paper>
                </Grid>
                {/* 香港民政及青年事务局 */}
                <Grid item xs={12} md={6} lg={3}>
                  <Paper sx={{ p: 4, height: '100%', backgroundColor: '#f8f9fa', borderRadius: 3, borderTop: '5px solid #7b1fa2' }}>
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                      <img 
                        src="https://www.weventure.gov.hk/EDay2024/media/images/home/HYAB-Logo-TC.png" 
                        alt="香港民政及青年事务局" 
                        style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#7b1fa2', mb: 2, textAlign: 'center' }}>
                      香港民政及青年事务局
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#444', lineHeight: 2, fontSize: '1.05rem' }}>
                      支持青年发展、社区建设与公民教育。
                    </Typography>
                  </Paper>
                </Grid>
                {/* 香港旅游发展局 */}
                <Grid item xs={12} md={6} lg={3}>
                  <Paper sx={{ p: 4, height: '100%', backgroundColor: '#f8f9fa', borderRadius: 3, borderTop: '5px solid #ed6c02' }}>
                    <Box sx={{ mb: 3, textAlign: 'center' }}>
                      <img 
                        src="https://www.tourism.gov.hk/images/about_us_hktb_logo.png" 
                        alt="香港旅游发展局" 
                        style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#ed6c02', mb: 2, textAlign: 'center' }}>
                      香港旅游发展局
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#444', lineHeight: 2, fontSize: '1.05rem' }}>
                      协同开发"文化寻根"与高端商务考察路线。
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* 联系我们 */}
      <Box sx={{ py: 8, backgroundColor: '#0a1628' }}>
        <Container maxWidth="lg">
          <Paper elevation={0} sx={{ 
            background: 'linear-gradient(135deg, #1a237e 0%, #303f9f 100%)', 
            borderRadius: 4, 
            p: { xs: 4, md: 6 } 
          }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
              <LocationOnIcon sx={{ fontSize: 42, color: '#fff' }} />
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#fff' }}>联系我们</Typography>
            </Stack>
            <Typography variant="h5" sx={{ color: 'rgba(255,255,255,0.9)', mb: 2 }}>总部地址：</Typography>
            <Typography variant="h6" sx={{ color: '#fff', lineHeight: 2, fontSize: '1.2rem' }}>
              香港九龙弥敦道333号加盛商业中心6层
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)', mt: 1, fontSize: '1rem' }}>
              6/F, Gamsun Commercial Centre, 333 Nathan Road, Kowloon, Hong Kong
            </Typography>
          </Paper>
        </Container>
      </Box>

      {/* 版权信息 */}
      <Box sx={{ py: 4, backgroundColor: '#050d18' }}>
        <Container maxWidth="lg">
          <Stack spacing={1} alignItems="center" textAlign="center">
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              <strong>技术支持：</strong>Airscend Media Communications Limited
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              版权归属：香港硕谷光核文化传播有限公司 / 深圳市硕谷光核科技文化有限公司
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default About;
