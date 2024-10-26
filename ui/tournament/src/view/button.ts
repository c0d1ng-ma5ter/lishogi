import { bind, MaybeVNode } from 'common/snabbdom';
import spinner from 'common/spinner';
import { h } from 'snabbdom';
import TournamentController from '../ctrl';
import { isIn } from '../tournament';

function orJoinSpinner(ctrl: TournamentController, f: () => MaybeVNode): MaybeVNode {
  return ctrl.joinSpinner ? spinner() : f();
}

export function withdraw(ctrl: TournamentController): MaybeVNode {
  return orJoinSpinner(ctrl, () => {
    const candidate = ctrl.data.isCandidate,
      pause = ctrl.data.isStarted && !candidate,
      title = ctrl.trans.noarg(pause ? 'pause' : 'withdraw');

    if (pause && !ctrl.isArena()) return;
    const button = h(
      'button.fbt.text',
      {
        attrs: {
          title: title,
          'data-icon': pause ? 'Z' : 'b',
        },
        hook: bind('click', ctrl.withdraw, ctrl.redraw),
      },
      !candidate ? title : undefined
    );
    if (candidate) return h('div.waiting', [h('span', ctrl.trans.noarg('waitingForApproval' as I18nKey)), button]);
    else return button;
  });
}

export function join(ctrl: TournamentController): MaybeVNode {
  return orJoinSpinner(ctrl, () => {
    const askToJoin = ctrl.data.candidatesOnly && !ctrl.data.me,
      delay = ctrl.data.me && ctrl.data.me.pauseDelay,
      joinable = ctrl.data.verdicts.accepted && !delay && !ctrl.data.isBot,
      highlightable = joinable && ctrl.data.createdBy !== ctrl.opts.userId,
      button = h(
        'button.fbt.text' + (highlightable ? '.highlight' : ''),
        {
          attrs: {
            disabled: !joinable,
            'data-icon': 'G',
          },
          hook: bind(
            'click',
            _ => {
              if (ctrl.data.private && !ctrl.data.me) {
                const p = prompt(ctrl.trans.noarg('password'));
                if (p !== null) ctrl.join(p);
              } else ctrl.join();
            },
            ctrl.redraw
          ),
        },
        askToJoin ? ctrl.trans.noarg('askToJoin' as I18nKey) : ctrl.trans.noarg('join')
      );
    return delay
      ? h(
          'div.delay-wrap',
          {
            attrs: { title: 'Waiting to be able to re-join the tournament' },
          },
          [
            h(
              'div.delay',
              {
                hook: {
                  insert(vnode) {
                    const el = vnode.elm as HTMLElement;
                    el.style.animation = `tour-delay ${delay}s linear`;
                    setTimeout(() => {
                      if (delay === ctrl.data.me.pauseDelay) {
                        ctrl.data.me.pauseDelay = 0;
                        ctrl.redraw();
                      }
                    }, delay * 1000);
                  },
                },
              },
              button
            ),
          ]
        )
      : button;
  });
}

export function joinWithdraw(ctrl: TournamentController): MaybeVNode {
  if (!ctrl.opts.userId)
    return h(
      'a.fbt.text.highlight',
      {
        attrs: {
          href: '/login?referrer=' + window.location.pathname,
          'data-icon': 'G',
        },
      },
      ctrl.trans.noarg('signIn')
    );
  if (ctrl.data.isDenied) return h('div.fbt.denied', ctrl.trans.noarg('denied' as I18nKey));
  else if (!ctrl.data.isFinished) return isIn(ctrl) || ctrl.data.isCandidate ? withdraw(ctrl) : join(ctrl);
}

export function managePlayers(ctrl: TournamentController): MaybeVNode {
  if (ctrl.isCreator() && !ctrl.data.isFinished)
    return h(
      'button.fbt.manage-player.data-count',
      {
        class: {
          text: !ctrl.isOrganized(),
        },
        attrs: {
          disabled: ctrl.data.isFinished,
          'data-icon': 'f',
          'data-count': ctrl.data.candidates?.length || 0,
        },
        hook: bind('click', () => (ctrl.playerManagement = !ctrl.playerManagement), ctrl.redraw),
      },
      !ctrl.isOrganized() ? ctrl.trans.noarg('managePlayers' as I18nKey) : undefined
    );
}
