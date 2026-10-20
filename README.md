# Workouts

Mobile-first gym workout tracker for [Obsidian](https://obsidian.md). Personal fork of [LiftOff](https://github.com/hpasic/obsidian-liftoff) by Haris Pasic. Log sets, reps, and weights with speed-optimized UX. All data stored as markdown in your vault.

<p align="center">
  <img src="screenshots/home-mobile.png" width="300" alt="Home screen with templates and recent workouts" />
  <img src="screenshots/workout-mobile.png" width="300" alt="Active workout tracking" />
</p>

## Features

- Start workouts from templates or build your own
- Log sets with weight, reps, and RPE tracking
- Built-in rest timer with auto-start
- Exercise library with search
- Workout history stored as plain markdown files
- Works great on mobile

### Home

Browse templates, manage your exercise library, and see recent workouts at a glance.

![Home view](screenshots/home.png)

### Workout Tracking

Log sets with weight and reps. Previous session data is pre-filled so you can pick up where you left off.

![Active workout](screenshots/workout-active.png)

### Timers

Built-in rest timer with preset durations, and interval timer for timed exercises like planks.

<p align="center">
  <img src="screenshots/rest-timer.png" width="400" alt="Rest timer with preset durations" />
  <img src="screenshots/interval-timer-running.png" width="400" alt="Interval timer during work phase" />
</p>

### Settings

Configure workout and template folders, default weight unit, and rest timer presets.

![Settings](screenshots/settings.png)

## Installation

This fork is not published to Community Plugins; install it manually.

1. Build the plugin: `npm install && npm run build`
2. Create a folder `your-vault/.obsidian/plugins/obsidian-workouts/`
3. Copy `main.js`, `manifest.json`, and `styles.css` into that folder
4. Enable the plugin in Settings > Community Plugins
