package app.critboard.player;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Critter VTT for players: the table at critter.poly-chrome.cc, full screen. The page knows it runs here from
 * "?app=player" and "CritterPlayer" in the user agent, and then opens on "Join a table" instead of a GM's campaigns.
 * Everything else is the live site, so Critter VTT's updates arrive without a new app.
 */
public class MainActivity extends Activity {
    static final String HOST = "critter.poly-chrome.cc";
    static final String HOME = "https://" + HOST + "/?app=player";
    static final int PICK = 41;

    WebView web;
    ValueCallback<Uri[]> picked;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // the table stays visible while you play

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(11, 12, 15));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(11, 12, 15));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Android 15 draws apps under the status and navigation bars: keep the table clear of them (and of the keyboard)
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                l = i.left; t = i.top; r = i.right; b = i.bottom;
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop(); r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, b);
            return insets;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // the table's music and dice sounds
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);                             // (Critter VTT has its own text size settings)
        s.setUserAgentString(s.getUserAgentString() + " CritterPlayer/1.0");
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;   // the table stays here
                open(u);                                       // everything else (GitHub, credits, help) in the browser
                return true;
            }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) offline();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            // choosing a picture (a portrait, a handout) from the phone
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (picked != null) picked.onReceiveValue(null);
                picked = cb;
                try { startActivityForResult(params.createIntent(), PICK); }
                catch (ActivityNotFoundException e) { picked = null; return false; }
                return true;
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> { if (url.startsWith("http")) open(Uri.parse(url)); });

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(startUrl(getIntent()));
    }

    // an invite link (critter.poly-chrome.cc/#K7QX2M) opens its table; anything else opens the start
    String startUrl(Intent in) {
        Uri u = in == null ? null : in.getData();
        if (u != null && HOST.equals(u.getHost())) { String f = u.getFragment(); return HOME + (f != null && !f.isEmpty() ? "#" + f : ""); }
        return HOME;
    }

    @Override
    protected void onNewIntent(Intent in) {
        super.onNewIntent(in);
        if (in != null && in.getData() != null) web.loadUrl(startUrl(in));
    }

    void open(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
    }

    void offline() {
        String html = "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
            + "<body style='margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c0f;color:#eee;font:16px system-ui,sans-serif;text-align:center'>"
            + "<div style='padding:24px'><h1 style='font-size:22px'>Can't reach the table</h1>"
            + "<p style='color:#bbb;line-height:1.5'>Critter VTT needs the internet. Check your connection and try again.</p>"
            + "<a href='" + HOME + "' style='display:inline-block;margin-top:12px;padding:12px 22px;border-radius:10px;background:#ff5c00;color:#141006;font-weight:700;text-decoration:none'>Try again</a></div></body>";
        web.loadDataWithBaseURL(HOME, html, "text/html", "utf-8", null);
    }

    // back: the page closes what's open (a sheet, a menu, a dialog) first; with nothing open, Critter VTT goes to the
    // background and stays at the table
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(window.critterBack && window.critterBack()) ? '1' : '0'", r -> {
            if (r != null && r.contains("1")) return;
            if (web.canGoBack()) { web.goBack(); return; }
            moveTaskToBack(true);
        });
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK && picked != null) {
            picked.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            picked = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.stopLoading(); ((ViewGroup) web.getParent()).removeView(web); web.destroy(); }
        super.onDestroy();
    }
}
