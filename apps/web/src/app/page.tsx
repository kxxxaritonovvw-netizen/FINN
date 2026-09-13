"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const currencies = [
  ["RUB", "₽", "Российский рубль"],
  ["USD", "$", "Доллар США"],
  ["EUR", "€", "Евро"],
  ["GBP", "£", "Фунт стерлингов"],
  ["CNY", "¥", "Китайский юань"],
  ["KZT", "₸", "Казахстанский тенге"],
  ["GEL", "₾", "Грузинский лари"],
  ["TRY", "₺", "Турецкая лира"],
  ["AED", "د.إ", "Дирхам ОАЭ"],
  ["AMD", "֏", "Армянский драм"],
  ["BYN", "Br", "Белорусский рубль"],
] as const;

function ExpenseRow({ autoFocus = false, onDelete }: { autoFocus?: boolean; onDelete: () => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    pointerStart.current = null;
  }
  function openMenu() {
    cancelHold();
    held.current = true;
    const rect = rowRef.current!.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    setMenu({
      left: Math.max(left + 12, Math.min(rect.right - 184, left + width - 196)),
      top: Math.max(top + 12, Math.min(rect.bottom + 8, top + height - 68)),
    });
  }
  useEffect(() => {
    window.addEventListener("scroll", cancelHold, true);
    return () => { cancelHold(); window.removeEventListener("scroll", cancelHold, true); };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const dialog = dialogRef.current!;
    dialog.showModal();
    const dismiss = () => setMenu(null);
    window.addEventListener("resize", dismiss);
    return () => { dialog.close(); window.removeEventListener("resize", dismiss); };
  }, [menu]);
  const [closed, setClosed] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const symbol = currencies.find(([code]) => code === currency)![1];

  return (
    <>
      <div ref={rowRef} className={`expense-row${closed ? " is-closed" : ""}`}
        tabIndex={0} aria-label="Расход. Удерживайте для открытия меню" aria-haspopup="dialog" aria-expanded={menu !== null}
        onPointerDown={event => {
          cancelHold();
          if (!event.isPrimary || event.button !== 0) return;
          held.current = false;
          pointerStart.current = { x: event.clientX, y: event.clientY };
          holdTimer.current = setTimeout(openMenu, 500);
        }}
        onPointerMove={event => {
          const start = pointerStart.current;
          if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancelHold();
        }}
        onPointerUp={cancelHold} onPointerCancel={cancelHold} onPointerLeave={cancelHold}
        onContextMenu={event => { event.preventDefault(); openMenu(); }}
        onKeyDown={event => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); openMenu(); }
        }}
        onClickCapture={event => {
          if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; }
        }}
      >
        <label className="expense-checkbox">
          <input type="checkbox" checked={closed} onChange={event => setClosed(event.target.checked)} aria-label={name ? `Закрыто: ${name}` : "Расход закрыт"} />
        </label>
        <input
          className="expense-name"
          aria-label="Название расхода"
          placeholder="Название расхода"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoComplete="off"
          autoFocus={autoFocus}
        />
        <input
          className="expense-amount"
          aria-label="Сумма расхода"
          placeholder="0"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            const next = event.target.value.replace(/\./g, ",");
            if (/^\d{0,9}(,\d{0,2})?$/.test(next)) setAmount(next);
          }}
          onBlur={() => {
            if (!amount || amount === ",") return setAmount("");
            const [whole, fraction] = amount.split(",");
            setAmount((whole.replace(/^0+(?=\d)/, "") || "0") + (fraction ? `,${fraction}` : ""));
          }}
          autoComplete="off"
        />
        <div className="currency-picker">
          <span className="currency-symbol" aria-hidden="true">{symbol}</span>
          <span className="currency-chevron" aria-hidden="true" />
          <select
            aria-label="Валюта расхода"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {currencies.map(([code, sign, label]) => (
              <option key={code} value={code}>{sign} · {code} — {label}</option>
            ))}
          </select>
        </div>
      </div>
      {menu && createPortal(
        <dialog ref={dialogRef} className="expense-context-menu" aria-label="Действия с расходом"
          style={{ left: menu.left, top: menu.top }}
          onCancel={() => setMenu(null)}
          onClick={event => { if (event.target === event.currentTarget) setMenu(null); }}
        >
          <button type="button" onClick={onDelete}>Удалить</button>
        </dialog>, document.body
      )}
    </>
  );
}

export default function Home() {
  const [rows, setRows] = useState<number[][]>([[0], [1]]);
  const nextRowId = useRef(2);
  const [days, setDays] = useState([5, 20]);
  const [activeSegment, setActiveSegment] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftDays, setDraftDays] = useState(["5", "20"]);
  const [error, setError] = useState("");
  const month = new Intl.DateTimeFormat("ru-RU", { month: "long", timeZone: "Europe/Moscow" }).format(new Date());

  return (
    <main className="screen" aria-label="Расходы">
      <h1 className="month-title">{month}</h1>
      <div className="days-toolbar">
        <div className="day-segments" role="group" aria-label="Число месяца">
          {days.map((day, index) => (
            <button
              type="button"
              className="day-segment"
              key={index}
              aria-pressed={activeSegment === index}
              onClick={() => setActiveSegment(index)}
            >
              {day} число
            </button>
          ))}
        </div>
        <button
          className="days-settings"
          type="button"
          aria-label="Настроить числа месяца"
          aria-expanded={settingsOpen}
          aria-controls="day-settings"
          onClick={() => {
            setDraftDays(days.map(String));
            setError("");
            setSettingsOpen(!settingsOpen);
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
            <circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" />
          </svg>
        </button>
      </div>
      {settingsOpen && (
        <form id="day-settings" className="day-settings-form" onSubmit={(event) => {
          event.preventDefault();
          const nextDays = draftDays.map(Number);
          if (nextDays.some(day => !Number.isInteger(day) || day < 1 || day > 31)) {
            setError("Укажи числа от 1 до 31.");
            return;
          }
          if (nextDays[0] >= nextDays[1]) {
            setError("Второе число должно быть больше первого.");
            return;
          }
          setDays(nextDays);
          setSettingsOpen(false);
        }}>
          <div className="day-settings-fields">
            {draftDays.map((day, index) => (
              <label key={index}>
                {index === 0 ? "Первое число" : "Второе число"}
                <input type="number" inputMode="numeric" min="1" max="31" required value={day}
                  onChange={(event) => {
                    setDraftDays(current => current.map((value, i) => i === index ? event.target.value : value));
                    setError("");
                  }} />
              </label>
            ))}
          </div>
          {error && <p className="day-settings-error" role="alert">{error}</p>}
          <div className="day-settings-actions">
            <button type="button" onClick={() => setSettingsOpen(false)}>Отмена</button>
            <button type="submit">Сохранить</button>
          </div>
        </form>
      )}
      {rows.map((segmentRows, segment) => (
        <div className="expenses-frame" key={segment} hidden={activeSegment !== segment} aria-label={`Расходы на ${days[segment]} число`}>
          <h2 className="expenses-title">Расходы</h2>
          {segmentRows.map(id => (
            <ExpenseRow key={id} autoFocus={id > 1} onDelete={() => setRows(current => current.map((items, index) => index === segment ? items.filter(item => item !== id) : items))} />
          ))}
      <button
        className="add-row"
        type="button"
        onClick={() => {
          const id = nextRowId.current++;
          setRows(current => current.map((items, index) => index === segment ? [...items, id] : items));
        }}
      >
        <span aria-hidden="true">+</span>
        Добавить строку
      </button>
        </div>
      ))}
    </main>
  );
}
