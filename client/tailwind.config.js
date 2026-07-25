/** @type {import('tailwindcss').Config} */
/**
 * 色板真源：docs/design/ArtDirection.md（Session 184 建立）。
 * 本配置注册四套具名色（ink / paper / seal / gold）+ 四个语义别名
 * （military 军 / civil 政 / personnel 人 / intel 谍）。
 *
 * 落地纪律：
 * - ink-* 与 Tailwind 默认 stone-* 同值，是「语义重命名」而非视觉改动（零重构成本）。
 * - seal-600 是第一强调色，一屏 ≤2 处，禁滥用；主令按钮/印章/危险前置专用。
 * - military/intel/personnel/civil 是按域分类的语义色，禁止按界面位置轮换跳色。
 * - 散布在各组件中的 stone-/amber- 直写类名属遗留并存态（值同，无视觉撕裂），
 *   统一收口至 StonePanel/SealButton 组件库（Step 4）处理；本轮只新设骨架不强制全量替换。
 * 详见 ArtDirection.md §1.2 使用纪律、§3.2 按钮层级。
 *
 * 注意：Tailwind v3.4 在 package.json type=module 的 ESM config 下不合并
 * theme.extend.colors 自定义色（默认色如 amber/rose/sky 仍正常生成），经 Session 185
 * 对照实验坐实。故四套具名色 + 四语义别名在此保留作文档真源与未来 Tailwind 版本修复后
 * 的落地锚点，但当前渲染走 client/src/index.css 的 --accent-* CSS 变量 +
 * AccSection inline style（见 index.css :root + AccSection.tsx）。
 */
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
      // —— 色板 token（ArtDirection.md §1.1）——
      // ink：墨色阶梯（与 stone 同值，语义重命名）
      ink: {
        950: '#0C0A09',
        900: '#1C1917',
        800: '#292524',
        700: '#44403C',
        600: '#57534E',
      },
      // paper：宣纸系（头像/简册/战报纸面）
      paper: {
        100: '#F5EBD0',
        300: '#C7AE7A',
        700: '#6B4E2C',
      },
      // seal：朱砂系（第一强调，稀缺资源）
      seal: {
        600: '#A61919',
        400: '#C6402A',
        900: '#7F1D1D', // 深朱：不可逆操作（宣战/处决）
      },
      // gold：金印系（第二强调，金边/爵位/选中描边）
      gold: {
        400: '#D7AA62',
        200: '#FDE68A', // 与 amber-200 同值
        900: '#78350F', // 与 amber-900 同值
      },
      // —— 语义别名（ArtDirection.md §1.2：军=朱红 / 政=金 / 人=宣 / 谍=青）——
      // 这些不是新色，是把上述具名色按"领域语义"再命名，供 AccSection 等组件按域引用。
      // 值刻意贴近现有跳色（rose/sky/amber/emerald），使本轮跳色统一零视觉跳变。
      military: {
        400: '#F87171', // = red-400，军类 accent 文字
        900: '#7F1D1D', // = red-900，军类边框/底
      },
      civil: {
        400: '#FBBF24', // = amber-400，政类 accent 文字
        900: '#78350F', // = amber-900，政类边框/底
      },
      personnel: {
        300: '#C7AE7A', // = paper-300，人/家族暖宣色
        700: '#6B4E2C', // = paper-700
      },
      intel: {
        400: '#38BDF8', // = sky-400，谍/情报青色 accent
        900: '#0C4A6E', // = sky-900，谍类边框
      },
    },
  },
  plugins: [],
};