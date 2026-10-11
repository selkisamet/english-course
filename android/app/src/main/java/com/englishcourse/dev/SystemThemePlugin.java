package com.englishcourse.dev;

import android.content.res.Configuration;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Telefonun açık / karanlık temasını sayfaya bildirir. Android'in uygulama içi tarayıcısı
 * (Android 13+ hedefinde) prefers-color-scheme'i güvenilir şekilde iletmediği için gerekli.
 */
@CapacitorPlugin(name = "SystemTheme")
public class SystemThemePlugin extends Plugin {

    private boolean isDark() {
        int mode = getContext().getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    private JSObject state() {
        JSObject result = new JSObject();
        result.put("dark", isDark());
        return result;
    }

    @PluginMethod
    public void get(PluginCall call) {
        call.resolve(state());
    }

    /** Tema değişince (MainActivity.onConfigurationChanged) dinleyicilere haber verir */
    void notifyChanged() {
        notifyListeners("change", state());
    }
}
