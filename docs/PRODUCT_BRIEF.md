# Спектр — Product Brief / MVP Roadmap

## Видение (1 предложение)

Telegram mini-app, который даёт русскоязычным семьям с детьми с РАС бесплатные инструменты коммуникации (AAC по PECS), визуального расписания и развития — открыл ссылку → работает, без Apple ID и валютной оплаты.

## Целевая аудитория

- **Primary:** родители детей 2–7 лет, non-verbal / minimally verbal, недавний диагноз РАС, СНГ.
- **Secondary:** SLP / коррекционные педагоги / ABA-терапевты, работающие с этими семьями.
- **Tertiary:** подростки 12–17 лет с ASD Level 1 (Mood Tracker модуль — sprint 6+).

## Что не делаем (no-go list)

- Не позиционируем как «лечение».
- Не продвигаем псевдонауку (MMS, хеляция, GFCF-диеты, weighted vests, AIT).
- Не используем surprise rewards / random animations / time pressure.
- Не показываем рекламу детям. Никаких pop-ups в детских модулях.
- Не делимся данными с третьими лицами.

## MVP Roadmap

### Sprint 1 (текущий) — AAC Phase I

**Цель:** ребёнок с помощью родителя может построить простую фразу из 1–3 карточек и услышать её произнесённой.

**Готово (✅) / в работе (🟡) / TODO (⏳):**
- ✅ Хаб с тайлами
- ✅ AAC экран: 12 карточек core vocabulary (я, хочу, ещё, помоги, да, нет, играть, кушать, пить, мама, папа, спать)
- ✅ Sentence strip (последовательность выбранных карточек)
- ✅ TTS озвучка через Web Speech API (ru-RU)
- ✅ Кнопки «Сказать» / «Очистить»
- ✅ Telemetry: `aac_open`, `aac_card_tap`, `aac_phrase_say`, `aac_clear`
- ⏳ Smoke test через playwright (iPhone 14 viewport)
- ⏳ Деплой на fly.io (subdomain TBD)
- ⏳ TG bot обвязка: команда `/start` → ссылка на mini-app

### Sprint 2 — Phase II–IV + Custom Voice

- Phase II: «расстояние и настойчивость» — partner-zone становится drop target, карточка drag'ом
- Phase III: discrimination массивов (выбор из N карточек)
- Phase IV: sentence structure builder с шаблоном «Я хочу ___»
- Custom voice: родитель записывает свой голос для каждого слова (заменяет TTS)
- Расширение vocabulary до 60 слов (категории: люди, действия, еда, чувства, места, время)
- Sensory profile onboarding (15 пунктов Dunn-style) → settings page

### Sprint 3 — Визуальное расписание «День»

- First-Then board (2 карточки последовательности)
- Multi-step routine (утро / школа / вечер)
- Countdown timer (TimeTimer-style — исчезающий красный сектор)
- Feelings board (zones of regulation: blue / green / yellow / red)
- Photo upload — родитель грузит фотки квартиры / школы / людей
- Routine completion telemetry

### Sprint 4 — Игра «Эмоции»

- 12 уровней по FaceSay-методологии
- Уровни 1–3: 4 базовые эмоции (joy / sad / anger / fear), cartoon faces
- Уровни 4–8: surprise, disgust + лёгкие реалистичные
- Уровни 9–12: contextual (ситуация + фото → эмоция персонажа)
- Adaptive difficulty: если ребёнок ошибается 3 раза подряд → уровень снижается
- Telemetry: accuracy per emotion, time-to-answer, progression

### Sprint 5 — Closed beta

- 5–10 семей через РАС-родительские TG-каналы
- Onboarding-форма для отбора
- Weekly feedback survey
- Iteration на UX по результатам

### Дальше (Sprint 6+)

- Игра «Взгляд» — joint attention через front camera
- Игра «Рутина» — POV video modeling
- Игра «Эхо» — IMT-inspired call-and-response
- Игра «Сад» — calming sandbox
- Mood Tracker для подростков ASD Level 1
- Parent Track: Hanen OWL coach + MYmind mindfulness
- Social Stories AI generator (Carol Gray 10.4)
- Progress Dashboard для специалистов (B2B)

## Технические решения (зафиксированы для MVP)

- **Backend:** Python 3.11 + aiohttp 3.9+. Без TG bot integration на старте — только web (TG bot добавим в Sprint 1.5).
- **Frontend:** vanilla JS (без React/Vue — sensory-friendly значит ZERO surprise updates, ZERO virtual DOM перерисовок).
- **TTS:** Web Speech API (`SpeechSynthesisUtterance`, lang='ru-RU'). Fallback на Yandex SpeechKit в Sprint 2+.
- **Хранилище:** events.jsonl на старте, миграция на SQLite в Sprint 2.
- **Deploy:** fly.io, отдельный app `spectrum-app` (не `roghans-tg-bot`).
- **Pictograms:** emoji placeholder в Sprint 1; в Sprint 2 — ARASAAC subset (CC-BY-NC-SA) + локальные replacements.

## Success metrics (R6 — бизнес-результат, не процесс)

- **Primary:** N семей с активным AAC-использованием **на 4+ недели** (retention 4-week).
- **Secondary:**
  - Avg phase progression (Phase I → III и выше).
  - N распознанных фраз `aac_phrase_say` / неделю.
  - Avg sentence length (proxy for language complexity).
  - Routine completions / неделю (после Sprint 3).
- **Anti-metric:** time-in-app — НЕ показатель success. Ребёнок может залипнуть в одной игре.

## Risks

- **Web Speech API качество ru-RU** — варьируется по платформам (iOS Safari ≠ Android Chrome). Митигация: запись custom voice в Sprint 2.
- **TG mini-app sandbox ограничения** — нет доступа к local storage в некоторых случаях, нет microphone без user gesture. Митигация: проверить на этапе Sprint 1 deploy.
- **Pictograms лицензирование** — ARASAAC CC-BY-NC-SA несовместимо с коммерческой подпиской premium. Митигация: купить commercial license или использовать FLUX-сгенерированные.
- **AppStore / Play Store обзоры** — не делаем native apps в принципе, только TG. Снимает риск.

## Owners

- Product: @skol4356
- Engineering: Claude + @skol4356

## Сегодня (что сделано на момент создания docs)

- ✅ Полный research-документ (~80 peer-reviewed ссылок 2023–2026): [`../../roghans_tg_bot/tg-bot/docs/research/asd_app_research.md`](../../roghans_tg_bot/tg-bot/docs/research/asd_app_research.md)
- ✅ Project skeleton (этот репо)
- ✅ AAC Phase I MVP (hub + 12-card vocab + sentence strip + TTS + telemetry)
- ⏳ Локальный smoke test
- ⏳ Git init + первый commit
