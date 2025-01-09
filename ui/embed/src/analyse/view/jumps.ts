import { h, VNode } from 'snabbdom';
import { AnalyseCtrl } from '../ctrl';
import { onInsert } from 'common/snabbdom';
import { bindMobileMousedown } from 'common/mobile';

export function renderJumps(ctrl: AnalyseCtrl): VNode {
  const canJumpPrev = ctrl.path !== '',
    canJumpNext = !!ctrl.node.children[0];
  return h(
    'div.analyse__controls.analyse-controls',
    h(
      'div.jumps',
      {
        hook: onInsert(el => {
          bindMobileMousedown(
            el,
            e => {
              const action = dataAct(e);
              if (action === 'prev') ctrl.prev();
              else if (action === 'next') ctrl.next();
            },
            ctrl.redraw,
          );
        }),
      },
      [jumpButton('Y', 'prev', canJumpPrev), jumpButton('X', 'next', canJumpNext)],
    ),
  );
}

function jumpButton(icon: string, effect: 'prev' | 'next', enabled: boolean): VNode {
  return h('button.fbt', {
    class: { disabled: !enabled },
    attrs: { 'data-act': effect, 'data-icon': icon },
  });
}

function dataAct(e: Event): string | null {
  const target = e.target as HTMLElement;
  return (
    target.getAttribute('data-act') || (target.parentNode as HTMLElement).getAttribute('data-act')
  );
}
