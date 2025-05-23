#include <napi.h>
#import <Cocoa/Cocoa.h>

class MacOSWindow : public Napi::ObjectWrap<MacOSWindow> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    MacOSWindow(const Napi::CallbackInfo& info);

private:
    static Napi::FunctionReference constructor;
    Napi::Value SetWindowLevel(const Napi::CallbackInfo& info);
    Napi::Value SetCollectionBehavior(const Napi::CallbackInfo& info);
};

Napi::FunctionReference MacOSWindow::constructor;

Napi::Object MacOSWindow::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "MacOSWindow", {
        InstanceMethod("setWindowLevel", &MacOSWindow::SetWindowLevel),
        InstanceMethod("setCollectionBehavior", &MacOSWindow::SetCollectionBehavior),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("MacOSWindow", func);
    return exports;
}

MacOSWindow::MacOSWindow(const Napi::CallbackInfo& info) : Napi::ObjectWrap<MacOSWindow>(info) {
    // Constructor implementation
}

Napi::Value MacOSWindow::SetWindowLevel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Number windowHandle = info[0].As<Napi::Number>();
    NSWindow* window = (__bridge NSWindow*)(void*)(uintptr_t)windowHandle.Int64Value();
    
    // Set window level to floating
    [window setLevel:NSFloatingWindowLevel];
    
    return env.Null();
}

Napi::Value MacOSWindow::SetCollectionBehavior(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Number windowHandle = info[0].As<Napi::Number>();
    NSWindow* window = (__bridge NSWindow*)(void*)(uintptr_t)windowHandle.Int64Value();
    
    // Set collection behavior to join all spaces and be transient
    NSWindowCollectionBehavior behavior = NSWindowCollectionBehaviorCanJoinAllSpaces | 
                                        NSWindowCollectionBehaviorTransient |
                                        NSWindowCollectionBehaviorIgnoresCycle;
    [window setCollectionBehavior:behavior];
    
    return env.Null();
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return MacOSWindow::Init(env, exports);
}

NODE_API_MODULE(macos_window, InitAll) 