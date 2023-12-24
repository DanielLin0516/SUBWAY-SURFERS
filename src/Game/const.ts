export const enum playerStatus {
  INIT = 'idle', // 站立
  JUMP = 'jump', // 起跳
  RUN = 'run', // 跑步
  ROLL = 'roll', // 下滚
  DANCE = 'dance', // 跳舞
  LOOKBACK = 'lookback', // 回头看
  RUNLOOKBACK = 'runlookback', // 回头看
  FALL = 'fall', // 下落
  DIE = 'die', // 下落
}
export const Obstacal: any = {
  train: {
      x: 5.646066284179687,
      y: 8.351531163230542,
      z: 16.539642333984375,
  },
  kerbStone: {
      x: 3.7279505729675293,
      y: 3.6123956470692073,
      z: 3.989417910575868,
  },
};

export const enum GAME_STATUS {
  READY = 'ready',
  START = 'start',
  PAUSE = 'pause',
  END = 'end',
}
