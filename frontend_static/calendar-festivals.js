/* Chinese festival labels, not statutory leave/workday arrangements.
 * Offline calendar arithmetic: lunar-javascript 1.7.7 (MIT, vendored).
 * Date fixtures checked against https://www.hko.gov.hk/tc/gts/time/conversion.htm
 */
const CalendarFestivals = (() => {
  const solarFestivals = {
    '01-01': '元旦', '03-08': '妇女节', '03-12': '植树节',
    '05-01': '劳动节', '05-04': '青年节', '06-01': '儿童节',
    '07-01': '建党节', '08-01': '建军节', '09-10': '教师节', '10-01': '国庆节',
  };
  const lunarFestivals = {
    '1-1': '春节', '1-15': '元宵节', '2-2': '龙抬头', '5-5': '端午节',
    '7-7': '七夕', '7-15': '中元节', '8-15': '中秋节', '9-9': '重阳节', '12-8': '腊八节',
  };
  const cache = new Map();
  function label(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return '';
    if (cache.has(day)) return cache.get(day);
    const names = [];
    const fixed = solarFestivals[day.slice(5)];
    if (fixed) names.push(fixed);
    try {
      const [year, month, date] = day.split('-').map(Number);
      const solar = Solar.fromYmd(year, month, date);
      const lunar = solar.getLunar();
      // Leap months are negative: do not celebrate a festival twice in a leap year.
      const lunarName = lunarFestivals[lunar.getMonth() + '-' + lunar.getDay()];
      if (lunarName) names.push(lunarName);
      if (lunar.getMonth() === 12 && lunar.getDay() >= 29) {
        const next = solar.next(1).getLunar();
        if (next.getMonth() === 1 && next.getDay() === 1) names.push('除夕');
      }
      const term = lunar.getJieQi();
      if (term === '清明') names.push('清明节');
      if (term === '冬至') names.push('冬至');
    } catch (_) {
      // A missing/corrupt optional calendar asset must not break personal schedules.
    }
    const result = [...new Set(names)].join('·');
    if (cache.size >= 2000) cache.clear();
    cache.set(day, result);
    return result;
  }
  return { label };
})();
