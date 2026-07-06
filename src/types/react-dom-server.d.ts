// Minimal declaration: @types/react-dom is not a dependency and the test
// suite only needs renderToString for SSR smoke-rendering components.
declare module 'react-dom/server' {
  import type { ReactElement } from 'react';
  export function renderToString(element: ReactElement): string;
}
