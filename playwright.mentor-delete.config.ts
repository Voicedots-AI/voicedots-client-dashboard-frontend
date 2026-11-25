import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'mentor-delete.spec.ts',workers:1,timeout:60000,expect:{timeout:20000},use:{baseURL:'http://127.0.0.1:5198'},webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5198 --strictPort',url:'http://127.0.0.1:5198',reuseExistingServer:false}});
