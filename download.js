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

    function getAndroidMethods() {
        if (typeof Android === 'undefined') return [];
        var methods = [];
        for (var key in Android) {
            if (typeof Android[key] === 'function') {
                methods.push(key);
            }
        }
        return methods;
    }

    function showMenu() {
        var url = getVideoUrl();
        if (!url) {
            Lampa.Noty.show('URL not found. Start playing first!');
            return;
        }

        var title = getTitle();
        var methods = getAndroidMethods();

        Lampa.Select.show({
            title: 'Download: ' + title.substring(0, 25),
            items: [
                { title: 'Open with App', subtitle: 'Android app chooser', id: 'player' },
                { title: 'Open in Browser', subtitle: 'Browser download', id: 'browser' },
                { title: 'Copy URL', subtitle: 'Manual paste', id: 'copy' },
                { title: 'Show Android Methods', subtitle: 'Debug info', id: 'debug' }
            ],
            onSelect: function (item) {
                Lampa.Select.close();

                if (item.id === 'player') {
                    if (typeof Android !== 'undefined') {
                        if (Android.openPlayer) {
                            Android.openPlayer(url, JSON.stringify({ title: title }));
                            Lampa.Noty.show('Opening player...');
                        } else if (Android.openExternalPlayer) {
                            Android.openExternalPlayer(url);
                            Lampa.Noty.show('Opening external player...');
                        } else if (Android.shareText) {
                            Android.shareText(url);
                            Lampa.Noty.show('Sharing...');
                        } else if (Android.share) {
                            Android.share(url);
                            Lampa.Noty.show('Sharing...');
                        } else {
                            copyToClipboard(url);
                            Lampa.Noty.show('No player method. URL copied!');
                        }
                    } else {
                        copyToClipboard(url);
                        Lampa.Noty.show('Android not available. URL copied!');
                    }
                } else if (item.id === 'browser') {
                    if (typeof Android !== 'undefined' && Android.openBrowser) {
                        Android.openBrowser(url);
                    } else {
                        window.open(url, '_blank');
                    }
                } else if (item.id === 'copy') {
                    copyToClipboard(url);
                    Lampa.Noty.show('URL copied!');
                } else if (item.id === 'debug') {
                    if (methods.length > 0) {
                        Lampa.Noty.show('Methods: ' + methods.slice(0, 10).join(', '));
                        console.log('All Android methods:', methods);
                    } else {
                        Lampa.Noty.show('No Android methods found');
                    }
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
