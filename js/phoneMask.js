/**
 * Телефон РФ: +7-XXX-XXX-XX-XX (11 цифр: код 7 и 10 цифр номера).
 */

function extractDigits(s) {
  let d = String(s ?? "").replace(/\D/g, "");
  if (!d.length) return "";
  if (d[0] === "8") d = "7" + d.slice(1);
  // Мобильный без кода страны: 9… → 79… (+7 подставляется с первой цифры)
  if (d[0] === "9") d = "7" + d;
  else if (d.length === 10 && d[0] !== "7") d = "7" + d;
  if (d[0] !== "7") return "";
  return d.slice(0, 11);
}

function formatFromDigits(d) {
  if (!d || d[0] !== "7") return "";
  const rest = d.slice(1);
  if (rest.length === 0) return "+7-";
  const g1 = rest.slice(0, 3);
  const g2 = rest.slice(3, 6);
  const g3 = rest.slice(6, 8);
  const g4 = rest.slice(8, 10);
  let out = "+7-" + g1;
  if (g2.length) out += "-" + g2;
  if (g3.length) out += "-" + g3;
  if (g4.length) out += "-" + g4;
  return out;
}

/** Привести произвольный ввод/значение из БД к отображаемому виду. */
export function formatPhoneInput(raw) {
  const d = extractDigits(raw);
  if (!d) return "";
  return formatFromDigits(d);
}

export function setPhoneInputValue(input, raw) {
  if (!input) return;
  input.value = raw == null || String(raw).trim() === "" ? "" : formatPhoneInput(String(raw));
}

/** Для `href="tel:..."` на полном номере РФ (11 цифр); иначе null — ссылку не ставим. */
export function telHrefFromRaw(raw) {
  const d = extractDigits(raw);
  if (!d || d.length !== 11) return null;
  return `tel:+${d}`;
}

/** null если пусто или номер неполный; иначе строка +7-XXX-XXX-XX-XX */
export function phoneForStorage(formatted) {
  const d = extractDigits(formatted);
  if (!d || d === "7") return null;
  if (d.length !== 11) return null;
  return formatFromDigits(d);
}

/** Пусто (нет значимых цифр) или ровно 11 цифр */
export function isPhoneEmptyOrComplete(formatted) {
  const d = extractDigits(formatted);
  if (!d || d === "7") return true;
  return d.length === 11;
}

function positionAfterDigits(formatted, n) {
  if (n <= 0) return 0;
  let c = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      c++;
      if (c >= n) return i + 1;
    }
  }
  return formatted.length;
}

export function attachPhoneMask(input) {
  if (!input) return;
  input.setAttribute("maxlength", "16");
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("autocomplete", "tel");

  input.addEventListener("input", () => {
    const raw = input.value;
    const oldPos = input.selectionStart ?? 0;
    const digitCountBefore = raw.slice(0, oldPos).replace(/\D/g, "").length;
    const newVal = formatPhoneInput(raw);
    input.value = newVal;
    const digitsInNew = newVal.replace(/\D/g, "").length;
    const normalizedLen = extractDigits(raw).length;
    const atEnd = oldPos >= raw.length;
    // При автоподстановке +7 (например ввод с 9) цифр в строке больше, чем ввёл пользователь —
    // если курсор был в конце, ставим его после последней цифры номера (например после 9).
    const n = atEnd ? normalizedLen : Math.min(digitCountBefore, digitsInNew);
    const newPos = positionAfterDigits(newVal, n);
    input.setSelectionRange(newPos, newPos);
  });
}
