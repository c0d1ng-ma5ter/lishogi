import { VNode, h } from 'snabbdom';
import { MaybeVNode } from 'common/snabbdom';
import { nextStage } from '../../categories';
import LearnCtrl from '../../ctrl';
import { average } from '../../util';
import { i18n, i18nFormat } from 'i18n';

function makeStars(score: number): VNode[] {
  const stars = [];
  for (let i = 0; i < score; i++) stars.push(h('div.star-wrap', h('i.star')));
  return stars;
}

export default function (ctrl: LearnCtrl): MaybeVNode {
  if (!ctrl.vm) return;
  const stage = ctrl.vm.stage,
    next = nextStage(stage.id),
    stars = Math.floor(average(ctrl.progress.get(stage.key)));
  return h(
    'div.learn__screen-overlay.completed',
    {
      on: {
        click: () => {
          if (ctrl.vm) ctrl.vm.stageState = 'end';
          ctrl.redraw();
        },
      },
    },
    h('div.learn__screen', [
      h('div.stars', makeStars(stars)),
      h('h1', i18nFormat('learn:stageXComplete', stage.id)),
      h('p', stage.complete),
      h('div.buttons', [
        next
          ? h(
              'a.next',
              {
                on: {
                  click: () => {
                    ctrl.nextLesson();
                    ctrl.redraw();
                  },
                },
              },
              [i18n('learn:next') + ': ', next.title + ' ', h('i', { attrs: { 'data-icon': 'H' } })]
            )
          : null,
        h(
          'a.back.text',
          {
            dataset: {
              icon: 'I',
            },
            on: {
              click: () => {
                ctrl.setHome();
                ctrl.redraw();
              },
            },
          },
          i18n('learn:backToMenu')
        ),
      ]),
    ])
  );
}
