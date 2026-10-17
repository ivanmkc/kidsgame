// Minimal declaration: @types/react-dom is not a dependency and tests
// only need createRoot to mount and unmount components for effect tests.
declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: unknown): Root;
}
