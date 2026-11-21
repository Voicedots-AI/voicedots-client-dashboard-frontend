import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'strength-gap-popover.spec.ts',use:{baseURL:'http://127.0.0.1:5194'},webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5194 --strictPort',url:'http://127.0.0.1:5194'}});
