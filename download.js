(function () {
    'use strict';

    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            return true;
        }
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
    }

    function getVideoUrl() {
        try {
            var pd = Lampa.Player.playdata();
            if (pd && pd.url && pd.url.indexOf('http') === 0) return pd.url;
        } catch (e) {}
        try {
            var v = document.querySelector('video');
            if (v && v.src && v.src.indexOf('blob:') !== 0) return v.src;
        } catch (e) {}
        return null;
    }

    function getTitle() {
        var el = document.querySelector('.player-info__name');
        if (el) return el.textContent.trim();
        try {
            var a = Lampa.Activity.active();
            if (a && a.card) return a.card.title || a.card.name || 'video';
        } catch (e) {}
        return 'video';
    }

    function getAndroidBridge() {
        if (typeof Android !== 'undefined') return { name: 'Android', obj: Android };
        if (typeof window.Android !== 'undefined') return { name: 'window.Android', obj: window.Android };
        if (typeof AndroidApp !== 'undefined') return { name: 'AndroidApp', obj: AndroidApp };
        return null;
    }

    function showMenu() {
        var url = getVideoUrl();
        if (!url) {
            Lampa.Noty.show('URL not found. Start playing first!');
            return;
        }

        var title = getTitle();
        var bridge = getAndroidBridge();
        var platform = Lampa.Platform ? Lampa.Platform.get() : 'unknown';

        Lampa.Select.show({
            title: 'Download: ' + title.substring(0, 25),
            items: [
                { title: 'Open with App', subtitle: 'External player', id: 'player' },
                { title: 'Open in Browser', subtitle: 'Browser', id: 'browser' },
                { title: 'Copy URL', subtitle: 'Manual paste', id: 'copy' },
                { title: 'Debug Info', subtitle: 'Platform: ' + platform, id: 'debug' }
            ],
            onSelect: function (item) {
                Lampa.Select.close();

                if (item.id === 'player') {
                    if (bridge && bridge.obj.openPlayer) {
                        bridge.obj.openPlayer(url, JSON.stringify({ title: title }));
                        Lampa.Noty.show('Opening player...');
                    } else {
                        copyToClipboard(url);
                        Lampa.Noty.show('No Android bridge. URL copied!');
                    }
                } else if (item.id === 'browser') {
                    if (bridge && bridge.obj.openBrowser) {
                        bridge.obj.openBrowser(url);
                    } else {
                        window.open(url, '_blank');
                    }
                } else if (item.id === 'copy') {
                    copyToClipboard(url);
                    Lampa.Noty.show('URL copied!');
                } else if (item.id === 'debug') {
                    var info = 'Platform: ' + platform + ', Bridge: ' + (bridge ? bridge.name : 'none');
                    Lampa.Noty.show(info);
                }
            },
            onBack: function () {
                Lampa.Controller.toggle('player');
            }
        });
    }

    function addButton() {
        if (document.querySelector('.dlhelper-btn')) return;
        var panel = document.querySelector('.player-panel__right');
        if (!panel) return;

        var btn = document.createElement('div');
        btn.className = 'player-panel__item selector dlhelper-btn';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:1.5em;height:1.5em;"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
        btn.addEventListener('click', showMenu);
        $(btn).on('hover:enter', showMenu);

        var settings = panel.querySelector('.player-panel__settings');
        if (settings) panel.insertBefore(btn, settings);
        else panel.appendChild(btn);
    }

    function startPlugin() {
        window.lampa_download_helper = true;

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') setTimeout(addButton, 500);
        });

        if (Lampa.Player && Lampa.Player.listener) {
            Lampa.Player.listener.follow('start', function () {
                setTimeout(addButton, 500);
            });
        }
    }

    if (!window.lampa_download_helper) startPlugin();
})();
