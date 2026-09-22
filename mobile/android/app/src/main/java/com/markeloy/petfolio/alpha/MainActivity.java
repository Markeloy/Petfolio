package com.markeloy.petfolio.alpha;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(state);
        if (bridge == null) return;
        // Modal first, then real WebView/Next history, then background the task.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                bridge.getWebView().evaluateJavascript(
                    "(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}return false;})()",
                    closed -> {
                        if ("true".equals(closed)) return;
                        String url = bridge.getWebView().getUrl();
                        android.net.Uri uri = url == null ? null : android.net.Uri.parse(url);
                        String path = uri == null ? "/" : uri.getPath();
                        if ("/".equals(path) || "/login".equals(path)) moveTaskToBack(true);
                        else if (bridge.getWebView().canGoBack()) bridge.getWebView().goBack();
                        else moveTaskToBack(true);
                    }
                );
            }
        });
    }
}
