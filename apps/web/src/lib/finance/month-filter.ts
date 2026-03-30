import { formatISO, subMonths } from 'date-fns';

export type MonthFilterState = {
  monthFilter: string;
  startDate: string;
  endDate: string;
};

export const buildDateRangeForMonth = (
  monthValue: string
): Pick<MonthFilterState, 'startDate' | 'endDate'> => {
  const [year, month] = monthValue.split('-');
  if (!year || !month) {
    return { startDate: '', endDate: '' };
  }

  const parsedYear = Number.parseInt(year, 10);
  const parsedMonth = Number.parseInt(month, 10);
  if (!parsedYear || !parsedMonth) {
    return { startDate: '', endDate: '' };
  }

  const monthLabel = String(parsedMonth).padStart(2, '0');
  const lastDay = new Date(parsedYear, parsedMonth, 0).getDate();

  return {
    startDate: `${parsedYear}-${monthLabel}-01`,
    endDate: `${parsedYear}-${monthLabel}-${String(lastDay).padStart(2, '0')}`,
  };
};

export const buildMonthFilterState = (monthValue: string): MonthFilterState => ({
  monthFilter: monthValue,
  ...buildDateRangeForMonth(monthValue),
});

export const getCurrentMonthValue = (baseDate: Date = new Date()) =>
  formatISO(baseDate, { representation: 'date' }).slice(0, 7);

export const getCurrentMonthFilterState = (baseDate: Date = new Date()) =>
  buildMonthFilterState(getCurrentMonthValue(baseDate));

export const getPreviousMonthFilterState = (baseDate: Date = new Date()) =>
  buildMonthFilterState(getCurrentMonthValue(subMonths(baseDate, 1)));

export const normalizeMonthFilterFromRange = (startValue: string, endValue: string) => {
  const [startYear, startMonth, startDay] = startValue.split('-');
  const [endYear, endMonth, endDay] = endValue.split('-');

  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
    return '';
  }

  if (startYear !== endYear || startMonth !== endMonth || startDay !== '01') {
    return '';
  }

  const lastDay = new Date(Number(startYear), Number(startMonth), 0).getDate();
  const expectedEndDay = String(lastDay).padStart(2, '0');

  if (endDay !== expectedEndDay) {
    return '';
  }

  return `${startYear}-${startMonth}`;
};
