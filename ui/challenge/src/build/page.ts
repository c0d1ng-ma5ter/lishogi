function main(opts: any): void {
  let accepting: boolean;
  const $el = $('.challenge-page');

  window.lishogi.socket = new window.lishogi.StrongSocket(opts.socketUrl, opts.data.socketVersion, {
    options: {
      name: 'challenge',
    },
    events: {
      reload: function () {
        window.lishogi.xhr.text('GET', opts.xhrUrl).then(html => {
          $el.replaceWith($(html).find($el));
          init();
        });
      },
    },
  });

  function init() {
    if (!accepting)
      $('#challenge-redirect').each(function () {
        location.href = $(this).attr('href');
      });
    $el.find('form.accept').submit(function () {
      accepting = true;
      $(this).html('<span class="ddloader"></span>');
    });
    $el.find('form.xhr').submit(function (this: HTMLFormElement, e) {
      e.preventDefault();
      window.lishogi.xhr.formToXhr(this);
      $(this).html('<span class="ddloader"></span>');
    });
    $el.find('input.friend-autocomplete').each(function () {
      const $input = $(this);
      window.lishogi.userAutocomplete($input, {
        focus: 1,
        friend: 1,
        tag: 'span',
        onSelect: function () {
          $input.parents('form').submit();
        },
      });
    });
  }

  init();

  function pingNow() {
    if (document.getElementById('ping-challenge')) {
      try {
        window.lishogi.socket.send('ping');
      } catch (e) {}
      setTimeout(pingNow, 9000);
    }
  }

  pingNow();
}

window.lishogi.registerModule(__bundlename__, main);
