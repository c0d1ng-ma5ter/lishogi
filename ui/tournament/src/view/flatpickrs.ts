import { h, VNode } from 'snabbdom';
import { adjustDateToLocal, adjustDateToUTC, formattedDate } from './util';

let fInstance;
export function flatpickrInput(
  disabled: boolean,
  scheduledAt: number | undefined,
  f: (date: Date) => void,
  utc: () => boolean
) {
  return h('input.flatpickr', {
    attrs: {
      disabled,
      placeholder: !disabled ? 'Suggest time for game' : '',
      'data-enable-time': 'true',
      'data-time_24h': 'true',
    },
    hook: {
      insert: (node: VNode) => {
        window.lishogi.flatpickr().done(() => {
          fInstance = window.flatpickr(node.elm, {
            minDate: 'today',
            maxDate: new Date(Date.now() + 1000 * 3600 * 24 * 31 * 3),
            dateFormat: 'U',
            altInput: true,
            altFormat: 'Z',
            formatDate: (date, format) => {
              if (utc()) date = adjustDateToLocal(date);

              if (format === 'U') return Math.floor(date.getTime()).toString();
              return formattedDate(date, utc());
            },
            parseDate: (dateString, format) => {
              console.log('parseDate', dateString, format, new Date(dateString));
              if (format === 'U') {
                return new Date(parseInt(dateString));
              }
              return new Date(dateString);
            },
            onChange: selectedDates => {
              f(selectedDates[0]);
            },
            disableMobile: true,
            position: 'above center',
            locale: document.documentElement.lang,
          });
          if (scheduledAt) {
            const scheduledDate = new Date(scheduledAt),
              finalDate = utc() ? adjustDateToUTC(scheduledDate) : scheduledDate;
            fInstance.setDate(finalDate, false);
            fInstance.altInput.value = formattedDate(scheduledDate, utc());
          }
        });
      },
      destroy: () => {
        if (fInstance) fInstance.destroy();
        fInstance = null;
      },
      postpatch: () => {
        if (fInstance && scheduledAt) {
          const scheduledDate = new Date(scheduledAt),
            finalDate = utc() ? adjustDateToUTC(scheduledDate) : scheduledDate;

          fInstance.setDate(finalDate, false);
          fInstance.altInput.value = formattedDate(scheduledDate, utc());
        }
      },
    },
  });
}
