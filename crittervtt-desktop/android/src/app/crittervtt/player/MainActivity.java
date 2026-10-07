package app.crittervtt.player;

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
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Critter VTT for players: the table at live.crittervtt.com, full screen. The page knows it runs here from
 * "?app=player" and "CritterPlayer" in the user agent, and then opens on "Join a table" instead of a GM's campaigns.
 * Everything else is the live site, so Critter VTT's updates arrive without a new app.
 */
public class MainActivity extends Activity {
    static final String HOST = "live.crittervtt.com";
    static final String HOME = "https://" + HOST + "/?app=player";
    // the address before the move: links to it still open here, and the first start moves what the app kept there
    static final String OLD_HOST = "critter.poly-chrome.cc";
    static boolean ours(Uri u) { return u != null && (HOST.equals(u.getHost()) || OLD_HOST.equals(u.getHost())); }
    static final int PICK = 41;

    WebView web;
    FrameLayout root;
    ValueCallback<Uri[]> picked;
    Updater updater;
    int navPx, topPx;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);   // the table stays visible while you play

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(11, 12, 15));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(11, 12, 15));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // the table runs edge to edge, under the status bar and the navigation bar (the gesture handle), which float over
        // it in its colours. The page keeps its own buttons clear of them from --sat and --sab; a notch at the side and the
        // keyboard still push the table in
        edgeToEdge();
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, nav, ime;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                l = i.left; t = i.top; r = i.right; nav = i.bottom;
                ime = insets.getInsets(WindowInsets.Type.ime()).bottom;
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop(); r = insets.getSystemWindowInsetRight();
                int b = insets.getSystemWindowInsetBottom(); nav = Math.min(b, insets.getStableInsetBottom()); ime = b > nav ? b : 0;
            }
            v.setPadding(l, 0, r, ime);
            topPx = t; navPx = ime > 0 ? 0 : nav;
            sendInsets();
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
        // the phone's font size (Settings › Display), up to 130% so the table's panels still hold their text
        s.setTextZoom(Math.max(100, Math.min(130, Math.round(getResources().getConfiguration().fontScale * 100))));
        s.setUserAgentString(s.getUserAgentString() + " CritterPlayer/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        web.addJavascriptInterface(new Bridge(), "CritterAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) { sendInsets(); moveStep(url); }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (ours(u)) return false;                     // the table stays here
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
        else if (!getSharedPreferences("move", MODE_PRIVATE).getBoolean("done", false)) moveStart();
        else web.loadUrl(startUrl(getIntent()));
        updater = new Updater(this);
    }

    // a newer version of the app on GitHub? (checked on opening and on coming back, every few hours at most)
    @Override
    protected void onResume() {
        super.onResume();
        if (updater != null) updater.check(false);
    }

    // what the page may tell the app: the table's colour, so the status and navigation bars match it (light or dark)
    class Bridge {
        @JavascriptInterface
        public void theme(String color, boolean light) {
            final int c;
            try { c = Color.parseColor(color); } catch (IllegalArgumentException e) { return; }
            runOnUiThread(() -> barsLike(c, light));
        }
        // moving from the old address (see moveStart)
        @JavascriptInterface
        public void moveOut(String json) { runOnUiThread(() -> MainActivity.this.moveOut(json == null ? "-" : json)); }
        @JavascriptInterface
        public String moveTake() { String d = moveData; return d == null ? "{}" : d; }
        @JavascriptInterface
        public void moveIn(boolean ok) { runOnUiThread(() -> moveEnd(ok)); }
        // the page's "Check for updates" (the Critter VTT menu and Help)
        @JavascriptInterface
        public void checkUpdate() { runOnUiThread(() -> { if (updater != null) updater.check(true); }); }
        @JavascriptInterface
        public String version() { return updater != null ? updater.myName() : ""; }
    }

    // how tall the navigation bar is, in the page's pixels, for its --sab (safe area at the bottom)
    void sendInsets() {
        if (web == null) return;
        float dp = getResources().getDisplayMetrics().density;
        web.evaluateJavascript("(function(s){s.setProperty('--sab','" + Math.round(navPx / dp) + "px');s.setProperty('--sat','" + Math.round(topPx / dp) + "px')})(document.documentElement.style)", null);
    }

    @SuppressWarnings("deprecation")
    void edgeToEdge() {
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 28) getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        if (Build.VERSION.SDK_INT >= 29) { getWindow().setNavigationBarContrastEnforced(false); getWindow().setStatusBarContrastEnforced(false); }
    }

    @SuppressWarnings("deprecation")
    void barsLike(int color, boolean light) {
        root.setBackgroundColor(color);   // behind the see-through bars (Android 15 draws apps under them)
        web.setBackgroundColor(color);
        getWindow().setStatusBarColor(Color.TRANSPARENT);       // the table shows through under the clock and icons
        getWindow().setNavigationBarColor(Color.TRANSPARENT);   // the table shows through under the gesture handle
        if (Build.VERSION.SDK_INT >= 30) {
            int f = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            getWindow().getInsetsController().setSystemBarsAppearance(light ? f : 0, f);
        } else {
            View d = getWindow().getDecorView(); int v = d.getSystemUiVisibility() | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
            int f = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            d.setSystemUiVisibility(light ? v | f : v & ~f);
        }
    }

    /* Critter VTT moved from critter.poly-chrome.cc to live.crittervtt.com. The app's name, seat, settings and Homebase
       identity were kept for the old address; on the first start after the update they move: the old address is opened
       without starting Critter VTT (?critter-export=1), hands everything over through the bridge, and the new address
       (opened the same way) takes it in. Only a finished move is remembered: anything else tries again next start. */
    int moveStage;   // 0 none, 1 reading the old address, 2 writing at the new one
    String moveData;
    void moveStart() {
        moveStage = 1;
        web.loadUrl("https://" + OLD_HOST + "/?app=player&critter-export=1");
        root.postDelayed(() -> { if (moveStage != 0) moveEnd(false); }, 15000);   // (never stuck on it)
    }
    void moveStep(String url) {
        Uri u = Uri.parse(url);
        if (moveStage == 1 && OLD_HOST.equals(u.getHost()))
            web.evaluateJavascript("window.critterExport ? critterExport().then(d => CritterAndroid.moveOut(JSON.stringify(d)), () => CritterAndroid.moveOut('-')) : CritterAndroid.moveOut('-')", null);
        else if (moveStage == 2 && HOST.equals(u.getHost()))
            web.evaluateJavascript("window.critterImport ? critterImport(JSON.parse(CritterAndroid.moveTake())).then(() => CritterAndroid.moveIn(true), () => CritterAndroid.moveIn(false)) : CritterAndroid.moveIn(false)", null);
    }
    void moveOut(String json) {
        if (moveStage != 1) return;
        if ("-".equals(json)) { moveEnd(false); return; }                      // the old address can't hand anything over yet
        // nothing kept there (a new install): nothing to move
        boolean any = json.contains("\"hb.uid\"") || json.contains("\"tt.");
        if (!any) { moveEnd(true); return; }
        moveData = json; moveStage = 2;
        web.loadUrl(HOME + "&critter-export=1");
    }
    void moveEnd(boolean done) {
        if (moveStage == 0) return;
        moveStage = 0; moveData = null;
        if (done) getSharedPreferences("move", MODE_PRIVATE).edit().putBoolean("done", true).apply();
        web.loadUrl(startUrl(getIntent()));
    }

    // an invite link (live.crittervtt.com/#K7QX2M, or the old address) opens its table; anything else opens the start
    String startUrl(Intent in) {
        Uri u = in == null ? null : in.getData();
        if (ours(u)) { String f = u.getFragment(); return HOME + (f != null && !f.isEmpty() ? "#" + f : ""); }
        return HOME;
    }

    @Override
    protected void onNewIntent(Intent in) {
        super.onNewIntent(in);
        if (in != null && in.getData() != null && moveStage == 0) web.loadUrl(startUrl(in));
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

    // back (the swipe from the edge, or the back button) goes back a step on the page: it closes what's open (a sheet,
    // a menu, a dialog) or goes to the previous start screen. With nothing to go back to, a first swipe only says so;
    // a second one within two seconds sends Critter VTT to the background (it stays at the table)
    long backAt;

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(window.critterBack && window.critterBack()) ? '1' : '0'", r -> {
            if (r != null && r.contains("1")) { backAt = 0; return; }
            long now = System.currentTimeMillis();
            if (now - backAt < 2000) { backAt = 0; moveTaskToBack(true); return; }
            backAt = now;
            android.widget.Toast.makeText(this, "Swipe back again to leave Critter VTT", android.widget.Toast.LENGTH_SHORT).show();
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
        if (updater != null) updater.stop();
        if (web != null) { web.stopLoading(); ((ViewGroup) web.getParent()).removeView(web); web.destroy(); }
        super.onDestroy();
    }
}
