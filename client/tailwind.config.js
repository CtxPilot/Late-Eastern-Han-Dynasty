/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,tsx}'],
  theme: {
    extend: {
      // 跨平台字体铁律：工程内部别名，禁止回退宿主系统字库
      // 详见 client/src/styles/fonts.css + client/public/fonts/README.md
      fontFamily: {
        song: ['HanDynastySerif', 'serif'],   // 正文 / 古籍
        seal: ['HanDynastySeal', 'serif'],     // 官印 / 篆书 / 大标题
      },
    },
  },
  plugins: [],
};
