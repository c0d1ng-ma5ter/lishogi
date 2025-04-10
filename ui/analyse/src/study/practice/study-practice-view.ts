import { richHTML } from 'common/rich-text';
import { type MaybeVNodes, bind, bindNonPassive } from 'common/snabbdom';
import spinner from 'common/spinner';
import { type VNode, h, thunk } from 'snabbdom';
import { boolSetting } from '../../bool-setting';
import { option, plural } from '../../util';
import { view as descView } from '../description';
import type { StudyCtrl } from '../interfaces';
import type { StudyPracticeCtrl, StudyPracticeData } from './interfaces';

function selector(data: StudyPracticeData) {
  return h(
    'select.selector',
    {
      hook: bind('change', e => {
        location.href = `/practice/${(e.target as HTMLInputElement).value}`;
      }),
    },
    [
      h(
        'option',
        {
          attrs: { disabled: true, selected: true },
        },
        'Practice list',
      ),
      ...data.structure.map(section =>
        h(
          'optgroup',
          {
            attrs: { label: section.name },
          },
          section.studies.map(study =>
            option(`${section.id}/${study.slug}/${study.id}`, '', study.name),
          ),
        ),
      ),
    ],
  );
}

function renderGoal(practice: StudyPracticeCtrl, inMoves: number) {
  const goal = practice.goal();
  switch (goal.result) {
    case 'mate':
      return 'Checkmate the opponent';
    case 'mateIn':
      return `Checkmate the opponent in ${plural('move', inMoves)}`;
    case 'drawIn':
      return `Hold the draw for ${plural('more move', inMoves)}`;
    case 'equalIn':
      return `Equalize in ${plural('move', inMoves)}`;
    case 'evalIn':
      if (practice.isSente() === goal.cp! >= 0)
        return `Get a winning position in ${plural('move', inMoves)}`;
      return `Defend for ${plural('move', inMoves)}`;
    case 'promotion':
      return 'Safely promote your pawn';
    default:
      return undefined;
  }
}

export function underboard(ctrl: StudyCtrl): MaybeVNodes {
  if (ctrl.vm.loading) return [h('div.feedback', spinner())];
  const p = ctrl.practice!;
  const gb = ctrl.gamebookPlay();
  const pinned = ctrl.data.chapter.description;
  if (gb)
    return pinned
      ? [h('div.feedback.ongoing', [h('div.comment', { hook: richHTML(pinned) })])]
      : [];
  else if (!ctrl.data.chapter.practice) return [descView(ctrl, true)];
  switch (p.success()) {
    case true: {
      const next = ctrl.nextChapter();
      return [
        h(
          'a.feedback.win',
          next
            ? {
                hook: bind('click', p.goToNext),
              }
            : {
                attrs: { href: '/practice' },
              },
          [
            h('span', 'Success!'),
            ctrl.nextChapter() ? 'Go to next exercise' : 'Back to practice menu',
          ],
        ),
      ];
    }
    case false:
      return [
        h(
          'a.feedback.fail',
          {
            hook: bind('click', p.reset, ctrl.redraw),
          },
          [h('span', [renderGoal(p, p.goal().moves!)]), h('strong', 'Click to retry')],
        ),
      ];
    default:
      return [
        h('div.feedback.ongoing', [
          h('div.goal', [renderGoal(p, p.goal().moves! - p.nbMoves())]),
          pinned ? h('div.comment', { hook: richHTML(pinned) }) : null,
        ]),
        boolSetting(
          {
            name: 'Load next exercise immediately',
            id: 'autoNext',
            checked: p.autoNext(),
            change: p.autoNext,
          },
          ctrl.redraw,
        ),
      ];
  }
}

export function side(ctrl: StudyCtrl): VNode {
  const current = ctrl.currentChapter();
  const data = ctrl.practice!.data;

  return h('div.practice__side', [
    h('div.practice__side__title', [
      h(`i.${data.study.id}`),
      h('div.text', [h('h1', data.study.name), h('em', data.study.desc)]),
    ]),
    h(
      'div.practice__side__chapters',
      {
        hook: bindNonPassive('click', e => {
          e.preventDefault();
          const target = e.target as HTMLElement;
          const id =
            (target.parentNode as HTMLElement).getAttribute('data-id') ||
            target.getAttribute('data-id');
          if (id) ctrl.setChapter(id, true);
          return false;
        }),
      },
      ctrl.chapters
        .list()
        .map(chapter => {
          const loading = ctrl.vm.loading && chapter.id === ctrl.vm.nextChapterId;
          const active = !ctrl.vm.loading && current && current.id === chapter.id;
          const completion = data.completion[chapter.id] >= 0 ? 'done' : 'ongoing';
          return [
            h(
              'a.ps__chapter',
              {
                key: chapter.id,
                attrs: {
                  href: `${data.url}/${chapter.id}`,
                  'data-id': chapter.id,
                },
                class: { active, loading },
              },
              [
                h(`span.status.${completion}`, {
                  attrs: {
                    'data-icon': (loading || active) && completion === 'ongoing' ? 'G' : 'E',
                  },
                }),
                h('h3', chapter.name),
              ],
            ),
          ];
        })
        .reduce((a, b) => a.concat(b), []),
    ),
    h('div.finally', [
      h('a.back', {
        attrs: {
          'data-icon': 'I',
          href: '/practice',
          title: 'More practice',
        },
      }),
      thunk('select.selector', selector, [data]),
    ]),
  ]);
}
