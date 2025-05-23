# Vibestage Electron Overlay

## Project Overview

This project is an Electron-based desktop application that creates a transparent overlay on top of all your screens, displaying large animated emojis at random positions. The overlay is always on top and click-through, allowing you to interact with your desktop and other applications while the emoji animation runs.

---

## Inspiration

This project is inspired by [Vibestage](https://github.com/aemal/vibestage), which is a web-based interactive emoji wall platform developed as part of the Vibe Coding 101 Crash Course by Aemal Sayer ([aemalsayer.com](https://aemalsayer.com)).

- **Original Vibestage**: A web app for real-time, interactive emoji walls at events, with mobile controller and real-time sync.
- **This Project**: A desktop overlay app that runs natively on your computer, showing animated emojis on top of all screens, independent of browsers or web servers.

You can access the free crash course here: [Vibe Coding 101 Crash Course on YouTube](https://www.youtube.com/playlist?list=PLWYu7XaUG3XPeekTEk_dJC-T6Q4qPudvj)

---

## Core Features

- Transparent, always-on-top overlay across all screens
- Click-through: does not block interaction with other apps
- Large emoji displayed at random positions every 2 seconds
- Runs as a native desktop app (Electron)

---

## Getting Started

### Prerequisites
- Node.js 18.0 or later
- npm (or yarn, pnpm, bun)

### Installation
```bash
# Clone the repository
# (replace <repo-url> with your actual repo URL)
git clone <repo-url>
cd vibestage-electron

# Install dependencies
npm install

# Start the app
npm start
```

---

## Project Structure
```
vibestage-electron/
├── main.js         # Electron main process (window, overlay logic)
├── index.html      # Overlay UI (emoji display)
├── renderer.js     # (Optional) Emoji animation logic
├── .gitignore      # Git ignore rules
├── LICENSE         # MIT License
└── ...             # Other config files
```

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---

## Credits
- Inspired by [Vibestage](https://github.com/aemal/vibestage) by Aemal Sayer
- Part of the [Vibe Coding 101 Crash Course](https://www.youtube.com/playlist?list=PLWYu7XaUG3XPeekTEk_dJC-T6Q4qPudvj)
- Created by Aemal Sayer ([aemalsayer.com](https://aemalsayer.com)) 