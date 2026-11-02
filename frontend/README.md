# frontend

React + TypeScript (Vite). Only `src/` is laid out so far. `package.json`, `tsconfig`,
`index.html` and `vite.config.ts` come from Vite scaffolding when implementation starts;
`vite.config.ts` will then proxy `/api` to the backend (http://localhost:8000) so the app
and API share one origin (session cookie works, no CORS).
