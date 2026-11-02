/// <reference types="vite/client" />

declare module '*.net?raw' {
  const content: string;
  export default content;
}

declare module '*.sp?raw' {
  const content: string;
  export default content;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}
