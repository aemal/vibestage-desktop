const macosWindow = require('./build/Release/macos_window.node');

class MacOSWindow {
    constructor(windowHandle) {
        this.windowHandle = windowHandle;
    }

    setWindowLevel() {
        macosWindow.MacOSWindow.prototype.setWindowLevel(this.windowHandle);
    }

    setCollectionBehavior() {
        macosWindow.MacOSWindow.prototype.setCollectionBehavior(this.windowHandle);
    }
}

module.exports = MacOSWindow; 