import {defineConfig} from '@playwright/test';
const port=Number(process.env.STRENGTH_TEST_PORT||5194);
export default defineConfig({testDir:'./tests',testMatch:'strength-gap-popover.spec.ts',use:{baseURL:`http://127.0.0.1:${port}`},webServer:{command:`npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}});
