import { Hooks } from 'snabbdom/hooks';
import { Puzzle } from './interfaces';
import { parseFen } from 'shogiops/fen';
import throttle from 'common/throttle';

export function bind(eventName: string, f: (e: Event) => any, redraw?: () => void): Hooks {
  return onInsert(el =>
    el.addEventListener(eventName, e => {
      const res = f(e);
      if (redraw) redraw();
      return res;
    })
  );
}

export function onInsert<A extends HTMLElement>(f: (element: A) => void): Hooks {
  return {
    insert: vnode => f(vnode.elm as A),
  };
}

export const getNow = (): number => Math.round(performance.now());

export const uciToLastMove = (uci: string): [Key, Key] | [Key] => {
  if(uci[1] === '*') return [uci.substr(2, 2) as Key];
  return [uci.substr(0, 2) as Key, uci.substr(2, 2) as Key];
}

export const puzzlePov = (puzzle: Puzzle) => parseFen(puzzle.fen).unwrap().turn;


const throttleSound = (name: string) => throttle(100, () => window.lishogi.sound[name]());
export const sound = {
  move: (take: boolean) => throttleSound(take ? 'capture' : 'move'),
  error: throttleSound('error'),
  wrong: throttleSound('capture'),
  good: throttleSound('check'),
  end: throttleSound('check'),
};
