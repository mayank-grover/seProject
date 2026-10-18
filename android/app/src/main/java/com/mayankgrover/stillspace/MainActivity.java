package com.mayankgrover.stillspace;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Offline app shell. Only bundled assets may execute inside the WebView. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int EXPORT_DOCUMENT = 41;
    private WebView webView;
    private FrameLayout root;
    private byte[] pendingExport;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        root = new FrameLayout(this);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.addJavascriptInterface(new ExportBridge(), "StillspaceAndroid");
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if ("https".equals(request.getUrl().getScheme()) && HOST.equals(request.getUrl().getHost())) {
                    WebResourceResponse response = loader.shouldInterceptRequest(request.getUrl());
                    if (response != null) return response;
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null,
                    new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) return false;
                return true;
            }
        });
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
            root.requestApplyInsets();
        }
        updateSystemAppearance();
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
        webView.loadUrl("https://" + HOST + "/index.html");
    }

    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        updateSystemAppearance();
        boolean dark = (configuration.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        webView.evaluateJavascript("window.stillspaceSystemTheme && window.stillspaceSystemTheme(" + dark + ")", null);
    }

    private void updateSystemAppearance() {
        boolean dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        setAppearanceColors(dark);
    }

    private void setAppearanceColors(boolean dark) {
        int background = Color.parseColor(dark ? "#161C18" : "#F4F5F0");
        webView.setBackgroundColor(background);
        root.setBackgroundColor(background);
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().getInsetsController().setSystemBarsAppearance(dark ? 0 : android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS, android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        } else {
            webView.setSystemUiVisibility(dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }

    @Override public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        webView.evaluateJavascript("window.stillspaceBack ? window.stillspaceBack() : false", result -> {
            if (!"true".equals(result)) finish();
        });
    }

    private final class ExportBridge {
        @JavascriptInterface public boolean isDark() {
            return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        }
        @JavascriptInterface public void setAppearance(boolean dark) {
            runOnUiThread(() -> setAppearanceColors(dark));
        }
        @JavascriptInterface public void saveExport(String name, String contents, String mime) {
            if (contents == null || contents.length() > 5_000_000) return;
            if (!"application/json".equals(mime) && !"text/csv".equals(mime)) return;
            final String filename = "text/csv".equals(mime) ? "stillspace-events.csv" : "stillspace-timetable.json";
            runOnUiThread(() -> {
                if (pendingExport != null) return;
                pendingExport = contents.getBytes(StandardCharsets.UTF_8);
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mime);
                intent.putExtra(Intent.EXTRA_TITLE, filename);
                try { startActivityForResult(intent, EXPORT_DOCUMENT); }
                catch (android.content.ActivityNotFoundException exception) {
                    pendingExport = null;
                    Toast.makeText(MainActivity.this, "No document picker is available.", Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent result) {
        super.onActivityResult(requestCode, resultCode, result);
        if (requestCode != EXPORT_DOCUMENT) return;
        byte[] bytes = pendingExport;
        pendingExport = null;
        if (resultCode != RESULT_OK || result == null || result.getData() == null || bytes == null) return;
        try (OutputStream stream = getContentResolver().openOutputStream(result.getData())) {
            if (stream == null) throw new java.io.IOException("No output stream");
            stream.write(bytes);
            Toast.makeText(this, "Export saved", Toast.LENGTH_SHORT).show();
        } catch (java.io.IOException exception) {
            Toast.makeText(this, "Could not save export. Please try again.", Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onDestroy() {
        webView.removeJavascriptInterface("StillspaceAndroid");
        webView.destroy();
        super.onDestroy();
    }
}
