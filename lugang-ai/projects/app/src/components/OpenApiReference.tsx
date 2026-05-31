import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

export default function OpenApiReference() {
  return (
    <ApiReferenceReact
      configuration={{
        hideDarkModeToggle: true,
        hideClientButton: true,
        theme: 'default',
        spec: {
          url: '/api/openapi.json'
        }
      }}
    />
  );
}
