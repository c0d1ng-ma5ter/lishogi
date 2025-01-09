import { spinnerHtml } from 'common/spinner';
import * as domData from 'common/data';

export function loadInfiniteScroll(sel: string): void {
  document.querySelectorAll(sel).forEach(el => {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'page-load-status';
    statusDiv.innerHTML = `<div id="infscr-loading" class="infinite-scroll-request">${spinnerHtml}</div>`;
    el.append(statusDiv);

    if (!el.querySelector('.pager a')) return;

    const infScroll = new window.InfiniteScroll(el, {
      path: '.pager a',
      append: '.infinitescroll .paginated',
      history: false,
      status: '.page-load-status',
      hideNav: '.pager',
    });

    domData.set(el, 'infinite-scroll', infScroll);

    infScroll.on('error', function () {
      document.getElementById('infscr-loading')?.remove();
    });

    infScroll.on('append', function () {
      window.lishogi.pubsub.emit('content_loaded');
      const ids: string[] = [];
      el.querySelectorAll('.paginated[data-dedup]').forEach((dedupEL: HTMLElement) => {
        const id = dedupEL.dataset.dedup;
        if (id) {
          if (ids.includes(id)) dedupEL.remove();
          else ids.push(id);
        }
      });
    });

    const parent = el.parentElement!;

    // Create and append a new button
    const moreButton = document.createElement('button');
    moreButton.className = 'inf-more button button-empty';
    moreButton.textContent = '…';
    moreButton.addEventListener('click', function () {
      infScroll.loadNextPage();
    });

    parent.appendChild(moreButton);
  });
}
