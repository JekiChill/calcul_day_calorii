'use strict';

(function () {
  /* ===== Константы ===== */
  var STORAGE_KEY = 'calorie-journal-v1';

  // Строго 4 сообщения об ошибках — по тексту ТЗ
  var MESSAGES = {
    empty: 'Пусто? Даже салат без калорий так не выглядит — введите число!',
    notNumber: 'Текст оставьте для меню, а сюда нужны только цифры: калькулятор буквы не переваривает!',
    zero: 'Ноль калорий? Это не суточная норма, а мечта диетолога — введите реальное значение!',
    negative: 'Минус калорий — это уже не дефицит, а научная фантастика: нужен положительный показатель!'
  };

  var NUMERIC_FIELDS = ['age', 'height', 'weight'];

  /* ===== DOM ===== */
  var form = document.getElementById('calc-form');
  var resultBox = document.getElementById('result');
  var resultValue = document.getElementById('result-value');
  var resultNote = document.getElementById('result-note');
  var formError = document.getElementById('form-error');
  var journalList = document.getElementById('journal');
  var emptyNote = document.getElementById('empty-journal');
  var clearButton = document.getElementById('clear-journal');

  /* ===== Валидация одного поля ===== */
  function validate(rawValue) {
    var value = String(rawValue).trim();

    // 1. Пустое поле
    if (value === '') {
      return { message: MESSAGES.empty };
    }

    // Заменяем запятую на точку — для «72,5»
    var normalized = value.replace(',', '.');

    // 2. Буквы и посторонние символы
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
      return { message: MESSAGES.notNumber };
    }

    var number = Number(normalized);

    if (!isFinite(number)) {
      return { message: MESSAGES.notNumber };
    }

    // 3. Ровно ноль
    if (number === 0) {
      return { message: MESSAGES.zero };
    }

    // 4. Отрицательное число
    if (number < 0) {
      return { message: MESSAGES.negative };
    }

    return { number: number };
  }

  /* ===== Расчёт по формуле Миффлина — Сан Жеора ===== */
  function calculate(gender, age, height, weight, activityFactor) {
    var base = 10 * weight + 6.25 * height - 5 * age;
    var bmr = (gender === 'male') ? base + 5 : base - 161;

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(bmr * activityFactor)
    };
  }

  /* ===== localStorage ===== */
  function readJournal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      var data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      return [];
    }
  }

  function writeJournal(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      // Хранилище недоступно — журнал будет жить только до перезагрузки
    }
  }

  function addEntry(entry) {
    var entries = readJournal();
    entries.push(entry);
    writeJournal(entries);
    renderJournal();
  }

  /* ===== Отрисовка журнала (добавляем вниз, старое не затираем) ===== */
  function renderJournal() {
    var entries = readJournal();

    journalList.innerHTML = '';

    entries.forEach(function (entry) {
      var item = document.createElement('li');
      item.className = 'journal-item';

      var time = document.createElement('div');
      time.className = 'journal-time';
      time.textContent = new Date(entry.time).toLocaleString('ru-RU', {
        dateStyle: 'short',
        timeStyle: 'medium'
      });

      var data = document.createElement('div');
      data.className = 'journal-data';
      data.textContent = entry.summary;

      var result = document.createElement('div');
      result.className = 'journal-result';
      result.textContent = 'Итог: ' + entry.result.toLocaleString('ru-RU') + ' ккал/сутки';

      item.appendChild(time);
      item.appendChild(data);
      item.appendChild(result);
      journalList.appendChild(item);
    });

    emptyNote.hidden = entries.length > 0;
  }

  /* ===== Подсветка ошибки поля ===== */
  function setFieldError(id, message) {
    var input = document.getElementById(id);
    var errorElement = document.getElementById('error-' + id);

    if (message) {
      input.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
      errorElement.textContent = message;
    } else {
      input.classList.remove('invalid');
      input.removeAttribute('aria-invalid');
      errorElement.textContent = '';
    }
  }

  /* ===== Отправка формы ===== */
  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var hasError = false;
    var firstInvalid = null;
    var values = {};

    formError.textContent = '';

    NUMERIC_FIELDS.forEach(function (id) {
      var input = document.getElementById(id);
      var result = validate(input.value);

      if (result.message) {
        hasError = true;
        setFieldError(id, result.message);
        if (!firstInvalid) {
          firstInvalid = input;
        }
      } else {
        setFieldError(id, '');
        values[id] = result.number;
      }
    });

    if (hasError) {
      resultBox.hidden = true;
      if (firstInvalid) {
        firstInvalid.focus();
      }
      return;
    }

    var genderInput = form.querySelector('input[name="gender"]:checked');
    var gender = genderInput ? genderInput.value : 'male';

    var activitySelect = document.getElementById('activity');
    var activityFactor = Number(activitySelect.value);
    var activityText = activitySelect.options[activitySelect.selectedIndex].textContent;

    var calculation = calculate(
      gender,
      values.age,
      values.height,
      values.weight,
      activityFactor
    );

    // Защита от абсурдных данных (например, вес 1 кг, рост 1 см)
    if (!isFinite(calculation.tdee) || calculation.tdee <= 0) {
      resultBox.hidden = true;
      formError.textContent = 'С такими параметрами норма не рассчитывается — проверьте рост, вес и возраст.';
      return;
    }

    resultValue.textContent = calculation.tdee.toLocaleString('ru-RU') + ' ккал/сутки';
    resultNote.textContent =
      'Базовый метаболизм: ' + calculation.bmr.toLocaleString('ru-RU') +
      ' ккал · Активность: ' + activityText;
    resultBox.hidden = false;

    var summary =
      (gender === 'male' ? 'Мужчина' : 'Женщина') + ', ' +
      values.age + ' лет, ' +
      values.height + ' см, ' +
      values.weight + ' кг, активность ' + activityFactor + ' (' + activityText + ')';

    addEntry({
      time: Date.now(),
      summary: summary,
      result: calculation.tdee
    });
  });

  /* ===== Сброс ошибки при вводе ===== */
  NUMERIC_FIELDS.forEach(function (id) {
    var input = document.getElementById(id);

    input.addEventListener('input', function () {
      setFieldError(id, '');
      formError.textContent = '';
    });
  });

  /* ===== Очистка журнала ===== */
  clearButton.addEventListener('click', function () {
    writeJournal([]);
    renderJournal();
  });

  /* ===== Инициализация: при F5 журнал остаётся ===== */
  renderJournal();
})();
