import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './theme/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
