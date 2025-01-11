import { defined } from 'common/common';
import { type MaybeVNode, onInsert } from 'common/snabbdom';
import { h } from 'snabbdom';
import type AnalyseCtrl from './ctrl';
import type { ConcealOf } from './interfaces';
import { renderIndexAndMove } from './move-view';

export interface ForkCtrl {
  state(): {
    node: Tree.Node;
    selected: number;
    displayed: boolean;
  };
  next: () => boolean | undefined;
  prev: () => boolean | undefined;
  proceed: (it?: number) => boolean | undefined;
}

export function make(root: AnalyseCtrl): ForkCtrl {
  let prev: Tree.Node | undefined;
  let selected = 0;
  function displayed() {
    return root.node.children.length > 1;
  }
  return {
    state() {
      const node = root.node;
      if (!prev || prev.id !== node.id) {
        prev = node;
        selected = 0;
      }
      return {
        node,
        selected,
        displayed: displayed(),
      };
    },
    next() {
      if (displayed()) {
        selected = Math.min(root.node.children.length - 1, selected + 1);
        return true;
      }
      return undefined;
    },
    prev() {
      if (displayed()) {
        selected = Math.max(0, selected - 1);
        return true;
      }
      return undefined;
    },
    proceed(it) {
      if (displayed()) {
        it = defined(it) ? it : selected;
        root.userJumpIfCan(root.path + root.node.children[it].id);
        return true;
      }
      return undefined;
    },
  };
}

export function view(root: AnalyseCtrl, concealOf?: ConcealOf): MaybeVNode {
  if (root.embed || root.retro) return;
  const state = root.fork.state();
  if (!state.displayed) return;
  const isMainline = concealOf && root.onMainline;
  return h(
    'div.analyse__fork',
    {
      hook: onInsert(el => {
        el.addEventListener('click', e => {
          const target = e.target as HTMLElement;
          const it = Number.parseInt(
            (target.parentNode as HTMLElement).getAttribute('data-it') ||
              target.getAttribute('data-it') ||
              '',
          );
          root.fork.proceed(it);
          root.redraw();
        });
      }),
    },
    state.node.children.map((node, it) => {
      const conceal = isMainline && concealOf!(true)(root.path + node.id, node);
      if (!conceal)
        return h(
          'move',
          {
            class: { selected: it === state.selected },
            attrs: { 'data-it': it },
          },
          renderIndexAndMove(
            {
              variant: root.data.game.variant.key,
              withDots: true,
              showEval: root.showComputer(),
              showGlyphs: root.showComputer(),
              offset: root.plyOffset(),
            },
            node,
          )!,
        );
      return undefined;
    }),
  );
}
