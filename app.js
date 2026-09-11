"use strict";

/**
 * 건강 캘린더 체크리스트
 * - 프레임워크 없이 순수 JS로 구현한 정적 웹앱
 * - 모든 기록은 브라우저 localStorage에만 저장된다.
 */

(function () {
  var STORAGE_KEY = "healthCalendar.records.v1";
  var CHECK_KEYS = ["sleep", "water", "meal", "exercise"];
  var WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
  var MOOD_LABELS = { good: "좋음", normal: "보통", hard: "힘듦" };

  // ------------------------------------------------------------------
  // 날짜 유틸리티 (로컬 시간 기준, 타임존 오차 방지를 위해 UTC 변환을 쓰지 않는다)
  // ------------------------------------------------------------------

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /** Date -> "YYYY-MM-DD" (로컬 기준) */
  function toDateKey(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  /** "YYYY-MM-DD" -> Date (로컬 자정) */
  function parseDateKey(key) {
    var parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function startOfToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, delta) {
    var d = new Date(date);
    d.setDate(d.getDate() + delta);
    return d;
  }

  function isSameDate(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  // ------------------------------------------------------------------
  // 저장소 (localStorage)
  // ------------------------------------------------------------------

  var storageAvailable = true;

  function loadRecords() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
      return {};
    } catch (err) {
      storageAvailable = false;
      console.warn("[건강 캘린더] 저장된 기록을 불러오지 못했습니다.", err);
      return {};
    }
  }

  function persistRecords() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (err) {
      storageAvailable = false;
      console.warn("[건강 캘린더] 기록을 저장하지 못했습니다.", err);
      return false;
    }
  }

  // ------------------------------------------------------------------
  // 상태
  // ------------------------------------------------------------------

  var records = loadRecords(); // { "YYYY-MM-DD": { sleep, water, meal, exercise, mood, note, updatedAt } }
  var today = startOfToday();
  var todayKey = toDateKey(today);

  var state = {
    viewYear: today.getFullYear(),
    viewMonth: today.getMonth(), // 0-indexed
    selectedKey: todayKey,
  };

  // ------------------------------------------------------------------
  // DOM 참조
  // ------------------------------------------------------------------

  var els = {
    todayBtn: document.getElementById("today-btn"),
    selectedDateLabel: document.getElementById("selected-date-label"),
    todayRateLabel: document.getElementById("today-rate-label"),
    streakLabel: document.getElementById("streak-label"),

    prevMonthBtn: document.getElementById("prev-month-btn"),
    nextMonthBtn: document.getElementById("next-month-btn"),
    calendarHeading: document.getElementById("calendar-heading"),
    calendarGrid: document.getElementById("calendar-grid"),

    checklistDateLabel: document.getElementById("checklist-date-label"),
    selectedRateBadge: document.getElementById("selected-rate-badge"),
    emptyHint: document.getElementById("empty-hint"),
    form: document.getElementById("checklist-form"),
    noteInput: document.getElementById("note-input"),
    clearBtn: document.getElementById("clear-record-btn"),
    saveStatus: document.getElementById("save-status"),
  };

  // ------------------------------------------------------------------
  // 기록 관련 계산
  // ------------------------------------------------------------------

  function hasContent(record) {
    if (!record) return false;
    return (
      CHECK_KEYS.some(function (k) {
        return !!record[k];
      }) ||
      !!record.mood ||
      !!record.numbness ||
      (record.note && record.note.trim().length > 0)
    );
  }

  /** 체크리스트 4항목 중 완료 비율(%) */
  function completionRate(record) {
    if (!record) return 0;
    var done = CHECK_KEYS.reduce(function (sum, k) {
      return sum + (record[k] ? 1 : 0);
    }, 0);
    return Math.round((done / CHECK_KEYS.length) * 100);
  }

  /** 오늘 또는 가장 최근 기록일부터 이어지는 연속 기록 일수 */
  function computeStreak() {
    var keys = Object.keys(records).filter(function (k) {
      return hasContent(records[k]);
    });
    if (keys.length === 0) return 0;

    var startDate;
    if (records[todayKey] && hasContent(records[todayKey])) {
      startDate = today;
    } else {
      keys.sort(); // YYYY-MM-DD 형식은 문자열 정렬 = 날짜 정렬
      startDate = parseDateKey(keys[keys.length - 1]);
    }

    var count = 0;
    var cursor = new Date(startDate);
    while (records[toDateKey(cursor)] && hasContent(records[toDateKey(cursor)])) {
      count += 1;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  // ------------------------------------------------------------------
  // 렌더링: 요약 카드
  // ------------------------------------------------------------------

  function renderSummary() {
    var selectedDate = parseDateKey(state.selectedKey);
    els.selectedDateLabel.textContent = formatDateShort(selectedDate);

    var todayRecord = records[todayKey];
    els.todayRateLabel.textContent = completionRate(todayRecord) + "%";

    els.streakLabel.textContent = String(computeStreak());
  }

  function formatDateShort(date) {
    return date.getFullYear() + "." + pad2(date.getMonth() + 1) + "." + pad2(date.getDate());
  }

  function formatDateLong(date) {
    var weekday = WEEKDAY_NAMES[date.getDay()];
    return (date.getMonth() + 1) + "월 " + date.getDate() + "일 (" + weekday + ")";
  }

  // ------------------------------------------------------------------
  // 렌더링: 캘린더
  // ------------------------------------------------------------------

  function renderCalendar() {
    var year = state.viewYear;
    var month = state.viewMonth; // 0-indexed

    els.calendarHeading.textContent = year + "년 " + (month + 1) + "월";

    var firstOfMonth = new Date(year, month, 1);
    var startOffset = firstOfMonth.getDay(); // 0=일요일
    var gridStart = addDays(firstOfMonth, -startOffset);

    els.calendarGrid.innerHTML = "";
    var frag = document.createDocumentFragment();

    for (var i = 0; i < 42; i++) {
      var cellDate = addDays(gridStart, i);
      var cellKey = toDateKey(cellDate);
      var inCurrentMonth = cellDate.getMonth() === month;
      var isToday = isSameDate(cellDate, today);
      var isSelected = cellKey === state.selectedKey;
      var record = records[cellKey];
      var hasRecord = hasContent(record);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-cell";
      if (!inCurrentMonth) btn.classList.add("day-cell--muted");
      if (isToday) btn.classList.add("day-cell--today");
      if (isSelected) btn.classList.add("day-cell--selected");
      if (hasRecord) btn.classList.add("day-cell--has-record");

      btn.dataset.dateKey = cellKey;
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
      if (isToday) btn.setAttribute("aria-current", "date");

      var labelParts = [formatDateLong(cellDate)];
      if (isToday) labelParts.push("오늘");
      if (hasRecord) labelParts.push("기록 있음");
      if (isSelected) labelParts.push("선택됨");
      btn.setAttribute("aria-label", labelParts.join(", "));

      var numberSpan = document.createElement("span");
      numberSpan.className = "day-cell__number";
      numberSpan.textContent = String(cellDate.getDate());

      var dotSpan = document.createElement("span");
      dotSpan.className = "day-cell__dot";
      dotSpan.setAttribute("aria-hidden", "true");

      btn.appendChild(numberSpan);
      btn.appendChild(dotSpan);

      btn.addEventListener("click", onDayCellClick);

      frag.appendChild(btn);
    }

    els.calendarGrid.appendChild(frag);
  }

  function onDayCellClick(evt) {
    var key = evt.currentTarget.dataset.dateKey;
    if (!key) return;
    var date = parseDateKey(key);
    selectDate(date, key);
  }

  function selectDate(date, key) {
    var monthChanged = date.getFullYear() !== state.viewYear || date.getMonth() !== state.viewMonth;
    state.selectedKey = key;
    state.viewYear = date.getFullYear();
    state.viewMonth = date.getMonth();
    if (monthChanged) {
      renderCalendar();
    } else {
      updateCalendarSelectionClasses();
    }
    renderSummary();
    renderChecklistForm();
    clearSaveStatus();
  }

  /** 월 전체를 다시 그리지 않고 선택 상태 클래스만 갱신 (불필요한 리렌더 방지) */
  function updateCalendarSelectionClasses() {
    var cells = els.calendarGrid.querySelectorAll(".day-cell");
    cells.forEach(function (cell) {
      var isSelected = cell.dataset.dateKey === state.selectedKey;
      cell.classList.toggle("day-cell--selected", isSelected);
      cell.setAttribute("aria-pressed", isSelected ? "true" : "false");

      var date = parseDateKey(cell.dataset.dateKey);
      var isToday = isSameDate(date, today);
      var record = records[cell.dataset.dateKey];
      var hasRecord = hasContent(record);
      var labelParts = [formatDateLong(date)];
      if (isToday) labelParts.push("오늘");
      if (hasRecord) labelParts.push("기록 있음");
      if (isSelected) labelParts.push("선택됨");
      cell.setAttribute("aria-label", labelParts.join(", "));
    });
  }

  // ------------------------------------------------------------------
  // 렌더링: 체크리스트 카드
  // ------------------------------------------------------------------

  function renderChecklistForm() {
    var date = parseDateKey(state.selectedKey);
    var isToday = state.selectedKey === todayKey;
    els.checklistDateLabel.textContent = isToday
      ? "오늘 · " + formatDateLong(date)
      : formatDateLong(date);

    var record = records[state.selectedKey];

    CHECK_KEYS.forEach(function (key) {
      var input = document.getElementById("check-" + key);
      input.checked = !!(record && record[key]);
    });

    var moodInputs = els.form.querySelectorAll('input[name="mood"]');
    moodInputs.forEach(function (input) {
      input.checked = !!(record && record.mood === input.value);
    });

    var numbnessInput = document.getElementById("check-numbness");
    numbnessInput.checked = !!(record && record.numbness);

    els.noteInput.value = (record && record.note) || "";

    els.selectedRateBadge.textContent = completionRate(record) + "%";

    var recordExists = hasContent(record);
    els.emptyHint.hidden = recordExists;
    els.clearBtn.hidden = !recordExists;
  }

  function clearSaveStatus() {
    els.saveStatus.textContent = "";
  }

  // ------------------------------------------------------------------
  // 저장 / 수정 / 삭제
  // ------------------------------------------------------------------

  function onFormSubmit(evt) {
    evt.preventDefault();

    var formData = new FormData(els.form);
    var newRecord = {
      sleep: formData.get("sleep") === "on",
      water: formData.get("water") === "on",
      meal: formData.get("meal") === "on",
      exercise: formData.get("exercise") === "on",
      mood: formData.get("mood") || null,
      numbness: formData.get("numbness") === "on",
      note: (formData.get("note") || "").toString().trim(),
      updatedAt: new Date().toISOString(),
    };

    if (!hasContent(newRecord)) {
      showSaveStatus("체크 항목, 기분, 메모 중 하나 이상을 입력해주세요.", true);
      return;
    }

    records[state.selectedKey] = newRecord;
    var saved = persistRecords();

    renderCalendar();
    renderSummary();
    renderChecklistForm();

    if (saved) {
      showSaveStatus("저장되었습니다.", false);
    } else {
      showSaveStatus("이 기기에 저장하지 못했어요. 브라우저 저장 공간을 확인해주세요.", true);
    }
  }

  function onClearRecord() {
    if (!records[state.selectedKey]) return;
    delete records[state.selectedKey];
    persistRecords();

    renderCalendar();
    renderSummary();
    renderChecklistForm();
    showSaveStatus("이 날짜의 기록을 지웠습니다.", false);
  }

  function showSaveStatus(message, isError) {
    els.saveStatus.textContent = message;
    els.saveStatus.classList.toggle("save-status--error", !!isError);
  }

  // ------------------------------------------------------------------
  // 월 이동 / 오늘로 이동
  // ------------------------------------------------------------------

  function goToMonth(delta) {
    var newMonthDate = new Date(state.viewYear, state.viewMonth + delta, 1);
    state.viewYear = newMonthDate.getFullYear();
    state.viewMonth = newMonthDate.getMonth();
    renderCalendar();
  }

  function goToToday() {
    selectDate(today, todayKey);
  }

  // ------------------------------------------------------------------
  // 이벤트 바인딩 및 초기화
  // ------------------------------------------------------------------

  function init() {
    els.prevMonthBtn.addEventListener("click", function () {
      goToMonth(-1);
    });
    els.nextMonthBtn.addEventListener("click", function () {
      goToMonth(1);
    });
    els.todayBtn.addEventListener("click", goToToday);
    els.form.addEventListener("submit", onFormSubmit);
    els.clearBtn.addEventListener("click", onClearRecord);

    renderCalendar();
    renderSummary();
    renderChecklistForm();

    if (!storageAvailable) {
      showSaveStatus(
        "이 브라우저에서는 저장 공간을 사용할 수 없어 기록이 새로고침 후 사라질 수 있어요.",
        true
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
