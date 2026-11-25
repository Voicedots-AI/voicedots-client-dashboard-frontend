import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'mentor-release.spec.ts',workers:1,timeout:45000,expect:{timeout:15000},use:{baseURL:'http://127.0.0.1:5196'},webServer:[
{command:'npm run dev -- --host 127.0.0.1 --port 5196 --strictPort',url:'http://127.0.0.1:5196',reuseExistingServer:true},
{command:'npm run dev -- --host 127.0.0.1 --port 5197 --strictPort',cwd:'../mentor-collaboration-20261114-student',url:'http://127.0.0.1:5197',reuseExistingServer:true}]});
