// Three languages, picked from the browser. Each uses its own everyday wording.
import { load, save } from './storage';

export type Lang = 'zh-TW' | 'zh-CN' | 'en';
const S = {
  'zh-TW': {
    title: '地鐵跑酷', tagline: '閃過列車，一路狂奔', play: '開始', best: '最高紀錄', coinsTotal: '金幣',
    ctrlKeys: '←→ 或 A D 換軌　↑ W 空白鍵 跳　↓ S 滑行　Esc 暫停',
    ctrlTouch: '左右滑換軌　往上滑跳　往下滑滑行',
    tapToStart: '點一下或按空白鍵開始', paused: '暫停', resume: '繼續', restart: '重來', home: '回首頁',
    over: '被抓到了！', score: '分數', coins: '金幣', distance: '距離', newBest: '新紀錄！', again: '再玩一次',
    preparing: '準備中…', loading: '載入中', loadFail: '載入失敗，請重新整理',
    hintJumpKeys: '按 ↑ 跳過去', hintJumpTouch: '往上滑跳過去',
    hintSlideKeys: '按 ↓ 從下面滑過', hintSlideTouch: '往下滑從下面滑過',
    hintLaneKeys: '按 ← → 換軌閃開', hintLaneTouch: '左右滑換軌閃開',
    hintRamp: '跑上斜坡可以上車頂',
    magnet: '磁鐵', shoes: '彈簧鞋', double: '雙倍分數', careful: '小心！再撞一次就會被抓', mute: '靜音', sound: '音效',
    mult: '倍率', meters: '公尺', lang: '語言',
  },
  'zh-CN': {
    title: '地铁跑酷', tagline: '躲开列车，一路狂奔', play: '开始', best: '最高纪录', coinsTotal: '金币',
    ctrlKeys: '←→ 或 A D 换道　↑ W 空格 跳　↓ S 滑铲　Esc 暂停',
    ctrlTouch: '左右滑换道　上滑跳　下滑滑铲',
    tapToStart: '点一下或按空格开始', paused: '暂停', resume: '继续', restart: '重新开始', home: '返回首页',
    over: '被抓住了！', score: '得分', coins: '金币', distance: '距离', newBest: '新纪录！', again: '再来一局',
    preparing: '准备中…', loading: '加载中', loadFail: '加载失败，请刷新页面',
    hintJumpKeys: '按 ↑ 跳过去', hintJumpTouch: '上滑跳过去',
    hintSlideKeys: '按 ↓ 从下面滑过去', hintSlideTouch: '下滑从下面滑过去',
    hintLaneKeys: '按 ← → 换道躲开', hintLaneTouch: '左右滑换道躲开',
    hintRamp: '跑上斜坡就能上车顶',
    magnet: '磁铁', shoes: '弹簧鞋', double: '双倍得分', careful: '小心！再撞一次就会被抓住', mute: '静音', sound: '音效',
    mult: '倍数', meters: '米', lang: '语言',
  },
  en: {
    title: 'Subway Run', tagline: 'Dodge the trains. Keep running.', play: 'Play', best: 'Best', coinsTotal: 'Coins',
    ctrlKeys: '← → / A D change lane · ↑ W Space jump · ↓ S roll · Esc pause',
    ctrlTouch: 'Swipe left/right to change lane · up to jump · down to roll',
    tapToStart: 'Tap or press Space to start', paused: 'Paused', resume: 'Resume', restart: 'Restart', home: 'Home',
    over: 'Caught!', score: 'Score', coins: 'Coins', distance: 'Distance', newBest: 'New best!', again: 'Play again',
    preparing: 'Getting ready…', loading: 'Loading', loadFail: 'Could not load. Please refresh.',
    hintJumpKeys: 'Press ↑ to jump', hintJumpTouch: 'Swipe up to jump',
    hintSlideKeys: 'Press ↓ to roll under', hintSlideTouch: 'Swipe down to roll under',
    hintLaneKeys: 'Press ← → to dodge', hintLaneTouch: 'Swipe left or right to dodge',
    hintRamp: 'Run up the ramp onto the train',
    magnet: 'Magnet', shoes: 'Spring shoes', double: 'Double score', careful: 'Careful! One more hit and you are caught', mute: 'Mute', sound: 'Sound',
    mult: 'Multiplier', meters: 'm', lang: 'Language',
  },
};
export type Key = keyof (typeof S)['en'];

export function detectLang(): Lang {
  const saved = load<string | null>('lang', null);
  if (saved === 'zh-TW' || saved === 'zh-CN' || saved === 'en') return saved;
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((l) => l.toLowerCase());
  for (const l of list) {
    if (l.startsWith('zh')) {
      if (/hant|tw|hk|mo/.test(l)) return 'zh-TW';
      return 'zh-CN';
    }
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

let lang: Lang = detectLang();
export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  save('lang', l);
  document.documentElement.lang = l;
}
export const t = (k: Key) => S[lang][k];
export const LANGS: Lang[] = ['zh-TW', 'zh-CN', 'en'];
export const LANG_LABEL: Record<Lang, string> = { 'zh-TW': '繁中', 'zh-CN': '简中', en: 'EN' };
