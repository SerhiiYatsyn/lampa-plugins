(function () {
    'use strict';

    /* ========================================
     * LAMPA DOWNLOAD HELPER v1.0.0
     * Share videos to Seal / YTDLnis / ADM
     * ======================================== */

    var CONFIG = {
        apps: [
            { id: 'seal', name: 'Seal', package: 'com.junkfood.seal', description: 'Material You design' },
            { id: 'ytdlnis', name: 'YTDLnis', package: 'com.deniscerri.ytdlnis', description: 'Advanced features' },
            { id: 'adm', name: 'ADM', package: 'com.dv.adm', description: 'Multi-threaded' },
            { id: '1dm', name: '1DM', package: 'idm.internet.download.manager', description: 'Fast downloads' }
        ]
    };

    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
    }

    function getVideoUrl() {
        try {
            var pd = Lampa.Player.playdata();
            if (pd && pd.url && typeof pd.url === 'string' && pd.url.indexOf('http') === 0) {
                return pd.url;
            }
        } catch (e) {}

        try {
            var video = document.querySelector('video');
            if (video && video.src && video.src.indexOf('blob:') !== 0) {
                return video.src;
            }
        } catch (e) {}

        return null;
    }

    function getTitle() {
        var el = document.querySelector('.player-info__name');
        if (el && el.textContent) return el.textContent.trim();

        try {
            var a = Lampa.Activity.active();
            if (a && a.card) return a.card.title || a.card.name || 'video';
        } catch (e) {}

        return 'video';
    }

    function shareToApp(url, pkg) {
        var intent = 'intent://#Intent;' +
            'action=android.intent.action.SEND;' +
            'type=text/plain;' +
            'S.android.intent.extra.TEXT=' + encodeURIComponent(url) + ';' +
            'package=' + pkg + ';' +
            'S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=' + pkg) + ';' +
            'end';
        window.location.href = intent;
    }

    function showMenu() {
        var url = getVideoUrl();

        if (!url) {
            Lampa.Noty.show('URL not found');
            return;
        }

        var title = getTitle();
        var items = [];

        CONFIG.apps.forEach(function (app) {
            items.push({
                title: app.name,
                subtitle: app.description,
                app: app
            });
        });

        items.push({ title: 'Copy URL', subtitle: 'To clipboard', id: 'copy' });
        items.push({ title: 'Open Browser', subtitle: 'External', id: 'browser' });

        Lampa.Select.show({
            title: 'Download: ' + title.substring(0, 30),
            items: items,
            onSelect: function (item) {
                Lampa.Select.close();

                if (item.app) {
                    shareToApp(url, item.app.package);
                    Lampa.Noty.show('Opening ' + item.app.name + '...');
                } else if (item.id === 'copy') {
                    copyToClipboard(url);
                    Lampa.Noty.show('URL copied!');
                } else if (item.id === 'browser') {
                    window.open(url, '_blank');
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
        if (settings) {
            panel.insertBefore(btn, settings);
        } else {
            panel.appendChild(btn);
        }
    }

    function startPlugin() {
        window.lampa_download_helper = true;

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                setTimeout(addButton, 500);
            }
        });

        if (Lampa.Player && Lampa.Player.listener) {
            Lampa.Player.listener.follow('start', function () {
                setTimeout(addButton, 500);
            });
        }

        Lampa.Noty.show('Download Helper loaded');
    }

    if (!window.lampa_download_helper) startPlugin();

})();
