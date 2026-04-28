import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // サーバー上のどのフォルダ（階層）に置いても、画像やプログラムが正しく読み込まれるように
  // パスを相対形式「./」に設定します。
  base: './', 
})
