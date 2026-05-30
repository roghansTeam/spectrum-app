# Скриншоты — production state (machine v9)

Все скрины сняты на проде через playwright headless Chromium с UA Telegram-iOS, viewport iPhone 14 (390×844). Light + dark mode.

## 🏠 Хаб

6 активных модулей + банер «Знакомство» (если sensory profile ещё не пройден):

| Light | Dark |
|---|---|
| <img src="screenshots/01_hub.png" width="280"> | <img src="screenshots/12_hub_dark.png" width="280"> |

## 💬 Голос — AAC коммуникатор (PECS Phase I + custom voice)

| Обычный режим | Режим записи родительского голоса | Dark mode |
|---|---|---|
| <img src="screenshots/02_aac_main.png" width="240"> | <img src="screenshots/03_aac_record_mode.png" width="240"> | <img src="screenshots/13_aac_dark.png" width="240"> |

60 слов в 6 категориях (главное / кто / делать / еда / чувства / где).

## 📅 День — визуальное расписание

| Hub (2 режима) | Распорядки |
|---|---|
| <img src="screenshots/04_day_hub.png" width="280"> | <img src="screenshots/05_day_routines.png" width="280"> |

5 готовых routine-шаблонов: Утро / Вечер / В школу / В магазин / К врачу.

## 😊 Эмоции — игра распознавания

<img src="screenshots/06_emotions_levels.png" width="320">

8 progressive уровней, открываются по мере прохождения предыдущих.

## 🎚️ Настроение — Mood Tracker для подростков

<img src="screenshots/07_mood_hub.png" width="320">

4 цветовые зоны (Zones of Regulation) → триггеры (опционально) → coping suggestions при yellow/red.

## 📖 Истории — AI Social Stories

<img src="screenshots/08_stories_form.png" width="320">

Форма с автозаполнением имени/возраста, Claude генерит story по Carol Gray 10.4 criteria.

## 🌬️ Родителю — Hanen + MYmind + Dashboard

| Hub | Совет дня |
|---|---|
| <img src="screenshots/09_parent_hub.png" width="280"> | <img src="screenshots/10_parent_tip.png" width="280"> |

15 ротирующихся Hanen-стратегий (OWL / 4S / MTW), 5 mindfulness-практик, progress dashboard читающий localStorage из всех модулей.

## ✨ Знакомство — Sensory Profile onboarding

<img src="screenshots/11_onboarding.png" width="320">

15-item Dunn-style опросник определяет sensory profile ребёнка (seeking / hyper / hypo / mixed) → результат сохраняется в localStorage и используется для адаптации UI.

---

**Все скриншоты обновляются автоматически через `tests/capture_prod.py`.** Чтобы пересобрать — запустите скрипт; он перезапишет файлы в `docs/screenshots/`.
