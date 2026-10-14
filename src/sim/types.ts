export type ObKind = 'low' | 'hurdle' | 'overhead' | 'train' | 'ramp';
export type PowerKind = 'magnet' | 'shoes' | 'double';
export type Hint = 'jump' | 'slide' | 'lane' | 'ramp';

export interface Ob {
  id: number;
  kind: ObKind;
  lane: number;
  d0: number; // near end (absolute distance along the track)
  d1: number; // far end
  yb: number; // solid from this height ...
  yt: number; // ... to this height
  halfW: number;
  walk: boolean; // can be stood on
  cars: number; // trains: number of cars
  variant: number;
  hint: Hint | null;
  hinted: boolean;
}

export interface Coin {
  id: number;
  lane: number;
  d: number;
  y: number;
  x: number; // usually laneX(lane); moves when pulled by the magnet
  pulled: boolean;
}

export interface Power {
  id: number;
  kind: PowerKind;
  lane: number;
  d: number;
  y: number;
}

export type SimEvent =
  | { type: 'jump'; super: boolean }
  | { type: 'land'; fall: number }
  | { type: 'slide' }
  | { type: 'lane'; dir: number }
  | { type: 'bump'; dir: number }
  | { type: 'stumble'; x: number; y: number }
  | { type: 'crash'; kind: ObKind | 'caught'; x: number; y: number }
  | { type: 'coin'; x: number; y: number; streak: number }
  | { type: 'power'; kind: PowerKind; x: number; y: number }
  | { type: 'powerEnd'; kind: PowerKind }
  | { type: 'hint'; hint: Hint }
  | { type: 'level'; mult: number };
