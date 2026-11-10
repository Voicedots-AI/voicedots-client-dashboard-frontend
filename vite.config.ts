import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({mode}) => {
  const env=loadEnv(mode,process.cwd(),'');
  return {
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {'/api':{target:env.CLIENT_API_PROXY_TARGET||'http://127.0.0.1:8007',changeOrigin:true,rewrite:(path:string)=>path.replace(/^\/api/,'')}}
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  };
})
