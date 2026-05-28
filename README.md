# Спектр — TG mini-app для детей с РАС

> Бесплатные инструменты коммуникации для семей с детьми с расстройством аутистического спектра (РАС). Открыл ссылку в Telegram — работает. Без Apple ID, без оплаты в долларах, без обхода стора.

## Статус

🟡 **MVP в разработке** — sprint 1 в работе: AAC Phase I (Picture Exchange Communication System).

## Что это

Telegram mini-app, который даёт семьям с детьми с РАС:

1. **AAC-коммуникатор «Голос»** — обмен карточками по протоколу PECS, 6 фаз, TTS на русском. **MVP-фокус.**
2. **Визуальное расписание «День»** — first-then boards, multi-step routines, feelings board, countdown (TimeTimer-style). _Sprint 3._
3. **Игры**:
   - «Эмоции» — распознавание лицевых выражений (FaceSay-style). _Sprint 4._
   - «Взгляд» — joint attention через front camera (MediaPipe FaceMesh).
   - «Рутина» — POV video modeling для daily living.
   - «Эхо» — call-and-response (Improvisational Music Therapy).
   - «Сад» — calming sandbox без целей.
4. **Mood Tracker** (для подростков с ASD Level 1) — daily check-ins + CBT микро-модули.
5. **Parent Track** — Hanen OWL coach + MYmind 5-min mindfulness + progress dashboard.
6. **Social Stories AI** — генератор по Carol Gray криtериям 10.4.

## Принципы (8 правил)

1. **Neurodiversity-affirming** — никогда не «лечение», только «поддержка навыков». Уважение к stimming, special interests.
2. **Sensory-friendly UX by default** — mute on start (кроме AAC, где звук = смысл), reduce-motion respected, dark mode, WCAG AA+. **Никаких** surprise sounds / pop-ups / random rewards.
3. **Sensory profile personalization** — 15-item Dunn-style onboarding → адаптация под профиль ребёнка (hyper / hypo / seeking).
4. **Predictable structure** — одинаковый layout, кнопки в одних местах. Снижает high-precision prediction errors (по Friston).
5. **Child-led** — выбор активности за ребёнком (PRT child choice), reinforcement = продолжение игры, не token.
6. **Parent-mediated layer** — параллельный adult-track. Mindfulness работает на родителя больше, чем на подростка (MYmind data).
7. **Evidence-anchored** — каждая фича привязана к published intervention.
8. **No friction access** — TG mini-app, открыл ссылку → работает.

## Что НЕ делаем

- ❌ Surprise rewards / random animations / jump scares
- ❌ Реклама / pop-ups / in-app purchases для детей
- ❌ Time pressure / leaderboards / competitive elements
- ❌ Промоутировать GFCF-диеты, MMS, хеляцию, weighted vests, AIT
- ❌ Позиционировать как «лечение РАС» / «нормализация»
- ❌ Flickering / strobe / autoplay video с звуком
- ❌ Sharing данных с третьими лицами

## Бизнес-модель

- **Ядро бесплатно**: AAC + расписание + базовые игры + library.
- **Premium ~ 299 ₽/мес или 1990 ₽/год**: AI Social Stories, Mood Tracker, Progress Dashboard, custom voice, adaptive difficulty.
- **B2B** (фаза 2): 1900 ₽/мес на специалиста (SLP / ABA / коррекционный педагог).

## Tech stack

- **Backend**: Python + aiohttp + python-telegram-bot
- **Frontend**: vanilla JS, Telegram WebApp SDK, PWA (offline в roadmap)
- **DB**: SQLite (persistent volume на fly.io), миграция на PostgreSQL при росте
- **TTS**: Web Speech API (ru-RU) на старте → Yandex SpeechKit fallback позже
- **AI**: Anthropic Claude (Social Stories generator)
- **Pictograms**: emoji placeholder → ARASAAC open set (CC-BY-NC-SA) → custom через fal.ai/FLUX
- **Deploy**: fly.io (отдельный app, не пересекается с roghans-tg-bot)
- **Eye-tracking**: MediaPipe FaceMesh / WebGazer.js (клиент-сайд)

## Структура

```
spectrum-app/
├── README.md
├── requirements.txt
├── bot.py                  # aiohttp + (в будущем) TG bot
├── modules/                # backend модули
├── static/
│   ├── index.html          # хаб
│   ├── aac.html            # AAC Phase I (MVP)
│   ├── js/
│   │   ├── telegram.js     # TG WebApp wrapper
│   │   ├── tts.js          # Web Speech abstraction
│   │   ├── telemetry.js    # /api/event posting
│   │   └── aac.js          # AAC логика
│   ├── css/
│   │   ├── tokens.css      # design tokens
│   │   ├── index.css       # хаб
│   │   └── aac.css         # AAC
│   └── assets/pictograms/  # ARASAAC subset (позже)
├── data/                   # SQLite + events.jsonl (gitignored)
├── tests/
├── docs/
│   └── PRODUCT_BRIEF.md    # MVP roadmap
└── fly.toml
```

## Локальный запуск

```bash
cd ~/PersonalProjects/spectrum-app
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python bot.py
# открыть http://localhost:8080
```

## Research-база

Полный научный документ с ~80 ссылками на peer-reviewed литературу 2023–2026:
[../roghans_tg_bot/tg-bot/docs/research/asd_app_research.md](../roghans_tg_bot/tg-bot/docs/research/asd_app_research.md)

## Owners

- Product: @skol4356
- Engineering: Claude + @skol4356

## License

TBD — рассматриваем MIT для кода + CC-BY-NC для образовательного контента.
