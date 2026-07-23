import { useState } from 'react';
import Drawer from '../shared/Drawer';

const defaultStatusOptions = [
  { value: '', label: '全部狀態' },
  { value: 'high', label: '高風險' },
  { value: 'medium', label: '中風險' },
  { value: 'normal', label: '一般' },
];

export default function DashboardFilterBar({
  query = '',
  onQueryChange,
  status = '',
  onStatusChange,
  statusOptions = defaultStatusOptions,
  direction = '',
  onDirectionChange,
  directionOptions = [],
  risk = '',
  onRiskChange,
  riskOptions = [],
  market = '',
  onMarketChange,
  marketOptions = [],
  product = '',
  onProductChange,
  productOptions = [],
  dateFrom = '',
  dateTo = '',
  onDateFromChange,
  onDateToChange,
  onClear,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ query, status, direction, risk, market, product, dateFrom, dateTo });

  function openMobileFilters() {
    setDraft({ query, status, direction, risk, market, product, dateFrom, dateTo });
    setOpen(true);
  }

  function applyMobileFilters() {
    onQueryChange?.(draft.query);
    onStatusChange?.(draft.status);
    onDirectionChange?.(draft.direction);
    onRiskChange?.(draft.risk);
    onMarketChange?.(draft.market);
    onProductChange?.(draft.product);
    onDateFromChange?.(draft.dateFrom);
    onDateToChange?.(draft.dateTo);
    setOpen(false);
  }

  function clearMobileFilters() {
    const cleared = { query: '', status: '', direction: '', risk: '', market: '', product: '', dateFrom: '', dateTo: '' };
    setDraft(cleared);
    onClear?.();
  }

  function FilterFields({ mobile = false }) {
    const values = mobile ? draft : { query, status, direction, risk, market, product, dateFrom, dateTo };
    const update = (key, value) => {
      if (mobile) {
        setDraft((current) => ({ ...current, [key]: value }));
        return;
      }
      const handlers = {
        query: onQueryChange,
        status: onStatusChange,
        direction: onDirectionChange,
        risk: onRiskChange,
        market: onMarketChange,
        product: onProductChange,
        dateFrom: onDateFromChange,
        dateTo: onDateToChange,
      };
      handlers[key]?.(value);
    };

    return (
      <div className="dashboard-filter-fields">
        {onQueryChange && (
          <label>
            關鍵字
            <input
              value={values.query}
              onChange={(event) => update('query', event.target.value)}
              placeholder="搜尋品項或市場"
            />
          </label>
        )}

        {onStatusChange && (
          <label>
            狀態
            <select
              value={values.status}
              onChange={(event) => update('status', event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        )}

        {onDirectionChange && (
          <label>
            方向
            <select
              value={values.direction}
              onChange={(event) => update('direction', event.target.value)}
            >
              <option value="">全部方向</option>
              {directionOptions.map((option) => (
                <option key={option.value ?? option} value={option.value ?? option}>
                  {option.label ?? option}
                </option>
              ))}
            </select>
          </label>
        )}

        {onRiskChange && (
          <label>
            風險
            <select
              value={values.risk}
              onChange={(event) => update('risk', event.target.value)}
            >
              <option value="">全部風險</option>
              {riskOptions.map((option) => (
                <option key={option.value ?? option} value={option.value ?? option}>
                  {option.label ?? option}
                </option>
              ))}
            </select>
          </label>
        )}

        {onMarketChange && (
          <label>
            市場
            <select
              value={values.market}
              onChange={(event) => update('market', event.target.value)}
            >
              <option value="">全部市場</option>
              {marketOptions.map((option) => (
                <option key={option.value ?? option} value={option.value ?? option}>
                  {option.label ?? option}
                </option>
              ))}
            </select>
          </label>
        )}

        {onProductChange && (
          <label>
            品項
            <select
              value={values.product}
              onChange={(event) => update('product', event.target.value)}
            >
              <option value="">全部品項</option>
              {productOptions.map((option) => (
                <option key={option.value ?? option} value={option.value ?? option}>
                  {option.label ?? option}
                </option>
              ))}
            </select>
          </label>
        )}

        {onDateFromChange && (
          <label>
            開始日期
            <input
              type="date"
              value={values.dateFrom}
              max={values.dateTo || undefined}
              onChange={(event) => update('dateFrom', event.target.value)}
            />
          </label>
        )}

        {onDateToChange && (
          <label>
            結束日期
            <input
              type="date"
              value={values.dateTo}
              min={values.dateFrom || undefined}
              onChange={(event) => update('dateTo', event.target.value)}
            />
          </label>
        )}

        <button type="button" onClick={mobile ? clearMobileFilters : onClear}>清除篩選</button>
        {mobile && <button type="button" className="filter-apply" onClick={applyMobileFilters}>套用篩選</button>}
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-filter-bar">
        <div className="desktop-filter-fields"><FilterFields /></div>
        <button type="button" className="mobile-filter-trigger" onClick={openMobileFilters}>篩選</button>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Dashboard 篩選">
        <FilterFields mobile />
      </Drawer>
    </>
  );
}
