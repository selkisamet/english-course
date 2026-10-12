package com.englishcourse.dev;

import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemThemePlugin.class);
        registerPlugin(AppSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Uygulama açıkken telefonun teması değişirse sayfaya bildir
        PluginHandle handle = getBridge().getPlugin("SystemTheme");
        if (handle != null) ((SystemThemePlugin) handle.getInstance()).notifyChanged();
    }
}
