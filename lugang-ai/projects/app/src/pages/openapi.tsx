import dynamic from 'next/dynamic';
import { Box } from '@chakra-ui/react';

const OpenApiReference = dynamic(() => import('@/components/OpenApiReference'), { ssr: false });

function OpenAPIPage() {
  return (
    <Box w="100vw" h="100vh" overflow="auto">
      <OpenApiReference />
    </Box>
  );
}

export async function getServerSideProps() {
  return {
    props: {}
  };
}

export default OpenAPIPage;
