import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon } from "lucide-react";

interface CalendarPickerProps {
  selectedDateTime: string; // ISO string or YYYY-MM-DDTHH:mm
  onChange: (dateTimeStr: string) => void;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  selectedDateTime,
  onChange,
}) => {
  const initialDate = selectedDateTime ? new Date(selectedDateTime) : new Date();
  
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState<number>(initialDate.getDate());
  const [selectedHour, setSelectedHour] = useState<string>(
    String(initialDate.getHours() % 12 || 12).padStart(2, "0")
  );
  const [selectedMinute, setSelectedMinute] = useState<string>(
    String(initialDate.getMinutes()).padStart(2, "0")
  );
  const [period, setPeriod] = useState<"AM" | "PM">(
    initialDate.getHours() >= 12 ? "PM" : "AM"
  );

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfWeek = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const updateDateTime = (
    day: number,
    hrStr: string,
    minStr: string,
    pmAm: "AM" | "PM"
  ) => {
    let hr = parseInt(hrStr, 10) || 12;
    if (pmAm === "PM" && hr < 12) hr += 12;
    if (pmAm === "AM" && hr === 12) hr = 0;

    const targetDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
      hr,
      parseInt(minStr, 10) || 0
    );

    // Format YYYY-MM-DDTHH:mm
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const d = String(targetDate.getDate()).padStart(2, "0");
    const hours = String(targetDate.getHours()).padStart(2, "0");
    const mins = String(targetDate.getMinutes()).padStart(2, "0");

    onChange(`${year}-${month}-${d}T${hours}:${mins}`);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    updateDateTime(day, selectedHour, selectedMinute, period);
  };

  const handleTimeChange = (
    h: string,
    m: string,
    p: "AM" | "PM"
  ) => {
    setSelectedHour(h);
    setSelectedMinute(m);
    setPeriod(p);
    updateDateTime(selectedDay, h, m, p);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* DAYS OF WEEK */}
      <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* CALENDAR DAYS GRID */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="py-2" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1;
          const isSelected = dayNum === selectedDay;
          const today = new Date();
          const isToday =
            dayNum === today.getDate() &&
            currentMonth.getMonth() === today.getMonth() &&
            currentMonth.getFullYear() === today.getFullYear();

          return (
            <button
              key={dayNum}
              type="button"
              onClick={() => handleSelectDay(dayNum)}
              className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none"
                  : isToday
                  ? "border border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      {/* TIME PICKER */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Clock size={14} className="text-indigo-500" /> Time:
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={selectedHour}
            onChange={(e) =>
              handleTimeChange(e.target.value, selectedMinute, period)
            }
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
          >
            {Array.from({ length: 12 }).map((_, idx) => {
              const val = String(idx + 1).padStart(2, "0");
              return (
                <option key={val} value={val}>
                  {val}
                </option>
              );
            })}
          </select>
          <span className="text-slate-400 font-bold">:</span>
          <select
            value={selectedMinute}
            onChange={(e) =>
              handleTimeChange(selectedHour, e.target.value, period)
            }
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
          >
            {["00", "15", "30", "45"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              handleTimeChange(
                selectedHour,
                selectedMinute,
                period === "AM" ? "PM" : "AM"
              )
            }
            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            {period}
          </button>
        </div>
      </div>
    </div>
  );
};
