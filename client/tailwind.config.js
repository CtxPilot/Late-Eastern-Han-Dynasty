// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

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
 *   统一收口至 StonePanel/SealButton 组件库（批次②）处理。
 * 详见 ArtDirection.md §1.2 使用纪律、§3.2 按钮层级。
 *
 * 注意：Session 185 曾把「具名色不生效」误诊为 Tailwind v3.4 ESM 合并问题；
 * Session 407 复核确认根因是结构级笔误——色组被放在 theme.extend 顶层而非
 * theme.extend.colors 下，类名从未生成。现已移入 colors 键，bg-seal-600 等类名
 * 正常生成（构建产物可验证）；语义 accent 同时保留 index.css 的 --accent-* CSS
 * 变量（AccSection 等继续引用，双通道等值）。
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
        // —— 文字色（ArtDirection.md §1.1 text-100 墨文 / text-300 沉文；
        //    取名 wen 避免与 Tailwind 字号类 text-* 混淆）——
        wen: {
          100: '#E8E0CE', // 深色底主文字（暖白）
          300: '#A8A29E', // 次要文字
        },
        // —— 语义别名（ArtDirection.md §1.2：军=朱红 / 政=金 / 人=宣 / 谍=青）——
        // 这些不是新色，是把具名色按"领域语义"再命名，供 AccSection 等组件按域引用。
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
